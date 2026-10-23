// Consultation booking: providers publish fees and weekly hours, the patient picks a type, date,
// provider and payment method, the server holds the slot while they check out, and the booking
// is confirmed according to how it is paid.
//
//   pay in person  -> confirmed, payment due at the visit
//   pay online     -> awaiting payment, confirmed only when Paystack says the payment succeeded
//   HMO            -> awaiting HMO confirmation until a staff member approves it
//
// The fee always comes from the provider's record on the server, never from the app.

import { Split, cleanSubaccount, onlineAllowed, splitFor } from './paystackSplit';
import mongoose from 'mongoose';
import express, { Request, RequestHandler, Response, Router } from 'express';
import { AppointmentRequest, BookingSlot, ProviderService, StaffRole } from './models';
import {
  HOLD_MS,
  MAX_DAYS_AHEAD,
  Method,
  Mode,
  bookableFor,
  cleanWeekly,
  decideBooking,
  feeFor,
  formatNaira,
  isYmd,
  lagosYmd,
  nextDays,
  parseServiceFields,
  paystackSignatureOk,
  slotLabel,
  slotsForDate,
  ONLINE_HOLD_MS,
} from './bookingCore';

export const BOOKING_TERMS_VERSION = 'draft-1';
export const BOOKING_TERMS = [
  'The fee shown is set by the provider for the type of visit you chose.',
  'Your chosen time is held for a few minutes while you check out. If you do not finish, it is released.',
  'Pay online: your booking is confirmed only after the payment succeeds.',
  'Pay in person: your booking is confirmed and you pay at the visit.',
  'HMO: your booking shows as awaiting HMO confirmation until the provider confirms your cover. If cover is declined, the booking is cancelled and you can book again with another payment method.',
  'You can cancel from Upcoming visits. Whether a paid fee is refunded is decided by the provider.',
  'Virtual visits open from your Upcoming visits screen shortly before the start time. Do not share the join button with anyone.',
];

export interface PaystackClient {
  configured: boolean;
  initialize(p: { email: string; amountMinor: number; reference: string; metadata?: Record<string, unknown>; split?: Split | null }): Promise<{ authorizationUrl: string }>;
  verify(reference: string): Promise<{ success: boolean; amountMinor: number; currency: string }>;
}

export function createPaystack(secret: string | undefined, fetchImpl: typeof fetch = fetch): PaystackClient {
  const headers = { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' };
  const call = async (path: string, init?: RequestInit) => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 15_000);
    try {
      const r = await fetchImpl(`https://api.paystack.co${path}`, { ...init, headers, signal: ctl.signal });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok || j?.status === false) throw new Error(`Paystack ${r.status}: ${String(j?.message || 'request failed').slice(0, 160)}`);
      return j.data;
    } finally {
      clearTimeout(t);
    }
  };
  return {
    configured: Boolean(secret),
    async initialize({ email, amountMinor, reference, metadata, split }) {
      const d = await call('/transaction/initialize', {
        method: 'POST',
        body: JSON.stringify({ email, amount: amountMinor, reference, currency: 'NGN', metadata, ...(split || {}) }),
      });
      return { authorizationUrl: String(d.authorization_url) };
    },
    async verify(reference) {
      const d = await call(`/transaction/verify/${encodeURIComponent(reference)}`);
      return { success: d?.status === 'success', amountMinor: Number(d?.amount), currency: String(d?.currency || '') };
    },
  };
}

export interface BookingDeps {
  getAuthUserId: (req: Request) => string | null;
  limiter: RequestHandler;
  requireStaff: (...roles: StaffRole[]) => RequestHandler;
  callerCanBook: (authUserId: string, familyMemberId: string) => Promise<boolean>;
  accountEmail: (authUserId: string) => Promise<string | undefined>;
  normalize: (doc: any) => Record<string, unknown>;
  push: (accountId: string, appointmentId: string, title: string, body: string) => Promise<void>;
  /** Facilities a provider profile can be set up for (the app's facility list and registered organisations). */
  listFacilities: () => Promise<{ id: string; name: string; address: string; registered?: boolean; type?: string; lat?: number | null; lng?: number | null }[]>;
  /** Provider verification: true if the assigned clinicians can take bookings (or none are assigned). */
  facilityEligible?: (staffIds: string[], facilityId: string) => Promise<boolean>;
  paystack: PaystackClient;
  /** Payment references that are not consultation bookings (pharmacy orders). Return true if handled. */
  otherReference?: (reference: string) => Promise<boolean>;
  now?: () => number;
}

const oid = (v: unknown) => (mongoose.isValidObjectId(String(v)) ? new mongoose.Types.ObjectId(String(v)) : null);
const shortRef = (id: any) => String(id).slice(-6).toUpperCase();
const modeOf = (v: unknown): Mode | null => (v === 'video' || v === 'in_person' ? v : null);
const dbDown = () => mongoose.connection.readyState !== 1;

function publicProvider(svc: any, mode: Mode) {
  return {
    facilityId: svc.facilityId,
    name: svc.facilityName,
    address: svc.facilityAddress || '',
    specialty: svc.specialty || '',
    mode,
    feeMinor: feeFor(svc, mode),
    currency: svc.currency || 'NGN',
    acceptsHmo: svc.acceptsHmo || [],
    payAtVisit: Boolean(svc.payAtVisit),
    onlinePayment: Boolean(svc.onlinePayment),
    slotMinutes: svc.slotMinutes,
  };
}

export function createBooking(deps: BookingDeps) {
  const eligibleSvc = async (svc: any) => !deps.facilityEligible || deps.facilityEligible(((svc?.staffIds as any[]) || []).map(String), String(svc?.facilityId || ''));
  const now = () => (deps.now ? deps.now() : Date.now());
  const router = Router();
  const webhook = Router();

  /** Slots already taken or held (an expired hold counts as free even before the TTL sweep removes it). */
  async function takenSet(facilityIds: string[], from: Date, to: Date): Promise<Set<string>> {
    const rows: any[] = await BookingSlot.find(
      { facilityId: { $in: facilityIds }, startsAt: { $gte: from, $lt: to } },
      'facilityId startsAt state holdExpiresAt'
    ).lean();
    const t = now();
    const set = new Set<string>();
    for (const r of rows) {
      if (r.state === 'held' && r.holdExpiresAt && new Date(r.holdExpiresAt).getTime() <= t) continue;
      set.add(`${r.facilityId}|${new Date(r.startsAt).getTime()}`);
    }
    return set;
  }

  async function bookableProviders(mode: Mode, facilityId?: string) {
    const q: any = { active: true };
    if (facilityId) q.facilityId = facilityId;
    const rows: any[] = await ProviderService.find(q).limit(200).lean();
    const open = rows.filter((s) => bookableFor(s, mode));
    const keep: any[] = [];
    for (const s of open) if (await eligibleSvc(s)) keep.push(s);
    return keep;
  }

  const authed = (req: Request, res: Response): string | null => {
    const id = deps.getAuthUserId(req);
    if (!id) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return null;
    }
    if (dbDown() || !mongoose.isValidObjectId(id)) {
      res.status(503).json({ success: false, message: 'Database unavailable' });
      return null;
    }
    return id;
  };

  const fail500 = (res: Response, tag: string, err: unknown, message: string) => {
    console.error(`[${tag}] ERROR:`, err);
    return res.status(500).json({ success: false, message });
  };

  // ----- reading availability -----

  router.get('/booking/config', (req, res) => {
    if (!deps.getAuthUserId(req)) return res.status(401).json({ success: false, message: 'Authentication required' });
    res.json({ success: true, onlinePayment: deps.paystack.configured, termsVersion: BOOKING_TERMS_VERSION, terms: BOOKING_TERMS, holdMinutes: HOLD_MS / 60000 });
  });

  router.get('/booking/dates', async (req, res) => {
    const id = authed(req, res);
    if (!id) return;
    const mode = modeOf(req.query.mode);
    if (!mode) return res.status(400).json({ success: false, message: 'Choose in person or virtual' });
    try {
      const facilityId = typeof req.query.facilityId === 'string' ? req.query.facilityId : undefined;
      const providers = await bookableProviders(mode, facilityId);
      const days = nextDays(now(), Number(req.query.days) || 30);
      const from = new Date(`${days[0]}T00:00:00Z`);
      const to = new Date(new Date(`${days[days.length - 1]}T00:00:00Z`).getTime() + 2 * 86_400_000);
      const taken = providers.length ? await takenSet(providers.map((p) => p.facilityId), from, to) : new Set<string>();
      const out: { date: string; providers: number }[] = [];
      for (const d of days) {
        let n = 0;
        for (const p of providers) {
          if (slotsForDate(p, d, now()).some((s) => !taken.has(`${p.facilityId}|${s.getTime()}`))) n++;
        }
        if (n) out.push({ date: d, providers: n });
      }
      res.json({ success: true, dates: out });
    } catch (err) {
      fail500(res, 'GET /booking/dates', err, 'Could not load available dates');
    }
  });

  router.get('/booking/availability', async (req, res) => {
    const id = authed(req, res);
    if (!id) return;
    const mode = modeOf(req.query.mode);
    const date = req.query.date;
    if (!mode || !isYmd(date)) return res.status(400).json({ success: false, message: 'Choose a visit type and a date' });
    try {
      const facilityId = typeof req.query.facilityId === 'string' ? req.query.facilityId : undefined;
      const providers = await bookableProviders(mode, facilityId);
      const from = new Date(`${date}T00:00:00Z`);
      const taken = providers.length ? await takenSet(providers.map((p) => p.facilityId), from, new Date(from.getTime() + 2 * 86_400_000)) : new Set<string>();
      const list = providers
        .map((p) => ({
          ...publicProvider(p, mode),
          slots: slotsForDate(p, date, now())
            .filter((s) => !taken.has(`${p.facilityId}|${s.getTime()}`))
            .map((s) => ({ startsAt: s.toISOString(), label: slotLabel(s) })),
        }))
        .filter((p) => p.slots.length > 0)
        .sort((a, b) => (a.feeMinor ?? 0) - (b.feeMinor ?? 0));
      res.json({ success: true, providers: list });
    } catch (err) {
      fail500(res, 'GET /booking/availability', err, 'Could not load providers');
    }
  });

  /** True if a facility has a published consultation profile, so the app can use this flow for it. */
  router.get('/booking/offers/:facilityId', async (req, res) => {
    const id = authed(req, res);
    if (!id) return;
    try {
      const svc: any = await ProviderService.findOne({ facilityId: String(req.params.facilityId), active: true }).lean();
      res.json({
        success: true,
        inPerson: Boolean(svc && bookableFor(svc, 'in_person') && (await eligibleSvc(svc))),
        virtual: Boolean(svc && bookableFor(svc, 'video') && (await eligibleSvc(svc))),
      });
    } catch (err) {
      fail500(res, 'GET /booking/offers', err, 'Could not check this provider');
    }
  });

  // ----- holding a slot -----

  router.post('/booking/holds', deps.limiter, async (req, res) => {
    const id = authed(req, res);
    if (!id) return;
    const mode = modeOf(req.body?.mode);
    const facilityId = String(req.body?.facilityId || '');
    const startsAt = new Date(String(req.body?.startsAt || ''));
    if (!mode || !facilityId || Number.isNaN(startsAt.getTime())) {
      return res.status(400).json({ success: false, message: 'Choose a provider and a time' });
    }
    try {
      const svc: any = await ProviderService.findOne({ facilityId, active: true }).lean();
      if (!svc || !bookableFor(svc, mode) || !(await eligibleSvc(svc))) return res.status(404).json({ success: false, message: 'This provider is not taking bookings for that visit type.' });
      // The time must be one the provider really offers. The app cannot invent one.
      const offered = slotsForDate(svc, lagosYmd(startsAt), now()).some((s) => s.getTime() === startsAt.getTime());
      if (!offered || startsAt.getTime() > now() + MAX_DAYS_AHEAD * 86_400_000) {
        return res.status(409).json({ success: false, message: 'That time is not available. Choose another.', code: 'slot_unavailable' });
      }
      const me = new mongoose.Types.ObjectId(id);
      await BookingSlot.deleteMany({ accountId: me, state: 'held' });
      await BookingSlot.deleteOne({ facilityId, startsAt, state: 'held', holdExpiresAt: { $lte: new Date(now()) } });
      const holdExpiresAt = new Date(now() + HOLD_MS);
      try {
        const hold: any = await BookingSlot.create({ facilityId, startsAt, state: 'held', accountId: me, mode, holdExpiresAt });
        return res.status(201).json({ success: true, holdId: String(hold._id), expiresAt: holdExpiresAt.toISOString() });
      } catch (e: any) {
        if (e?.code === 11000) return res.status(409).json({ success: false, message: 'That time was just taken. Choose another.', code: 'slot_taken' });
        throw e;
      }
    } catch (err) {
      fail500(res, 'POST /booking/holds', err, 'Could not hold that time');
    }
  });

  router.delete('/booking/holds/:id', async (req, res) => {
    const id = authed(req, res);
    if (!id) return;
    const hid = oid(req.params.id);
    if (!hid) return res.json({ success: true });
    try {
      await BookingSlot.deleteOne({ _id: hid, accountId: new mongoose.Types.ObjectId(id), state: 'held', appointmentId: { $exists: false } });
      res.json({ success: true });
    } catch (err) {
      fail500(res, 'DELETE /booking/holds', err, 'Could not release the time');
    }
  });

  // ----- confirming -----

  /** Moves a slot from held to booked for an appointment. If the hold was lost, tries to take the slot again. */
  async function lockSlot(appt: any): Promise<boolean> {
    const r = await BookingSlot.updateOne(
      { facilityId: appt.facilityId, startsAt: appt.startsAt, appointmentId: appt._id },
      { $set: { state: 'booked' }, $unset: { holdExpiresAt: 1 } }
    );
    if (r.matchedCount) return true;
    try {
      await BookingSlot.create({ facilityId: appt.facilityId, startsAt: appt.startsAt, state: 'booked', accountId: appt.accountId, mode: appt.visitType === 'video' ? 'video' : 'in_person', appointmentId: appt._id });
      return true;
    } catch {
      return false;
    }
  }

  async function releaseSlot(appt: any) {
    await BookingSlot.deleteMany({ appointmentId: appt._id });
  }

  /** Called when a payment is known to have succeeded (webhook, verify, or the sweep). Safe to call twice. */
  async function settlePaid(appt: any, paidMinor: number): Promise<'confirmed' | 'already' | 'refund_due'> {
    if (appt.status === 'confirmed' && appt.paymentStatus === 'paid') return 'already';
    if (appt.status !== 'awaiting_payment' || paidMinor < (appt.feeMinor ?? 0)) {
      // Money arrived for a booking that is cancelled or underpaid. Flag it for a person to refund.
      await AppointmentRequest.updateOne({ _id: appt._id }, { $set: { paymentStatus: 'refund_due' } });
      console.warn(`[booking] payment ${appt.paymentRef} needs a refund review (status ${appt.status}, paid ${paidMinor}, fee ${appt.feeMinor})`);
      return 'refund_due';
    }
    if (!(await lockSlot(appt))) {
      await AppointmentRequest.updateOne({ _id: appt._id }, { $set: { status: 'cancelled', paymentStatus: 'refund_due' } });
      console.warn(`[booking] payment ${appt.paymentRef} arrived after the slot was lost; refund needed`);
      void deps.push(String(appt.accountId), String(appt._id), 'Booking not confirmed', 'Your payment arrived after the time was released. The provider will refund you, or contact support.').catch(() => {});
      return 'refund_due';
    }
    const done = await AppointmentRequest.updateOne(
      { _id: appt._id, status: 'awaiting_payment' },
      { $set: { status: 'confirmed', paymentStatus: 'paid' } }
    );
    return done.modifiedCount ? 'confirmed' : 'already';
  }

  router.post('/booking/confirm', deps.limiter, async (req, res) => {
    const id = authed(req, res);
    if (!id) return;
    const b = req.body || {};
    const holdId = oid(b.holdId);
    const method = b.paymentMethod as Method;
    if (!holdId) return res.status(400).json({ success: false, message: 'Choose a time first' });
    if (b.acceptTerms !== true) return res.status(400).json({ success: false, message: 'Accept the booking terms to continue' });
    if (b.reason !== undefined && (typeof b.reason !== 'string' || b.reason.length > 500)) {
      return res.status(400).json({ success: false, message: 'Reason must be 500 characters or fewer' });
    }
    try {
      const me = new mongoose.Types.ObjectId(id);
      const hold: any = await BookingSlot.findOne({ _id: holdId, accountId: me, state: 'held', holdExpiresAt: { $gt: new Date(now()) } });
      if (!hold) return res.status(410).json({ success: false, message: 'Your held time ran out. Choose a time again.', code: 'hold_expired' });
      const svc: any = await ProviderService.findOne({ facilityId: hold.facilityId, active: true }).lean();
      const mode: Mode = hold.mode;
      const fee = svc ? feeFor(svc, mode) : null;
      if (!svc || !bookableFor(svc, mode) || fee === null || !(await eligibleSvc(svc))) {
        return res.status(409).json({ success: false, message: 'This provider is no longer taking those bookings.' });
      }
      const familyMemberId = b.familyMemberId && b.familyMemberId !== 'me' ? String(b.familyMemberId) : undefined;
      if (familyMemberId && !(await deps.callerCanBook(id, familyMemberId))) {
        return res.status(403).json({ success: false, message: 'You cannot book for this family member' });
      }
      const hmoIn = b.hmo && typeof b.hmo === 'object' ? b.hmo : {};
      const decision = decideBooking({ method, svc, gatewayConfigured: deps.paystack.configured && onlineAllowed(svc.paystackSubaccount), hmoProvider: String(hmoIn.provider || '') });
      if (decision.ok === false) {
        const no = decision as { message: string; code: string };
        return res.status(409).json({ success: false, message: no.message, code: no.code });
      }

      let email: string | undefined;
      if (method === 'online') {
        email = await deps.accountEmail(id);
        if (!email) return res.status(400).json({ success: false, message: 'Add an email address to your account to pay online.', code: 'email_required' });
      }

      const doc: any = await AppointmentRequest.create({
        accountId: me,
        familyMemberId,
        facilityId: svc.facilityId,
        facilityName: svc.facilityName,
        facilityAddress: svc.facilityAddress || '',
        scheduledFor: hold.startsAt,
        startsAt: hold.startsAt,
        durationMin: svc.slotMinutes,
        timeSlot: slotLabel(hold.startsAt),
        reason: typeof b.reason === 'string' ? b.reason.trim() : '',
        visitType: mode,
        status: decision.status,
        paymentMethod: method,
        paymentStatus: decision.paymentStatus,
        feeMinor: fee,
        currency: svc.currency || 'NGN',
        termsAcceptedAt: new Date(now()),
        hmo:
          method === 'hmo'
            ? {
                policyId: String(hmoIn.policyId || '').slice(0, 80),
                policyLabel: String(hmoIn.policyLabel || hmoIn.provider || '').slice(0, 120),
                preAuthId: String(hmoIn.preAuthId || '').slice(0, 80),
                clientStatus: String(hmoIn.preAuthStatus || '').slice(0, 40),
              }
            : undefined,
      });
      doc.bookingRef = shortRef(doc._id);
      await doc.save();

      // Claim the held slot for this appointment. Only the holder, and only while the hold is live.
      const claimed = await BookingSlot.updateOne(
        { _id: hold._id, accountId: me, state: 'held', holdExpiresAt: { $gt: new Date(now()) } },
        decision.status === 'awaiting_payment'
          ? { $set: { appointmentId: doc._id, holdExpiresAt: new Date(now() + decision.holdMs) } }
          : { $set: { appointmentId: doc._id, state: 'booked' }, $unset: { holdExpiresAt: 1 } }
      );
      if (!claimed.modifiedCount) {
        await AppointmentRequest.deleteOne({ _id: doc._id });
        return res.status(410).json({ success: false, message: 'Your held time ran out. Choose a time again.', code: 'hold_expired' });
      }

      let authorizationUrl: string | undefined;
      if (method === 'online') {
        try {
          const reference = `wr-${doc._id}`;
          const init = await deps.paystack.initialize({
            email: email!,
            amountMinor: fee,
            reference,
            metadata: { appointmentId: String(doc._id), bookingRef: doc.bookingRef },
            split: splitFor({ subaccount: svc.paystackSubaccount, amountMinor: fee }),
          });
          authorizationUrl = init.authorizationUrl;
          doc.paymentRef = reference;
          await doc.save();
        } catch (err) {
          console.error('[POST /booking/confirm] payment start failed:', err);
          await AppointmentRequest.deleteOne({ _id: doc._id });
          await releaseSlot(doc);
          return res.status(502).json({ success: false, message: 'Could not start the payment. Try again, or choose another payment method.' });
        }
      }

      if (decision.status === 'awaiting_hmo') {
        void deps.push(id, String(doc._id), 'Awaiting HMO confirmation', `Your visit at ${svc.facilityName} is held while your cover is confirmed. Ref ${doc.bookingRef}.`).catch(() => {});
      }
      // Confirmed visits are announced by the existing status sweep (push, email and SMS).
      const notice =
        decision.status === 'confirmed'
          ? `Booking confirmed. Fee ${formatNaira(fee)}, payable at the visit.`
          : decision.status === 'awaiting_payment'
            ? 'Finish the payment to confirm your booking.'
            : 'Awaiting HMO confirmation. We will tell you when the provider confirms your cover.';
      res.status(201).json({ success: true, appointment: deps.normalize(doc), authorizationUrl, notice });
    } catch (err) {
      fail500(res, 'POST /booking/confirm', err, 'Could not complete the booking');
    }
  });

  // ----- status and payment follow-up -----

  router.get('/booking/:id', async (req, res) => {
    const id = authed(req, res);
    if (!id) return;
    const aid = oid(req.params.id);
    if (!aid) return res.status(404).json({ success: false, message: 'Booking not found' });
    try {
      let appt: any = await AppointmentRequest.findOne({ _id: aid, accountId: new mongoose.Types.ObjectId(id) });
      if (!appt) return res.status(404).json({ success: false, message: 'Booking not found' });
      // If the app is back from the payment page but the webhook has not landed, ask Paystack directly.
      if (appt.status === 'awaiting_payment' && appt.paymentRef && deps.paystack.configured) {
        try {
          const v = await deps.paystack.verify(appt.paymentRef);
          if (v.success && v.currency === (appt.currency || 'NGN')) {
            await settlePaid(appt, v.amountMinor);
            appt = await AppointmentRequest.findById(aid);
          }
        } catch (err) {
          console.warn('[GET /booking/:id] verify failed:', err);
        }
      }
      res.json({ success: true, appointment: deps.normalize(appt) });
    } catch (err) {
      fail500(res, 'GET /booking/:id', err, 'Could not load the booking');
    }
  });

  // Paystack calls this. It is mounted with a raw body (see `webhook`) so the signature can be checked.
  webhook.post('/booking/paystack/webhook', express.raw({ type: '*/*', limit: '100kb' }), async (req: Request, res: Response) => {
    const secret = process.env.PAYSTACK_SECRET_KEY || '';
    const raw: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    if (!paystackSignatureOk(secret, raw, req.headers['x-paystack-signature'])) {
      return res.status(401).json({ success: false });
    }
    // Acknowledge first; Paystack retries on anything but 200.
    res.status(200).json({ success: true });
    try {
      const evt: any = JSON.parse(raw.toString('utf8'));
      if (evt?.event !== 'charge.success') return;
      const reference = String(evt?.data?.reference || '');
      if (!/^wr-[a-f0-9]{24}$/.test(reference)) {
        if (deps.otherReference) await deps.otherReference(reference);
        return;
      }
      const appt: any = await AppointmentRequest.findOne({ paymentRef: reference });
      if (!appt) return;
      // Do not trust the body for the amount: ask Paystack.
      const v = await deps.paystack.verify(reference);
      if (v.success && v.currency === (appt.currency || 'NGN')) await settlePaid(appt, v.amountMinor);
    } catch (err) {
      console.error('[paystack webhook] ERROR:', err);
    }
  });

  /** Cancels bookings whose payment never arrived, and settles ones that paid without the webhook. */
  async function sweepPayments() {
    if (dbDown()) return;
    try {
      const cutoff = new Date(now() - ONLINE_HOLD_MS - 2 * 60_000);
      const stale: any[] = await AppointmentRequest.find({ status: 'awaiting_payment', createdAt: { $lt: cutoff } }).limit(50);
      for (const a of stale) {
        let paid = false;
        if (a.paymentRef && deps.paystack.configured) {
          try {
            const v = await deps.paystack.verify(a.paymentRef);
            if (v.success) {
              paid = true;
              await settlePaid(a, v.amountMinor);
            }
          } catch { /* try again next minute */ continue; }
        }
        if (!paid) {
          await AppointmentRequest.updateOne({ _id: a._id, status: 'awaiting_payment' }, { $set: { status: 'cancelled' } });
          await releaseSlot(a);
        }
      }
    } catch (err) {
      console.warn('[booking sweep] failed:', err);
    }
  }

  // ----- provider setup and HMO decisions (staff) -----

  const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
  const fee = (v: unknown): number | undefined | 'bad' => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= 100_000_000 ? n : 'bad';
  };

  /** Facility ids this staff member may manage. null means all (admin). */
  async function managedIds(req: any): Promise<string[] | null> {
    if (req.staff?.role === 'admin' || req.staff?.legacy) return null;
    const rows: any[] = await ProviderService.find({ staffIds: String(req.staff?.id || '') }).select('facilityId').lean();
    return rows.map((r) => r.facilityId);
  }

  router.get('/staff/providers/:facilityId/service', deps.requireStaff('records_officer', 'clinician'), async (req, res) => {
    try {
      const facilityId = String(req.params.facilityId);
      const ids = await managedIds(req);
      if (ids && !ids.includes(facilityId)) return res.status(403).json({ success: false, message: 'You are not set up to manage this provider.' });
      const svc = await ProviderService.findOne({ facilityId }).lean();
      res.json({ success: true, service: svc || null });
    } catch (err) {
      fail500(res, 'GET /staff/providers/service', err, 'Could not load the provider');
    }
  });

  router.get('/staff/facility-options', deps.requireStaff('admin'), async (_req, res) => {
    try {
      res.json({ success: true, facilities: await deps.listFacilities() });
    } catch (err) {
      fail500(res, 'GET /staff/facility-options', err, 'Could not load facilities');
    }
  });

  router.get('/staff/providers', deps.requireStaff('records_officer', 'clinician'), async (req, res) => {
    try {
      const ids = await managedIds(req);
      const q: any = ids ? { facilityId: { $in: ids } } : {};
      const rows: any[] = await ProviderService.find(q).sort({ facilityName: 1 }).limit(300).lean();
      // Only an admin sees which accounts are assigned.
      res.json({ success: true, canManageStaff: !ids, providers: ids ? rows.map(({ staffIds, paystackSubaccount, ...r }) => r) : rows });
    } catch (err) {
      fail500(res, 'GET /staff/providers', err, 'Could not load providers');
    }
  });

  router.put('/staff/providers/:facilityId/service', deps.requireStaff('records_officer', 'clinician'), async (req, res) => {
    const b = req.body || {};
    const facilityId = clip(req.params.facilityId, 80);
    if (!facilityId) return res.status(400).json({ success: false, message: 'Provider is required' });
    let ids: string[] | null;
    try {
      ids = await managedIds(req);
    } catch (err) {
      return fail500(res, 'PUT /staff/providers/service', err, 'Could not save the provider');
    }
    const isAdmin = !ids;
    const existing: any = await ProviderService.findOne({ facilityId }).lean().catch(() => null);
    // Only an admin creates a provider, renames it, or changes who manages it.
    if (!isAdmin && (!existing || !ids!.includes(facilityId))) return res.status(403).json({ success: false, message: 'You are not set up to manage this provider.' });
    const name = isAdmin ? clip(b.facilityName, 120) : existing.facilityName;
    if (!name) return res.status(400).json({ success: false, message: 'Provider name is required' });
    const parsed = parseServiceFields(b);
    if ('error' in parsed) return res.status(400).json({ success: false, message: parsed.error });
    const set: any = { ...parsed.set, updatedBy: req.staff?.name || 'staff' };
    if (isAdmin) {
      set.facilityName = name;
      set.facilityAddress = clip(b.facilityAddress, 200);
      set.specialty = clip(b.specialty, 80);
      if (Array.isArray(b.staffIds)) set.staffIds = [...new Set(b.staffIds.map((x: unknown) => clip(x, 40)).filter(Boolean))].slice(0, 30);
      if (b.paystackSubaccount !== undefined) {
        const code = cleanSubaccount(b.paystackSubaccount);
        if (code === null) return res.status(400).json({ success: false, message: 'The Paystack subaccount code looks like ACCT_ followed by letters and numbers' });
        set.paystackSubaccount = code;
      }
    }
    try {
      const svc = await ProviderService.findOneAndUpdate({ facilityId }, { $set: set }, { upsert: isAdmin, new: true, setDefaultsOnInsert: true });
      res.json({ success: true, service: svc });
    } catch (err) {
      fail500(res, 'PUT /staff/providers/service', err, 'Could not save the provider');
    }
  });

  router.get('/staff/bookings', deps.requireStaff('records_officer', 'clinician'), async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : 'awaiting_hmo';
    if (!['awaiting_hmo', 'awaiting_payment', 'confirmed', 'cancelled'].includes(status)) return res.status(400).json({ success: false, message: 'Unknown status' });
    try {
      const q: any = { status, startsAt: { $exists: true } };
      const mine = await managedIds(req);
      if (mine) q.facilityId = { $in: mine };
      if (typeof req.query.facilityId === 'string' && (!mine || mine.includes(req.query.facilityId))) q.facilityId = req.query.facilityId;
      const rows: any[] = await AppointmentRequest.find(q).sort({ startsAt: 1 }).limit(200).lean();
      res.json({
        success: true,
        bookings: rows.map((a) => ({
          id: String(a._id),
          bookingRef: a.bookingRef,
          facilityId: a.facilityId,
          facilityName: a.facilityName,
          startsAt: a.startsAt,
          visitType: a.visitType,
          feeMinor: a.feeMinor,
          paymentMethod: a.paymentMethod,
          paymentStatus: a.paymentStatus,
          hmo: a.hmo ? { policyLabel: a.hmo.policyLabel, preAuthId: a.hmo.preAuthId, clientStatus: a.hmo.clientStatus } : undefined,
        })),
      });
    } catch (err) {
      fail500(res, 'GET /staff/bookings', err, 'Could not load bookings');
    }
  });

  /** Approve or decline an HMO booking. `mine` limits it to those providers (null = any). Used by the staff page and the website bridge. */
  async function decideHmo(a: { id: unknown; decision: unknown; approvalCode?: unknown; who: string; mine: string[] | null }): Promise<{ status: number; body: Record<string, unknown> }> {
    const aid = oid(a.id);
    if (!aid || (a.decision !== 'approve' && a.decision !== 'decline')) return { status: 400, body: { success: false, message: 'Choose approve or decline' } };
    const appt: any = await AppointmentRequest.findOne({ _id: aid, status: 'awaiting_hmo' });
    if (!appt) return { status: 409, body: { success: false, message: 'This booking is not waiting for HMO confirmation.' } };
    if (a.mine && !a.mine.includes(String(appt.facilityId))) return { status: 403, body: { success: false, message: 'This booking belongs to another provider.' } };
    if (a.decision === 'approve') {
      if (!(await lockSlot(appt))) return { status: 409, body: { success: false, message: 'The time is no longer held for this booking.' } };
      await AppointmentRequest.updateOne(
        { _id: aid, status: 'awaiting_hmo' },
        { $set: { status: 'confirmed', paymentStatus: 'hmo_approved', 'hmo.decidedBy': a.who, 'hmo.decidedAt': new Date(now()), 'hmo.approvalCode': clip(a.approvalCode, 60) } }
      );
    } else {
      await AppointmentRequest.updateOne(
        { _id: aid, status: 'awaiting_hmo' },
        { $set: { status: 'cancelled', paymentStatus: 'hmo_declined', 'hmo.decidedBy': a.who, 'hmo.decidedAt': new Date(now()) } }
      );
      await releaseSlot(appt);
      void deps.push(String(appt.accountId), String(aid), 'HMO cover not confirmed', `${appt.facilityName} could not confirm your HMO cover. Book again and choose another way to pay.`).catch(() => {});
    }
    return { status: 200, body: { success: true } };
  }

  router.post('/staff/bookings/:id/hmo', deps.requireStaff('records_officer', 'clinician'), async (req, res) => {
    try {
      const mine = await managedIds(req);
      const who = req.staff && !req.staff.legacy ? req.staff.name : clip(req.body?.decidedBy, 120) || 'staff';
      const r = await decideHmo({ id: req.params.id, decision: req.body?.decision, approvalCode: req.body?.approvalCode, who, mine });
      res.status(r.status).json(r.body);
    } catch (err) {
      fail500(res, 'POST /staff/bookings/hmo', err, 'Could not save the decision');
    }
  });

  let timer: NodeJS.Timeout | null = null;
  const startSweeps = () => {
    if (timer) return;
    timer = setInterval(sweepPayments, 60_000);
    timer.unref();
  };

  return { router, webhook, sweepPayments, startSweeps, releaseSlot, settlePaid, decideHmo };
}
