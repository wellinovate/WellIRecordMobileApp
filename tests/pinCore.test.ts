import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PIN_ATTEMPTS, attemptsLeft, checkPin, isPinFormat, makePinRecord, parsePinRecord, pinBlocked, weakPinReason } from '../src/utils/pinCore';

const salt = new Uint8Array(16).map((_, i) => i + 1);

test('a PIN is exactly six digits', () => {
  assert.ok(isPinFormat('482915'));
  for (const bad of ['12345', '1234567', '12a456', '', ' 12345', '12 456']) assert.ok(!isPinFormat(bad), bad);
});

test('the guesses people try first are refused', () => {
  for (const weak of ['111111', '000000', '123456', '654321', '234567', '987654']) assert.ok(weakPinReason(weak), weak);
  assert.equal(weakPinReason('482915'), null);
  assert.equal(weakPinReason('121212'), null);
  assert.ok(weakPinReason('12345'));
});

test('the right PIN opens and the wrong one does not', () => {
  const rec = makePinRecord('482915', salt, 1000);
  assert.ok(checkPin('482915', rec));
  assert.ok(!checkPin('482916', rec));
  assert.ok(!checkPin('48291', rec));
  assert.ok(!checkPin('', rec));
});

test('the record never holds the PIN, and the salt changes the hash', () => {
  const a = makePinRecord('482915', salt, 1000);
  const b = makePinRecord('482915', new Uint8Array(16).fill(9), 1000);
  assert.ok(!JSON.stringify(a).includes('482915'));
  assert.notEqual(a.hash, b.hash);
  assert.equal(a.hash.length, 64);
});

test('a damaged or missing record counts as no PIN', () => {
  assert.equal(parsePinRecord(null), null);
  assert.equal(parsePinRecord('not json'), null);
  assert.equal(parsePinRecord(JSON.stringify({ v: 1, salt: 'zz', hash: 'ab', iter: 1 })), null);
  const rec = makePinRecord('482915', salt, 1000);
  assert.deepEqual(parsePinRecord(JSON.stringify(rec)), rec);
  assert.ok(!checkPin('482915', { ...rec, v: 2 } as any));
});

test('five wrong tries block the PIN', () => {
  assert.equal(MAX_PIN_ATTEMPTS, 5);
  assert.equal(attemptsLeft(0), 5);
  assert.equal(attemptsLeft(4), 1);
  assert.equal(attemptsLeft(9), 0);
  assert.ok(!pinBlocked(4));
  assert.ok(pinBlocked(5));
});
