import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import mongoose from 'mongoose';
import { connect, disconnect, hasDb } from './db';
import { createPatientAuth } from '../../patientAuth';
import { AccountAuditLog, PatientMfa } from '../../models';
import { totp } from '../../totp';

// Made fresh each run so no secret-shaped string sits in the repository.
const SECRET = crypto.randomBytes(32).toString('hex');

describe('patient second step against a real database', { skip: !hasDb && 'set MONGODB_URI_TEST to run' }, () => {
  let server: Server;
  let base = '';
  const alice = new mongoose.Types.ObjectId();
  const bob = new mongoose.Types.ObjectId();
  let secret = '';
  let recovery: string[] = [];

  async function call(method: string, path: string, body?: any, user?: mongoose.Types.ObjectId) {
    const r = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(user ? { 'x-test-user': String(user) } : {}) },
      body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
    });
    let json: any = {};
    try { json = await r.json(); } catch {}
    return { status: r.status, ...json } as any;
  }
  // A code from the step after the current one: always inside the accepted window, and never the
  // step the enrolment code used, so it is not rejected as a replay.
  const nextCode = () => totp(secret, Date.now() + 30_000);
  const resetSteps = () => PatientMfa.updateOne({ accountId: String(alice) }, { $set: { lastStep: -1, failCount: 0 }, $unset: { lockedUntil: 1 } });

  before(async () => {
    await connect();
    const app = express();
    app.use(express.json());
    const mfa = createPatientAuth({
      jwtSecret: SECRET,
      limiter: (_req, _res, next) => next(),
      getAuthUserId: (req) => (req.headers['x-test-user'] as string) || null,
      accountLabel: async () => 'alice@example.com',
      issueToken: (p) => `session-for-${p.userId}`,
    });
    app.use('/api/v1', mfa.router);
    // Stands in for the real sign-in routes: first factor passed, ask the gate.
    app.post('/api/v1/test/first-factor', async (req, res) => {
      const challenge = await mfa.gate({ userId: req.body.userId, email: 'alice@example.com', method: 'Password' });
      res.json(challenge ?? { token: `session-for-${req.body.userId}` });
    });
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  });
  after(async () => { server?.close(); await disconnect(); });

  it('needs sign-in for every settings route', async () => {
    for (const [m, p] of [['GET', '/auth/mfa/status'], ['POST', '/auth/mfa/setup'], ['POST', '/auth/mfa/enable'], ['POST', '/auth/mfa/disable'], ['POST', '/auth/mfa/recovery-codes']]) {
      assert.equal((await call(m, p, {})).status, 401, `${m} ${p}`);
    }
  });

  it('lets a person without the second step straight through', async () => {
    const r = await call('POST', '/test/first-factor', { userId: String(bob) });
    assert.equal(r.token, `session-for-${bob}`);
    assert.equal(r.mfaRequired, undefined);
  });

  it('turns on only after a correct code, and stores the secret sealed', async () => {
    assert.equal((await call('GET', '/auth/mfa/status', undefined, alice)).enabled, false);
    const setup = await call('POST', '/auth/mfa/setup', {}, alice);
    assert.equal(setup.status, 200, JSON.stringify(setup));
    secret = setup.secret;
    assert.match(setup.otpauthUrl, /^otpauth:\/\/totp\//);
    assert.equal((await call('POST', '/auth/mfa/enable', { code: '000000' }, alice)).status, 400);
    assert.equal((await call('GET', '/auth/mfa/status', undefined, alice)).enabled, false);

    const on = await call('POST', '/auth/mfa/enable', { code: totp(secret, Date.now()) }, alice);
    assert.equal(on.status, 200, JSON.stringify(on));
    recovery = on.recoveryCodes;
    assert.equal(recovery.length, 8);
    const row: any = await PatientMfa.findOne({ accountId: String(alice) }).lean();
    assert.equal(row.enabled, true);
    assert.ok(!JSON.stringify(row).includes(secret), 'secret must not be stored in plain text');
    assert.ok(row.recovery.every((h: string) => !recovery.includes(h)), 'recovery codes must be hashed');
    assert.equal((await call('POST', '/auth/mfa/setup', {}, alice)).status, 409);
  });

  it('withholds the session until the code is right', async () => {
    const r = await call('POST', '/test/first-factor', { userId: String(alice) });
    assert.equal(r.mfaRequired, true);
    assert.equal(r.token, undefined);
    assert.ok(r.mfaToken);

    assert.equal((await call('POST', '/auth/mfa/verify', { mfaToken: 'junk', code: nextCode() })).status, 401);
    assert.equal((await call('POST', '/auth/mfa/verify', { mfaToken: r.mfaToken, code: '000000' })).status, 400);

    const ok = await call('POST', '/auth/mfa/verify', { mfaToken: r.mfaToken, code: nextCode() });
    assert.equal(ok.status, 200, JSON.stringify(ok));
    assert.equal(ok.token, `session-for-${alice}`);

    // The same code cannot be used twice.
    const again = await call('POST', '/auth/mfa/verify', { mfaToken: r.mfaToken, code: nextCode() });
    assert.equal(again.status, 400);
  });

  it('accepts each recovery code once', async () => {
    await resetSteps();
    const r = await call('POST', '/test/first-factor', { userId: String(alice) });
    const first = await call('POST', '/auth/mfa/verify', { mfaToken: r.mfaToken, recoveryCode: recovery[0] });
    assert.equal(first.status, 200, JSON.stringify(first));
    assert.equal(first.recoveryCodesLeft, 7);
    const second = await call('POST', '/auth/mfa/verify', { mfaToken: r.mfaToken, recoveryCode: recovery[0] });
    assert.equal(second.status, 400);
  });

  it('locks after five wrong codes, even for the right one', async () => {
    await resetSteps();
    const r = await call('POST', '/test/first-factor', { userId: String(alice) });
    for (let i = 0; i < 5; i++) assert.equal((await call('POST', '/auth/mfa/verify', { mfaToken: r.mfaToken, code: '000000' })).status, 400);
    const locked = await call('POST', '/auth/mfa/verify', { mfaToken: r.mfaToken, code: nextCode() });
    assert.equal(locked.status, 429);
    assert.ok(locked.retryAfterSec > 0);
    await resetSteps();
  });

  it('needs a code to make new recovery codes or turn off', async () => {
    assert.equal((await call('POST', '/auth/mfa/recovery-codes', { code: '000000' }, alice)).status, 400);
    const fresh = await call('POST', '/auth/mfa/recovery-codes', { code: nextCode() }, alice);
    assert.equal(fresh.status, 200, JSON.stringify(fresh));
    assert.equal(fresh.recoveryCodes.length, 8);

    // Old recovery codes no longer work; the new ones do.
    await resetSteps();
    const r = await call('POST', '/test/first-factor', { userId: String(alice) });
    assert.equal((await call('POST', '/auth/mfa/verify', { mfaToken: r.mfaToken, recoveryCode: recovery[2] })).status, 400);
    assert.equal((await call('POST', '/auth/mfa/verify', { mfaToken: r.mfaToken, recoveryCode: fresh.recoveryCodes[0] })).status, 200);

    assert.equal((await call('POST', '/auth/mfa/disable', { code: '000000' }, alice)).status, 400);
    const off = await call('POST', '/auth/mfa/disable', { recoveryCode: fresh.recoveryCodes[1] }, alice);
    assert.equal(off.status, 200, JSON.stringify(off));
    const after = await call('POST', '/test/first-factor', { userId: String(alice) });
    assert.equal(after.token, `session-for-${alice}`);
  });

  it('writes the changes to the account log', async () => {
    const actions = (await AccountAuditLog.find({ accountId: String(alice) }).lean()).map((r: any) => r.action);
    for (const a of ['mfa_enabled', 'sign_in_mfa', 'mfa_failed', 'mfa_locked', 'mfa_recovery_codes', 'mfa_disabled']) {
      assert.ok(actions.includes(a), `missing ${a} in ${actions.join(',')}`);
    }
  });
});
