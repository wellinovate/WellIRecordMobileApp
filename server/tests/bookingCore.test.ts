import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { describe, it } from 'node:test';
import {
  ONLINE_HOLD_MS,
  bookableFor,
  cleanWeekly,
  decideBooking,
  feeFor,
  joinWindow,
  lagosYmd,
  nextDays,
  paystackSignatureOk,
  slotLabel,
  slotsForDate,
  type ServiceLike,
} from '../bookingCore';

const svc = (over: Partial<ServiceLike> = {}): ServiceLike => ({
  offersInPerson: true,
  offersVirtual: true,
  feeInPersonMinor: 1_500_000,
  feeVirtualMinor: 1_000_000,
  acceptsHmo: ['Hygeia'],
  payAtVisit: true,
  onlinePayment: true,
  slotMinutes: 30,
  weekly: [{ day: 3, start: '09:00', end: '11:00' }],
  ...over,
});

// 2026-10-21 is a Wednesday (day 3).
const NOW_BEFORE = Date.parse('2026-10-20T10:00:00Z');

describe('fees by visit type', () => {
  it('uses the fee of the chosen mode, not one price for both', () => {
    assert.equal(feeFor(svc(), 'in_person'), 1_500_000);
    assert.equal(feeFor(svc(), 'video'), 1_000_000);
  });
  it('has no fee when none is set', () => {
    assert.equal(feeFor(svc({ feeVirtualMinor: undefined }), 'video'), null);
    assert.equal(feeFor(svc({ feeInPersonMinor: -5 }), 'in_person'), null);
  });
  it('is bookable only when it offers the mode, has a fee and has hours', () => {
    assert.equal(bookableFor(svc(), 'video'), true);
    assert.equal(bookableFor(svc({ offersVirtual: false }), 'video'), false);
    assert.equal(bookableFor(svc({ feeVirtualMinor: undefined }), 'video'), false);
    assert.equal(bookableFor(svc({ weekly: [] }), 'in_person'), false);
    assert.equal(bookableFor(svc({ active: false }), 'in_person'), false);
  });
});

describe('slots', () => {
  it('lists half-hour slots inside the window, in Lagos time', () => {
    const slots = slotsForDate(svc(), '2026-10-21', NOW_BEFORE);
    assert.deepEqual(slots.map(slotLabel), ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM']);
    // 09:00 in Lagos (UTC+1) is 08:00 UTC.
    assert.equal(slots[0].toISOString(), '2026-10-21T08:00:00.000Z');
  });
  it('gives nothing on a day with no hours', () => {
    assert.equal(slotsForDate(svc(), '2026-10-22', NOW_BEFORE).length, 0);
  });
  it('drops slots that start inside the lead time or in the past', () => {
    const now = Date.parse('2026-10-21T08:10:00Z'); // 09:10 Lagos
    const left = slotsForDate(svc(), '2026-10-21', now).map(slotLabel);
    assert.deepEqual(left, ['10:00 AM', '10:30 AM']); // 09:30 is inside the 30 minute lead
  });
  it('does not end a slot after the window closes', () => {
    const s = svc({ slotMinutes: 45 });
    assert.deepEqual(slotsForDate(s, '2026-10-21', NOW_BEFORE).map(slotLabel), ['09:00 AM', '09:45 AM']);
  });
  it('rejects a bad date', () => {
    assert.equal(slotsForDate(svc(), '2026-13-40', NOW_BEFORE).length, 0);
  });
  it('knows the Lagos day around midnight', () => {
    assert.equal(lagosYmd(new Date('2026-10-20T23:30:00Z')), '2026-10-21');
    assert.equal(nextDays(Date.parse('2026-10-20T23:30:00Z'), 3)[0], '2026-10-21');
  });
});

describe('weekly hours from a provider', () => {
  it('accepts valid windows', () => {
    assert.deepEqual(cleanWeekly([{ day: 1, start: '08:00', end: '12:30' }]), { weekly: [{ day: 1, start: '08:00', end: '12:30' }] });
  });
  it('rejects bad days, times and reversed windows', () => {
    assert.ok('error' in cleanWeekly([{ day: 7, start: '08:00', end: '09:00' }]));
    assert.ok('error' in cleanWeekly([{ day: 1, start: '8:00', end: '09:00' }]));
    assert.ok('error' in cleanWeekly([{ day: 1, start: '10:00', end: '09:00' }]));
    assert.ok('error' in cleanWeekly('x'));
  });
});

describe('what each payment method does to the booking', () => {
  const base = { svc: svc(), gatewayConfigured: true };
  it('pay in person confirms and records payment at the visit', () => {
    const d = decideBooking({ ...base, method: 'in_person' });
    assert.ok(d.ok && d.status === 'confirmed' && d.paymentStatus === 'pay_at_visit');
  });
  it('pay in person is refused when the provider does not allow it', () => {
    const d = decideBooking({ ...base, method: 'in_person', svc: svc({ payAtVisit: false }) });
    assert.equal(d.ok, false);
  });
  it('online waits for payment and holds the slot longer', () => {
    const d = decideBooking({ ...base, method: 'online' });
    assert.ok(d.ok && d.status === 'awaiting_payment' && d.holdMs === ONLINE_HOLD_MS);
  });
  it('online is refused when the gateway is not set up', () => {
    assert.equal(decideBooking({ ...base, method: 'online', gatewayConfigured: false }).ok, false);
  });
  it('HMO is never confirmed on the app\'s word', () => {
    const d = decideBooking({ ...base, method: 'hmo', hmoProvider: 'hygeia' });
    assert.ok(d.ok && d.status === 'awaiting_hmo' && d.paymentStatus === 'awaiting_hmo');
  });
  it('HMO is refused for a plan the provider does not accept', () => {
    assert.equal(decideBooking({ ...base, method: 'hmo', hmoProvider: 'Other HMO' }).ok, false);
    assert.equal(decideBooking({ ...base, method: 'hmo', hmoProvider: '' }).ok, false);
    assert.equal(decideBooking({ ...base, method: 'hmo', hmoProvider: 'Hygeia', svc: svc({ acceptsHmo: [] }) }).ok, false);
  });
  it('rejects an unknown method', () => {
    assert.equal(decideBooking({ ...base, method: 'cash' as any }).ok, false);
  });
});

describe('joining a virtual visit', () => {
  const start = new Date('2026-10-21T08:00:00Z');
  it('opens 10 minutes before the start and closes an hour after the end', () => {
    assert.equal(joinWindow(start, 30, start.getTime() - 11 * 60_000).open, false);
    assert.equal(joinWindow(start, 30, start.getTime() - 9 * 60_000).open, true);
    assert.equal(joinWindow(start, 30, start.getTime() + 89 * 60_000).open, true);
    assert.equal(joinWindow(start, 30, start.getTime() + 91 * 60_000).open, false);
  });
});

describe('payment webhook signature', () => {
  const body = JSON.stringify({ event: 'charge.success' });
  const sig = (secret: string) => crypto.createHmac('sha512', secret).update(body).digest('hex');
  it('accepts the right signature only', () => {
    assert.equal(paystackSignatureOk('sk_test_x', body, sig('sk_test_x')), true);
    assert.equal(paystackSignatureOk('sk_test_x', body, sig('other')), false);
    assert.equal(paystackSignatureOk('sk_test_x', body + ' ', sig('sk_test_x')), false);
  });
  it('refuses a missing key or malformed header', () => {
    assert.equal(paystackSignatureOk('', body, sig('')), false);
    assert.equal(paystackSignatureOk('sk_test_x', body, undefined), false);
    assert.equal(paystackSignatureOk('sk_test_x', body, 'abc'), false);
  });
});
