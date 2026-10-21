// Visits console for clinic staff: see who is booked, confirm or cancel a request,
// join the video room for a virtual visit, and file the visit summary.
// Page: /clinic/visits (consolePages.ts). Staff scope follows ProviderService.staffIds.
// Room contract with the patient app: `wr-visit-<appointmentId>`.
import mongoose from 'mongoose';
import express, { Request, RequestHandler, Router } from 'express';
import { AccessToken } from 'livekit-server-sdk';
import { AppointmentRequest, FamilyMember, ProviderService } from './models';
import { joinWindow } from './bookingCore';

export const VISIT_STATUSES = ['requested', 'awaiting_payment', 'awaiting_hmo', 'confirmed'] as const;

/** Start of the current day in Lagos (UTC+1, no daylight saving), as a UTC instant. */
export function lagosDayStart(nowMs: number): Date {
  const shifted = new Date(nowMs + 3600_000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - 3600_000);
}

/** The moment the visit is meant to start: the booked slot, or the requested day. */
export function visitStart(a: { startsAt?: Date | string | null; scheduledFor?: Date | string | null }): Date | null {
  const v = a.startsAt || a.scheduledFor;
  return v ? new Date(v) : null;
}

/** Can staff join now? Booked visits use the join window; plain requests use the Lagos day. */
export function staffJoinState(
  a: { visitType?: string; status?: string; startsAt?: Date | string | null; scheduledFor?: Date | string | null; durationMin?: number },
  nowMs: number
): { ok: boolean; code?: string; message?: string; opensAt?: Date } {
  if (a.visitType !== 'video') return { ok: false, code: 'not_video', message: 'This is not a video visit.' };
  if (a.status !== 'confirmed') return { ok: false, code: 'not_confirmed', message: 'Confirm the visit before joining.' };
  if (a.startsAt) {
    const w = joinWindow(new Date(a.startsAt), a.durationMin || 30, nowMs);
    if (w.open) return { ok: true };
    return nowMs < w.opensAt.getTime()
      ? { ok: false, code: 'join_window_closed', message: 'You can join 10 minutes before the start.', opensAt: w.opensAt }
      : { ok: false, code: 'visit_ended', message: 'This visit has ended.' };
  }
  const today = new Date(nowMs + 3600_000).toISOString().slice(0, 10);
  const day = a.scheduledFor ? new Date(new Date(a.scheduledFor).getTime()).toISOString().slice(0, 10) : '';
  return today === day ? { ok: true } : { ok: false, code: 'wrong_day', message: 'You can join on the day of the visit.' };
}

export interface Outcome {
  status: number;
  body: Record<string, unknown>;
}

export interface ClinicVisitsDeps {
  requireStaff: (...roles: any[]) => RequestHandler;
  releaseSlot: (appt: any) => Promise<void>;
  push: (accountId: string, appointmentId: string, title: string, body: string) => Promise<void>;
  now?: () => number;
}

export function createClinicVisits(deps: ClinicVisitsDeps): {
  router: Router;
  listVisits: (mine: string[] | null) => Promise<any[]>;
  confirmVisit: (id: unknown, mine: string[] | null) => Promise<Outcome>;
  cancelVisit: (id: unknown, mine: string[] | null) => Promise<Outcome>;
  videoToken: (id: unknown, mine: string[] | null, who: { id: string; name: string }) => Promise<Outcome>;
} {
  const router = express.Router();
  const now = deps.now || Date.now;
  const staffOnly = deps.requireStaff('records_officer', 'clinician');
  const oid = (v: unknown) => (mongoose.isValidObjectId(String(v)) ? new mongoose.Types.ObjectId(String(v)) : null);
  const notFound: Outcome = { status: 404, body: { success: false, message: 'Visit not found' } };

  /** Facility ids this staff member works at. null means every facility (admin). */
  async function scope(req: Request): Promise<string[] | null> {
    const s: any = (req as any).staff;
    if (s?.role === 'admin' || s?.legacy) return null;
    const rows: any[] = await ProviderService.find({ staffIds: String(s?.id || '') }).select('facilityId').lean();
    return rows.map((r) => r.facilityId);
  }

  async function load(idRaw: unknown, mine: string[] | null): Promise<any | null> {
    const id = oid(idRaw);
    if (!id) return null;
    const a: any = await AppointmentRequest.findById(id).lean();
    if (!a || (mine && !mine.includes(String(a.facilityId)))) return null;
    return a;
  }

  async function listVisits(mine: string[] | null): Promise<any[]> {
    const q: any = { status: { $in: VISIT_STATUSES }, externalFacility: { $ne: true } };
    if (mine) q.facilityId = { $in: mine };
    else q.facilityId = { $exists: true, $ne: '' };
    // From the start of today (Lagos) so a visit later today is still listed.
    q.scheduledFor = { $gte: lagosDayStart(now()) };
    const rows: any[] = await AppointmentRequest.find(q).sort({ startsAt: 1, scheduledFor: 1 }).limit(200).lean();
    const ids = [...new Set(rows.map((r) => r.familyMemberId).filter((x) => mongoose.isValidObjectId(String(x || ''))))];
    const people: any[] = ids.length ? await FamilyMember.find({ _id: { $in: ids } }, 'fullName name').lean() : [];
    const nameOf = new Map(people.map((p) => [String(p._id), String(p.fullName || p.name || '')]));
    return rows.map((a) => {
      const join = staffJoinState(a, now());
      return {
        id: String(a._id),
        facilityId: a.facilityId,
        bookingRef: a.bookingRef || '',
        facilityName: a.facilityName,
        patientName: nameOf.get(String(a.familyMemberId)) || 'Patient',
        startsAt: visitStart(a),
        timeSlot: a.timeSlot,
        visitType: a.visitType || 'in_person',
        status: a.status,
        paymentMethod: a.paymentMethod,
        paymentStatus: a.paymentStatus,
        feeMinor: a.feeMinor,
        hmo: a.hmo ? { policyLabel: a.hmo.policyLabel, preAuthId: a.hmo.preAuthId, clientStatus: a.hmo.clientStatus } : undefined,
        // The reason is the patient's own words; show it to the clinic that was asked, nobody else.
        reason: a.reason || '',
        canJoin: join.ok,
        joinMessage: join.ok ? '' : join.message || '',
        summaryDone: Boolean(a.visitSummary?.authoredAt),
      };
    });
  }

  // A request to a clinic that has no published hours: staff decide.
  async function confirmVisit(idRaw: unknown, mine: string[] | null): Promise<Outcome> {
    const a = await load(idRaw, mine);
    if (!a) return notFound;
    const done = await AppointmentRequest.updateOne({ _id: a._id, status: 'requested' }, { $set: { status: 'confirmed' } });
    if (!done.modifiedCount) return { status: 409, body: { success: false, message: 'This visit is not waiting for confirmation.' } };
    return { status: 200, body: { success: true } };
  }

  async function cancelVisit(idRaw: unknown, mine: string[] | null): Promise<Outcome> {
    const a = await load(idRaw, mine);
    if (!a) return notFound;
    if (!['requested', 'confirmed', 'awaiting_hmo', 'awaiting_payment'].includes(a.status)) {
      return { status: 409, body: { success: false, message: 'This visit can no longer be cancelled.' } };
    }
    const set: any = { status: 'cancelled' };
    if (a.paymentStatus === 'paid') set.paymentStatus = 'refund_due'; // a person refunds it; nothing is automatic
    const done = await AppointmentRequest.updateOne({ _id: a._id, status: a.status }, { $set: set });
    if (!done.modifiedCount) return { status: 409, body: { success: false, message: 'This visit just changed. Refresh and try again.' } };
    await deps.releaseSlot(a).catch(() => {});
    void deps.push(String(a.accountId), String(a._id), 'Visit cancelled', `${a.facilityName} cancelled your visit${a.paymentStatus === 'paid' ? '. Your payment will be refunded.' : '.'}`).catch(() => {});
    return { status: 200, body: { success: true, refundDue: a.paymentStatus === 'paid' } };
  }

  // Clinician's token for the same room the patient joins.
  async function videoToken(idRaw: unknown, mine: string[] | null, who: { id: string; name: string }): Promise<Outcome> {
    const url = process.env.LIVEKIT_URL;
    const key = process.env.LIVEKIT_API_KEY;
    const secret = process.env.LIVEKIT_API_SECRET;
    if (!url || !key || !secret) return { status: 503, body: { success: false, message: 'Video visits are not set up yet.' } };
    const a = await load(idRaw, mine);
    if (!a) return notFound;
    const state = staffJoinState(a, now());
    if (!state.ok) return { status: 409, body: { success: false, message: state.message, code: state.code, opensAt: state.opensAt } };
    const room = `wr-visit-${String(a._id)}`;
    const at = new AccessToken(key, secret, { identity: `staff-${who.id || 'x'}`, name: who.name || 'Clinician', ttl: '1h' });
    at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });
    return { status: 200, body: { success: true, url, token: await at.toJwt(), room } };
  }

  const route = (name: string, fn: (req: Request) => Promise<Outcome>, fallback: string) => async (req: Request, res: any) => {
    try {
      const r = await fn(req);
      res.status(r.status).json(r.body);
    } catch (err) {
      console.error(`[${name}] ERROR:`, err);
      res.status(500).json({ success: false, message: fallback });
    }
  };

  router.get(
    '/staff/visits',
    staffOnly,
    route('GET /staff/visits', async (req) => ({ status: 200, body: { success: true, visits: await listVisits(await scope(req)) } }), 'Could not load visits')
  );
  router.post('/staff/visits/:id/confirm', staffOnly, route('POST /staff/visits/confirm', async (req) => confirmVisit(req.params.id, await scope(req)), 'Could not confirm the visit'));
  router.post('/staff/visits/:id/cancel', staffOnly, route('POST /staff/visits/cancel', async (req) => cancelVisit(req.params.id, await scope(req)), 'Could not cancel the visit'));
  router.post(
    '/staff/visits/:id/video-token',
    staffOnly,
    route(
      'POST /staff/visits/video-token',
      async (req) => {
        const staff: any = (req as any).staff;
        return videoToken(req.params.id, await scope(req), { id: String(staff?.id || 'x'), name: String(staff?.name || 'Clinician') });
      },
      'Could not start the video visit'
    )
  );

  return { router, listVisits, confirmVisit, cancelVisit, videoToken };
}
