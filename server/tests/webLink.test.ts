import test from 'node:test';
import assert from 'node:assert/strict';
import { CODE_RE, cleanCode, relayError, safeSegment } from '../webLink';

test('codes are cleaned like the website does and checked against its alphabet', () => {
  assert.equal(cleanCode(' ab-cd 23 45 '), 'ABCD2345');
  assert.ok(CODE_RE.test('ABCD2345'));
  assert.ok(!CODE_RE.test('ABCD0123')); // 0 and 1 are never issued
  assert.ok(!CODE_RE.test('ABC'));
});

test('ids placed in a path must be a plain token', () => {
  assert.equal(safeSegment('64f1a2b3c4d5e6f708192a3b'), '64f1a2b3c4d5e6f708192a3b');
  assert.equal(safeSegment('../../x'), null);
  assert.equal(safeSegment('a/b'), null);
  assert.equal(safeSegment('abc'), null);
});

test('website errors are passed on in words the app can show', () => {
  assert.deepEqual(relayError({ ok: false, status: 0 }), { status: 503, body: { success: false, message: 'The website could not be reached. Try again in a moment.' } });
  assert.equal(relayError({ ok: false, status: 404, code: 'NOT_LINKED', message: 'x' }).body.code, 'NOT_LINKED');
  assert.equal(relayError({ ok: false, status: 500, message: 'boom' }).status, 502);
  // A signature problem is our fault, not the person's: never shown as "unauthorised".
  assert.equal(relayError({ ok: false, status: 401 }).status, 502);
  assert.equal(relayError({ ok: false, status: 425, code: 'TOO_EARLY', message: 'early', opensAt: '2026-11-02T09:50:00Z' }).body.opensAt, '2026-11-02T09:50:00Z');
});
