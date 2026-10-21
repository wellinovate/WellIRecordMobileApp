// Pharmacy ordering: the patient sends a request with a prescription, the pharmacist reviews it and
// sends a quote, the patient chooses delivery or pickup and a payment method at checkout, and the
// order is handed over against a six digit code. Rules live in pharmacyCore.ts.
//
// The delivery address is collected at checkout, after the quote, because the delivery fee depends
// on it. Nothing leaves the pharmacy until the payment rule for the chosen method is met.
// Prescription photos are sealed in our own database and never sent to a third party.

import { cleanSubaccount, onlineAllowed, splitFor } from './paystackSplit';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Request, RequestHandler, Response, Router } from 'express';
import { PharmacyAttachment, PharmacyOrder, PharmacyService, Prescription, StaffRole } from './models';
import { PaystackClient } from './booking';
import { openSecret, sealSecret } from './totp';
import { formatNaira } from './bookingCore';
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_TYPES,
  PayMethod,
  QUOTE_TTL_MS,
  TIMELINE,
  afterHmoApproval,
  afterWrongCode,
  canMove,
  cleanBands,
  cleanItems,
  cleanQuoteLines,
  codeLocked,
  codeMatches,
  decidePayment,
  deliveryFee,
  haversineKm,
  medicationSubtotal,
  newHandoverCode,
  orderRef,
  patientCanCancel,
  sniffType,
  timelineStep,
} from './pharmacyCore';

export const PHARMACY_TERMS_VERSION = 'draft-1';
export const PHARMACY_TERMS = [
  'The pharmacist checks your prescription and stock, then sends you a price. You are not charged until you accept it and choose how to pay.',
  'Prices and delivery fees are set by the pharmacy. The delivery fee depends on your address and is shown before you pay.',
  'Pay online: the order goes ahead only after the payment succeeds. Pay on delivery or at pickup: you pay when you receive the medication.',
  'HMO: the order waits while the pharmacy confirms your cover. If cover is declined you can choose another way to pay.',
  'Your prescription photo is seen only by the pharmacy you chose. It is kept for 30 days after the order ends, then deleted.',
  'Give the six digit code to the rider or pharmacist only when you have your medication in hand.',
  'Whether a paid order is refunded is decided by the pharmacy.',
];

export interface PharmacyDeps {
  getAuthUserId: (req: Request) => string | null;
  limiter: RequestHandler;
  requireStaff: (...roles: StaffRole[]) => RequestHandler;
  paystack: PaystackClient;
  accountContact: (accountId: string) => Promise<{ email?: string; phone?: string; name: string }>;
  notify: (accountId: string, orderId: string, title: string, body: string) => Promise<void>;
  audit: (req: Request | null, accountId: string, action: string, actor: string, detail?: string) => Promise<void>;
  /** Key for sealing prescription photos and handover codes. */
  sealKey: string;
  listFacilities: () => Promise<{ id: string; name: string; address: string }[]>;
  /** Registered WelliRecord pharmacies: used to show a verified mark. */
  registeredIds?: () => Promise<Set<string>>;
  now?: () => number;
}

const oid = (v: unknown) => (mongoose.isValidObjectId(String(v)) ? new mongoose.Types.ObjectId(String(v)) : null);
const dbDown = () => mongoose.connection.readyState !== 1;
const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const REF_RE = /^wo-([a-f0-9]{24})-[a-f0-9]{6}$/;
const KEEP_AFTER_CLOSE_MS = 30 * 24 * 60 * 60 * 1000;
const ONLINE_PAY_WINDOW_MS = 30 * 60 * 1000;

export function createPharmacyOrders(deps: PharmacyDeps) {
  const now = () => (deps.now ? deps.now() : Date.now());
  const router = Router();

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
  const staffName = (req: Request) => (req.staff && !req.staff.legacy ? req.staff.name : 'staff');

  const terms = (svc: any) => ({
    onlinePayment: Boolean(svc.onlinePayment),
    payOnDelivery: Boolean(svc.payOnDelivery),
    payAtPickup: Boolean(svc.payAtPickup),
    acceptsHmo: svc.acceptsHmo || [],
  });

  const event = (o: any, status: string, by: string, note?: string) => {
    o.events.push({ at: new Date(now()), status, by, note });
  };

  const tell = (o: any, title: string, body: string) => {
    void deps.notify(String(o.accountId), String(o._id), title, body).catch(() => {});
  };

  // ----- shape sent to the app -----

  function view(o: any) {
    const showCode = ['confirmed', 'dispatched', 'ready_for_pickup'].includes(o.status) && o.handoverSealed;
    return {
      id: String(o._id),
      ref: orderRef(o._id),
      status: o.status,
      step: timelineStep({ status: o.status, hasAddress: Boolean(o.address?.text), fulfilment: o.fulfilment }),
      timeline: TIMELINE,
      pharmacy: { id: o.pharmacyId, name: o.pharmacyName, address: o.pharmacyAddress || '' },
      subjectName: o.subjectName,
      items: o.items,
      attachmentCount: (o.attachmentIds || []).length,
      linkToRecord: Boolean(o.linkToRecord),
      quote: o.quote
        ? {
            lines: (o.quote.lines || []).map((l: any, i: number) => ({ index: i, name: l.name, strength: l.strength, quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, available: l.available, alternative: l.alternative, note: l.note })),
            note: o.quote.note || '',
            expiresAt: o.quote.expiresAt,
          }
        : null,
      excluded: o.excluded || [],
      fulfilment: o.fulfilment || null,
      address: o.address ? { text: o.address.text, landmark: o.address.landmark, recipientName: o.address.recipientName, recipientPhone: o.address.recipientPhone } : null,
      distanceKm: o.distanceKm ?? null,
      medsMinor: o.medsMinor,
      deliveryFeeMinor: o.deliveryFeeMinor,
      feeEstimated: Boolean(o.feeEstimated),
      totalMinor: o.totalMinor,
      dueMinor: o.dueMinor,
      currency: o.currency || 'NGN',
      paymentMethod: o.paymentMethod || null,
      paymentStatus: o.paymentStatus || null,
      hmo: o.hmo ? { provider: o.hmo.provider, status: o.hmo.status, coveredMinor: o.hmo.coveredMinor ?? null, reason: o.hmo.reason || '' } : null,
      handoverCode: showCode ? openSecret(deps.sealKey, o.handoverSealed) : null,
      dispatch: o.dispatch ? { riderName: o.dispatch.riderName, riderPhone: o.dispatch.riderPhone, etaNote: o.dispatch.etaNote, assignedAt: o.dispatch.assignedAt } : null,
      events: (o.events || []).map((e: any) => ({ at: e.at, status: e.status, note: e.note || '' })),
      cancelReason: o.cancelReason || '',
      createdAt: o.createdAt,
      closedAt: o.closedAt || null,
    };
  }

  // ----- pharmacies -----

  router.get('/pharmacy-orders/config', (req, res) => {
    if (!deps.getAuthUserId(req)) return res.status(401).json({ success: false, message: 'Authentication required' });
    res.json({ success: true, onlinePayment: deps.paystack.configured, termsVersion: PHARMACY_TERMS_VERSION, terms: PHARMACY_TERMS, maxAttachments: 3, maxAttachmentBytes: ATTACHMENT_MAX_BYTES });
  });

  router.get('/pharmacy-orders/pharmacies', async (req, res) => {
    const id = authed(req, res);
    if (!id) return;
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const here = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
    try {
      const rows: any[] = await PharmacyService.find({ active: true }).limit(200).lean();
      const verified = deps.registeredIds ? await deps.registeredIds() : new Set<string>();
      const list = rows
        .map((s) => {
          const dist = here && typeof s.lat === 'number' && typeof s.lng === 'number' ? Math.round(haversineKm(here, { lat: s.lat, lng: s.lng }) * 10) / 10 : null;
          const fee = s.deliveryEnabled ? deliveryFee(s.feeBands || [], dist) : null;
          return {
            facilityId: s.facilityId,
            name: s.name,
            address: s.address || '',
            phone: s.phone || '',
            distanceKm: dist,
            deliveryAvailable: Boolean(s.deliveryEnabled) && !(fee && fee.outOfRange),
            pickupAvailable: Boolean(s.pickupEnabled),
            deliveryEta: s.deliveryEta || '',
            deliveryFromMinor: s.deliveryEnabled && (s.feeBands || []).length ? Math.min(...s.feeBands.map((b: any) => b.feeMinor)) : null,
            onlinePayment: Boolean(s.onlinePayment) && deps.paystack.configured,
            payOnDelivery: Boolean(s.payOnDelivery),
            payAtPickup: Boolean(s.payAtPickup),
            acceptsHmo: s.acceptsHmo || [],
            verified: verified.has(s.facilityId),
          };
        })
        .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
      res.json({ success: true, pharmacies: list });
    } catch (err) {
      fail500(res, 'GET /pharmacy-orders/pharmacies', err, 'Could not load pharmacies');
    }
  });

  // ----- prescription photo -----

  router.post('/pharmacy-orders/attachments', deps.limiter, async (req, res) => {
    const id = authed(req, res);
    if (!id) return;
    const b64 = typeof req.body?.dataBase64 === 'string' ? req.body.dataBase64.replace(/^data:[^;]+;base64,/, '') : '';
    if (!b64 || b64.length > Math.ceil((ATTACHMENT_MAX_BYTES * 4) / 3) + 8 || !/^[A-Za-z0-9+/=\s]+$/.test(b64)) {
      return res.status(400).json({ success: false, message: 'Choose a photo or PDF under 2.5 MB' });
    }
    try {
      const bytes = Buffer.from(b64, 'base64');
      if (!bytes.length || bytes.length > ATTACHMENT_MAX_BYTES) return res.status(400).json({ success: false, message: 'Choose a photo or PDF under 2.5 MB' });
      const type = sniffType(bytes);
      if (!type || !ATTACHMENT_TYPES.includes(type)) return res.status(400).json({ success: false, message: 'Only JPEG, PNG or PDF files can be sent' });
      const open = await PharmacyAttachment.countDocuments({ accountId: new mongoose.Types.ObjectId(id), orderId: { $exists: false } });
      if (open >= 6) return res.status(429).json({ success: false, message: 'Too many unsent files. Send an order or try again later.' });
      const doc = await PharmacyAttachment.create({
        accountId: new mongoose.Types.ObjectId(id),
        contentType: type,
        bytes: bytes.length,
        sealed: sealSecret(deps.sealKey, bytes.toString('base64')),
        // An upload that never becomes part of an order is removed after a day.
        expiresAt: new Date(now() + 24 * 60 * 60 * 1000),
      });
      res.status(201).json({ success: true, attachment: { id: String(doc._id), contentType: type, bytes: bytes.length } });
    } catch (err) {
      fail500(res, 'POST /pharmacy-orders/attachments', err, 'Could not save the file');
    }
  });

  router.get('/pharmacy-orders/attachments/:id', async (req, res) => {
    const id = authed(req, res);
    const aid = oid(req.params.id);
    if (!id) return;
    if (!aid) return res.status(404).json({ success: false, message: 'File not found' });
    try {
      const a: any = await PharmacyAttachment.findOne({ _id: aid, accountId: new mongoose.Types.ObjectId(id) }).lean();
      const data = a ? openSecret(deps.sealKey, a.sealed) : null;
      if (!a || !data) return res.status(404).json({ success: false, message: 'File not found' });
      res.set('Cache-Control', 'no-store');
      res.json({ success: true, contentType: a.contentType, dataBase64: data });
    } catch (err) {
      fail500(res, 'GET /pharmacy-orders/attachments/:id', err, 'Could not load the file');
    }
  });

  // ----- placing and reading orders -----

  router.post('/pharmacy-orders', deps.limiter, async (req, res) => {
    const id = authed(req, res);
    if (!id) return;
    const b = req.body || {};
    const items = cleanItems(b.items);
    if ('error' in items) return res.status(400).json({ success: false, message: items.error });
    const ids: string[] = Array.isArray(b.attachmentIds) ? [...new Set<string>(b.attachmentIds.map(String))].slice(0, 3) : [];
    if (b.acceptTerms !== true) return res.status(400).json({ success: false, message: 'Accept the terms to continue' });
    if (ids.length && b.consentShare !== true) return res.status(400).json({ success: false, message: 'Agree to share your prescription with the pharmacy' });
    try {
      const me = new mongoose.Types.ObjectId(id);
      const svc: any = await PharmacyService.findOne({ facilityId: clip(b.pharmacyId, 80), active: true }).lean();
      if (!svc) return res.status(404).json({ success: false, message: 'This pharmacy is not taking orders on WelliRecord yet.' });
      const files = ids.map(oid);
      if (files.some((f) => !f)) return res.status(400).json({ success: false, message: 'A file could not be found. Add it again.' });
      const owned = files.length ? await PharmacyAttachment.countDocuments({ _id: { $in: files }, accountId: me, orderId: { $exists: false } }) : 0;
      if (owned !== files.length) return res.status(400).json({ success: false, message: 'A file could not be found. Add it again.' });
      const active = await PharmacyOrder.countDocuments({ accountId: me, status: { $in: ['awaiting_review', 'quoted', 'awaiting_payment', 'awaiting_hmo'] } });
      if (active >= 5) return res.status(429).json({ success: false, message: 'You have several open orders. Finish or cancel one first.' });
      const contact = await deps.accountContact(id);
      const o: any = new PharmacyOrder({
        accountId: me,
        subjectName: clip(b.subjectName, 120) || contact.name,
        patientPhone: contact.phone,
        pharmacyId: svc.facilityId,
        pharmacyName: svc.name,
        pharmacyAddress: svc.address,
        items: items.items,
        attachmentIds: files,
        linkToRecord: b.linkToRecord === true && files.length > 0,
        consentAt: files.length ? new Date(now()) : undefined,
        status: 'awaiting_review',
        events: [],
      });
      event(o, 'awaiting_review', 'patient');
      await o.save();
      if (files.length) await PharmacyAttachment.updateMany({ _id: { $in: files } }, { $set: { orderId: o._id }, $unset: { expiresAt: 1 } });
      void deps.audit(req, id, 'prescription_shared', 'You', `Sent to ${svc.name} with order ${orderRef(o._id)}`).catch(() => {});
      res.status(201).json({ success: true, order: view(o) });
    } catch (err) {
      fail500(res, 'POST /pharmacy-orders', err, 'Could not send the order');
    }
  });

  /** Moves quotes that ran out of time to expired, so the app never offers a stale price. */
  async function expireIfStale(o: any) {
    if (o.status === 'quoted' && o.quote?.expiresAt && new Date(o.quote.expiresAt).getTime() <= now()) {
      const r = await PharmacyOrder.updateOne({ _id: o._id, status: 'quoted' }, { $set: { status: 'expired', closedAt: new Date(now()) }, $push: { events: { at: new Date(now()), status: 'expired', by: 'system', note: 'The quote ran out of time' } } });
      if (r.modifiedCount) {
        o.status = 'expired';
        await closeAttachments(o);
      }
    }
  }

  async function closeAttachments(o: any) {
    if (o.attachmentIds?.length) await PharmacyAttachment.updateMany({ _id: { $in: o.attachmentIds } }, { $set: { expiresAt: new Date(now() + KEEP_AFTER_CLOSE_MS) } });
  }

  router.get('/pharmacy-orders', async (req, res) => {
    const id = authed(req, res);
    if (!id) return;
    try {
      const rows: any[] = await PharmacyOrder.find({ accountId: new mongoose.Types.ObjectId(id) }).sort({ createdAt: -1 }).limit(50);
      for (const o of rows) await expireIfStale(o);
      res.json({ success: true, orders: rows.map(view) });
    } catch (err) {
      fail500(res, 'GET /pharmacy-orders', err, 'Could not load your orders');
    }
  });

  async function mine(req: Request, res: Response): Promise<any | null> {
    const id = authed(req, res);
    if (!id) return null;
    const oidv = oid(req.params.id);
    const o = oidv ? await PharmacyOrder.findOne({ _id: oidv, accountId: new mongoose.Types.ObjectId(id) }) : null;
    if (!o) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return null;
    }
    await expireIfStale(o);
    return o;
  }

  router.get('/pharmacy-orders/:id', async (req, res) => {
    try {
      let o = await mine(req, res);
      if (!o) return;
      if (o.status === 'awaiting_payment' && o.paymentRef && deps.paystack.configured) {
        try {
          if (await verifyAndSettle(o.paymentRef)) o = await PharmacyOrder.findById(o._id);
        } catch (err) {
          console.warn('[GET /pharmacy-orders/:id] verify failed:', err);
        }
      }
      res.json({ success: true, order: view(o) });
    } catch (err) {
      fail500(res, 'GET /pharmacy-orders/:id', err, 'Could not load the order');
    }
  });

  // ----- checkout -----

  const phoneOk = (v: string) => /^\+?\d[\d\s-]{7,16}$/.test(v);

  type Priced =
    | { ok: false; status: number; message: string; code?: string }
    | { ok: true; svc: any; fulfilment: 'delivery' | 'pickup'; excluded: number[]; meds: number; address: any; distanceKm: number | null; fee: { feeMinor: number; estimated: boolean; outOfRange: boolean }; total: number };

  /** Works out the medication subtotal, delivery fee and total for the patient's choices. Saves nothing. */
  async function price(o: any, b: any): Promise<Priced> {
    const no = (status: number, message: string, code?: string): Priced => ({ ok: false, status, message, code });
    if (!['quoted', 'awaiting_payment'].includes(o.status)) return no(409, 'This order is not ready for checkout.');
    const svc: any = await PharmacyService.findOne({ facilityId: o.pharmacyId, active: true }).lean();
    if (!svc) return no(409, 'This pharmacy is no longer taking orders.');
    const fulfilment = b.fulfilment === 'pickup' ? 'pickup' : b.fulfilment === 'delivery' ? 'delivery' : null;
    if (!fulfilment) return no(400, 'Choose delivery or pickup');

    const lines = o.quote?.lines || [];
    const excluded: number[] = Array.isArray(b.excluded) ? [...new Set<number>(b.excluded.map(Number).filter((n: number) => Number.isInteger(n) && n >= 0 && n < lines.length && lines[n].alternative))] : [];
    const meds = medicationSubtotal(lines, excluded);
    if (meds <= 0) return no(400, 'Keep at least one medication in the order.');

    let address: any;
    let distanceKm: number | null = null;
    let fee = { feeMinor: 0, estimated: false, outOfRange: false };
    if (fulfilment === 'delivery') {
      if (!svc.deliveryEnabled) return no(409, 'This pharmacy does not deliver. Choose pickup.');
      const a = b.address || {};
      const text = clip(a.text, 300);
      const recipientPhone = clip(a.recipientPhone, 20);
      if (text.length < 8) return no(400, 'Enter the full delivery address with a landmark');
      if (!phoneOk(recipientPhone)) return no(400, 'Enter a phone number for the person receiving the order');
      const lat = num(a.lat);
      const lng = num(a.lng);
      const located = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
      address = { text, landmark: clip(a.landmark, 120), recipientName: clip(a.recipientName, 80), recipientPhone, ...(located ? { lat, lng } : {}) };
      if (located && typeof svc.lat === 'number' && typeof svc.lng === 'number') distanceKm = Math.round(haversineKm({ lat: lat!, lng: lng! }, { lat: svc.lat, lng: svc.lng }) * 10) / 10;
      fee = deliveryFee(svc.feeBands || [], distanceKm);
      if (fee.outOfRange) return no(409, 'This address is outside the pharmacy\'s delivery area. Choose pickup or another pharmacy.', 'out_of_range');
    } else if (!svc.pickupEnabled) {
      return no(409, 'This pharmacy does not offer pickup.');
    }
    return { ok: true, svc, fulfilment, excluded, meds, address, distanceKm, fee, total: meds + fee.feeMinor };
  }

  // The total before the patient commits: nothing is saved and no payment starts.
  router.post('/pharmacy-orders/:id/preview', deps.limiter, async (req, res) => {
    try {
      const o = await mine(req, res);
      if (!o) return;
      const p = await price(o, req.body || {});
      if (p.ok === false) return res.status(p.status).json({ success: false, message: p.message, code: p.code });
      const methods = (['online', 'on_delivery', 'at_pickup'] as PayMethod[]).filter(
        (m) => decidePayment({ method: m, fulfilment: p.fulfilment, svc: terms(p.svc), gatewayConfigured: deps.paystack.configured && onlineAllowed(p.svc?.paystackSubaccount) }).ok
      );
      res.json({
        success: true,
        medsMinor: p.meds,
        deliveryFeeMinor: p.fee.feeMinor,
        feeEstimated: p.fee.estimated,
        distanceKm: p.distanceKm,
        totalMinor: p.total,
        methods,
        hmo: p.svc.acceptsHmo || [],
        eta: p.fulfilment === 'delivery' ? p.svc.deliveryEta || '' : '',
      });
    } catch (err) {
      fail500(res, 'POST /pharmacy-orders/:id/preview', err, 'Could not work out the total');
    }
  });

  router.post('/pharmacy-orders/:id/checkout', deps.limiter, async (req, res) => {
    try {
      const o = await mine(req, res);
      if (!o) return;
      const b = req.body || {};
      if (b.acceptTerms !== true) return res.status(400).json({ success: false, message: 'Accept the terms to continue' });
      const p = await price(o, b);
      if (p.ok === false) return res.status(p.status).json({ success: false, message: p.message, code: p.code });
      const { svc, fulfilment, excluded, meds, address, distanceKm, fee } = p;

      const method = b.paymentMethod as PayMethod;
      const hmoIn = b.hmo && typeof b.hmo === 'object' ? b.hmo : {};
      const decision = decidePayment({ method, fulfilment, svc: terms(svc), gatewayConfigured: deps.paystack.configured && onlineAllowed(svc?.paystackSubaccount), hmoProvider: clip(hmoIn.provider, 80) });
      if (decision.ok === false) {
        const no = decision as { message: string; code: string };
        return res.status(409).json({ success: false, message: no.message, code: no.code });
      }

      const total = p.total;
      let email: string | undefined;
      if (method === 'online') {
        email = (await deps.accountContact(String(o.accountId))).email;
        if (!email) return res.status(409).json({ success: false, message: 'Add an email address to your account to pay online, or choose another way to pay.' });
      }

      o.excluded = excluded;
      o.fulfilment = fulfilment;
      o.address = address;
      o.distanceKm = distanceKm;
      o.medsMinor = meds;
      o.deliveryFeeMinor = fee.feeMinor;
      o.feeEstimated = fee.estimated;
      o.totalMinor = total;
      o.dueMinor = total;
      o.paymentMethod = method;
      o.paymentStatus = decision.paymentStatus;
      o.hmo = method === 'hmo' ? { provider: clip(hmoIn.provider, 80), memberId: clip(hmoIn.memberId, 60), status: 'awaiting', coveredMinor: 0 } : undefined;
      o.status = decision.status;
      o.handoverSealed = o.handoverSealed || sealSecret(deps.sealKey, newHandoverCode());
      event(o, decision.status, 'patient', `${fulfilment === 'delivery' ? 'Delivery' : 'Pickup'}, ${method.replace('_', ' ')}`);
      await o.save();

      let authorizationUrl: string | undefined;
      if (method === 'online') {
        try {
          authorizationUrl = await startPayment(o, email!);
        } catch (err) {
          console.error('[POST /pharmacy-orders/:id/checkout] payment start failed:', err);
          o.status = 'quoted';
          o.paymentStatus = undefined;
          await o.save();
          return res.status(502).json({ success: false, message: 'Could not start the payment. Try again, or choose another payment method.' });
        }
      }
      if (decision.status === 'confirmed') tell(o, 'Order confirmed', `${o.pharmacyName} will prepare your order. Ref ${orderRef(o._id)}.`);
      if (decision.status === 'awaiting_hmo') tell(o, 'Awaiting HMO confirmation', `${o.pharmacyName} is confirming your cover. Ref ${orderRef(o._id)}.`);
      const notice =
        decision.status === 'confirmed'
          ? `Order confirmed. Total ${formatNaira(total)}, paid ${fulfilment === 'delivery' ? 'on delivery' : 'at pickup'}.`
          : decision.status === 'awaiting_payment'
            ? 'Finish the payment to confirm your order.'
            : 'Awaiting HMO confirmation. We will tell you when the pharmacy confirms your cover.';
      res.json({ success: true, order: view(o), authorizationUrl, notice });
    } catch (err) {
      fail500(res, 'POST /pharmacy-orders/:id/checkout', err, 'Could not complete checkout');
    }
  });

  async function startPayment(o: any, email: string): Promise<string> {
    const reference = `wo-${o._id}-${crypto.randomBytes(3).toString('hex')}`;
    const svc: any = await PharmacyService.findOne({ facilityId: o.pharmacyId }).select('paystackSubaccount').lean();
    const init = await deps.paystack.initialize({
      email,
      amountMinor: o.dueMinor,
      reference,
      metadata: { orderId: String(o._id), orderRef: orderRef(o._id) },
      split: splitFor({ subaccount: svc?.paystackSubaccount, amountMinor: o.dueMinor }),
    });
    o.paymentRef = reference;
    o.paymentStartedAt = new Date(now());
    await o.save();
    return init.authorizationUrl;
  }

  // Pay the balance after HMO cover, or retry a payment that was not finished.
  router.post('/pharmacy-orders/:id/pay', deps.limiter, async (req, res) => {
    try {
      const o = await mine(req, res);
      if (!o) return;
      if (o.status !== 'awaiting_payment' || o.dueMinor <= 0) return res.status(409).json({ success: false, message: 'Nothing is waiting for payment on this order.' });
      if (!deps.paystack.configured) return res.status(409).json({ success: false, message: 'Online payment is not available right now.' });
      const email = (await deps.accountContact(String(o.accountId))).email;
      if (!email) return res.status(409).json({ success: false, message: 'Add an email address to your account to pay online.' });
      const authorizationUrl = await startPayment(o, email);
      res.json({ success: true, order: view(o), authorizationUrl });
    } catch (err) {
      fail500(res, 'POST /pharmacy-orders/:id/pay', err, 'Could not start the payment');
    }
  });

  router.post('/pharmacy-orders/:id/cancel', deps.limiter, async (req, res) => {
    try {
      const o = await mine(req, res);
      if (!o) return;
      if (!patientCanCancel(o.status)) return res.status(409).json({ success: false, message: 'This order can no longer be cancelled here.' });
      await cancelOrder(o, 'patient', clip(req.body?.reason, 200) || 'Cancelled by you');
      res.json({ success: true, order: view(o) });
    } catch (err) {
      fail500(res, 'POST /pharmacy-orders/:id/cancel', err, 'Could not cancel the order');
    }
  });

  async function cancelOrder(o: any, by: string, reason: string) {
    // Money already taken is flagged for a person to refund. Nothing is refunded automatically.
    if (o.paymentStatus === 'paid') o.paymentStatus = 'refund_due';
    else if (['pending', 'awaiting_hmo', 'pay_on_delivery', 'pay_at_pickup'].includes(o.paymentStatus || '')) o.paymentStatus = 'cancelled';
    o.status = 'cancelled';
    o.cancelReason = reason;
    o.closedAt = new Date(now());
    event(o, 'cancelled', by, reason);
    await o.save();
    await closeAttachments(o);
  }

  // ----- payment confirmation -----

  /** Called when a payment is known to have succeeded (webhook, status check or sweep). Safe to call twice. */
  async function settlePaid(o: any, paidMinor: number): Promise<'confirmed' | 'already' | 'refund_due'> {
    if (o.paymentStatus === 'paid') return 'already';
    if (o.status !== 'awaiting_payment' || paidMinor < o.dueMinor) {
      await PharmacyOrder.updateOne({ _id: o._id }, { $set: { paymentStatus: 'refund_due' }, $push: { events: { at: new Date(now()), status: o.status, by: 'system', note: 'Payment needs a refund review' } } });
      console.warn(`[pharmacy] payment ${o.paymentRef} needs a refund review (status ${o.status}, paid ${paidMinor}, due ${o.dueMinor})`);
      return 'refund_due';
    }
    const r = await PharmacyOrder.updateOne(
      { _id: o._id, status: 'awaiting_payment' },
      { $set: { status: 'confirmed', paymentStatus: 'paid' }, $push: { events: { at: new Date(now()), status: 'confirmed', by: 'system', note: 'Payment received' } } }
    );
    if (r.modifiedCount) tell(o, 'Payment received', `${o.pharmacyName} will prepare your order. Ref ${orderRef(o._id)}.`);
    return r.modifiedCount ? 'confirmed' : 'already';
  }

  async function verifyAndSettle(reference: string): Promise<boolean> {
    const m = REF_RE.exec(reference);
    if (!m) return false;
    const o: any = await PharmacyOrder.findById(m[1]);
    if (!o) return false;
    const v = await deps.paystack.verify(reference);
    if (!v.success || v.currency !== (o.currency || 'NGN')) return false;
    await settlePaid(o, v.amountMinor);
    return true;
  }

  const isOrderReference = (reference: string) => REF_RE.test(reference);

  async function sweep() {
    if (dbDown()) return;
    try {
      const t = now();
      // Quotes that ran out of time.
      const stale: any[] = await PharmacyOrder.find({ status: 'quoted', 'quote.expiresAt': { $lte: new Date(t) } }).limit(50);
      for (const o of stale) await expireIfStale(o);
      // Online payments that never finished.
      const unpaid: any[] = await PharmacyOrder.find({ status: 'awaiting_payment', paymentStartedAt: { $lt: new Date(t - ONLINE_PAY_WINDOW_MS) } }).limit(50);
      for (const o of unpaid) {
        let paid = false;
        if (o.paymentRef && deps.paystack.configured) {
          try {
            paid = await verifyAndSettle(o.paymentRef);
          } catch {
            continue;
          }
        }
        if (!paid) {
          // Back to the quote so the patient can choose again; the price is still valid until it expires.
          await PharmacyOrder.updateOne({ _id: o._id, status: 'awaiting_payment' }, { $set: { status: 'quoted', paymentStatus: undefined }, $push: { events: { at: new Date(t), status: 'quoted', by: 'system', note: 'Payment not completed' } } });
        }
      }
    } catch (err) {
      console.warn('[pharmacy sweep] failed:', err);
    }
  }

  // ----- pharmacy staff -----

  const PHARMACY_ROLES: StaffRole[] = ['pharmacist'];
  const staffOnly = deps.requireStaff(...PHARMACY_ROLES);

  /** Admin sees every pharmacy. A pharmacist sees only the pharmacies they are assigned to. */
  async function visibleIds(req: Request): Promise<string[] | null> {
    if (!req.staff || req.staff.role === 'admin' || req.staff.legacy) return null;
    const rows: any[] = await PharmacyService.find({ staffIds: req.staff.id }, 'facilityId').lean();
    return rows.map((r) => r.facilityId);
  }

  async function staffOrder(req: Request, res: Response): Promise<any | null> {
    const oidv = oid(req.params.id);
    const o = oidv ? await PharmacyOrder.findById(oidv) : null;
    const scope = await visibleIds(req);
    if (!o || (scope && !scope.includes(o.pharmacyId))) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return null;
    }
    return o;
  }

  const STAFF_STATUSES = ['awaiting_review', 'quoted', 'awaiting_payment', 'awaiting_hmo', 'confirmed', 'dispatched', 'ready_for_pickup', 'delivered', 'collected', 'cancelled', 'rejected', 'expired'];

  router.get('/staff/pharmacy/orders', staffOnly, async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : 'awaiting_review';
    if (!STAFF_STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'Unknown status' });
    try {
      const scope = await visibleIds(req);
      const q: any = { status };
      if (scope) q.pharmacyId = { $in: scope };
      const rows: any[] = await PharmacyOrder.find(q).sort({ createdAt: 1 }).limit(200).lean();
      res.json({
        success: true,
        orders: rows.map((o) => ({
          id: String(o._id),
          ref: orderRef(o._id),
          status: o.status,
          pharmacyId: o.pharmacyId,
          pharmacyName: o.pharmacyName,
          subjectName: o.subjectName,
          itemCount: (o.items || []).length,
          fileCount: (o.attachmentIds || []).length,
          fulfilment: o.fulfilment || null,
          paymentMethod: o.paymentMethod || null,
          paymentStatus: o.paymentStatus || null,
          totalMinor: o.totalMinor,
          createdAt: o.createdAt,
        })),
      });
    } catch (err) {
      fail500(res, 'GET /staff/pharmacy/orders', err, 'Could not load orders');
    }
  });

  router.get('/staff/pharmacy/orders/:id', staffOnly, async (req, res) => {
    try {
      const o = await staffOrder(req, res);
      if (!o) return;
      const files: any[] = o.attachmentIds?.length ? await PharmacyAttachment.find({ _id: { $in: o.attachmentIds } }, 'contentType bytes').lean() : [];
      const v: any = view(o);
      // Staff see the patient's phone and address; the handover code stays with the patient.
      delete v.handoverCode;
      res.json({ success: true, order: { ...v, patientPhone: o.patientPhone || '', address: o.address || null, files: files.map((f) => ({ id: String(f._id), contentType: f.contentType, bytes: f.bytes })), hmoMemberId: o.hmo?.memberId || '', requested: o.items } });
    } catch (err) {
      fail500(res, 'GET /staff/pharmacy/orders/:id', err, 'Could not load the order');
    }
  });

  router.get('/staff/pharmacy/orders/:id/files/:fileId', staffOnly, async (req, res) => {
    try {
      const o = await staffOrder(req, res);
      if (!o) return;
      const fid = oid(req.params.fileId);
      if (!fid || !(o.attachmentIds || []).some((x: any) => String(x) === String(fid))) return res.status(404).json({ success: false, message: 'File not found' });
      const a: any = await PharmacyAttachment.findById(fid).lean();
      const data = a ? openSecret(deps.sealKey, a.sealed) : null;
      if (!a || !data) return res.status(404).json({ success: false, message: 'File not found' });
      void deps.audit(req, String(o.accountId), 'prescription_viewed', `${staffName(req)} at ${o.pharmacyName}`, `Order ${orderRef(o._id)}`).catch(() => {});
      res.set('Cache-Control', 'no-store');
      res.json({ success: true, contentType: a.contentType, dataBase64: data });
    } catch (err) {
      fail500(res, 'GET /staff/pharmacy/orders/files', err, 'Could not load the file');
    }
  });

  router.post('/staff/pharmacy/orders/:id/quote', staffOnly, async (req, res) => {
    try {
      const o = await staffOrder(req, res);
      if (!o) return;
      if (o.status !== 'awaiting_review') return res.status(409).json({ success: false, message: 'This order is not waiting for review.' });
      const q = cleanQuoteLines(req.body?.lines);
      if ('error' in q) return res.status(400).json({ success: false, message: q.error });
      o.quote = { lines: q.lines, note: clip(req.body?.note, 400), quotedBy: staffName(req), quotedAt: new Date(now()), expiresAt: new Date(now() + QUOTE_TTL_MS) };
      o.status = 'quoted';
      event(o, 'quoted', staffName(req), clip(req.body?.note, 200));
      await o.save();
      tell(o, 'Your pharmacy sent a quote', `${o.pharmacyName} reviewed your order. Open it to see the price and choose how to receive it.`);
      res.json({ success: true });
    } catch (err) {
      fail500(res, 'POST /staff/pharmacy/orders/quote', err, 'Could not save the quote');
    }
  });

  router.post('/staff/pharmacy/orders/:id/reject', staffOnly, async (req, res) => {
    try {
      const o = await staffOrder(req, res);
      if (!o) return;
      const reason = clip(req.body?.reason, 300);
      if (reason.length < 3) return res.status(400).json({ success: false, message: 'Give the patient a reason' });
      if (!canMove(o.status, 'rejected')) return res.status(409).json({ success: false, message: 'This order cannot be rejected now.' });
      o.status = 'rejected';
      o.cancelReason = reason;
      o.closedAt = new Date(now());
      event(o, 'rejected', staffName(req), reason);
      await o.save();
      await closeAttachments(o);
      tell(o, 'Order not accepted', `${o.pharmacyName} could not fill your order: ${reason}`);
      res.json({ success: true });
    } catch (err) {
      fail500(res, 'POST /staff/pharmacy/orders/reject', err, 'Could not reject the order');
    }
  });

  router.post('/staff/pharmacy/orders/:id/hmo', staffOnly, async (req, res) => {
    try {
      const o = await staffOrder(req, res);
      if (!o) return;
      if (o.status !== 'awaiting_hmo') return res.status(409).json({ success: false, message: 'This order is not waiting for HMO confirmation.' });
      const svc: any = await PharmacyService.findOne({ facilityId: o.pharmacyId }).lean();
      if (req.body?.decision === 'approve') {
        const covered = Number(req.body?.coveredMinor);
        if (!Number.isInteger(covered) || covered <= 0) return res.status(400).json({ success: false, message: 'Enter the amount the HMO covers, in kobo' });
        const next = afterHmoApproval({ totalMinor: o.totalMinor, coveredMinor: covered, fulfilment: o.fulfilment, svc: terms(svc || {}), gatewayConfigured: deps.paystack.configured && onlineAllowed(svc?.paystackSubaccount) });
        o.hmo = { ...(o.hmo?.toObject?.() || o.hmo || {}), status: 'approved', coveredMinor: Math.min(covered, o.totalMinor), decidedBy: staffName(req) };
        o.dueMinor = next.dueMinor;
        o.status = next.status;
        o.paymentStatus = next.paymentStatus;
        event(o, next.status, staffName(req), `HMO covers ${formatNaira(Math.min(covered, o.totalMinor))}`);
        await o.save();
        tell(o, 'HMO cover confirmed', next.dueMinor > 0 ? `Your HMO covers part of the order. ${formatNaira(next.dueMinor)} is left to pay.` : 'Your HMO covers the order. The pharmacy will prepare it.');
      } else if (req.body?.decision === 'decline') {
        o.hmo = { ...(o.hmo?.toObject?.() || o.hmo || {}), status: 'declined', decidedBy: staffName(req), reason: clip(req.body?.reason, 200) };
        o.status = 'quoted';
        o.paymentStatus = 'hmo_declined';
        event(o, 'quoted', staffName(req), 'HMO cover declined');
        await o.save();
        tell(o, 'HMO cover not confirmed', `${o.pharmacyName} could not confirm your HMO cover. Open the order and choose another way to pay.`);
      } else {
        return res.status(400).json({ success: false, message: 'Choose approve or decline' });
      }
      res.json({ success: true });
    } catch (err) {
      fail500(res, 'POST /staff/pharmacy/orders/hmo', err, 'Could not save the decision');
    }
  });

  router.post('/staff/pharmacy/orders/:id/dispatch', staffOnly, async (req, res) => {
    try {
      const o = await staffOrder(req, res);
      if (!o) return;
      if (o.status !== 'confirmed' || o.fulfilment !== 'delivery') return res.status(409).json({ success: false, message: 'Only a confirmed delivery order can be dispatched.' });
      const riderName = clip(req.body?.riderName, 80);
      const riderPhone = clip(req.body?.riderPhone, 20);
      if (riderName.length < 2 || !phoneOk(riderPhone)) return res.status(400).json({ success: false, message: 'Enter the rider\'s name and phone number' });
      o.dispatch = { riderName, riderPhone, etaNote: clip(req.body?.etaNote, 120), assignedAt: new Date(now()) };
      o.status = 'dispatched';
      event(o, 'dispatched', staffName(req), `Rider ${riderName}`);
      await o.save();
      tell(o, 'Your order is on the way', `${riderName} is bringing your order. Give them your six digit code only when you have the medication.`);
      res.json({ success: true });
    } catch (err) {
      fail500(res, 'POST /staff/pharmacy/orders/dispatch', err, 'Could not dispatch the order');
    }
  });

  router.post('/staff/pharmacy/orders/:id/ready', staffOnly, async (req, res) => {
    try {
      const o = await staffOrder(req, res);
      if (!o) return;
      if (o.status !== 'confirmed' || o.fulfilment !== 'pickup') return res.status(409).json({ success: false, message: 'Only a confirmed pickup order can be marked ready.' });
      o.status = 'ready_for_pickup';
      event(o, 'ready_for_pickup', staffName(req));
      await o.save();
      tell(o, 'Ready for pickup', `Your order is ready at ${o.pharmacyName}. Show your six digit code at the counter.`);
      res.json({ success: true });
    } catch (err) {
      fail500(res, 'POST /staff/pharmacy/orders/ready', err, 'Could not update the order');
    }
  });

  // Handover: the rider or counter staff enters the patient's code.
  async function handover(req: Request, res: Response, from: 'dispatched' | 'ready_for_pickup', to: 'delivered' | 'collected') {
    const o = await staffOrder(req, res);
    if (!o) return;
    if (o.status !== from) return res.status(409).json({ success: false, message: 'This order is not at the handover step.' });
    const state = { attempts: o.codeAttempts || 0, lockedUntil: o.codeLockedUntil || null };
    if (codeLocked(state, now())) return res.status(423).json({ success: false, message: 'Too many wrong codes. Try again in 15 minutes, or ask the patient to contact support.' });
    const expected = o.handoverSealed ? openSecret(deps.sealKey, o.handoverSealed) : null;
    if (!codeMatches(expected, req.body?.code)) {
      const next = afterWrongCode(state, now());
      o.codeAttempts = next.attempts;
      o.codeLockedUntil = next.lockedUntil || undefined;
      await o.save();
      return res.status(400).json({ success: false, message: 'That code is not right.' });
    }
    o.status = to;
    o.codeAttempts = 0;
    o.codeLockedUntil = undefined;
    o.closedAt = new Date(now());
    if (o.paymentStatus === 'pay_on_delivery' || o.paymentStatus === 'pay_at_pickup') o.paymentStatus = 'paid_on_handover';
    event(o, to, staffName(req));
    await o.save();
    await closeAttachments(o);
    if (o.linkToRecord) await recordMedication(o).catch((err) => console.warn('[pharmacy] record link failed:', err));
    tell(o, to === 'delivered' ? 'Order delivered' : 'Order collected', `Thank you. Order ${orderRef(o._id)} is complete.`);
    res.json({ success: true });
  }

  router.post('/staff/pharmacy/orders/:id/deliver', staffOnly, async (req, res) => {
    try {
      await handover(req, res, 'dispatched', 'delivered');
    } catch (err) {
      fail500(res, 'POST /staff/pharmacy/orders/deliver', err, 'Could not confirm delivery');
    }
  });
  router.post('/staff/pharmacy/orders/:id/collect', staffOnly, async (req, res) => {
    try {
      await handover(req, res, 'ready_for_pickup', 'collected');
    } catch (err) {
      fail500(res, 'POST /staff/pharmacy/orders/collect', err, 'Could not confirm pickup');
    }
  });

  router.post('/staff/pharmacy/orders/:id/cancel', staffOnly, async (req, res) => {
    try {
      const o = await staffOrder(req, res);
      if (!o) return;
      const reason = clip(req.body?.reason, 300);
      if (reason.length < 3) return res.status(400).json({ success: false, message: 'Give the patient a reason' });
      if (!['awaiting_payment', 'awaiting_hmo', 'confirmed', 'ready_for_pickup'].includes(o.status)) return res.status(409).json({ success: false, message: 'This order cannot be cancelled now.' });
      await cancelOrder(o, staffName(req), reason);
      tell(o, 'Order cancelled', `${o.pharmacyName} cancelled your order: ${reason}${o.paymentStatus === 'refund_due' ? ' The pharmacy will refund you.' : ''}`);
      res.json({ success: true });
    } catch (err) {
      fail500(res, 'POST /staff/pharmacy/orders/cancel', err, 'Could not cancel the order');
    }
  });

  /** On handover, with the patient's consent, the dispensed medication is added to their medication list. */
  async function recordMedication(o: any) {
    const skip = new Set<number>(o.excluded || []);
    const lines = (o.quote?.lines || []).filter((l: any, i: number) => l.available && !skip.has(i));
    for (const l of lines) {
      await Prescription.create({
        accountId: o.accountId,
        familyMemberId: String(o.accountId),
        medicationName: l.name,
        dosage: l.strength || '',
        quantity: l.quantity,
        prescriber: 'As on the prescription sent with the order',
        pharmacyProvider: o.pharmacyName,
        totalPriceNaira: Math.round((l.unitPriceMinor * l.quantity) / 100),
        hmoCoveredNaira: 0,
        patientCoPayNaira: Math.round((l.unitPriceMinor * l.quantity) / 100),
        refillsTotal: 0,
        refillsRemaining: 0,
        status: 'delivered',
        deliveryAddress: o.address?.text || '',
        deliveryType: o.fulfilment,
        orderType: 'record_from_order',
        notes: `From order ${orderRef(o._id)}`,
      } as any);
    }
  }

  // ----- pharmacy setup (admin) -----

  router.get('/staff/pharmacy/services', staffOnly, async (req, res) => {
    try {
      const scope = await visibleIds(req);
      const rows = await PharmacyService.find(scope ? { facilityId: { $in: scope } } : {}).sort({ name: 1 }).limit(300).lean();
      res.json({ success: true, services: rows });
    } catch (err) {
      fail500(res, 'GET /staff/pharmacy/services', err, 'Could not load pharmacies');
    }
  });

  router.get('/staff/pharmacy/facility-options', deps.requireStaff('admin'), async (_req, res) => {
    try {
      res.json({ success: true, facilities: await deps.listFacilities() });
    } catch (err) {
      fail500(res, 'GET /staff/pharmacy/facility-options', err, 'Could not load facilities');
    }
  });

  router.put('/staff/pharmacy/services/:facilityId', staffOnly, async (req, res) => {
    const b = req.body || {};
    const facilityId = clip(req.params.facilityId, 80);
    // An assigned pharmacist may change fees, payment options, delivery time, phone and the pause switch.
    // Only an admin creates a pharmacy or changes its name, address, map position or who is assigned.
    let scope: string[] | null;
    try {
      scope = await visibleIds(req);
    } catch (err) {
      return fail500(res, 'PUT /staff/pharmacy/services', err, 'Could not save the pharmacy');
    }
    const isAdmin = !scope;
    const existing: any = await PharmacyService.findOne({ facilityId }).lean().catch(() => null);
    if (!isAdmin && (!existing || !scope!.includes(facilityId))) return res.status(403).json({ success: false, message: 'You are not set up to manage this pharmacy.' });
    const name = isAdmin ? clip(b.name, 120) : existing.name;
    if (!facilityId || !name) return res.status(400).json({ success: false, message: 'Pharmacy name is required' });
    const bands = cleanBands(b.feeBands ?? []);
    if ('error' in bands) return res.status(400).json({ success: false, message: bands.error });
    const deliveryEnabled = b.deliveryEnabled !== false;
    if (deliveryEnabled && bands.bands.length === 0) return res.status(400).json({ success: false, message: 'Set at least one delivery fee band, or turn delivery off' });
    const rawLat = isAdmin ? b.lat : existing.lat;
    const rawLng = isAdmin ? b.lng : existing.lng;
    const lat = rawLat === '' || rawLat === undefined || rawLat === null ? undefined : Number(rawLat);
    const lng = rawLng === '' || rawLng === undefined || rawLng === null ? undefined : Number(rawLng);
    if ((lat !== undefined && !(Math.abs(lat) <= 90)) || (lng !== undefined && !(Math.abs(lng) <= 180)) || (lat === undefined) !== (lng === undefined)) {
      return res.status(400).json({ success: false, message: 'Enter both latitude and longitude, or leave both empty' });
    }
    if (deliveryEnabled && lat === undefined) return res.status(400).json({ success: false, message: 'Delivery fees need the pharmacy\'s latitude and longitude' });
    const acceptsHmo = Array.isArray(b.acceptsHmo) ? [...new Set(b.acceptsHmo.map((x: unknown) => clip(x, 80)).filter(Boolean))].slice(0, 40) : [];
    const staffIds = Array.isArray(b.staffIds) ? [...new Set(b.staffIds.map((x: unknown) => clip(x, 40)).filter((x: string) => mongoose.isValidObjectId(x)))].slice(0, 40) : [];
    const set: any = {
      phone: clip(b.phone, 30),
      deliveryEnabled,
      pickupEnabled: b.pickupEnabled !== false,
      feeBands: bands.bands,
      deliveryEta: clip(b.deliveryEta, 80) || 'Within 2 to 4 hours',
      onlinePayment: b.onlinePayment !== false,
      payOnDelivery: b.payOnDelivery === true,
      payAtPickup: b.payAtPickup !== false,
      acceptsHmo,
      active: b.active !== false,
      updatedBy: staffName(req),
    };
    if (isAdmin) Object.assign(set, { name, address: clip(b.address, 200), lat, lng, staffIds });
    if (isAdmin && b.paystackSubaccount !== undefined) {
      const code = cleanSubaccount(b.paystackSubaccount);
      if (code === null) return res.status(400).json({ success: false, message: 'The Paystack subaccount code looks like ACCT_ followed by letters and numbers' });
      set.paystackSubaccount = code;
    }
    try {
      const svc = await PharmacyService.findOneAndUpdate({ facilityId }, { $set: set }, { upsert: isAdmin, new: true, setDefaultsOnInsert: true });
      res.json({ success: true, service: svc });
    } catch (err) {
      fail500(res, 'PUT /staff/pharmacy/services', err, 'Could not save the pharmacy');
    }
  });

  let timer: NodeJS.Timeout | null = null;
  const startSweeps = () => {
    if (timer) return;
    timer = setInterval(sweep, 60_000);
    timer.unref();
  };

  return { router, sweep, startSweeps, isOrderReference, verifyAndSettle };
}
