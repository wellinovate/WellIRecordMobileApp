import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInactivityTracker, INACTIVITY_MS } from '../src/utils/inactivityCore';

const MIN = 60 * 1000;

test('the limit is 10 minutes', () => {
  assert.equal(INACTIVITY_MS, 10 * MIN);
});

test('it expires after 10 quiet minutes and not before', () => {
  let t = 1_000_000;
  const tr = createInactivityTracker(INACTIVITY_MS, () => t);
  assert.equal(tr.expired(), false);
  t += 9 * MIN + 59_000;
  assert.equal(tr.expired(), false);
  assert.equal(tr.remaining(), 1000);
  t += 1000;
  assert.equal(tr.expired(), true);
  assert.equal(tr.remaining(), 0);
});

test('a touch restarts the 10 minutes', () => {
  let t = 0;
  const tr = createInactivityTracker(INACTIVITY_MS, () => t);
  t += 9 * MIN;
  tr.touch();
  t += 9 * MIN;
  assert.equal(tr.expired(), false);
  t += 2 * MIN;
  assert.equal(tr.expired(), true);
});

test('time with the app in the background still counts, because it is read from the clock', () => {
  let t = 0;
  const tr = createInactivityTracker(INACTIVITY_MS, () => t);
  tr.touch();
  t += 3 * 60 * MIN; // phone asleep for three hours, no timers ran
  assert.equal(tr.expired(), true);
});
