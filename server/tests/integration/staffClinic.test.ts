import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import mongoose from 'mongoose';
import { connect, disconnect, hasDb } from './db';
import { createStaff } from '../../staff';
import { createChildFacilityRouter, hashCode } from '../../childFacility';
import { eraseChildData } from '../../accountErasure';
import { totp } from '../../totp';
import {
  ChildAuditLog, ChildFacilityGrant, ChildGrowth, ChildGuardian, ChildMilestone, ChildScreening,
  ChildVaccination, FamilyMember, ReminderLog, ReminderPreference, StaffActionLog,
} from '../../models';

const JWT = 'integration-test-jwt-secret';
const CODE_SECRET = 'integration-test-code-secret';
const ADMIN_SECRET = 'integration-admin-secret';
const CODE = 'ABCD2345';

describe('staff, MFA and clinic access against a real database', { skip: !hasDb && 'set MONGODB_URI_TEST to run' }, () => {
  let server: Server;
  let base = '';
  const notified: string[] = [];
  const memberId = new mongoose.Types.ObjectId();
  const parentId = new mongoose.Types.ObjectId();

  async function call(method: string, path: string, body?: any, token?: string) {
    const r = await fetch(`${base}/api/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json: any = {};
    try { json = await r.json(); } catch {}
    return { status: r.status, ...json } as any;
  }

  // Walks a new person from temporary password to a full session with MFA.
  async function fullSignIn(email: string, password: string, newPassword?: string) {
    const login = await call('POST', '/staff/auth/login', { email, password });
    assert.equal(login.status, 200, JSON.stringify(login));
    let token = login.token;
    if (login.staff?.mustChangePassword) {
      const ch = await call('POST', '/staff/auth/change-password', { currentPassword: password, newPassword }, token);
      assert.equal(ch.status, 200, JSON.stringify(ch));
      token = ch.token;
    }
    const setup = await call('POST', '/staff/mfa/setup', {}, token);
    assert.equal(setup.status, 200);
    const en = await call('POST', '/staff/mfa/enable', { code: totp(setup.secret, Date.now()) }, token);
    assert.equal(en.status, 200, JSON.stringify(en));
    return { token: en.token as string, secret: setup.secret as string, recovery: en.recoveryCodes as string[] };
  }

  before(async () => {
    await connect();
    process.env.ADMIN_SECRET = ADMIN_SECRET;
    delete process.env.ALLOW_LEGACY_ADMIN_SECRET;
    delete process.env.STAFF_MFA_REQUIRED;
    const pass = (_q: any, _s: any, n: any) => n();
    const staff = createStaff({ jwtSecret: JWT, limiter: pass });
    const app = express();
    app.use(express.json());
    app.use('/api/v1', staff.router);
    app.use('/api/v1', createChildFacilityRouter({
      getAuthUserId: () => null, requireStaff: staff.requireStaff, limiter: pass, codeSecret: CODE_SECRET,
      notify: async (id) => { notified.push(id); },
    }));
    await new Promise<void>((ok) => { server = app.listen(0, ok); });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    await FamilyMember.create({
      _id: memberId, accountId: parentId, fullName: 'Ada Test', initials: 'AT', relationship: 'Child',
      dateOfBirth: '2026-01-01', gender: 'Female', wrId: 'WR-IT-0001',
    });
    await ChildFacilityGrant.create({
      childId: memberId, codeHash: hashCode(CODE_SECRET, CODE), createdBy: String(parentId), createdByName: 'Parent',
      expiresAt: new Date(Date.now() + 3600_000), uses: [],
    });
  });

  after(async () => {
    server?.close();
    await disconnect();
  });

  let admin: { token: string; secret: string; recovery: string[] };
  let clinician: { token: string };
  let pharmacist: { token: string };

  it('bootstrap works once, with the secret, and not without it', async () => {
    const body = { email: 'boss@clinic.ng', name: 'Boss', password: 'first-Admin-pass-77' };
    const no = await fetch(`${base}/api/v1/staff/bootstrap`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(no.status, 401);
    const ok = await fetch(`${base}/api/v1/staff/bootstrap`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET }, body: JSON.stringify(body) });
    assert.equal(ok.status, 201);
    const again = await fetch(`${base}/api/v1/staff/bootstrap`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET }, body: JSON.stringify(body) });
    assert.equal(again.status, 409);
  });

  it('a password-only session cannot do anything until MFA is set up', async () => {
    const login = await call('POST', '/staff/auth/login', { email: 'boss@clinic.ng', password: 'first-Admin-pass-77' });
    assert.equal(login.mfaSetupRequired, true);
    const blocked = await call('GET', '/staff/users', undefined, login.token);
    assert.equal(blocked.status, 403);
    assert.equal(blocked.code, 'mfa_enrollment_required');
    admin = await fullSignIn('boss@clinic.ng', 'first-Admin-pass-77');
    assert.equal(admin.recovery.length, 8);
    assert.equal((await call('GET', '/staff/users', undefined, admin.token)).status, 200);
  });

  it('later sign-ins need the code; wrong codes and replays are refused; a recovery code works once', async () => {
    const login = await call('POST', '/staff/auth/login', { email: 'boss@clinic.ng', password: 'first-Admin-pass-77' });
    assert.equal(login.mfaRequired, true);
    assert.equal(login.token, undefined);
    assert.equal((await call('POST', '/staff/auth/mfa', { mfaToken: login.mfaToken, code: '000000' })).status, 401);
    const good = await call('POST', '/staff/auth/mfa', { mfaToken: login.mfaToken, code: totp(admin.secret, Date.now() + 30_000) });
    assert.equal(good.status, 200, JSON.stringify(good));
    const replay = await call('POST', '/staff/auth/mfa', { mfaToken: login.mfaToken, code: totp(admin.secret, Date.now() + 30_000) });
    assert.equal(replay.status, 401, 'same code twice');
    const r1 = await call('POST', '/staff/auth/mfa', { mfaToken: login.mfaToken, recoveryCode: admin.recovery[0] });
    assert.equal(r1.status, 200);
    const r2 = await call('POST', '/staff/auth/mfa', { mfaToken: login.mfaToken, recoveryCode: admin.recovery[0] });
    assert.equal(r2.status, 401, 'recovery code is single use');
  });

  it('five wrong passwords lock the account', async () => {
    await call('POST', '/staff/users', { email: 'lock@clinic.ng', name: 'Lock', role: 'clinician' }, admin.token);
    for (let i = 0; i < 5; i++) await call('POST', '/staff/auth/login', { email: 'lock@clinic.ng', password: 'wrong-wrong-wrong' });
    const r = await call('POST', '/staff/auth/login', { email: 'lock@clinic.ng', password: 'wrong-wrong-wrong' });
    assert.equal(r.status, 429);
  });

  it('admin adds a clinician and a pharmacist; they must change the temporary password', async () => {
    const c = await call('POST', '/staff/users', { email: 'doc@clinic.ng', name: 'Dr Doc', role: 'clinician', organization: 'Test Clinic' }, admin.token);
    assert.equal(c.status, 201, JSON.stringify(c));
    const p = await call('POST', '/staff/users', { email: 'pharm@clinic.ng', name: 'Pharm', role: 'pharmacist' }, admin.token);
    clinician = await fullSignIn('doc@clinic.ng', c.temporaryPassword, 'new-Clinic-pass-88');
    pharmacist = await fullSignIn('pharm@clinic.ng', p.temporaryPassword, 'Bright-River-9921-ok');
    assert.ok(clinician.token && pharmacist.token);
  });

  it('a non-admin cannot manage staff', async () => {
    assert.equal((await call('GET', '/staff/users', undefined, clinician.token)).status, 403);
    assert.equal((await call('GET', '/staff/actions', undefined, clinician.token)).status, 403);
  });

  it('clinic lookup: right code opens the record; wrong code and unknown WelliID give the same answer', async () => {
    const ok = await call('POST', '/facility/child/lookup', { wrId: 'wr-it-0001', code: CODE.toLowerCase() }, clinician.token);
    assert.equal(ok.status, 200, JSON.stringify(ok));
    assert.equal(ok.child.name, 'Ada Test');
    assert.equal(ok.bundle.resourceType, 'Bundle');
    const wrong = await call('POST', '/facility/child/lookup', { wrId: 'WR-IT-0001', code: 'WRONG234' }, clinician.token);
    const unknown = await call('POST', '/facility/child/lookup', { wrId: 'WR-NOPE', code: CODE }, clinician.token);
    assert.equal(wrong.status, 403);
    assert.equal(unknown.status, 403);
    assert.equal(wrong.message, unknown.message);
  });

  it('a pharmacist cannot use the clinic endpoints', async () => {
    assert.equal((await call('POST', '/facility/child/lookup', { wrId: 'WR-IT-0001', code: CODE }, pharmacist.token)).status, 403);
  });

  it('clinic records a measurement and a vaccine; the parent is told; the child log names the clinician', async () => {
    notified.length = 0;
    const g = await call('POST', '/facility/child/growth', { wrId: 'WR-IT-0001', code: CODE, measuredOn: '2026-06-01', weightKg: '7.4', lengthCm: '66' }, clinician.token);
    assert.equal(g.status, 201, JSON.stringify(g));
    const row: any = await ChildGrowth.findOne({ memberId });
    assert.equal(row.source, 'clinic');
    assert.equal(row.weightKg, 7.4);

    const v = await call('POST', '/facility/child/vaccinations', { wrId: 'WR-IT-0001', code: CODE, vaccineCode: 'BCG-1', administeredDate: '2026-01-03', lotNumber: 'L1' }, clinician.token);
    assert.equal(v.status, 201, JSON.stringify(v));
    const dose: any = await ChildVaccination.findOne({ memberId, vaccineCode: 'BCG-1' });
    assert.equal(dose.verification, 'provider_verified');
    assert.equal(dose.verifiedBy, 'Dr Doc');

    assert.equal(notified.filter((n) => n === String(parentId)).length, 2);
    const logs: any[] = await ChildAuditLog.find({ childId: memberId });
    assert.ok(logs.some((l) => l.action === 'growth_added' && /Dr Doc/.test(String(l.actorLabel ?? l.detail ?? ''))));
  });

  it('a parent-reported dose is confirmed, and a confirmed dose is not overwritten', async () => {
    await ChildVaccination.create({ memberId, ownerId: String(parentId), vaccineCode: 'HEPB-0', vaccineName: 'Hepatitis B birth dose', administeredDate: '2026-01-02', verification: 'caregiver_reported' });
    const c = await call('POST', '/facility/child/vaccinations', { wrId: 'WR-IT-0001', code: CODE, vaccineCode: 'HEPB-0', administeredDate: '2026-01-02' }, clinician.token);
    assert.equal(c.status, 200);
    assert.equal(c.confirmed, true);
    const again = await call('POST', '/facility/child/vaccinations', { wrId: 'WR-IT-0001', code: CODE, vaccineCode: 'HEPB-0', administeredDate: '2026-01-02' }, clinician.token);
    assert.equal(again.status, 409);
  });

  it('rejects bad input: future dates, dates before birth, unknown vaccine, empty measurement', async () => {
    const base0 = { wrId: 'WR-IT-0001', code: CODE };
    assert.equal((await call('POST', '/facility/child/growth', { ...base0, measuredOn: '2999-01-01', weightKg: '5' }, clinician.token)).status, 400);
    assert.equal((await call('POST', '/facility/child/growth', { ...base0, measuredOn: '2026-06-01' }, clinician.token)).status, 400);
    assert.equal((await call('POST', '/facility/child/vaccinations', { ...base0, vaccineCode: 'PENTA-1', administeredDate: '2025-01-01' }, clinician.token)).status, 400);
    assert.equal((await call('POST', '/facility/child/vaccinations', { ...base0, vaccineCode: 'NOPE', administeredDate: '2026-02-01' }, clinician.token)).status, 400);
  });

  it('expired and revoked codes are refused like wrong ones', async () => {
    await ChildFacilityGrant.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await call('POST', '/facility/child/lookup', { wrId: 'WR-IT-0001', code: CODE }, clinician.token)).status, 403);
    await ChildFacilityGrant.updateMany({}, { $set: { expiresAt: new Date(Date.now() + 3600_000) } });
    assert.equal((await call('POST', '/facility/child/lookup', { wrId: 'WR-IT-0001', code: CODE }, clinician.token)).status, 200);
    await ChildFacilityGrant.updateMany({}, { $set: { revokedAt: new Date() } });
    assert.equal((await call('POST', '/facility/child/lookup', { wrId: 'WR-IT-0001', code: CODE }, clinician.token)).status, 403);
    await ChildFacilityGrant.updateMany({}, { $unset: { revokedAt: 1 } });
  });

  it('a custody lock stops the clinic with 423', async () => {
    await FamilyMember.updateOne({ _id: memberId }, { $set: { custodyLock: { active: true } } });
    assert.equal((await call('POST', '/facility/child/lookup', { wrId: 'WR-IT-0001', code: CODE }, clinician.token)).status, 423);
    await FamilyMember.updateOne({ _id: memberId }, { $unset: { custodyLock: 1 } });
  });

  it('disabling or changing a role ends the person\'s open session', async () => {
    const list = await call('GET', '/staff/users', undefined, admin.token);
    const doc = list.staff.find((s: any) => s.email === 'doc@clinic.ng');
    assert.equal((await call('PATCH', `/staff/users/${doc.id}`, { status: 'disabled' }, admin.token)).status, 200);
    assert.equal((await call('POST', '/facility/child/lookup', { wrId: 'WR-IT-0001', code: CODE }, clinician.token)).status, 401);
  });

  it('the last active admin cannot be disabled', async () => {
    const list = await call('GET', '/staff/users', undefined, admin.token);
    const me = list.staff.find((s: any) => s.email === 'boss@clinic.ng');
    assert.equal((await call('PATCH', `/staff/users/${me.id}`, { status: 'disabled' }, admin.token)).status, 409);
  });

  it('admin can reset someone\'s MFA, and every non-GET staff call is in the action log', async () => {
    const list = await call('GET', '/staff/users', undefined, admin.token);
    const ph = list.staff.find((s: any) => s.email === 'pharm@clinic.ng');
    assert.equal((await call('POST', `/staff/users/${ph.id}/reset-mfa`, {}, admin.token)).status, 200);
    const after = await call('GET', '/staff/users', undefined, admin.token);
    assert.equal(after.staff.find((s: any) => s.email === 'pharm@clinic.ng').mfaEnabled, false);
    const actions: any[] = await StaffActionLog.find().lean();
    assert.ok(actions.length >= 5);
    assert.ok(actions.every((a) => a.staffName && a.action));
  });

  it('account deletion erases a child\'s data everywhere, and only that account\'s data', async () => {
    const otherParent = new mongoose.Types.ObjectId();
    const otherChild = new mongoose.Types.ObjectId();
    await FamilyMember.create({ _id: otherChild, accountId: otherParent, fullName: 'Other Kid', initials: 'OK', relationship: 'Child', wrId: 'WR-IT-0002' });
    const seed = async (child: mongoose.Types.ObjectId, owner: mongoose.Types.ObjectId) => {
      await ChildVaccination.create({ memberId: child, ownerId: String(owner), vaccineCode: 'OPV-0', vaccineName: 'OPV', administeredDate: '2026-02-02' });
      await ChildGrowth.create({ memberId: child, ownerId: String(owner), measuredOn: '2026-03-03', weightKg: 5 });
      await ChildMilestone.create({ childId: child, code: 'm1', status: 'achieved', recordedBy: String(owner) });
      await ChildScreening.create({ childId: child, kind: 'vision', date: '2026-04-04', result: 'no_concerns', recordedBy: String(owner) });
      await ChildAuditLog.create({ childId: child, actorId: String(owner), actorRole: 'primary', actorName: 'Parent', action: 'viewed' });
      await ReminderPreference.create({ childId: child, accountId: String(owner) });
      await ReminderLog.create({ childId: child, accountId: String(owner), channel: 'push', key: 'k' + String(child) });
    };
    await seed(memberId, parentId);
    await seed(otherChild, otherParent);
    // the deleted parent also helps with the other child
    await ChildGuardian.create({ childId: otherChild, accountId: String(parentId), displayName: 'Helper', relationship: 'Aunt', status: 'active', invitedBy: String(otherParent) });

    const result = await eraseChildData([parentId]);
    assert.equal(result.children, 1);

    const left = async (m: any) => ({
      vax: await ChildVaccination.countDocuments({ memberId: m }),
      growth: await ChildGrowth.countDocuments({ memberId: m }),
      ms: await ChildMilestone.countDocuments({ childId: m }),
      scr: await ChildScreening.countDocuments({ childId: m }),
      log: await ChildAuditLog.countDocuments({ childId: m }),
      grant: await ChildFacilityGrant.countDocuments({ childId: m }),
      rp: await ReminderPreference.countDocuments({ childId: m }),
      rl: await ReminderLog.countDocuments({ childId: m }),
    });
    assert.deepEqual(await left(memberId), { vax: 0, growth: 0, ms: 0, scr: 0, log: 0, grant: 0, rp: 0, rl: 0 });
    assert.deepEqual(await left(otherChild), { vax: 1, growth: 1, ms: 1, scr: 1, log: 1, grant: 0, rp: 1, rl: 1 });
    assert.equal(await ChildGuardian.countDocuments({ accountId: String(parentId) }), 0);
  });
});
