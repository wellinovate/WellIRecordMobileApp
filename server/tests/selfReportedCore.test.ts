import test from 'node:test';
import assert from 'node:assert/strict';
import { checkMeasurement, checkMedication, checkFamilyHistory, doseTimes } from '../selfReportedCore';

test('measurement: accepts a number in range and rounds', () => {
  const r = checkMeasurement({ kind: 'blood_sugar', value: '95.46', unit: 'mg/dL', context: 'fasting' });
  assert.deepEqual(r, { ok: true, value: { kind: 'blood_sugar', value: 95.5, unit: 'mg/dL', context: 'fasting' } });
});
test('measurement: a comma decimal works', () => {
  const r: any = checkMeasurement({ kind: 'blood_sugar', value: '5,4', unit: 'mmol/L' });
  assert.equal(r.value.value, 5.4);
});
test('measurement: mmol/L number entered as mg/dL is caught', () => {
  assert.equal(checkMeasurement({ kind: 'blood_sugar', value: 5.4, unit: 'mg/dL' }).ok, false);
});
test('measurement: rejects blanks, text, unknown kind and unit, bad context', () => {
  assert.equal(checkMeasurement({ kind: 'waist', value: '' }).ok, false);
  assert.equal(checkMeasurement({ kind: 'waist', value: 'abc' }).ok, false);
  assert.equal(checkMeasurement({ kind: 'weight', value: 5 }).ok, false);
  assert.equal(checkMeasurement({ kind: 'waist', value: 80, unit: 'ft' }).ok, false);
  assert.equal(checkMeasurement({ kind: 'blood_sugar', value: 90, context: 'bedtime' }).ok, false);
  assert.equal(checkMeasurement({ kind: 'waist', value: Infinity }).ok, false);
});
test('measurement: context only kept for blood sugar', () => {
  const r: any = checkMeasurement({ kind: 'waist', value: 80, context: 'fasting' });
  assert.equal(r.value.context, undefined);
});
test('medication: needs name, frequency, time for daily doses, and ordered dates', () => {
  const ok = checkMedication({ name: 'Amlodipine', dose: '5 mg', frequency: 'once_daily', time: '08:00', startDate: '2026-10-26', endDate: '2026-12-26' }, '2026-10-26');
  assert.equal(ok.ok, true);
  assert.equal(checkMedication({ name: 'A', frequency: 'once_daily', time: '08:00', startDate: '2026-10-26' }, '2026-10-26').ok, false);
  assert.equal(checkMedication({ name: 'Amlodipine', frequency: 'once_daily', startDate: '2026-10-26' }, '2026-10-26').ok, false);
  assert.equal(checkMedication({ name: 'Amlodipine', frequency: 'hourly', time: '08:00', startDate: '2026-10-26' }, '2026-10-26').ok, false);
  assert.equal(checkMedication({ name: 'Amlodipine', frequency: 'as_needed', startDate: '2026-10-26', endDate: '2026-10-01' }, '2026-10-26').ok, false);
  assert.equal(checkMedication({ name: 'Amlodipine', frequency: 'as_needed', startDate: '2026-02-30' }, '2026-10-26').ok, false);
  assert.equal(checkMedication({ name: 'Amlodipine', frequency: 'as_needed', startDate: '2030-01-01' }, '2026-10-26').ok, false);
  assert.equal(checkMedication({ name: 'Amlodipine', frequency: 'as_needed', startDate: '2026-10-26' }, '2026-10-26').ok, true);
});
test('medication: markup is stripped from text', () => {
  const r: any = checkMedication({ name: '<b>Para</b>cetamol', frequency: 'as_needed', startDate: '2026-10-26' }, '2026-10-26');
  assert.equal(/[<>]/.test(r.value.name), false);
});
test('family history: validates relative, conditions, other text and age', () => {
  assert.equal(checkFamilyHistory({ relative: 'Mother', conditions: ['Diabetes', 'Stroke'] }).ok, true);
  assert.equal(checkFamilyHistory({ relative: 'Cousin', conditions: ['Diabetes'] }).ok, false);
  assert.equal(checkFamilyHistory({ relative: 'Mother', conditions: [] }).ok, false);
  assert.equal(checkFamilyHistory({ relative: 'Mother', conditions: ['Made up'] }).ok, false);
  assert.equal(checkFamilyHistory({ relative: 'Mother', conditions: ['Other'] }).ok, false);
  assert.equal(checkFamilyHistory({ relative: 'Mother', conditions: ['Other'], otherText: 'Lupus' }).ok, true);
  assert.equal(checkFamilyHistory({ relative: 'Mother', conditions: ['Diabetes'], ageAtDiagnosis: 150 }).ok, false);
  assert.equal(checkFamilyHistory({ relative: 'Mother', conditions: ['Diabetes'], ageAtDiagnosis: 45.5 }).ok, false);
  const dup: any = checkFamilyHistory({ relative: 'Father', conditions: ['Diabetes', 'Diabetes'] });
  assert.deepEqual(dup.value.conditions, ['Diabetes']);
});
test('dose times are spaced across the day', () => {
  assert.deepEqual(doseTimes('08:00', 1), ['08:00']);
  assert.deepEqual(doseTimes('08:00', 2), ['08:00', '20:00']);
  assert.deepEqual(doseTimes('07:30', 3), ['07:30', '15:30', '23:30']);
  assert.deepEqual(doseTimes('20:00', 3), ['20:00', '04:00', '12:00']);
});
