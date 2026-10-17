import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueGroups, lagosToday, normalizeNgMobile } from '../server/childReminders';
import { IMMUNIZATION_SCHEDULE } from '../server/data/immunizationSchedule';
import { buildDoseRows, addDaysIso } from '../src/utils/immunization';

const kinds = (dob: string, taken: string[], today: string) =>
  Object.fromEntries(dueGroups(dob, new Set(taken), today).map((g) => [g.kind, g.count]));

test('a newborn has the three birth doses due', () => {
  assert.deepEqual(kinds('2026-10-17', [], '2026-10-17'), { due: 3 });
});

test('doses become due soon one week before the due date, and not earlier', () => {
  const birth = ['BCG-1', 'OPV-0', 'HEPB-0'];
  assert.equal(kinds('2026-10-17', birth, addDaysIso('2026-10-17', 6 * 7 - 7)).due_soon, 4);
  assert.deepEqual(kinds('2026-10-17', birth, addDaysIso('2026-10-17', 6 * 7 - 8)), {});
  assert.equal(kinds('2026-10-17', birth, addDaysIso('2026-10-17', 6 * 7)).due, 4);
});

test('a child who has had every routine dose gets no reminders', () => {
  const taken = IMMUNIZATION_SCHEDULE.doses.map((d) => d.code);
  for (const today of ['2026-10-17', '2027-03-01', '2028-01-01']) assert.deepEqual(dueGroups('2026-10-17', new Set(taken), today), []);
});

test('a 2 year old with no overdue routine doses gets nothing', () => {
  const taken = IMMUNIZATION_SCHEDULE.doses.filter((d) => d.track === 'routine').map((d) => d.code);
  assert.deepEqual(dueGroups('2024-10-01', new Set(taken), '2026-10-17'), []);
});

test('programme doses never produce reminders', () => {
  const routine = IMMUNIZATION_SCHEDULE.doses.filter((d) => d.track === 'routine').map((d) => d.code);
  assert.deepEqual(dueGroups('2026-01-01', new Set(routine), '2026-10-17'), []);
});

test('the overdue key changes each week so the reminder repeats weekly, not daily', () => {
  const a = dueGroups('2026-05-10', new Set(['BCG-1', 'OPV-0', 'HEPB-0']), '2026-10-14').find((g) => g.kind === 'overdue');
  const b = dueGroups('2026-05-10', new Set(['BCG-1', 'OPV-0', 'HEPB-0']), '2026-10-15').find((g) => g.kind === 'overdue');
  assert.ok(a && b);
  assert.equal(a!.key, b!.key);
  const c = dueGroups('2026-05-10', new Set(['BCG-1', 'OPV-0', 'HEPB-0']), '2026-10-22').find((g) => g.kind === 'overdue');
  assert.notEqual(a!.key, c!.key);
});

test('server reminders agree with the app on which routine doses are due', () => {
  const dob = '2026-01-15';
  for (let day = 0; day <= 900; day += 1) {
    const today = addDaysIso(dob, day);
    const rows = buildDoseRows(IMMUNIZATION_SCHEDULE as any, dob, [], today).filter((r) => r.dose.track === 'routine');
    const dueInApp = rows.filter((r) => r.status === 'due').length;
    assert.equal(kinds(dob, [], today).due || 0, dueInApp, `due on day ${day}`);
    const overdueInApp = rows.filter((r) => r.status === 'overdue').length;
    assert.ok((kinds(dob, [], today).overdue || 0) <= overdueInApp, `overdue on day ${day}`);
  }
});

test('phone numbers normalise to 234 form and bad numbers are refused', () => {
  assert.equal(normalizeNgMobile('08031234567'), '2348031234567');
  assert.equal(normalizeNgMobile('+234 803 123 4567'), '2348031234567');
  assert.equal(normalizeNgMobile('2348031234567'), '2348031234567');
  assert.equal(normalizeNgMobile('803-123-4567'), '2348031234567');
  for (const bad of ['0603123456', '12345', '', null, undefined, 123, '0803123456789']) assert.equal(normalizeNgMobile(bad), null, String(bad));
});

test('lagosToday rolls over at midnight Lagos time (UTC+1), not UTC', () => {
  assert.equal(lagosToday(new Date('2026-10-17T22:59:00Z')), '2026-10-17');
  assert.equal(lagosToday(new Date('2026-10-17T23:00:00Z')), '2026-10-18');
});
