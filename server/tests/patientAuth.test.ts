import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { evaluateSecondStep, MFA_LOCK_MS, MFA_MAX_FAILS, signChallenge, verifyChallenge, type MfaState } from '../patientAuth';
import { hashRecovery, newSecret, sealSecret, totp, stepFor } from '../totp';

const KEY = 'k'.repeat(40);
const NOW = Date.UTC(2026, 9, 20, 12, 0, 0);

function fresh(): { rec: MfaState; secret: string } {
  const secret = newSecret();
  return { secret, rec: { secretEnc: sealSecret(KEY, secret), recovery: [], lastStep: -1, failCount: 0, lockedUntil: null } };
}

describe('patient MFA challenge token', () => {
  const p = { userId: 'u1', email: 'a@b.co', method: 'Password' };
  it('round-trips the pending sign-in', () => {
    const t = signChallenge('secret-one', p);
    assert.equal(verifyChallenge('secret-one', t)?.userId, 'u1');
  });
  it('rejects another secret, junk, and a staff challenge', () => {
    const t = signChallenge('secret-one', p);
    assert.equal(verifyChallenge('secret-two', t), null);
    assert.equal(verifyChallenge('secret-one', 'nope'), null);
    assert.equal(verifyChallenge('secret-one', undefined), null);
    assert.equal(verifyChallenge('secret-one', jwt.sign({ typ: 'staff-mfa', sid: 'x' }, 'secret-one')), null);
  });
  it('is not accepted as a session token', () => {
    const t = signChallenge('secret-one', p);
    assert.throws(() => jwt.verify(t, 'secret-one'));
  });
});

describe('second step check', () => {
  it('accepts the current code and records the step', () => {
    const { rec, secret } = fresh();
    const r = evaluateSecondStep(rec, { code: totp(secret, NOW) }, KEY, NOW);
    assert.equal(r.result, 'ok');
    if (r.result === 'ok') assert.equal(r.patch.lastStep, stepFor(NOW));
  });
  it('blocks replay of the same code', () => {
    const { rec, secret } = fresh();
    const first = evaluateSecondStep(rec, { code: totp(secret, NOW) }, KEY, NOW);
    assert.equal(first.result, 'ok');
    if (first.result === 'ok') Object.assign(rec, first.patch);
    assert.equal(evaluateSecondStep(rec, { code: totp(secret, NOW) }, KEY, NOW).result, 'bad');
  });
  it('rejects a wrong code and counts it', () => {
    const { rec } = fresh();
    const r = evaluateSecondStep(rec, { code: '000000' }, KEY, NOW);
    assert.equal(r.result, 'bad');
    if (r.result === 'bad') assert.equal(r.patch.failCount, 1);
  });
  it('locks after the maximum wrong codes, then refuses even a right one', () => {
    const { rec, secret } = fresh();
    rec.failCount = MFA_MAX_FAILS - 1;
    const r = evaluateSecondStep(rec, { code: '000000' }, KEY, NOW);
    assert.equal(r.result, 'bad');
    if (r.result === 'bad') {
      assert.equal(r.locked, true);
      assert.equal(r.patch.lockedUntil?.getTime(), NOW + MFA_LOCK_MS);
      Object.assign(rec, r.patch);
    }
    const locked = evaluateSecondStep(rec, { code: totp(secret, NOW) }, KEY, NOW + 1000);
    assert.equal(locked.result, 'locked');
    assert.equal(evaluateSecondStep(rec, { code: totp(secret, NOW + MFA_LOCK_MS + 60000) }, KEY, NOW + MFA_LOCK_MS + 60000).result, 'ok');
  });
  it('accepts a recovery code once', () => {
    const { rec } = fresh();
    rec.recovery = [hashRecovery(KEY, 'ABCDE-FGHJK'), hashRecovery(KEY, 'MNPQR-STUVW')];
    const r = evaluateSecondStep(rec, { recoveryCode: 'abcde fghjk' }, KEY, NOW);
    assert.equal(r.result, 'ok');
    if (r.result === 'ok') {
      assert.equal(r.usedRecovery, true);
      assert.equal(r.patch.recovery?.length, 1);
      Object.assign(rec, r.patch);
    }
    assert.equal(evaluateSecondStep(rec, { recoveryCode: 'ABCDE-FGHJK' }, KEY, NOW).result, 'bad');
  });
  it('does not accept a code when no secret is stored', () => {
    assert.equal(evaluateSecondStep({ recovery: [], lastStep: -1, failCount: 0 }, { code: '123456' }, KEY, NOW).result, 'bad');
  });
});
