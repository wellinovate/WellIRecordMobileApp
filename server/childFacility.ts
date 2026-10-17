// Facility data flow for a child's record.
//
// A clinic can read a child's record and add verified entries only with the
// guardian's consent, given as a short-lived code the guardian creates in the
// app and reads out at the visit. The clinic uses its own staff sign-in
// (see staff.ts). Everything the clinic does is written to the child's access
// log under the staff member's name, and the guardian is notified of writes.
//
//   Guardian (app token, manageGuardians):
//     POST   /family/:id/facility-codes          { hours }   -> { code, expiresAt }   (code shown once)
//     GET    /family/:id/facility-codes                      -> active and recent grants with who used them
//     DELETE /family/:id/facility-codes/:gid                 -> revoke
//   Clinic (staff token, clinician or records officer):
//     POST   /facility/child/lookup        { wrId, code }
//     POST   /facility/child/vaccinations  { wrId, code, vaccineCode, administeredDate, ... }
//     POST   /facility/child/growth        { wrId, code, measuredOn, weightKg, lengthCm, headCircumferenceCm, notes }

import crypto from 'crypto';
import express, { Request, RequestHandler, Response } from 'express';
import mongoose from 'mongoose';
import { ChildFacilityGrant, ChildGrowth, ChildVaccination, FamilyMember, StaffRole } from './models';
import { auditChild, resolveChildAccess } from './childAccess';
import { IMMUNIZATION_SCHEDULE, scheduleDoseByCode } from './data/immunizationSchedule';
import { childToFhirBundle } from './fhir';

export const DEFAULT_HOURS = 24;
export const MAX_HOURS = 72;
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newFacilityCode(len = 8): string {
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return out;
}

export const hashCode = (secret: string, code: string) =>
  crypto.createHmac('sha256', secret).update(`facility:${String(code).toUpperCase().replace(/[^A-Z0-9]/g, '')}`).digest('hex');

export const normaliseWrId = (v: unknown) => String(v ?? '').trim().toUpperCase().replace(/\s+/g, '');

export function clampHours(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_HOURS;
  return Math.min(Math.round(n), MAX_HOURS);
}

export function grantState(g: { expiresAt: Date; revokedAt?: Date | null }, now = new Date()): 'active' | 'expired' | 'revoked' {
  if (g.revokedAt) return 'revoked';
  return g.expiresAt.getTime() > now.getTime() ? 'active' : 'expired';
}

const cleanText = (v: unknown, max: number) => {
  const t = String(v ?? '').trim().slice(0, max);
  return t || undefined;
};
const isoDate = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : undefined);
const num = (v: unknown, min: number, max: number) => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};

export interface FacilityDeps {
  getAuthUserId: (req: Request) => string | null;
  requireStaff: (...roles: StaffRole[]) => RequestHandler;
  limiter: RequestHandler;
  codeSecret: string;
  notify: (userId: string, title: string, body: string) => Promise<void>;
}

export function createChildFacilityRouter(deps: FacilityDeps) {
  const router = express.Router();
  const clinic = deps.requireStaff('clinician', 'records_officer');

  // ----- guardian side -----
  async function guardianAccess(req: Request, res: Response) {
    const actorId = deps.getAuthUserId(req);
    if (!actorId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return null;
    }
    const a = await resolveChildAccess(actorId, req.params.id);
    if (!a) {
      res.status(404).json({ success: false, message: 'Family member not found' });
      return null;
    }
    if (!a.perms.manageGuardians) {
      res.status(a.locked ? 423 : 403).json({
        success: false,
        message: a.locked ? 'Changes are locked on this profile' : 'You cannot give a clinic access to this profile',
      });
      return null;
    }
    return a;
  }

  const grantPayload = (g: any) => ({
    id: String(g._id),
    state: grantState(g),
    expiresAt: g.expiresAt,
    createdAt: g.createdAt,
    createdByName: g.createdByName,
    uses: (g.uses || []).map((u: any) => ({ staffName: u.staffName, organization: u.organization || '', action: u.action, at: u.at })),
  });

  router.post('/family/:id/facility-codes', deps.limiter, async (req: Request, res: Response) => {
    try {
      const a = await guardianAccess(req, res);
      if (!a) return;
      const code = newFacilityCode();
      const hours = clampHours(req.body?.hours);
      const g: any = await ChildFacilityGrant.create({
        childId: a.member._id,
        codeHash: hashCode(deps.codeSecret, code),
        createdBy: a.actorId,
        createdByName: String(a.member.fullName || a.member.name || 'Guardian'),
        expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
        uses: [],
      });
      await auditChild(a.member._id, a.actorId, a.role, 'facility_code_created', `valid ${hours} hours`);
      return res.status(201).json({ success: true, code, grant: grantPayload(g) });
    } catch (err) {
      console.error('[POST /family/:id/facility-codes] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not create the code' });
    }
  });

  router.get('/family/:id/facility-codes', async (req: Request, res: Response) => {
    try {
      const a = await guardianAccess(req, res);
      if (!a) return;
      const grants = await ChildFacilityGrant.find({ childId: a.member._id }).sort({ createdAt: -1 }).limit(20);
      return res.json({ success: true, grants: grants.map(grantPayload) });
    } catch (err) {
      console.error('[GET /family/:id/facility-codes] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not load clinic access' });
    }
  });

  router.delete('/family/:id/facility-codes/:gid', async (req: Request, res: Response) => {
    try {
      const a = await guardianAccess(req, res);
      if (!a) return;
      if (!mongoose.isValidObjectId(req.params.gid)) return res.status(400).json({ success: false, message: 'Invalid code' });
      const g: any = await ChildFacilityGrant.findOneAndUpdate(
        { _id: req.params.gid, childId: a.member._id, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } },
        { new: true }
      );
      if (!g) return res.status(404).json({ success: false, message: 'Code not found' });
      await auditChild(a.member._id, a.actorId, a.role, 'facility_code_revoked');
      return res.json({ success: true, grant: grantPayload(g) });
    } catch (err) {
      console.error('[DELETE /family/:id/facility-codes/:gid] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not revoke the code' });
    }
  });

  // ----- clinic side -----
  // Finds the child and checks the consent code. Sends the error itself and returns null on failure.
  async function openGrant(req: Request, res: Response) {
    const wrId = normaliseWrId(req.body?.wrId);
    const code = String(req.body?.code ?? '');
    const fail = (status: number, message: string) => {
      res.status(status).json({ success: false, message });
      return null;
    };
    if (!wrId || code.replace(/[^A-Za-z0-9]/g, '').length < 8) return fail(400, 'Enter the WelliID and the 8 character code the parent gives you');
    const member: any = await FamilyMember.findOne({ wrId });
    // Same answer for "no such child" and "wrong code" so WelliIDs cannot be probed.
    const bad = () => fail(403, 'That code is not valid for this child. Ask the parent for a new one.');
    if (!member) return bad();
    const grant: any = await ChildFacilityGrant.findOne({ childId: member._id, codeHash: hashCode(deps.codeSecret, code) });
    if (!grant || grantState(grant) !== 'active') return bad();
    if (member.custodyLock?.active) return fail(423, 'This profile is locked. Staff must review it before a clinic can use it.');
    return { member, grant };
  }

  async function recordUse(grant: any, req: Request, action: string) {
    const s = req.staff!;
    await ChildFacilityGrant.updateOne(
      { _id: grant._id },
      { $push: { uses: { $each: [{ staffId: s.id, staffName: s.name, organization: s.organization, action, at: new Date() }], $slice: -50 } } }
    );
  }
  const who = (req: Request) => `${req.staff!.name}${req.staff!.organization ? `, ${req.staff!.organization}` : ''}`;

  router.post('/facility/child/lookup', deps.limiter, clinic, async (req: Request, res: Response) => {
    try {
      const opened = await openGrant(req, res);
      if (!opened) return;
      const { member, grant } = opened;
      const [vaccinations, growth] = await Promise.all([
        ChildVaccination.find({ memberId: member._id }).sort({ administeredDate: 1 }),
        ChildGrowth.find({ memberId: member._id }).sort({ measuredOn: -1 }),
      ]);
      await recordUse(grant, req, 'viewed');
      await auditChild(member._id, `staff:${req.staff!.id}`, 'admin', 'facility_viewed', who(req), 30, who(req));
      const child = {
        id: String(member._id),
        wrId: member.wrId,
        fullName: member.fullName || member.name,
        dateOfBirth: member.dateOfBirth || (member.dob ? String(member.dob).split('T')[0] : null),
        gender: member.gender,
        bloodType: member.bloodType,
        genotype: member.genotype,
        allergies: member.allergies,
        childProfile: member.childProfile || {},
      };
      const bundle = childToFhirBundle(
        child,
        vaccinations.map((v: any) => ({ ...v.toObject(), id: String(v._id) })),
        growth.map((g: any) => ({ ...g.toObject(), id: String(g._id) }))
      );
      return res.json({
        success: true,
        child: { name: child.fullName, wrId: child.wrId, dateOfBirth: child.dateOfBirth, allergies: child.allergies || '' },
        expiresAt: grant.expiresAt,
        scheduleVersion: IMMUNIZATION_SCHEDULE.version,
        scheduleReviewStatus: IMMUNIZATION_SCHEDULE.reviewStatus,
        bundle,
      });
    } catch (err) {
      console.error('[POST /facility/child/lookup] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not open the record' });
    }
  });

  router.post('/facility/child/vaccinations', deps.limiter, clinic, async (req: Request, res: Response) => {
    try {
      const opened = await openGrant(req, res);
      if (!opened) return;
      const { member, grant } = opened;
      const b = req.body || {};
      const dose = scheduleDoseByCode(String(b.vaccineCode || ''));
      if (!dose) return res.status(400).json({ success: false, message: 'Unknown vaccine code' });
      const administeredDate = isoDate(b.administeredDate);
      if (!administeredDate) return res.status(400).json({ success: false, message: 'Enter the date as YYYY-MM-DD' });
      if (administeredDate > new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)) {
        return res.status(400).json({ success: false, message: 'The date cannot be in the future' });
      }
      const dob = isoDate(member.dateOfBirth || (member.dob ? String(member.dob).split('T')[0] : ''));
      if (dob && administeredDate < dob) return res.status(400).json({ success: false, message: 'The date is before the child was born' });

      const s = req.staff!;
      const verified = {
        verification: 'provider_verified' as const,
        verifiedBy: s.name,
        verifiedAt: new Date(),
        verificationSource: `Clinic visit${s.organization ? `: ${s.organization}` : ''}`,
      };
      const fields = {
        facility: cleanText(b.facility, 120) || s.organization,
        provider: cleanText(b.provider, 120) || s.name,
        lotNumber: cleanText(b.lotNumber, 60),
        manufacturer: cleanText(b.manufacturer, 80),
        expiryDate: isoDate(b.expiryDate),
        site: cleanText(b.site, 40),
        route: cleanText(b.route, 40) || dose.route,
        reaction: cleanText(b.reaction, 300),
        notes: cleanText(b.notes, 300),
      };
      const existing: any = await ChildVaccination.findOne({ memberId: member._id, vaccineCode: dose.code });
      let record: any;
      let action: string;
      if (existing) {
        if (existing.verification === 'provider_verified') {
          return res.status(409).json({ success: false, message: 'This dose is already confirmed by a clinic' });
        }
        // Confirm the parent's entry. The clinic's values replace the parent's where given.
        const set: any = { ...verified, administeredDate };
        for (const [k, v] of Object.entries(fields)) if (v !== undefined) set[k] = v;
        record = await ChildVaccination.findByIdAndUpdate(existing._id, { $set: set }, { new: true });
        action = 'vaccination_verified';
      } else {
        record = await ChildVaccination.create({
          memberId: member._id,
          ownerId: `staff:${s.id}`,
          vaccineCode: dose.code,
          vaccineName: `${dose.vaccine}${dose.doseNumber ? ` (dose ${dose.doseNumber})` : ''}`,
          administeredDate,
          ...fields,
          ...verified,
          scheduleVersion: IMMUNIZATION_SCHEDULE.version,
        });
        action = 'vaccination_added';
      }
      await recordUse(grant, req, action);
      await auditChild(member._id, `staff:${s.id}`, 'admin', action, `${record.vaccineName} by ${who(req)}`, 0, who(req));
      if (member.accountId) {
        deps
          .notify(String(member.accountId), 'Clinic updated a record', `${s.organization || s.name} confirmed ${record.vaccineName} for ${member.fullName || member.name}.`)
          .catch(() => {});
      }
      return res.status(existing ? 200 : 201).json({ success: true, vaccinationId: String(record._id), confirmed: Boolean(existing) });
    } catch (err) {
      console.error('[POST /facility/child/vaccinations] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not save the vaccination' });
    }
  });

  router.post('/facility/child/growth', deps.limiter, clinic, async (req: Request, res: Response) => {
    try {
      const opened = await openGrant(req, res);
      if (!opened) return;
      const { member, grant } = opened;
      const b = req.body || {};
      const measuredOn = isoDate(b.measuredOn);
      if (!measuredOn) return res.status(400).json({ success: false, message: 'Enter the date as YYYY-MM-DD' });
      if (measuredOn > new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)) {
        return res.status(400).json({ success: false, message: 'The date cannot be in the future' });
      }
      const weightKg = num(b.weightKg, 0.3, 150);
      const lengthCm = num(b.lengthCm, 20, 220);
      const headCircumferenceCm = num(b.headCircumferenceCm, 20, 70);
      if (weightKg === undefined && lengthCm === undefined && headCircumferenceCm === undefined) {
        return res.status(400).json({ success: false, message: 'Enter at least one valid measurement' });
      }
      const s = req.staff!;
      const created: any = await ChildGrowth.create({
        memberId: member._id,
        ownerId: `staff:${s.id}`,
        measuredOn,
        weightKg,
        lengthCm,
        headCircumferenceCm,
        source: 'clinic',
        notes: cleanText(b.notes, 300),
      });
      await recordUse(grant, req, 'growth_added');
      await auditChild(member._id, `staff:${s.id}`, 'admin', 'growth_added', `${measuredOn} by ${who(req)}`, 0, who(req));
      if (member.accountId) {
        deps
          .notify(String(member.accountId), 'Clinic added a measurement', `${s.organization || s.name} recorded a measurement for ${member.fullName || member.name}.`)
          .catch(() => {});
      }
      return res.status(201).json({ success: true, entryId: String(created._id) });
    } catch (err) {
      console.error('[POST /facility/child/growth] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not save the measurement' });
    }
  });

  return router;
}
