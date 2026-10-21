import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanLinkCode, formatLinkCode, isLinkCode, recordLinkStatusText, webVisitState } from '../src/utils/webLink';

test('a link code is cleaned, formatted and checked against the website alphabet', () => {
  assert.equal(cleanLinkCode(' abcd-2345 '), 'ABCD2345');
  assert.equal(formatLinkCode('abcd2345xx'), 'ABCD-2345');
  assert.equal(formatLinkCode('abc'), 'ABC');
  assert.ok(isLinkCode('abcd-2345'));
  assert.ok(!isLinkCode('ABCD-0123')); // 0 and 1 are never issued
  assert.ok(!isLinkCode('ABCD-23'));
});

test('a website video visit opens 10 minutes early and closes an hour after it ends', () => {
  const v = { status: 'booked', visitType: 'virtual', joinOpensAt: '2026-11-02T09:50:00Z', joinClosesAt: '2026-11-02T11:30:00Z' };
  const t = (iso: string) => Date.parse(iso);
  assert.equal(webVisitState(v, t('2026-11-02T09:49:59Z')), 'early');
  assert.equal(webVisitState(v, t('2026-11-02T09:50:00Z')), 'open');
  assert.equal(webVisitState(v, t('2026-11-02T11:30:00Z')), 'open');
  assert.equal(webVisitState(v, t('2026-11-02T11:30:01Z')), 'closed');
  assert.equal(webVisitState({ ...v, status: 'cancelled' }, t('2026-11-02T10:00:00Z')), 'unavailable');
  assert.equal(webVisitState({ ...v, visitType: 'in_person' }, t('2026-11-02T10:00:00Z')), 'unavailable');
  assert.equal(webVisitState({ ...v, joinOpensAt: 'x' }, t('2026-11-02T10:00:00Z')), 'unavailable');
});

test('record link status is shown in plain words', () => {
  assert.equal(recordLinkStatusText('under_hospital_review'), 'Waiting for the hospital to review');
  assert.equal(recordLinkStatusText('something_new'), 'something new');
});
