import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRegionRows, isIdentityMethod, shouldWriteActive, ACTIVE_WRITE_EVERY_MS } from '../registryCore';

const g = (id: string | null, registered: number, contactVerified = 0, identityVerified = 0, active30 = 0, withRecord = 0) => ({ _id: id, registered, contactVerified, identityVerified, active30, withRecord });

test('all 37 regions are listed, busiest first, with empty ones at zero', () => {
  const { rows, totals } = buildRegionRows([g('LAG', 50, 40), g('ABJ', 80, 60, 5, 30, 20)]);
  assert.equal(rows.length, 37);
  assert.equal(rows[0].code, 'ABJ');
  assert.equal(rows[1].code, 'LAG');
  assert.equal(rows.find((r) => r.code === 'KAN')?.registered, 0);
  assert.equal(totals.registered, 130);
  assert.equal(totals.contactVerified, 100);
  assert.equal(totals.identityVerified, 5);
});

test('percentages are one decimal place, and null when nobody is registered', () => {
  const { rows } = buildRegionRows([g('RIV', 3, 1)]);
  assert.equal(rows[0].contactVerifiedPct, 33.3);
  assert.equal(rows.find((r) => r.code === 'KAN')?.contactVerifiedPct, null);
});

test('"not stated" and "before regions" rows appear only when they have people, and count in the totals', () => {
  const none = buildRegionRows([g('LAG', 1)]);
  assert.equal(none.rows.some((r) => r.code === 'UNK' || r.code === 'LEGACY'), false);
  const some = buildRegionRows([g('LAG', 1), g('UNK', 4), g(null, 10)]);
  assert.equal(some.rows.filter((r) => r.code === 'UNK' || r.code === 'LEGACY').length, 2);
  assert.equal(some.totals.registered, 15);
});

test('residing counts come from the residence state, separate from the registration region', () => {
  const { rows, totals } = buildRegionRows([g('ABJ', 10)], { 'FCT, Abuja': 7, Lagos: 3 });
  assert.equal(rows.find((r) => r.code === 'ABJ')?.registered, 10);
  assert.equal(rows.find((r) => r.code === 'ABJ')?.residing, 7);
  assert.equal(rows.find((r) => r.code === 'LAG')?.residing, 3);
  assert.equal(totals.residing, 10);
});

test('identity methods are a fixed list', () => {
  assert.equal(isIdentityMethod('passport'), true);
  assert.equal(isIdentityMethod('selfie'), false);
});

test('last-active is written at most every six hours per person', () => {
  assert.equal(shouldWriteActive(undefined, 1000), true);
  assert.equal(shouldWriteActive(1000, 1000 + ACTIVE_WRITE_EVERY_MS - 1), false);
  assert.equal(shouldWriteActive(1000, 1000 + ACTIVE_WRITE_EVERY_MS), true);
});
