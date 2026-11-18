import test from 'node:test';
import assert from 'node:assert/strict';
import { labSummary } from '../src/utils/labSummary';

test('shows value, unit and interpretation', () => {
  assert.equal(labSummary({ testName: 'Hb', resultValue: '12.5', unit: 'g/dL', interpretation: 'normal' }), 'Hb: 12.5 g/dL (normal)');
});
test('keeps text results that have no unit', () => {
  assert.equal(labSummary({ testName: 'Widal', resultValue: 'Positive 1:160', interpretation: 'unknown' }), 'Widal: Positive 1:160');
});
test('falls back to the interpretation and hides unknown', () => {
  assert.equal(labSummary({ testName: 'X', interpretation: 'abnormal' }), 'abnormal');
  assert.equal(labSummary({ testName: 'X', interpretation: 'unknown' }), '');
});
