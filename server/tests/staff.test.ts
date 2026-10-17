import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { createStaff, passwordProblem, roleAllowed, signStaffToken, tempPassword, verifyStaffToken } from '../staff';

const SECRET = 'test-jwt-secret-for-staff-tests';

describe('staff passwords', () => {
  it('rejects short, letter-only, digit-only and name-containing passwords', () => {
    assert.ok(passwordProblem('short1'));
    assert.ok(passwordProblem('onlylettersonlyletters'));
    assert.ok(passwordProblem('123456789012345'));
    assert.ok(passwordProblem('chinedu-Password1', 'chinedu@clinic.ng'));
  });
  it('accepts a long mixed password', () => {
    assert.equal(passwordProblem('bright-River-4416-ok', 'a@b.ng'), null);
  });
  it('generated temporary passwords meet the policy and differ each time', () => {
    const a = tempPassword();
    const b = tempPassword();
    assert.equal(passwordProblem(a), null);
    assert.notEqual(a, b);
  });
});

describe('staff roles', () => {
  it('admin passes every check, others only their own', () => {
    assert.equal(roleAllowed('admin', ['pharmacist']), true);
    assert.equal(roleAllowed('pharmacist', ['pharmacist']), true);
    assert.equal(roleAllowed('clinician', ['pharmacist']), false);
    assert.equal(roleAllowed('records_officer', ['clinician', 'records_officer']), true);
  });
});

describe('staff tokens', () => {
  const user = { id: 'abc123', role: 'clinician' as const, tokenVersion: 3 };
  it('round-trips', () => {
    assert.deepEqual(verifyStaffToken(SECRET, signStaffToken(SECRET, user)), { sid: 'abc123', role: 'clinician', tv: 3 });
  });
  it('a staff token is not a valid patient token and a patient token is not a staff token', () => {
    const staffToken = signStaffToken(SECRET, user);
    assert.throws(() => jwt.verify(staffToken, SECRET));
    const patientToken = jwt.sign({ userId: 'u1', role: 'patient' }, SECRET);
    assert.equal(verifyStaffToken(SECRET, patientToken), null);
  });
  it('rejects tampered and wrong-key tokens', () => {
    const t = signStaffToken(SECRET, user);
    assert.equal(verifyStaffToken(SECRET, t.slice(0, -2) + 'xx'), null);
    assert.equal(verifyStaffToken('another-secret', t), null);
  });
});

describe('legacy admin secret', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });
  const run = async (headers: Record<string, string>, roles: any[] = []) => {
    const { requireStaff } = createStaff({ jwtSecret: SECRET, limiter: (_q, _s, n) => n() });
    let status = 0;
    let nexted = false;
    const req: any = { headers, method: 'GET', path: '/x' };
    const res: any = {
      status(c: number) {
        status = c;
        return this;
      },
      json() {
        return this;
      },
    };
    await requireStaff(...roles)(req, res, () => {
      nexted = true;
    });
    return { status, nexted, staff: req.staff };
  };

  it('works while allowed and records the caller as legacy', async () => {
    process.env.ADMIN_SECRET = 'a-long-shared-secret';
    delete process.env.ALLOW_LEGACY_ADMIN_SECRET;
    const r = await run({ 'x-admin-secret': 'a-long-shared-secret' }, ['pharmacist']);
    assert.equal(r.nexted, true);
    assert.equal(r.staff.legacy, true);
  });
  it('is refused once switched off', async () => {
    process.env.ADMIN_SECRET = 'a-long-shared-secret';
    process.env.ALLOW_LEGACY_ADMIN_SECRET = 'false';
    const r = await run({ 'x-admin-secret': 'a-long-shared-secret' });
    assert.equal(r.nexted, false);
    assert.equal(r.status, 401);
  });
  it('rejects a wrong secret and a missing sign-in', async () => {
    process.env.ADMIN_SECRET = 'a-long-shared-secret';
    assert.equal((await run({ 'x-admin-secret': 'wrong-secret-of-same-ln' })).status, 401);
    assert.equal((await run({})).status, 401);
  });
  it('says so when no secret is configured', async () => {
    delete process.env.ADMIN_SECRET;
    assert.equal((await run({ 'x-admin-secret': 'anything' })).status, 503);
  });
});
