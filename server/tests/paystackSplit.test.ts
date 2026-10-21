import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanSubaccount, isSubaccountCode, onlineAllowed, splitFor } from '../paystackSplit';

test('subaccount codes are validated', () => {
  assert.equal(isSubaccountCode('ACCT_abc123xyz'), true);
  assert.equal(isSubaccountCode('acct_abc123xyz'), false);
  assert.equal(isSubaccountCode('ACCT_'), false);
  assert.equal(isSubaccountCode('ACCT_ab c123'), false);
  assert.equal(isSubaccountCode(undefined), false);
  assert.equal(cleanSubaccount('  ACCT_abc123xyz '), 'ACCT_abc123xyz');
  assert.equal(cleanSubaccount(''), '');
  assert.equal(cleanSubaccount('nonsense'), null);
});

test('no subaccount means no split', () => {
  assert.equal(splitFor({ subaccount: '', amountMinor: 500000 }, {}), null);
  assert.equal(splitFor({ subaccount: 'bad', amountMinor: 500000 }, {}), null);
});

test('a subaccount adds the account bearer by default and no charge without a percentage', () => {
  assert.deepEqual(splitFor({ subaccount: 'ACCT_abc123xyz', amountMinor: 500000 }, {}), { subaccount: 'ACCT_abc123xyz', bearer: 'account' });
});

test('the bearer and platform percentage come from settings', () => {
  const s = splitFor({ subaccount: 'ACCT_abc123xyz', amountMinor: 500000 }, { bearer: 'subaccount', platformFeePercent: '5' });
  assert.deepEqual(s, { subaccount: 'ACCT_abc123xyz', bearer: 'subaccount', transaction_charge: 25000 });
});

test('the platform share is rounded, capped below 50 percent and never the whole payment', () => {
  assert.equal(splitFor({ subaccount: 'ACCT_abc123xyz', amountMinor: 3333 }, { platformFeePercent: 10 })!.transaction_charge, 333);
  assert.equal(splitFor({ subaccount: 'ACCT_abc123xyz', amountMinor: 1000 }, { platformFeePercent: 90 })!.transaction_charge, 500);
  assert.equal(splitFor({ subaccount: 'ACCT_abc123xyz', amountMinor: 1000 }, { platformFeePercent: 'abc' })!.transaction_charge, undefined);
  assert.equal(splitFor({ subaccount: 'ACCT_abc123xyz', amountMinor: 1000 }, { platformFeePercent: -5 })!.transaction_charge, undefined);
});

test('online payment can require a subaccount', () => {
  assert.equal(onlineAllowed('', {}), true);
  assert.equal(onlineAllowed('', { requireSubaccount: 'true' }), false);
  assert.equal(onlineAllowed('ACCT_abc123xyz', { requireSubaccount: 'true' }), true);
  assert.equal(onlineAllowed('', { requireSubaccount: false }), true);
});
