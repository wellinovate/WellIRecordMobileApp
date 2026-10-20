import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CODE_LOCK_MS,
  MAX_CODE_ATTEMPTS,
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
  patientCanCancel,
  sniffType,
  timelineStep,
  type PharmacyTerms,
} from '../pharmacyCore';

const terms = (over: Partial<PharmacyTerms> = {}): PharmacyTerms => ({
  onlinePayment: true,
  payOnDelivery: true,
  payAtPickup: true,
  acceptsHmo: ['Hygeia'],
  ...over,
});

describe('distance and delivery fee', () => {
  const bands = [
    { maxKm: 10, feeMinor: 200_000 },
    { maxKm: 3, feeMinor: 100_000 },
  ];
  it('measures a known distance', () => {
    // Abuja city centre to Wuse is a few km.
    const d = haversineKm({ lat: 9.0765, lng: 7.3986 }, { lat: 9.0579, lng: 7.4951 });
    assert.ok(d > 9 && d < 12, String(d));
    assert.equal(haversineKm({ lat: 1, lng: 1 }, { lat: 1, lng: 1 }), 0);
  });
  it('picks the smallest band that covers the distance', () => {
    assert.equal(deliveryFee(bands, 2).feeMinor, 100_000);
    assert.equal(deliveryFee(bands, 3).feeMinor, 100_000);
    assert.equal(deliveryFee(bands, 7).feeMinor, 200_000);
  });
  it('refuses a distance beyond the last band', () => {
    const f = deliveryFee(bands, 11);
    assert.equal(f.outOfRange, true);
    assert.equal(f.feeMinor, 0);
  });
  it('marks the fee as an estimate when the distance is unknown', () => {
    const f = deliveryFee(bands, null);
    assert.deepEqual(f, { feeMinor: 200_000, estimated: true, outOfRange: false });
  });
  it('charges nothing with no bands', () => {
    assert.equal(deliveryFee([], 4).feeMinor, 0);
  });
  it('validates bands from a pharmacy', () => {
    const ok = cleanBands([{ maxKm: 10, feeMinor: 2000 }, { maxKm: 3, feeMinor: 1000 }]);
    assert.ok('bands' in ok && ok.bands[0].maxKm === 3);
    assert.ok('error' in cleanBands([{ maxKm: 0, feeMinor: 1 }]));
    assert.ok('error' in cleanBands([{ maxKm: 5, feeMinor: 1.5 }]));
    assert.ok('error' in cleanBands('x'));
    assert.ok('error' in cleanBands(Array.from({ length: 9 }, (_, i) => ({ maxKm: i + 1, feeMinor: 1 }))));
  });
});

describe('order items', () => {
  it('cleans and limits requested medication', () => {
    const r = cleanItems([{ name: ' Amoxicillin ', strength: '500mg', quantity: 21 }]);
    assert.ok('items' in r && r.items[0].name === 'Amoxicillin');
    assert.ok('error' in cleanItems([]));
    assert.ok('error' in cleanItems([{ name: '', quantity: 1 }]));
    assert.ok('error' in cleanItems([{ name: 'X', quantity: 0 }]));
    assert.ok('error' in cleanItems([{ name: 'X', quantity: 1.5 }]));
    assert.ok('error' in cleanItems(Array.from({ length: 21 }, () => ({ name: 'X', quantity: 1 }))));
  });
});

describe('quote', () => {
  const lines = [
    { name: 'A', quantity: 2, unitPriceMinor: 100_000 },
    { name: 'B', quantity: 1, unitPriceMinor: 50_000, alternative: true },
    { name: 'C', quantity: 1, available: false },
  ];
  it('keeps unavailable lines at zero price', () => {
    const r = cleanQuoteLines(lines);
    assert.ok('lines' in r);
    if ('lines' in r) {
      assert.equal(r.lines[2].unitPriceMinor, 0);
      assert.equal(medicationSubtotal(r.lines), 250_000);
    }
  });
  it('lets the patient leave out an alternative but not a requested line', () => {
    const r = cleanQuoteLines(lines) as any;
    assert.equal(medicationSubtotal(r.lines, [1]), 200_000);
    assert.equal(medicationSubtotal(r.lines, [0]), 250_000);
  });
  it('refuses a quote with nothing available', () => {
    assert.ok('error' in cleanQuoteLines([{ name: 'C', quantity: 1, available: false }]));
    assert.ok('error' in cleanQuoteLines([{ name: 'A', quantity: 1, unitPriceMinor: -1 }]));
  });
});

describe('payment', () => {
  const base = { fulfilment: 'delivery' as const, svc: terms(), gatewayConfigured: true };
  it('online waits for the gateway', () => {
    const d = decidePayment({ ...base, method: 'online' });
    assert.ok(d.ok && d.status === 'awaiting_payment');
    assert.equal(decidePayment({ ...base, method: 'online', gatewayConfigured: false }).ok, false);
    assert.equal(decidePayment({ ...base, method: 'online', svc: terms({ onlinePayment: false }) }).ok, false);
  });
  it('pay on delivery only for delivery, pay at pickup only for pickup', () => {
    assert.equal(decidePayment({ ...base, method: 'on_delivery' }).ok, true);
    assert.equal(decidePayment({ ...base, method: 'at_pickup' }).ok, false);
    assert.equal(decidePayment({ ...base, fulfilment: 'pickup', method: 'at_pickup' }).ok, true);
    assert.equal(decidePayment({ ...base, fulfilment: 'pickup', method: 'on_delivery' }).ok, false);
    assert.equal(decidePayment({ ...base, method: 'on_delivery', svc: terms({ payOnDelivery: false }) }).ok, false);
  });
  it('HMO is never confirmed on the app\'s word', () => {
    const d = decidePayment({ ...base, method: 'hmo', hmoProvider: 'hygeia' });
    assert.ok(d.ok && d.status === 'awaiting_hmo');
    assert.equal(decidePayment({ ...base, method: 'hmo', hmoProvider: 'Other' }).ok, false);
    assert.equal(decidePayment({ ...base, method: 'hmo', hmoProvider: '' }).ok, false);
  });
  it('rejects an unknown method', () => {
    assert.equal(decidePayment({ ...base, method: 'cash' as any }).ok, false);
  });
  it('after HMO approval the balance moves on', () => {
    const full = afterHmoApproval({ totalMinor: 100, coveredMinor: 100, fulfilment: 'delivery', svc: terms(), gatewayConfigured: true });
    assert.deepEqual([full.dueMinor, full.status], [0, 'confirmed']);
    const part = afterHmoApproval({ totalMinor: 100, coveredMinor: 60, fulfilment: 'delivery', svc: terms(), gatewayConfigured: true });
    assert.deepEqual([part.dueMinor, part.status], [40, 'awaiting_payment']);
    const cod = afterHmoApproval({ totalMinor: 100, coveredMinor: 60, fulfilment: 'delivery', svc: terms({ onlinePayment: false }), gatewayConfigured: true });
    assert.deepEqual([cod.dueMinor, cod.status, cod.paymentStatus], [40, 'confirmed', 'pay_on_delivery']);
    const over = afterHmoApproval({ totalMinor: 100, coveredMinor: 500, fulfilment: 'pickup', svc: terms(), gatewayConfigured: true });
    assert.equal(over.dueMinor, 0);
  });
});

describe('status moves', () => {
  it('allows the normal path and nothing backwards', () => {
    assert.equal(canMove('awaiting_review', 'quoted'), true);
    assert.equal(canMove('quoted', 'confirmed'), true);
    assert.equal(canMove('confirmed', 'dispatched'), true);
    assert.equal(canMove('dispatched', 'delivered'), true);
    assert.equal(canMove('awaiting_review', 'dispatched'), false);
    assert.equal(canMove('awaiting_payment', 'dispatched'), false);
    assert.equal(canMove('delivered', 'quoted'), false);
    assert.equal(canMove('cancelled', 'confirmed'), false);
  });
  it('the patient cannot cancel once dispatched', () => {
    assert.equal(patientCanCancel('confirmed'), true);
    assert.equal(patientCanCancel('dispatched'), false);
    assert.equal(patientCanCancel('delivered'), false);
  });
  it('maps status to a timeline step', () => {
    assert.equal(timelineStep({ status: 'awaiting_review' }), 1);
    assert.equal(timelineStep({ status: 'quoted' }), 2);
    assert.equal(timelineStep({ status: 'awaiting_payment', hasAddress: false }), 3);
    assert.equal(timelineStep({ status: 'awaiting_payment', hasAddress: true }), 4);
    assert.equal(timelineStep({ status: 'dispatched' }), 5);
    assert.equal(timelineStep({ status: 'delivered' }), 6);
    assert.equal(timelineStep({ status: 'cancelled' }), -1);
  });
});

describe('handover code', () => {
  it('is six digits', () => {
    for (let i = 0; i < 50; i++) assert.match(newHandoverCode(), /^\d{6}$/);
  });
  it('matches only the exact code', () => {
    assert.equal(codeMatches('012345', '012345'), true);
    assert.equal(codeMatches('012345', ' 012345 '), true);
    assert.equal(codeMatches('012345', '012346'), false);
    assert.equal(codeMatches('012345', '12345'), false);
    assert.equal(codeMatches('012345', 12345), false);
    assert.equal(codeMatches(null, '012345'), false);
  });
  it('locks after five wrong codes', () => {
    const now = 1_000_000;
    let s: any = { attempts: 0 };
    for (let i = 0; i < MAX_CODE_ATTEMPTS - 1; i++) {
      s = afterWrongCode(s, now);
      assert.equal(codeLocked(s, now), false);
    }
    s = afterWrongCode(s, now);
    assert.equal(codeLocked(s, now), true);
    assert.equal(codeLocked(s, now + CODE_LOCK_MS + 1), false);
    assert.equal(s.attempts, 0);
  });
});

describe('attachment type check', () => {
  it('reads the file signature, not the claimed type', () => {
    assert.equal(sniffType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), 'image/jpeg');
    assert.equal(sniffType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), 'image/png');
    assert.equal(sniffType(Buffer.from('%PDF-1.7\n')), 'application/pdf');
    assert.equal(sniffType(Buffer.from('<html></html>')), null);
    assert.equal(sniffType(Buffer.from('MZ\x90\x00\x03\x00')), null);
  });
});
