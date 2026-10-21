import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import mongoose from 'mongoose';
import { connect, disconnect, hasDb } from './db';
import { createPharmacyOrders } from '../../pharmacyOrders';
import type { PaystackClient } from '../../booking';
import { PharmacyAttachment, PharmacyOrder, Prescription } from '../../models';

describe('pharmacy orders against a real database', { skip: !hasDb && 'set MONGODB_URI_TEST to run' }, () => {
  let server: Server;
  let base = '';
  let pharmacy: ReturnType<typeof createPharmacyOrders>;
  const alice = new mongoose.Types.ObjectId();
  const bob = new mongoose.Types.ObjectId();
  const admin = new mongoose.Types.ObjectId();
  const pharmacistA = new mongoose.Types.ObjectId();
  const pharmacistB = new mongoose.Types.ObjectId();
  const SEAL = crypto.randomBytes(16).toString('hex');
  let verifyResult = { success: true, amountMinor: 0, currency: 'NGN' };
  const pushes: string[] = [];
  const audits: string[] = [];

  const paystack: PaystackClient = {
    configured: true,
    initialize: async ({ reference }) => ({ authorizationUrl: `https://pay.test/${reference}` }),
    verify: async () => verifyResult,
  };

  // Header "x-test-staff" is "<id>:<role>".
  async function call(method: string, path: string, body?: any, who?: { user?: mongoose.Types.ObjectId; staff?: mongoose.Types.ObjectId; role?: string }) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (who?.user) headers['x-test-user'] = String(who.user);
    if (who?.staff) headers['x-test-staff'] = `${who.staff}:${who.role || 'pharmacist'}`;
    const r = await fetch(`${base}${path}`, { method, headers, body: body && method !== 'GET' ? JSON.stringify(body) : undefined });
    let json: any = {};
    try { json = await r.json(); } catch {}
    return { status: r.status, ...json } as any;
  }
  const patient = (m: string, p: string, b?: any, u = alice) => call(m, p, b, { user: u });
  const asAdmin = (m: string, p: string, b?: any) => call(m, p, b, { staff: admin, role: 'admin' });
  const asA = (m: string, p: string, b?: any) => call(m, p, b, { staff: pharmacistA });
  const asB = (m: string, p: string, b?: any) => call(m, p, b, { staff: pharmacistB });

  // 1x1 PNG: the signature is what the server checks.
  const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), crypto.randomBytes(40)]).toString('base64');

  // Pharmacy at the Abuja city centre. Alice lives about 3 km away, Bob about 40 km away.
  const HERE = { lat: 9.0765, lng: 7.3986 };
  const NEAR = { lat: 9.1, lng: 7.42 };
  const FAR = { lat: 9.4, lng: 7.7 };

  async function newAttachment(user = alice) {
    const a = await patient('POST', '/pharmacy-orders/attachments', { dataBase64: PNG }, user);
    assert.equal(a.status, 201, JSON.stringify(a));
    return a.attachment.id as string;
  }
  const OPEN = ['awaiting_review', 'quoted', 'awaiting_payment', 'awaiting_hmo'];
  async function place(over: any = {}, user = alice) {
    // Tests share a user, so close earlier open orders first. The cap itself has its own test.
    await PharmacyOrder.collection.updateMany({ accountId: user, status: { $in: OPEN } }, { $set: { status: 'cancelled' } });
    const r = await patient('POST', '/pharmacy-orders', {
      pharmacyId: 'ph-1',
      items: [{ name: 'Amoxicillin', strength: '500mg', quantity: 21 }, { name: 'Paracetamol', strength: '500mg', quantity: 20 }],
      acceptTerms: true,
      ...over,
    }, user);
    return r;
  }
  const quoteBody = { lines: [
    { name: 'Amoxicillin 500mg', quantity: 21, unitPriceMinor: 15_000 },
    { name: 'Paracetamol 500mg', quantity: 20, unitPriceMinor: 5_000, alternative: true },
  ], note: 'Both in stock' };
  async function quoted(over: any = {}, user = alice) {
    const r = await place(over, user);
    assert.equal(r.status, 201, JSON.stringify(r));
    const q = await asA('POST', `/staff/pharmacy/orders/${r.order.id}/quote`, quoteBody);
    assert.equal(q.status, 200, JSON.stringify(q));
    return r.order.id as string;
  }
  const checkout = (id: string, body: any, user = alice) =>
    patient('POST', `/pharmacy-orders/${id}/checkout`, { acceptTerms: true, ...body }, user);
  const homeDelivery = { fulfilment: 'delivery', address: { text: '12 Example Street, Maitama, Abuja', landmark: 'Opposite the bank', recipientName: 'Alice', recipientPhone: '08031234567', ...NEAR } };

  before(async () => {
    await connect();
    const app = express();
    pharmacy = createPharmacyOrders({
      getAuthUserId: (req) => (req.headers['x-test-user'] as string) || null,
      limiter: (_q, _s, n) => n(),
      requireStaff: (...roles: string[]) => (req, res, next) => {
        const h = String(req.headers['x-test-staff'] || '');
        const [id, role] = h.split(':');
        if (!id) return res.status(401).json({ success: false });
        if (role !== 'admin' && !roles.includes(role)) return res.status(403).json({ success: false });
        (req as any).staff = { id, name: `Staff ${id.slice(-4)}`, role, legacy: false };
        next();
      },
      paystack,
      accountContact: async () => ({ email: 'patient@example.com', phone: '+2348031234567', name: 'Alice Test' }),
      notify: async (_a, _o, title) => { pushes.push(title); },
      audit: async (_r, _a, action) => { audits.push(action); },
      sealKey: SEAL,
      listFacilities: async () => [],
    } as any);
    app.use(express.json({ limit: '3mb' }));
    app.use('/api/v1', pharmacy.router);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
    try {
      await PharmacyAttachment.init();
    } catch {
      // FerretDB (local runs) has no TTL indexes; CI uses real MongoDB.
    }
    const svc = (facilityId: string, over: any = {}) =>
      asAdmin('PUT', `/staff/pharmacy/services/${facilityId}`, {
        name: 'City Pharmacy', address: 'Central Area, Abuja', ...HERE,
        deliveryEnabled: true, pickupEnabled: true,
        feeBands: [{ maxKm: 5, feeMinor: 150_000 }, { maxKm: 15, feeMinor: 300_000 }],
        onlinePayment: true, payOnDelivery: true, payAtPickup: true, acceptsHmo: ['Hygeia'],
        staffIds: [String(pharmacistA)],
        ...over,
      });
    assert.equal((await svc('ph-1')).status, 200);
    assert.equal((await svc('ph-2', { name: 'Other Pharmacy', staffIds: [String(pharmacistB)] })).status, 200);
  });
  after(async () => { server?.close(); await disconnect(); });

  it('needs sign-in for patients and a pharmacist account for staff routes', async () => {
    assert.equal((await call('GET', '/pharmacy-orders')).status, 401);
    assert.equal((await call('GET', '/staff/pharmacy/orders')).status, 401);
    assert.equal((await call('GET', '/staff/pharmacy/orders', undefined, { staff: alice, role: 'records_officer' })).status, 403);
  });

  it('lists pharmacies nearest first with delivery range and payment options', async () => {
    const r = await patient('GET', `/pharmacy-orders/pharmacies?lat=${NEAR.lat}&lng=${NEAR.lng}`);
    assert.equal(r.status, 200);
    assert.ok(r.pharmacies.length >= 2);
    assert.equal(r.pharmacies[0].deliveryAvailable, true);
    assert.equal(r.pharmacies[0].deliveryFromMinor, 150_000);
    const far = await patient('GET', `/pharmacy-orders/pharmacies?lat=${FAR.lat}&lng=${FAR.lng}`);
    assert.equal(far.pharmacies[0].deliveryAvailable, false);
  });

  it('refuses delivery without fee bands or coordinates', async () => {
    assert.equal((await asAdmin('PUT', '/staff/pharmacy/services/ph-x', { name: 'X', feeBands: [], ...HERE })).status, 400);
    assert.equal((await asAdmin('PUT', '/staff/pharmacy/services/ph-x', { name: 'X', feeBands: [{ maxKm: 5, feeMinor: 100 }] })).status, 400);
    assert.equal((await asB('PUT', '/staff/pharmacy/services/ph-1', { feeBands: [{ maxKm: 5, feeMinor: 100 }] })).status, 403);
    assert.equal((await asA('PUT', '/staff/pharmacy/services/ph-1', { feeBands: [] })).status, 400);
  });

  it('accepts a real image, refuses a disguised file, and keeps files private to the owner', async () => {
    const bad = await patient('POST', '/pharmacy-orders/attachments', { dataBase64: Buffer.from('<html>hi</html>').toString('base64') });
    assert.equal(bad.status, 400);
    const id = await newAttachment();
    const mine = await patient('GET', `/pharmacy-orders/attachments/${id}`);
    assert.equal(mine.contentType, 'image/png');
    assert.equal(mine.dataBase64, PNG);
    assert.equal((await patient('GET', `/pharmacy-orders/attachments/${id}`, undefined, bob)).status, 404);
    // Stored sealed, not as the file itself.
    const raw: any = await PharmacyAttachment.findById(id).lean();
    assert.ok(!String(raw.sealed).includes(PNG.slice(0, 20)));
  });

  it('needs consent to share a prescription and cannot use someone else\'s file', async () => {
    const f = await newAttachment();
    assert.equal((await place({ attachmentIds: [f] })).status, 400);
    assert.equal((await place({ attachmentIds: [f], consentShare: true }, bob)).status, 400);
    const ok = await place({ attachmentIds: [f], consentShare: true });
    assert.equal(ok.status, 201);
    assert.equal(ok.order.status, 'awaiting_review');
    assert.ok(audits.includes('prescription_shared'));
  });

  it('only the assigned pharmacist sees an order, and opening a file is logged', async () => {
    const f = await newAttachment();
    const r = await place({ attachmentIds: [f], consentShare: true });
    const id = r.order.id;
    assert.equal((await asA('GET', `/staff/pharmacy/orders/${id}`)).status, 200);
    assert.equal((await asB('GET', `/staff/pharmacy/orders/${id}`)).status, 404);
    const list = await asB('GET', '/staff/pharmacy/orders?status=awaiting_review');
    assert.ok(!list.orders.some((o: any) => o.id === id));
    assert.equal((await asAdmin('GET', `/staff/pharmacy/orders/${id}`)).status, 200);
    const before = audits.filter((a) => a === 'prescription_viewed').length;
    const file = await asA('GET', `/staff/pharmacy/orders/${id}/files/${f}`);
    assert.equal(file.status, 200);
    assert.equal(audits.filter((a) => a === 'prescription_viewed').length, before + 1);
    assert.equal((await asB('GET', `/staff/pharmacy/orders/${id}/files/${f}`)).status, 404);
  });

  it('delivery order paid on delivery: quote, checkout, dispatch, handover code', async () => {
    const id = await quoted({ linkToRecord: true, attachmentIds: [await newAttachment()], consentShare: true });
    // Alternatives can be left out, so the total follows what the patient keeps.
    const co = await checkout(id, { ...homeDelivery, paymentMethod: 'on_delivery', excluded: [1] });
    assert.equal(co.status, 200, JSON.stringify(co));
    assert.equal(co.order.status, 'confirmed');
    assert.equal(co.order.medsMinor, 21 * 15_000);
    assert.equal(co.order.deliveryFeeMinor, 150_000);
    assert.equal(co.order.totalMinor, 21 * 15_000 + 150_000);
    assert.equal(co.order.paymentStatus, 'pay_on_delivery');
    const code = co.order.handoverCode;
    assert.match(code, /^\d{6}$/);
    // Not dispatched until a rider is assigned, and it needs the rider's details.
    assert.equal((await asA('POST', `/staff/pharmacy/orders/${id}/dispatch`, { riderName: 'R' })).status, 400);
    assert.equal((await asA('POST', `/staff/pharmacy/orders/${id}/deliver`, { code })).status, 409);
    assert.equal((await asA('POST', `/staff/pharmacy/orders/${id}/dispatch`, { riderName: 'Musa Rider', riderPhone: '08099998888', etaNote: 'About 40 minutes' })).status, 200);
    const mid = await patient('GET', `/pharmacy-orders/${id}`);
    assert.equal(mid.order.status, 'dispatched');
    assert.equal(mid.order.dispatch.riderName, 'Musa Rider');
    // Patient cannot cancel once it is on the way.
    assert.equal((await patient('POST', `/pharmacy-orders/${id}/cancel`, {})).status, 409);
    // Staff do not get the code back from the order detail.
    assert.equal((await asA('GET', `/staff/pharmacy/orders/${id}`)).order.handoverCode, undefined);
    const wrong = code === '000000' ? '111111' : '000000';
    assert.equal((await asA('POST', `/staff/pharmacy/orders/${id}/deliver`, { code: wrong })).status, 400);
    assert.equal((await asA('POST', `/staff/pharmacy/orders/${id}/deliver`, { code })).status, 200);
    const done = await patient('GET', `/pharmacy-orders/${id}`);
    assert.equal(done.order.status, 'delivered');
    assert.equal(done.order.paymentStatus, 'paid_on_handover');
    assert.equal(done.order.handoverCode, null);
    // Medication added to the record because the patient agreed.
    assert.equal(await Prescription.countDocuments({ notes: `From order ${done.order.ref}` }), 1);
    // Files get a 30 day expiry once the order ends.
    const files: any[] = await PharmacyAttachment.find({ orderId: id }).lean();
    assert.ok(files.length === 1 && files[0].expiresAt);
  });

  it('locks handover after five wrong codes, even for the right code', async () => {
    const id = await quoted();
    const co = await checkout(id, { ...homeDelivery, paymentMethod: 'on_delivery' });
    await asA('POST', `/staff/pharmacy/orders/${id}/dispatch`, { riderName: 'Rider', riderPhone: '08099998888' });
    const wrong = co.order.handoverCode === '123456' ? '654321' : '123456';
    for (let i = 0; i < 5; i++) assert.equal((await asA('POST', `/staff/pharmacy/orders/${id}/deliver`, { code: wrong })).status, 400);
    assert.equal((await asA('POST', `/staff/pharmacy/orders/${id}/deliver`, { code: co.order.handoverCode })).status, 423);
  });

  it('pickup is paid at the counter and collected with the code', async () => {
    const id = await quoted();
    const co = await checkout(id, { fulfilment: 'pickup', paymentMethod: 'at_pickup' });
    assert.equal(co.status, 200, JSON.stringify(co));
    assert.equal(co.order.deliveryFeeMinor, 0);
    assert.equal((await asA('POST', `/staff/pharmacy/orders/${id}/dispatch`, { riderName: 'Rider', riderPhone: '08099998888' })).status, 409);
    assert.equal((await asA('POST', `/staff/pharmacy/orders/${id}/ready`)).status, 200);
    assert.equal((await asA('POST', `/staff/pharmacy/orders/${id}/collect`, { code: co.order.handoverCode })).status, 200);
    assert.equal((await patient('GET', `/pharmacy-orders/${id}`)).order.status, 'collected');
  });

  it('shows the total and payment options before the patient commits, and saves nothing', async () => {
    const id = await quoted();
    const pv = await patient('POST', `/pharmacy-orders/${id}/preview`, { ...homeDelivery, excluded: [1] });
    assert.equal(pv.status, 200, JSON.stringify(pv));
    assert.equal(pv.medsMinor, 21 * 15_000);
    assert.equal(pv.deliveryFeeMinor, 150_000);
    assert.equal(pv.totalMinor, 21 * 15_000 + 150_000);
    assert.deepEqual(pv.methods.sort(), ['on_delivery', 'online']);
    assert.deepEqual(pv.hmo, ['Hygeia']);
    const pk = await patient('POST', `/pharmacy-orders/${id}/preview`, { fulfilment: 'pickup' });
    assert.equal(pk.totalMinor, 21 * 15_000 + 5_000 * 20);
    assert.deepEqual(pk.methods.sort(), ['at_pickup', 'online']);
    const o = (await patient('GET', `/pharmacy-orders/${id}`)).order;
    assert.equal(o.status, 'quoted');
    assert.equal(o.fulfilment, null);
    assert.equal((await patient('POST', `/pharmacy-orders/${id}/preview`, { ...homeDelivery }, bob)).status, 404);
  });

  it('refuses pay-on-delivery for pickup and an address outside the delivery area', async () => {
    const id = await quoted();
    assert.equal((await checkout(id, { fulfilment: 'pickup', paymentMethod: 'on_delivery' })).status, 409);
    const far = await checkout(id, { fulfilment: 'delivery', address: { ...homeDelivery.address, ...FAR }, paymentMethod: 'on_delivery' });
    assert.equal(far.status, 409);
    assert.equal(far.code, 'out_of_range');
    assert.equal((await checkout(id, { fulfilment: 'delivery', address: { text: 'x', recipientPhone: '1' }, paymentMethod: 'on_delivery' })).status, 400);
    assert.equal((await patient('GET', `/pharmacy-orders/${id}`)).order.status, 'quoted');
  });

  it('online payment confirms only when the payment provider says so, once, for the full amount', async () => {
    const id = await quoted();
    const co = await checkout(id, { ...homeDelivery, paymentMethod: 'online' });
    assert.equal(co.status, 200, JSON.stringify(co));
    assert.equal(co.order.status, 'awaiting_payment');
    assert.match(co.authorizationUrl, /^https:\/\/pay\.test\/wo-[a-f0-9]{24}-[a-f0-9]{6}$/);
    const ref = co.authorizationUrl.replace('https://pay.test/', '');
    // The dispatch step is closed while payment is open.
    assert.equal((await asA('POST', `/staff/pharmacy/orders/${id}/dispatch`, { riderName: 'Rider', riderPhone: '08099998888' })).status, 409);
    // Underpaid: flagged for refund review, not confirmed.
    verifyResult = { success: true, amountMinor: co.order.totalMinor - 1, currency: 'NGN' };
    await pharmacy.verifyAndSettle(ref);
    let o: any = await PharmacyOrder.findById(id).lean();
    assert.equal(o.status, 'awaiting_payment');
    assert.equal(o.paymentStatus, 'refund_due');
    // Full amount settles it, and a second call changes nothing.
    await PharmacyOrder.updateOne({ _id: id }, { $set: { paymentStatus: 'pending' } });
    verifyResult = { success: true, amountMinor: co.order.totalMinor, currency: 'NGN' };
    await pharmacy.verifyAndSettle(ref);
    await pharmacy.verifyAndSettle(ref);
    o = await PharmacyOrder.findById(id).lean();
    assert.equal(o.status, 'confirmed');
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(o.events.filter((e: any) => e.status === 'confirmed').length, 1);
    // A failed payment does nothing.
    const id2 = await quoted();
    const co2 = await checkout(id2, { ...homeDelivery, paymentMethod: 'online' });
    verifyResult = { success: false, amountMinor: 0, currency: 'NGN' };
    await pharmacy.verifyAndSettle(co2.authorizationUrl.replace('https://pay.test/', ''));
    assert.equal((await PharmacyOrder.findById(id2).lean() as any).status, 'awaiting_payment');
    assert.equal(pharmacy.isOrderReference('wr-' + 'a'.repeat(24)), false);
  });

  it('HMO: waits for staff, then the balance goes to payment', async () => {
    const id = await quoted();
    assert.equal((await checkout(id, { ...homeDelivery, paymentMethod: 'hmo', hmo: { provider: 'Other HMO' } })).status, 409);
    const co = await checkout(id, { ...homeDelivery, paymentMethod: 'hmo', hmo: { provider: 'hygeia', memberId: 'HY123' } });
    assert.equal(co.status, 200, JSON.stringify(co));
    assert.equal(co.order.status, 'awaiting_hmo');
    assert.equal((await asA('POST', `/staff/pharmacy/orders/${id}/dispatch`, { riderName: 'Rider', riderPhone: '08099998888' })).status, 409);
    const total = co.order.totalMinor;
    assert.equal((await asA('POST', `/staff/pharmacy/orders/${id}/hmo`, { decision: 'approve', coveredMinor: 0 })).status, 400);
    assert.equal((await asA('POST', `/staff/pharmacy/orders/${id}/hmo`, { decision: 'approve', coveredMinor: 100_000 })).status, 200);
    const after = await patient('GET', `/pharmacy-orders/${id}`);
    assert.equal(after.order.status, 'awaiting_payment');
    assert.equal(after.order.dueMinor, total - 100_000);
    const pay = await patient('POST', `/pharmacy-orders/${id}/pay`, {});
    assert.equal(pay.status, 200);
    assert.match(pay.authorizationUrl, /^https:\/\/pay\.test\/wo-/);
    // Full cover goes straight to confirmed.
    const id2 = await quoted();
    const c2 = await checkout(id2, { fulfilment: 'pickup', paymentMethod: 'hmo', hmo: { provider: 'Hygeia' } });
    await asA('POST', `/staff/pharmacy/orders/${id2}/hmo`, { decision: 'approve', coveredMinor: c2.order.totalMinor });
    assert.equal((await patient('GET', `/pharmacy-orders/${id2}`)).order.status, 'confirmed');
    // A declined cover sends the patient back to choose again.
    const id3 = await quoted();
    await checkout(id3, { fulfilment: 'pickup', paymentMethod: 'hmo', hmo: { provider: 'Hygeia' } });
    await asA('POST', `/staff/pharmacy/orders/${id3}/hmo`, { decision: 'decline', reason: 'Not covered' });
    assert.equal((await patient('GET', `/pharmacy-orders/${id3}`)).order.status, 'quoted');
  });

  it('cancelling a paid order flags a refund and nothing is refunded automatically', async () => {
    const id = await quoted();
    const co = await checkout(id, { ...homeDelivery, paymentMethod: 'online' });
    verifyResult = { success: true, amountMinor: co.order.totalMinor, currency: 'NGN' };
    await pharmacy.verifyAndSettle(co.authorizationUrl.replace('https://pay.test/', ''));
    const c = await patient('POST', `/pharmacy-orders/${id}/cancel`, { reason: 'Changed my mind' });
    assert.equal(c.status, 200);
    assert.equal(c.order.status, 'cancelled');
    assert.equal(c.order.paymentStatus, 'refund_due');
  });

  it('rejects and quote rules: needs a reason, an available line, and only works from review', async () => {
    const r = await place();
    const id = r.order.id;
    assert.equal((await asA('POST', `/staff/pharmacy/orders/${id}/reject`, { reason: '' })).status, 400);
    assert.equal((await asA('POST', `/staff/pharmacy/orders/${id}/quote`, { lines: [{ name: 'X', quantity: 1, available: false }] })).status, 400);
    assert.equal((await asB('POST', `/staff/pharmacy/orders/${id}/quote`, quoteBody)).status, 404);
    assert.equal((await asA('POST', `/staff/pharmacy/orders/${id}/reject`, { reason: 'Prescription is unreadable' })).status, 200);
    assert.equal((await asA('POST', `/staff/pharmacy/orders/${id}/quote`, quoteBody)).status, 409);
    assert.equal((await patient('GET', `/pharmacy-orders/${id}`)).order.status, 'rejected');
    assert.equal((await patient('GET', `/pharmacy-orders/${id}`, undefined, bob)).status, 404);
  });

  it('limits how many open orders one person can have', async () => {
    const carol = new mongoose.Types.ObjectId();
    const body = { pharmacyId: 'ph-1', items: [{ name: 'Paracetamol', quantity: 1 }], acceptTerms: true };
    for (let i = 0; i < 5; i++) assert.equal((await patient('POST', '/pharmacy-orders', body, carol)).status, 201);
    assert.equal((await patient('POST', '/pharmacy-orders', body, carol)).status, 429);
  });

  it('a quote that has run out of time cannot be checked out', async () => {
    const id = await quoted();
    await PharmacyOrder.collection.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: { 'quote.expiresAt': new Date(Date.now() - 1000) } });
    const co = await checkout(id, { fulfilment: 'pickup', paymentMethod: 'at_pickup' });
    assert.equal(co.status, 409);
    assert.equal((await patient('GET', `/pharmacy-orders/${id}`)).order.status, 'expired');
  });

  it('lets an assigned pharmacist change prices and payment options but not identity, position or staff', async () => {
    const put = (id: string, body: any, who: any) => call('PUT', `/staff/pharmacy/services/${id}`, body, { staff: who });
    const edit = { feeBands: [{ maxKm: 4, feeMinor: 120_000 }], deliveryEta: 'Same day', payOnDelivery: false, phone: '08000000000' };
    const ok = await put('ph-1', { name: 'Renamed', address: 'Elsewhere', lat: 1, lng: 1, staffIds: [String(pharmacistB)], deliveryEnabled: true, pickupEnabled: true, ...edit }, pharmacistA);
    assert.equal(ok.status, 200);
    assert.equal(ok.service.feeBands[0].feeMinor, 120_000);
    assert.equal(ok.service.deliveryEta, 'Same day');
    assert.equal(ok.service.name, 'City Pharmacy');
    assert.equal(ok.service.address, 'Central Area, Abuja');
    assert.notEqual(ok.service.lat, 1);
    assert.deepEqual(ok.service.staffIds, [String(pharmacistA)]);
    // Not assigned, or a pharmacy that does not exist yet: refused.
    assert.equal((await put('ph-1', edit, pharmacistB)).status, 403);
    assert.equal((await put('ph-new', { name: 'New', ...edit }, pharmacistA)).status, 403);
  });

});
