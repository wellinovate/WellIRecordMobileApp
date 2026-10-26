// Provider verification, read-only side. The application, reviewer queue, approvals, restrictions, complaints, document storage
// and the expiry job live in the website backend (wellinovate/WelliRecord, modules/provider-verification). This server only asks
// "is this clinician eligible?" by reading the same pv_ collections, and writes audit rows for gate decisions and record access.
//
// Keep providerVerificationCore.ts and providerVerificationModels.ts in step with the website copies.

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { evaluateEligibility, auditProblem, type Eligibility, type ProviderSnapshot } from './providerVerificationCore';
import { PvPermission, PvProvider, PvRestriction, auditModelFor } from './providerVerificationModels';

export interface GateDeps {
  now?: () => Date;
}

export interface GateContext {
  purpose?: string;
  patientRef?: string;
  facilityId?: string;
}

/** Enforcement is on unless PROVIDER_VERIFICATION_ENFORCE=false. The off switch exists for an emergency and is logged at boot. */
export const enforcementOn = () => String(process.env.PROVIDER_VERIFICATION_ENFORCE ?? 'true').toLowerCase() !== 'false';

const isId = (v: unknown) => mongoose.isValidObjectId(String(v ?? ''));

export function createProviderGate(deps: GateDeps = {}) {
  const now = () => (deps.now ? deps.now() : new Date());
  const db = () => mongoose.connection.readyState === 1;
  const fail = (res: Response, status: number, message: string, code?: string) => res.status(status).json({ success: false, message, ...(code ? { code } : {}) });


  /** Writes one audit row. Throws if it cannot, so a state change is never reported as done without its audit row. */
  async function audit(a: { actorId: string; actorType: 'staff' | 'provider' | 'patient' | 'system'; action: string; subjectType: string; subjectId: string; purpose?: string; lawfulBasis?: string; detail?: Record<string, unknown> }, requiresBasis = false) {
    const problem = auditProblem(a, requiresBasis);
    if (problem) throw new Error(problem);
    await auditModelFor().create({ ...a, timestamp: now() });
  }
  const auditSafe = async (...args: Parameters<typeof audit>) => {
    try { await audit(...args); } catch (err) { console.error('[VERIFY] audit write failed:', err); }
  };

  // ----- the gate -----

  async function snapshot(p: any): Promise<ProviderSnapshot> {
    const [perms, restr] = await Promise.all([
      PvPermission.find({ providerId: String(p._id), revokedAt: { $exists: false } }).lean(),
      PvRestriction.find({ providerId: String(p._id), state: 'active', liftedAt: { $exists: false } }).lean(),
    ]);
    return {
      id: String(p._id), category: p.category, specialtyTier: p.specialtyTier, status: p.status,
      registrationLevel: p.registrationLevel ?? null, licenceExpiry: p.licenceExpiry ?? null,
      grantedFunctions: (perms as any[]).map((x) => x.function), restrictions: (restr as any[]).map((x) => ({ scope: x.scope })),
    };
  }

  /**
   * The one eligibility check. Every clinical path calls this. It fails closed: an error, a missing record or a database that is
   * not connected all mean "not eligible". Denials, and every consultation start, are written to the audit log.
   */
  async function canPerform(ref: { staffUserId?: string; providerId?: string }, action: string, ctx: GateContext = {}): Promise<Eligibility & { providerId?: string }> {
    if (!enforcementOn()) return { eligible: true, reason: 'ok' };
    let result: Eligibility & { providerId?: string } = { eligible: false, reason: 'error' };
    try {
      if (!db()) throw new Error('database not connected');
      const p: any = ref.providerId && isId(ref.providerId)
        ? await PvProvider.findById(ref.providerId)
        : ref.staffUserId ? await PvProvider.findOne({ $or: [{ staffUserId: String(ref.staffUserId) }, { linkedStaffIds: String(ref.staffUserId) }] }) : null;
      result = p ? { ...evaluateEligibility(await snapshot(p), action, now()), providerId: String(p._id) } : { eligible: false, reason: 'no_provider' };
    } catch (err) {
      console.error('[VERIFY] gate error (treated as not eligible):', err);
      result = { eligible: false, reason: 'error' };
    }
    if (action !== 'appear_in_search' && (!result.eligible || action === 'start_consultation')) {
      await auditSafe({
        actorId: String(ref.staffUserId ?? ref.providerId ?? 'unknown'), actorType: 'system', action: 'gate_decision', subjectType: 'provider',
        subjectId: String(result.providerId ?? ref.providerId ?? ref.staffUserId ?? 'unknown'),
        detail: { action, eligible: result.eligible, reason: result.reason, ...(ctx.facilityId ? { facilityId: ctx.facilityId } : {}) },
      });
    }
    return result;
  }

  /** Express guard form of the gate for a signed-in clinician. Sends 403 and returns false when not eligible. */
  async function gateStaff(req: Request, res: Response, action: string, ctx: GateContext = {}): Promise<boolean> {
    const s = req.staff;
    if (!s) { fail(res, 401, 'Staff sign-in required.'); return false; }
    const r = await canPerform({ staffUserId: s.id }, action, ctx);
    if (r.eligible) return true;
    fail(res, 403, 'Your provider verification does not allow this. Check your status under Provider verification.', 'not_verified');
    return false;
  }

  /** A facility can take bookings when it has no assigned clinicians to check, or at least one of them is eligible. */
  async function facilityEligible(staffIds: string[], facilityId?: string): Promise<boolean> {
    if (!enforcementOn()) return true;
    if (!staffIds.length) return true; // no individual clinician is linked, so there is nothing to check here (see CLAUDE.md)
    for (const id of staffIds) {
      if ((await canPerform({ staffUserId: id }, 'book_consultation', { facilityId })).eligible) return true;
    }
    return false;
  }

  /** Records that a provider opened a patient record: who, when, why, and on what lawful basis or consent reference. */
  async function auditRecordAccess(a: { staffUserId: string; patientRef: string; purpose: string; lawfulBasis: string; consentRef?: string }) {
    await audit({
      actorId: a.staffUserId, actorType: 'staff', action: 'record_access', subjectType: 'patient', subjectId: a.patientRef,
      purpose: a.purpose, lawfulBasis: a.lawfulBasis, detail: a.consentRef ? { consentRef: a.consentRef } : undefined,
    }, true);
  }

  /** Filters search results: an individual practitioner shows up only when their linked provider record is eligible. */
  async function eligibleOrgIds(orgIds: string[]): Promise<Set<string>> {
    const out = new Set<string>();
    if (!enforcementOn()) return new Set(orgIds);
    if (!orgIds.length || !db()) return out;
    try {
      const ps: any[] = await PvProvider.find({ organizationId: { $in: orgIds } });
      for (const p of ps) {
        if (evaluateEligibility(await snapshot(p), 'appear_in_search', now()).eligible) out.add(String(p.organizationId));
      }
    } catch (err) {
      console.error('[VERIFY] search filter error (hiding practitioners):', err);
    }
    return out;
  }

  return { canPerform, gateStaff, facilityEligible, auditRecordAccess, eligibleOrgIds };
}

export type ProviderGate = ReturnType<typeof createProviderGate>;
