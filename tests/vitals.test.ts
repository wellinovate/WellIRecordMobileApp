import test from 'node:test';
import assert from 'node:assert/strict';
import { cmToIn, formatMeasure, inToCm, kgToLbs, lbsToKg, parseHeight, parseWeight } from '../src/utils/vitals';

test('height text is read and written in both units', () => {
  assert.deepEqual(parseHeight('169 cm'), { value: 169, unit: 'cm' });
  assert.deepEqual(parseHeight('169'), { value: 169, unit: 'cm' });
  assert.deepEqual(parseHeight('67 in'), { value: 67, unit: 'in' });
  assert.equal(parseHeight('tall'), null);
  assert.equal(parseHeight('900 cm'), null);
  assert.equal(formatMeasure({ value: 169, unit: 'cm' }), '169 cm');
});

test('weight text is read and written in both units', () => {
  assert.deepEqual(parseWeight('79 kg'), { value: 79, unit: 'kg' });
  assert.deepEqual(parseWeight('174 lbs'), { value: 174, unit: 'lbs' });
  assert.deepEqual(parseWeight('75'), { value: 75, unit: 'kg' });
  assert.equal(parseWeight('heavy'), null);
});

test('unit conversion rounds to whole numbers', () => {
  assert.equal(cmToIn(169), 67);
  assert.equal(inToCm(67), 170);
  assert.equal(kgToLbs(79), 174);
  assert.equal(lbsToKg(174), 79);
});
