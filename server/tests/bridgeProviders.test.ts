import test from 'node:test';
import assert from 'node:assert/strict';
import { facilityIdOk, publicService } from '../bridgeProviders';
import { parseServiceFields } from '../bookingCore';

test('the website never sees the payout account or assigned staff', () => {
  const out: any = publicService({ _id: 'x', __v: 1, facilityId: 'WR-1', facilityName: 'Clinic', staffIds: ['s1'], paystackSubaccount: 'ACCT_abc', onlinePayment: true });
  assert.equal(out.payoutReady, true);
  assert.equal('staffIds' in out, false);
  assert.equal('paystackSubaccount' in out, false);
  assert.equal(publicService(null), null);
  assert.equal((publicService({ facilityId: 'WR-1' }) as any).payoutReady, false);
});

test('facility ids in a path are a plain token', () => {
  assert.equal(facilityIdOk('WR-ORG-123'), 'WR-ORG-123');
  assert.equal(facilityIdOk('../x'), null);
  assert.equal(facilityIdOk('a'), null);
  assert.equal(facilityIdOk({ $ne: 1 }), null);
});

test('service fields: valid input gives the fields, bad input gives a plain message', () => {
  const ok: any = parseServiceFields({
    offersInPerson: true, feeInPersonMinor: 500000, offersVirtual: true, feeVirtualMinor: 300000,
    slotMinutes: 30, weekly: [{ day: 1, start: '09:00', end: '12:00' }], acceptsHmo: ['AXA', 'AXA', ' Hygeia '], payAtVisit: true, onlinePayment: true,
  });
  assert.equal(ok.set.feeInPersonMinor, 500000);
  assert.deepEqual(ok.set.acceptsHmo, ['AXA', 'Hygeia']);
  assert.equal(ok.set.active, true);
  assert.match((parseServiceFields({ offersInPerson: true, slotMinutes: 30, weekly: [] }) as any).error, /in-person fee/);
  assert.match((parseServiceFields({ offersInPerson: false, offersVirtual: true, slotMinutes: 30 }) as any).error, /virtual fee/);
  assert.match((parseServiceFields({ offersInPerson: false, slotMinutes: 5 }) as any).error, /Slot length/);
  assert.match((parseServiceFields({ offersInPerson: true, feeInPersonMinor: -1, slotMinutes: 30 }) as any).error, /kobo/);
});
