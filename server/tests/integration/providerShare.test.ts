import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import mongoose from 'mongoose';
import { connect, disconnect, hasDb } from './db';
import { createProviderShareRouter } from '../../providerShare';
import { FamilyMember, HealthRecord, Prescription, ProviderShare, UserProfile } from '../../models';

const SECRET = 'integration-share-secret';

describe('provider share against a real database', { skip: !hasDb && 'set MONGODB_URI_TEST to run' }, () => {
  let server: Server;
  let base = '';
  const sent: { to: string; code: string }[] = [];
  const notes: string[] = [];
  const owner = new mongoose.Types.ObjectId();
  const stranger = new mongoose.Types.ObjectId();

  async function call(method: string, path: string, body?: any, headers: Record<string, string> = {}) {
    const r = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json: any = {};
    try { json = await r.json(); } catch {}
    return { status: r.status, ...json } as any;
  }
  const as = (id: mongoose.Types.ObjectId) => ({ 'x-test-user': String(id) });
  const tokenOf = (url: string) => url.split('/').pop() as string;

  before(async () => {
    await connect();
    await UserProfile.create({ accountId: owner, fullName: 'Ada Test', dateOfBirth: '1990-01-02', gender: 'Female', allergies: 'Penicillin', wrId: 'WR-TEST-0001' });
    await Prescription.create({ familyMemberId: String(owner), medicationName: 'Amlodipine', dosage: '5mg', frequency: 'Daily', prescriber: 'Dr Test', pharmacyProvider: 'Test Pharmacy', status: 'active' });
    await HealthRecord.create({ userId: owner, familyMemberId: owner, title: 'Malaria test', recordType: 'Lab Result', date: '2026-01-01', provider: 'Test Lab', summary: 'Positive' });
    const app = express();
    app.use(express.json());
    app.use(
      '/api/v1',
      createProviderShareRouter({
        getAuthUserId: (req) => (req.headers['x-test-user'] as string) || null,
        callerCanShare: async (a, s) => a === s,
        sendEmail: async (m) => { const c = /\b(\d{6})\b/.exec(m.html); sent.push({ to: m.to, code: c ? c[1] : '' }); },
        sendSms: async () => {},
        normalisePhone: (p) => p,
        notify: async (_u, title) => { notes.push(title); },
        limiter: (_req, _res, next) => next(),
        secret: SECRET,
        publicBaseUrl: () => 'http://x',
      })
    );
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  });
  after(async () => { server?.close(); await disconnect(); });

  const form = (extra: any = {}) => ({
    subjectId: 'me', recipientName: 'Dr Bello', sections: ['allergies', 'medications', 'records'], hours: 2,
    verification: { mode: 'contact', channel: 'email', contact: 'bello@clinic.ng' }, ...extra,
  });

  it('needs sign-in to create and list', async () => {
    assert.equal((await call('POST', '/provider-shares', form())).status, 401);
    assert.equal((await call('GET', '/provider-shares')).status, 401);
  });

  it('opens with an emailed code, scoped to the chosen sections, and notifies the patient', async () => {
    const c = await call('POST', '/provider-shares', form(), as(owner));
    assert.equal(c.status, 201, JSON.stringify(c));
    const t = tokenOf(c.url);
    const stored: any = await ProviderShare.findById(c.share.id).lean();
    assert.ok(!JSON.stringify(stored).includes(t), 'token is not stored in clear');

    assert.equal((await call('GET', `/provider-share/${t}/record`)).status, 401);
    assert.equal((await call('POST', `/provider-share/${t}/verify`, { code: '123456' })).status, 400);
    const o = await call('POST', `/provider-share/${t}/otp`);
    assert.equal(o.status, 200);
    assert.equal(sent.length, 1);
    const v = await call('POST', `/provider-share/${t}/verify`, { code: sent[0].code });
    assert.equal(v.status, 200, JSON.stringify(v));
    const rec = await call('GET', `/provider-share/${t}/record`, undefined, { Authorization: `Bearer ${v.session}` });
    assert.equal(rec.status, 200);
    assert.equal(rec.patient.name, 'Ada Test');
    assert.equal(rec.allergies, 'Penicillin');
    assert.equal(rec.medications[0].name, 'Amlodipine');
    assert.equal(rec.records[0].title, 'Malaria test');
    assert.equal(rec.conditions, undefined);
    assert.ok(notes.includes('Your shared link was opened'));
    // the code works once
    assert.equal((await call('POST', `/provider-share/${t}/verify`, { code: sent[0].code })).status, 400);
    const list = await call('GET', '/provider-shares', undefined, as(owner));
    assert.equal(list.shares[0].openedCount, 1);
  });

  it('a session from one link does not open another', async () => {
    const a = await call('POST', '/provider-shares', form({ verification: { mode: 'passcode' } }), as(owner));
    const b = await call('POST', '/provider-shares', form({ verification: { mode: 'passcode' } }), as(owner));
    const va = await call('POST', `/provider-share/${tokenOf(a.url)}/verify`, { code: a.passcode });
    assert.equal(va.status, 200);
    const cross = await call('GET', `/provider-share/${tokenOf(b.url)}/record`, undefined, { Authorization: `Bearer ${va.session}` });
    assert.equal(cross.status, 401);
  });

  it('wrong codes slow down, then lock the link', async () => {
    const c = await call('POST', '/provider-shares', form({ verification: { mode: 'passcode' } }), as(owner));
    const t = tokenOf(c.url);
    const wrong = c.passcode === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) assert.equal((await call('POST', `/provider-share/${t}/verify`, { code: wrong })).status, 401);
    assert.equal((await call('POST', `/provider-share/${t}/verify`, { code: c.passcode })).status, 429, 'cooldown blocks even the right code');
    await ProviderShare.updateOne({ _id: c.share.id }, { $unset: { cooldownUntil: 1 } });
    for (let i = 0; i < 10; i++) {
      await call('POST', `/provider-share/${t}/verify`, { code: wrong });
      await ProviderShare.updateOne({ _id: c.share.id }, { $unset: { cooldownUntil: 1 } });
    }
    const after = await call('POST', `/provider-share/${t}/verify`, { code: c.passcode });
    assert.equal(after.status, 410);
    assert.equal(after.code, 'locked');
    assert.ok(notes.includes('Shared link locked'));
  });

  it('revoking ends access at once, including an open session', async () => {
    const c = await call('POST', '/provider-shares', form({ verification: { mode: 'passcode' } }), as(owner));
    const t = tokenOf(c.url);
    const v = await call('POST', `/provider-share/${t}/verify`, { code: c.passcode });
    assert.equal((await call('POST', `/provider-shares/${c.share.id}/revoke`, undefined, as(stranger))).status, 404);
    assert.equal((await call('POST', `/provider-shares/${c.share.id}/revoke`, undefined, as(owner))).status, 200);
    const rec = await call('GET', `/provider-share/${t}/record`, undefined, { Authorization: `Bearer ${v.session}` });
    assert.equal(rec.status, 410);
    assert.equal((await call('GET', `/provider-share/${t}/info`)).code, 'revoked');
  });

  it('expired links stop working and unknown tokens look the same as bad ones', async () => {
    const c = await call('POST', '/provider-shares', form({ verification: { mode: 'passcode' } }), as(owner));
    await ProviderShare.updateOne({ _id: c.share.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await call('POST', `/provider-share/${tokenOf(c.url)}/verify`, { code: c.passcode })).code, 'expired');
    assert.equal((await call('GET', `/provider-share/${'x'.repeat(32)}/info`)).status, 404);
  });

  it('rejects sharing a profile the caller cannot reach', async () => {
    const kid = await FamilyMember.create({ accountId: stranger, fullName: 'Child', initials: 'C', relationship: 'Child' } as any);
    const r = await call('POST', '/provider-shares', form({ subjectId: String(kid._id) }), as(owner));
    assert.equal(r.status, 403);
  });
});
