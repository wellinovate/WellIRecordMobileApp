import { test } from 'node:test';
import assert from 'node:assert/strict';
import { childAgeYears, effectivePerms, MAJORITY_AGE, PERMISSION_KEYS, TEEN_ACCESS_AGE } from '../server/childAccess';

const active = (permissions: Record<string, boolean>, restriction?: any) => ({ status: 'active', permissions, restriction });
const all = { viewRecords: true, addRecords: true, bookAppointments: true, receiveReminders: true, manageGuardians: true };

test('a pending or revoked guardian has no permissions', () => {
  for (const status of ['pending', 'revoked', undefined]) {
    const p = effectivePerms({ status, permissions: all });
    for (const k of PERMISSION_KEYS) assert.equal(p[k], false, `${String(status)} ${k}`);
  }
  assert.equal(effectivePerms(null).viewRecords, false);
});

test('an active guardian gets exactly what was granted', () => {
  const p = effectivePerms(active({ viewRecords: true, addRecords: false, receiveReminders: true }));
  assert.equal(p.viewRecords, true);
  assert.equal(p.addRecords, false);
  assert.equal(p.manageGuardians, false);
  assert.equal(p.bookAppointments, false);
});

test('a blocked restriction removes every permission, even all grants', () => {
  const p = effectivePerms(active(all, { active: true, level: 'blocked' }));
  for (const k of PERMISSION_KEYS) assert.equal(p[k], false, k);
});

test('a view_only restriction keeps view and removes the rest', () => {
  const p = effectivePerms(active(all, { active: true, level: 'view_only' }));
  assert.equal(p.viewRecords, true);
  for (const k of PERMISSION_KEYS.filter((k) => k !== 'viewRecords')) assert.equal(p[k], false, k);
});

test('view_only does not grant view that was never granted', () => {
  const p = effectivePerms(active({ viewRecords: false }, { active: true, level: 'view_only' }));
  assert.equal(p.viewRecords, false);
});

test('an inactive restriction changes nothing', () => {
  const p = effectivePerms(active(all, { active: false, level: 'blocked' }));
  assert.equal(p.manageGuardians, true);
});

test('permissions given as a mongoose subdocument are read through toObject', () => {
  const p = effectivePerms({ status: 'active', permissions: { toObject: () => ({ viewRecords: true, addRecords: true }) } });
  assert.equal(p.addRecords, true);
  assert.equal(p.manageGuardians, false);
});

test('childAgeYears handles birthdays and bad input', () => {
  const now = new Date('2026-10-17T12:00:00Z');
  assert.equal(childAgeYears({ dateOfBirth: '2013-10-17' }, now), 13);
  assert.equal(childAgeYears({ dateOfBirth: '2013-10-18' }, now), 12);
  assert.equal(childAgeYears({ dateOfBirth: '2008-10-17' }, now), 18);
  assert.equal(childAgeYears({ dateOfBirth: '2008-10-18' }, now), 17);
  assert.equal(childAgeYears({ dateOfBirth: 'not a date' }, now), null);
  assert.equal(childAgeYears({}, now), null);
  assert.equal(childAgeYears({ dob: '2020-02-29T00:00:00.000Z' }, now), 6);
});

test('age thresholds are 13 for own-account access and 18 for handover', () => {
  assert.equal(TEEN_ACCESS_AGE, 13);
  assert.equal(MAJORITY_AGE, 18);
});
