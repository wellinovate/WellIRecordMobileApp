import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import mongoose from 'mongoose';
import { connect, disconnect, hasDb } from './db';
import { createBooking, type PaystackClient } from '../../booking';
import { lagosYmd } from '../../bookingCore';
import { AppointmentRequest, BookingSlot } from '../../models';

const PAYSTACK_SECRET = crypto.randomBytes(16).toString('hex');

describe('consultation booking against a real database', { skip: !hasDb && 'set MONGODB_URI_TEST to run' }, () => {
  let server: Server;
  let base = '';
  let booking: ReturnType<typeof createBooking>;
  const alice = new mongoose.Types.ObjectId();
  const bob = new mongoose.Types.ObjectId();
  const facilityId = 'fac-1';
  // Two days ahead, every day open 08:00 to 12:00 Lagos time.
  const date = lagosYmd(new Date(Date.now() + 2 * 86_400_000));
  let verifyResult: { success: boolean; amountMinor: number; currency: string } = { success: true, amountMinor: 1_500_000, currency: 'NGN' };
  process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET;

  const paystack: PaystackClient = {
    configured: true,
    initialize: async ({ reference }) => ({ authorizationUrl: `https://pay.test/${reference}` }),
    verify: async () => verifyResult,
  };

  async function call(method: string, path: string, body?: any, user?: mongoose.Types.ObjectId, asStaff?: string) {
    const r = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(user ? { 'x-test-user': String(user) } : {}), ...(asStaff ? { 'x-test-staff': asStaff } : {}) },
      body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
    });
    let json: any = {};
    try { json = await r.json(); } catch {}
    return { status: r.status, ...json } as any;
  }

  const putService = (over: any = {}) =>
    call('PUT', `/staff/providers/${facilityId}/service`, {
      facilityName: 'Garki Clinic',
      facilityAddress: 'Garki, Abuja',
      specialty: 'Primary care',
      offersInPerson: true,
      offersVirtual: true,
      feeInPersonMinor: 1_500_000,
      feeVirtualMinor: 1_000_000,
      acceptsHmo: ['Hygeia'],
      payAtVisit: true,
      onlinePayment: true,
      slotMinutes: 30,
      weekly: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, start: '08:00', end: '12:00' })),
      ...over,
    });

  // The first free time on a day (2 + dayOffset days ahead). Each test uses its own day so they do not collide.
  async function firstSlot(user = alice, mode = 'in_person', dayOffset = 0) {
    const d = lagosYmd(new Date(Date.now() + (2 + dayOffset) * 86_400_000));
    const a = await call('GET', `/booking/availability?mode=${mode}&date=${d}`, undefined, user);
    return a.providers[0].slots[0].startsAt as string;
  }
  async function hold(startsAt: string, user = alice, mode = 'in_person') {
    return call('POST', '/booking/holds', { facilityId, mode, startsAt }, user);
  }
  const confirm = (body: any, user = alice) => call('POST', '/booking/confirm', { acceptTerms: true, ...body }, user);

  before(async () => {
    await connect();
    await AppointmentRequest.init();
    try {
      await BookingSlot.init();
    } catch {
      // FerretDB (used for local runs) has no TTL indexes. The unique index is the part these tests rely on;
      // expired holds are also ignored by the queries themselves, which one test checks.
      await BookingSlot.collection.createIndex({ facilityId: 1, startsAt: 1 }, { unique: true });
    }
    const app = express();
    booking = createBooking({
      getAuthUserId: (req) => (req.headers['x-test-user'] as string) || null,
      limiter: (_q, _s, n) => n(),
      requireStaff: (...roles: string[]) => (req, res, next) => {
        // No header means an admin; "x-test-staff: <id>:<role>" signs in as that person.
        const h = String(req.headers['x-test-staff'] || '');
        const [id, role] = h ? h.split(':') : ['admin-1', 'admin'];
        if (role !== 'admin' && !roles.includes(role)) return res.status(403).json({ success: false });
        (req as any).staff = { id, name: h ? `Staff ${id}` : 'Test Staff', role, legacy: false };
        next();
      },
      callerCanBook: async () => true,
      accountEmail: async () => 'patient@example.com',
      normalize: (d: any) => ({ id: String(d._id), status: d.status, paymentStatus: d.paymentStatus, bookingRef: d.bookingRef, feeMinor: d.feeMinor }),
      push: async () => {},
      paystack,
    });
    app.use('/api/v1', booking.webhook);
    app.use(express.json());
    app.use('/api/v1', booking.router);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
    assert.equal((await putService()).status, 200);
  });
  after(async () => { server?.close(); await disconnect(); });

  it('needs sign-in to read availability or hold a time', async () => {
    assert.equal((await call('GET', `/booking/availability?mode=video&date=${date}`)).status, 401);
    assert.equal((await call('POST', '/booking/holds', {})).status, 401);
  });

  it('shows the fee for the chosen mode and hides a mode the provider has no fee for', async () => {
    const inPerson = await call('GET', `/booking/availability?mode=in_person&date=${date}`, undefined, alice);
    assert.equal(inPerson.providers[0].feeMinor, 1_500_000);
    const video = await call('GET', `/booking/availability?mode=video&date=${date}`, undefined, alice);
    assert.equal(video.providers[0].feeMinor, 1_000_000);
    await putService({ offersVirtual: true, feeVirtualMinor: undefined });
    assert.equal((await call('PUT', `/staff/providers/${facilityId}/service`, { facilityName: 'x', offersVirtual: true, weekly: [] })).status, 400);
    await putService(); // restore
  });

  it('lists the dates that have open slots', async () => {
    const r = await call('GET', '/booking/dates?mode=in_person&days=5', undefined, alice);
    // Today can have no time left (the lead time passes late in the evening), so 4 or 5 days.
    assert.ok(r.dates.length >= 4 && r.dates.length <= 5);
    assert.ok(r.dates.every((d: any) => d.providers === 1));
  });

  it('refuses a time the provider does not offer', async () => {
    const r = await hold(`${date}T02:00:00.000Z`); // 03:00 Lagos
    assert.equal(r.status, 409);
  });

  it('lets only one person hold a time, and hides it from others while held', async () => {
    const t = await firstSlot(alice, 'in_person', 0);
    assert.equal((await hold(t, alice)).status, 201);
    assert.equal((await hold(t, bob)).status, 409);
    const seen = await call('GET', `/booking/availability?mode=in_person&date=${date}`, undefined, bob);
    assert.ok(!seen.providers[0].slots.some((s: any) => s.startsAt === t));
  });

  it('frees a time when the hold runs out', async () => {
    const t = await firstSlot(bob, 'in_person', 0); // alice still holds slot 0, so this is slot 1
    const h = await hold(t, bob);
    assert.equal(h.status, 201);
    await BookingSlot.updateOne({ _id: h.holdId }, { $set: { holdExpiresAt: new Date(Date.now() - 1000) } });
    const taken = await hold(t, alice);
    assert.equal(taken.status, 201, 'an expired hold must not block the next person');
    const gone = await confirm({ holdId: h.holdId, paymentMethod: 'in_person' }, bob);
    assert.equal(gone.status, 410);
    await call('DELETE', `/booking/holds/${taken.holdId}`, undefined, alice);
  });

  it('needs the terms accepted', async () => {
    const t = await firstSlot(alice, 'in_person', 3);
    const h = await hold(t);
    const r = await call('POST', '/booking/confirm', { holdId: h.holdId, paymentMethod: 'in_person' }, alice);
    assert.equal(r.status, 400);
    await call('DELETE', `/booking/holds/${h.holdId}`, undefined, alice);
  });

  it('pay in person: confirmed with payment due at the visit, and the time is taken for good', async () => {
    const t = await firstSlot(alice, 'in_person', 4);
    const h = await hold(t, alice);
    const r = await confirm({ holdId: h.holdId, paymentMethod: 'in_person' }, alice);
    assert.equal(r.status, 201);
    assert.equal(r.appointment.status, 'confirmed');
    assert.equal(r.appointment.paymentStatus, 'pay_at_visit');
    assert.equal(r.appointment.feeMinor, 1_500_000);
    assert.match(r.appointment.bookingRef, /^[A-F0-9]{6}$/);
    const slot: any = await BookingSlot.findOne({ facilityId, startsAt: new Date(t) }).lean();
    assert.equal(slot.state, 'booked');
    assert.equal(slot.holdExpiresAt, undefined);
    assert.equal((await hold(t, bob)).status, 409);
  });

  it('pay in person is refused when the provider turns it off', async () => {
    await putService({ payAtVisit: false });
    const t = await firstSlot(alice, 'in_person', 5);
    const h = await hold(t);
    const r = await confirm({ holdId: h.holdId, paymentMethod: 'in_person' });
    assert.equal(r.status, 409);
    assert.equal(r.code, 'pay_at_visit_unavailable');
    await call('DELETE', `/booking/holds/${h.holdId}`, undefined, alice);
    await putService();
  });

  it('online: not confirmed until the payment provider says so', async () => {
    const t = await firstSlot(alice, 'in_person', 6);
    const h = await hold(t);
    const r = await confirm({ holdId: h.holdId, paymentMethod: 'online' });
    assert.equal(r.status, 201);
    assert.equal(r.appointment.status, 'awaiting_payment');
    assert.match(r.authorizationUrl, /^https:\/\/pay\.test\/wr-[a-f0-9]{24}$/);
    const id = r.appointment.id;

    // A webhook with the wrong signature changes nothing.
    const body = JSON.stringify({ event: 'charge.success', data: { reference: `wr-${id}` } });
    const bad = await fetch(`${base}/booking/paystack/webhook`, { method: 'POST', headers: { 'x-paystack-signature': 'a'.repeat(128) }, body });
    assert.equal(bad.status, 401);
    assert.equal((await AppointmentRequest.findById(id).lean() as any).status, 'awaiting_payment');

    // A signed one confirms it, after the server checks the amount with Paystack.
    verifyResult = { success: true, amountMinor: 1_500_000, currency: 'NGN' };
    const sig = crypto.createHmac('sha512', PAYSTACK_SECRET).update(body).digest('hex');
    const ok = await fetch(`${base}/booking/paystack/webhook`, { method: 'POST', headers: { 'x-paystack-signature': sig }, body });
    assert.equal(ok.status, 200);
    await new Promise((r2) => setTimeout(r2, 300));
    const done: any = await AppointmentRequest.findById(id).lean();
    assert.equal(done.status, 'confirmed');
    assert.equal(done.paymentStatus, 'paid');
    assert.equal(((await BookingSlot.findOne({ appointmentId: id }).lean()) as any).state, 'booked');
  });

  it('online: a payment smaller than the fee does not confirm the booking', async () => {
    const t = await firstSlot(alice, 'in_person', 7);
    const h = await hold(t);
    const r = await confirm({ holdId: h.holdId, paymentMethod: 'online' });
    const id = r.appointment.id;
    verifyResult = { success: true, amountMinor: 100, currency: 'NGN' };
    const status = await call('GET', `/booking/${id}`, undefined, alice);
    assert.equal(status.appointment.status, 'awaiting_payment');
    const row: any = await AppointmentRequest.findById(id).lean();
    assert.equal(row.paymentStatus, 'refund_due');
    verifyResult = { success: true, amountMinor: 1_500_000, currency: 'NGN' };
  });

  it('online: the sweep cancels an unpaid booking and frees the time', async () => {
    const t = await firstSlot(alice, 'in_person', 8);
    const h = await hold(t);
    const r = await confirm({ holdId: h.holdId, paymentMethod: 'online' });
    const id = r.appointment.id;
    await AppointmentRequest.collection.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: { createdAt: new Date(Date.now() - 60 * 60_000) } });
    verifyResult = { success: false, amountMinor: 0, currency: 'NGN' };
    await booking.sweepPayments();
    assert.equal(((await AppointmentRequest.findById(id).lean()) as any).status, 'cancelled');
    assert.equal(await BookingSlot.countDocuments({ appointmentId: id }), 0);
    assert.equal((await hold(t, bob)).status, 201);
    verifyResult = { success: true, amountMinor: 1_500_000, currency: 'NGN' };
  });

  it('HMO: waits for staff, then confirms or cancels and frees the time', async () => {
    const t1 = await firstSlot(bob, 'in_person', 9);
    const h1 = await hold(t1, bob);
    const hmo = { provider: 'Hygeia', policyId: 'p1', policyLabel: 'Hygeia · ABC123', preAuthId: 'pa1', preAuthStatus: 'APPROVED' };
    const r1 = await confirm({ holdId: h1.holdId, paymentMethod: 'hmo', hmo }, bob);
    assert.equal(r1.appointment.status, 'awaiting_hmo', 'an approved pre-auth on the phone is not enough');
    const queue = await call('GET', '/staff/bookings?status=awaiting_hmo');
    assert.ok(queue.bookings.some((b: any) => b.id === r1.appointment.id));
    const approve = await call('POST', `/staff/bookings/${r1.appointment.id}/hmo`, { decision: 'approve', approvalCode: 'AP-1' });
    assert.equal(approve.status, 200);
    const done: any = await AppointmentRequest.findById(r1.appointment.id).lean();
    assert.equal(done.status, 'confirmed');
    assert.equal(done.paymentStatus, 'hmo_approved');
    assert.equal(done.hmo.decidedBy, 'Test Staff');

    const t2 = await firstSlot(bob, 'in_person', 10);
    const h2 = await hold(t2, bob);
    const r2 = await confirm({ holdId: h2.holdId, paymentMethod: 'hmo', hmo }, bob);
    const decline = await call('POST', `/staff/bookings/${r2.appointment.id}/hmo`, { decision: 'decline' });
    assert.equal(decline.status, 200);
    assert.equal(((await AppointmentRequest.findById(r2.appointment.id).lean()) as any).status, 'cancelled');
    assert.equal(await BookingSlot.countDocuments({ appointmentId: r2.appointment.id }), 0);
    // It cannot be decided twice.
    assert.equal((await call('POST', `/staff/bookings/${r2.appointment.id}/hmo`, { decision: 'approve' })).status, 409);
  });

  it('HMO: refused for a plan the provider does not accept', async () => {
    const t = await firstSlot(bob, 'in_person', 11);
    const h = await hold(t, bob);
    const r = await confirm({ holdId: h.holdId, paymentMethod: 'hmo', hmo: { provider: 'Other HMO' } }, bob);
    assert.equal(r.status, 409);
    assert.equal(r.code, 'hmo_not_accepted');
  });

  it('one person cannot confirm another person\'s hold', async () => {
    const t = await firstSlot(alice, 'in_person', 12);
    const h = await hold(t, alice);
    const r = await confirm({ holdId: h.holdId, paymentMethod: 'in_person' }, bob);
    assert.equal(r.status, 410);
  });

  it('a virtual visit takes the virtual fee', async () => {
    const t = await firstSlot(alice, 'video', 13);
    const h = await hold(t, alice, 'video');
    const r = await confirm({ holdId: h.holdId, paymentMethod: 'in_person' });
    assert.equal(r.appointment.feeMinor, 1_000_000);
  });

  it('lets a clinician change only their own clinic, and only the safe fields', async () => {
    const fid = 'fac-scope';
    const full = (over: any = {}) => ({
      facilityName: 'Scope Clinic', facilityAddress: 'Wuse', specialty: 'GP', offersInPerson: true, offersVirtual: false,
      feeInPersonMinor: 500_000, acceptsHmo: [], payAtVisit: true, onlinePayment: true, slotMinutes: 30,
      weekly: [{ day: 1, start: '09:00', end: '12:00' }], ...over,
    });
    const put = (id: string, body: any, who?: string) => call('PUT', `/staff/providers/${id}/service`, body, undefined, who);
    // Not assigned yet: refused, and a clinician cannot create a clinic.
    assert.equal((await put(fid, full(), 'c1:clinician')).status, 403);
    assert.equal((await put(fid, full(), undefined)).status, 200); // admin creates it
    assert.equal((await put(fid, full({ staffIds: ['c1'] }), undefined)).status, 200); // admin assigns c1
    // Assigned clinician: fees and hours change; name, address and staff do not.
    const r = await put(fid, full({ facilityName: 'Hijacked', facilityAddress: 'Elsewhere', staffIds: ['c1', 'c2'], feeInPersonMinor: 700_000 }), 'c1:clinician');
    assert.equal(r.status, 200);
    assert.equal(r.service.feeInPersonMinor, 700_000);
    assert.equal(r.service.facilityName, 'Scope Clinic');
    assert.equal(r.service.facilityAddress, 'Wuse');
    assert.deepEqual(r.service.staffIds, ['c1']);
    // Another clinician cannot touch it or see it.
    assert.equal((await put(fid, full(), 'c2:clinician')).status, 403);
    assert.equal((await call('GET', `/staff/providers/${fid}/service`, undefined, undefined, 'c2:clinician')).status, 403);
    const mine = await call('GET', '/staff/providers', undefined, undefined, 'c1:clinician');
    assert.deepEqual(mine.providers.map((p: any) => p.facilityId), [fid]);
    assert.equal(mine.providers[0].staffIds, undefined);
    assert.equal(mine.canManageStaff, false);
    const none = await call('GET', '/staff/providers', undefined, undefined, 'c2:clinician');
    assert.equal(none.providers.length, 0);
    // The facility list and role checks stay admin-only.
    assert.equal((await call('GET', '/staff/facility-options', undefined, undefined, 'c1:clinician')).status, 403);
    assert.equal((await put(fid, full(), 'p1:pharmacist')).status, 403);
  });

});
