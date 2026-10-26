import test from 'node:test';
import assert from 'node:assert/strict';
import { formatClock, formatYmd, toYmd } from '../src/utils/dateFormat';

test('dates and clock times are shown in plain form', () => {
  assert.equal(toYmd(2026, 0, 5), '2026-01-05');
  assert.equal(formatYmd('2026-03-09'), '9 Mar 2026');
  assert.equal(formatYmd('nope'), '');
  assert.equal(formatClock('08:00'), '8:00 AM');
  assert.equal(formatClock('00:30'), '12:30 AM');
  assert.equal(formatClock('12:00'), '12:00 PM');
  assert.equal(formatClock('20:05'), '8:05 PM');
  assert.equal(formatClock('x'), '');
});
