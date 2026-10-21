import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lagosDayStart, staffJoinState, visitStart } from '../clinicVisits';

const at = (iso: string) => new Date(iso).getTime();

test('the Lagos day starts at 23:00 UTC the evening before', () => {
  assert.equal(lagosDayStart(at('2026-10-21T10:00:00Z')).toISOString(), '2026-10-20T23:00:00.000Z');
  assert.equal(lagosDayStart(at('2026-10-21T23:30:00Z')).toISOString(), '2026-10-21T23:00:00.000Z');
});

test('visit start prefers the booked slot', () => {
  assert.equal(visitStart({ startsAt: '2026-10-21T09:00:00Z', scheduledFor: '2026-10-21T00:00:00Z' })!.toISOString(), '2026-10-21T09:00:00.000Z');
  assert.equal(visitStart({ scheduledFor: '2026-10-21T00:00:00Z' })!.toISOString(), '2026-10-21T00:00:00.000Z');
  assert.equal(visitStart({}), null);
});

test('staff cannot join a visit that is not a confirmed video visit', () => {
  assert.equal(staffJoinState({ visitType: 'in_person', status: 'confirmed' }, Date.now()).code, 'not_video');
  assert.equal(staffJoinState({ visitType: 'video', status: 'requested' }, Date.now()).code, 'not_confirmed');
});

test('a booked visit opens 10 minutes before the start and closes an hour after the end', () => {
  const v = { visitType: 'video', status: 'confirmed', startsAt: '2026-10-21T09:00:00Z', durationMin: 30 };
  assert.equal(staffJoinState(v, at('2026-10-21T08:45:00Z')).code, 'join_window_closed');
  assert.equal(staffJoinState(v, at('2026-10-21T08:50:00Z')).ok, true);
  assert.equal(staffJoinState(v, at('2026-10-21T10:20:00Z')).ok, true);
  assert.equal(staffJoinState(v, at('2026-10-21T11:00:00Z')).code, 'visit_ended');
});

test('a plain request can be joined on its Lagos day only', () => {
  const v = { visitType: 'video', status: 'confirmed', scheduledFor: '2026-10-21T00:00:00Z' };
  assert.equal(staffJoinState(v, at('2026-10-21T10:00:00Z')).ok, true);
  assert.equal(staffJoinState(v, at('2026-10-22T10:00:00Z')).code, 'wrong_day');
});
