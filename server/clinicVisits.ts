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

export interface ClinicVisitsDeps {
  requireStaff: (...roles: any[]) => RequestHandler;
  releaseSlot: (appt: any) => Promise<void>;
  push: (accountId: string, appointmentId: string, title: string, body: string) => Promise<void>;
  now?: () => number;
}

export function createClinicVisits(deps: ClinicVisitsDeps): { router: Router } {
  const router = express.Router();
  const now = deps.now || Date.now;
  const staffOnly = deps.requireStaff('records_officer', 'clinician');
  const oid = (v: unknown) => (mongoose.isValidObjectId(String(v)) ? new mongoose.Types.ObjectId(String(v)) : null);

  /** Facility ids this staff member works at. null means every facility (admin). */
  async function scope(req: Request): Promise<string[] | null> {
    const s: any = (req as any).staff;
    if (s?.role === 'admin' || s?.legacy) return null;
    const rows: any[] = await ProviderService.find({ staffIds: String(s?.id || '') }).select('facilityId').lean();
    return rows.map((r) => r.facilityId);
  }

  async function load(req: Request, res: any): Promise<any | null> {
    const id = oid(req.params.id);
    if (!id) {
      res.status(404).json({ success: false, message: 'Visit not found' });
      return null;
    }
    const a: any = await AppointmentRequest.findById(id).lean();
    const mine = await scope(req);
    if (!a || (mine && !mine.includes(String(a.facilityId)))) {
      res.status(404).json({ success: false, message: 'Visit not found' });
      return null;
    }
    return a;
  }

  router.get('/staff/visits', staffOnly, async (req, res) => {
    try {
      const mine = await scope(req);
      const q: any = { status: { $in: VISIT_STATUSES }, externalFacility: { $ne: true } };
      if (mine) q.facilityId = { $in: mine };
      else q.facilityId = { $exists: true, $ne: '' };
      // From the start of today (Lagos) so a visit later today is still listed.
      q.scheduledFor = { $gte: lagosDayStart(now()) };
      const rows: any[] = await AppointmentRequest.find(q).sort({ startsAt: 1, scheduledFor: 1 }).limit(200).lean();
      const ids = [...new Set(rows.map((r) => r.familyMemberId).filter((x) => mongoose.isValidObjectId(String(x || ''))))];
      const people: any[] = ids.length ? await FamilyMember.find({ _id: { $in: ids } }, 'fullName name').lean() : [];
      const nameOf = new Map(people.map((p) => [String(p._id), String(p.fullName || p.name || '')]));
      res.json({
        success: true,
        visits: rows.map((a) => {
          const join = staffJoinState(a, now());
          return {
            id: String(a._id),
            bookingRef: a.bookingRef || '',
            facilityName: a.facilityName,
            patientName: nameOf.get(String(a.familyMemberId)) || 'Patient',
            startsAt: visitStart(a),
            timeSlot: a.timeSlot,
            visitType: a.visitType || 'in_person',
            status: a.status,
            paymentMethod: a.paymentMethod,
            paymentStatus: a.paymentStatus,
            // The reason is the patient's own words; show it to the clinic that was asked, nobody else.
            reason: a.reason || '',
            canJoin: join.ok,
            joinMessage: join.ok ? '' : join.message || '',
            summaryDone: Boolean(a.visitSummary?.authoredAt),
          };
        }),
      });
    } catch (err) {
      console.error('[GET /staff/visits] ERROR:', err);
      res.status(500).json({ success: false, message: 'Could not load visits' });
    }
  });

  // A request to a clinic that has no published hours: staff decide.
  router.post('/staff/visits/:id/confirm', staffOnly, async (req, res) => {
    try {
      const a = await load(req, res);
      if (!a) return;
      const done = await AppointmentRequest.updateOne({ _id: a._id, status: 'requested' }, { $set: { status: 'confirmed' } });
      if (!done.modifiedCount) return res.status(409).json({ success: false, message: 'This visit is not waiting for confirmation.' });
      res.json({ success: true });
    } catch (err) {
      console.error('[POST /staff/visits/confirm] ERROR:', err);
      res.status(500).json({ success: false, message: 'Could not confirm the visit' });
    }
  });

  router.post('/staff/visits/:id/cancel', staffOnly, async (req, res) => {
    try {
      const a = await load(req, res);
      if (!a) return;
      if (!['requested', 'confirmed', 'awaiting_hmo', 'awaiting_payment'].includes(a.status)) {
        return res.status(409).json({ success: false, message: 'This visit can no longer be cancelled.' });
      }
      const set: any = { status: 'cancelled' };
      if (a.paymentStatus === 'paid') set.paymentStatus = 'refund_due'; // a person refunds it; nothing is automatic
      const done = await AppointmentRequest.updateOne({ _id: a._id, status: a.status }, { $set: set });
      if (!done.modifiedCount) return res.status(409).json({ success: false, message: 'This visit just changed. Refresh and try again.' });
      await deps.releaseSlot(a).catch(() => {});
      void deps.push(String(a.accountId), String(a._id), 'Visit cancelled', `${a.facilityName} cancelled your visit${a.paymentStatus === 'paid' ? '. Your payment will be refunded.' : '.'}`).catch(() => {});
      res.json({ success: true, refundDue: a.paymentStatus === 'paid' });
    } catch (err) {
      console.error('[POST /staff/visits/cancel] ERROR:', err);
      res.status(500).json({ success: false, message: 'Could not cancel the visit' });
    }
  });

  // Clinician's token for the same room the patient joins.
  router.post('/staff/visits/:id/video-token', staffOnly, async (req, res) => {
    const url = process.env.LIVEKIT_URL;
    const key = process.env.LIVEKIT_API_KEY;
    const secret = process.env.LIVEKIT_API_SECRET;
    if (!url || !key || !secret) return res.status(503).json({ success: false, message: 'Video visits are not set up yet.' });
    try {
      const a = await load(req, res);
      if (!a) return;
      const state = staffJoinState(a, now());
      if (!state.ok) return res.status(409).json({ success: false, message: state.message, code: state.code, opensAt: state.opensAt });
      const staff: any = (req as any).staff;
      const room = `wr-visit-${String(a._id)}`;
      const at = new AccessToken(key, secret, { identity: `staff-${String(staff?.id || 'x')}`, name: String(staff?.name || 'Clinician'), ttl: '1h' });
      at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });
      res.json({ success: true, url, token: await at.toJwt(), room });
    } catch (err) {
      console.error('[POST /staff/visits/video-token] ERROR:', err);
      res.status(500).json({ success: false, message: 'Could not start the video visit' });
    }
  });

  return { router };
}
