import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashToken, hashCodeFor, newCode, newToken, sameHash, maskContact, shareState, parseCreate, MAX_HOURS,
} from '../providerShare';
import { providerSharePage } from '../providerSharePage';

const phone = (p: string) => (p.startsWith('0') ? '+234' + p.slice(1) : p);

test('token and code hashes are keyed and distinct', () => {
  const t = newToken();
  assert.ok(t.length >= 30);
  assert.notEqual(hashToken('a', t), hashToken('b', t));
  assert.notEqual(hashToken('a', t), hashCodeFor('a', 'id', t));
  assert.equal(hashCodeFor('k', 'id', '123 456'), hashCodeFor('k', 'id', '123456'));
  assert.notEqual(hashCodeFor('k', 'id1', '123456'), hashCodeFor('k', 'id2', '123456'));
});

test('codes are six digits', () => {
  for (let i = 0; i < 200; i++) assert.match(newCode(), /^\d{6}$/);
});

test('sameHash handles missing and unequal input', () => {
  const h = hashToken('k', 'x');
  assert.equal(sameHash(h, h), true);
  assert.equal(sameHash(h, undefined), false);
  assert.equal(sameHash(h, hashToken('k', 'y')), false);
});

test('masking hides most of the contact', () => {
  assert.equal(maskContact('email', 'doctor@clinic.com'), 'd***@c***.com');
  assert.ok(!maskContact('sms', '+2348012345678').includes('12345'));
});

test('share state', () => {
  const future = new Date(Date.now() + 1000 * 60);
  assert.equal(shareState({ expiresAt: future }), 'active');
  assert.equal(shareState({ expiresAt: new Date(Date.now() - 1) }), 'expired');
  assert.equal(shareState({ expiresAt: future, revokedAt: new Date() }), 'revoked');
  assert.equal(shareState({ expiresAt: future, lockedAt: new Date() }), 'locked');
});

test('create validation', () => {
  const ok = parseCreate({ recipientName: 'Dr Ade', sections: ['allergies', 'bogus'], hours: 24, verification: { mode: 'passcode' } }, phone);
  assert.ok('value' in ok && ok.value.sections.length === 1);
  const bad = (b: any) => assert.ok('message' in (parseCreate(b, phone) as any));
  bad({ recipientName: 'D', sections: ['records'], verification: { mode: 'passcode' } });
  bad({ recipientName: 'Dr Ade', sections: [], verification: { mode: 'passcode' } });
  bad({ recipientName: 'Dr Ade', sections: ['records'], hours: MAX_HOURS + 1, verification: { mode: 'passcode' } });
  bad({ recipientName: 'Dr Ade', sections: ['records'], hours: 0, verification: { mode: 'passcode' } });
  bad({ recipientName: 'Dr Ade', sections: ['records'], verification: { mode: 'contact', channel: 'email', contact: 'nope' } });
  bad({ recipientName: 'Dr Ade', sections: ['records'], verification: { mode: 'contact', channel: 'sms', contact: '12345' } });
  const sms = parseCreate({ recipientName: 'Dr Ade', sections: ['records'], verification: { mode: 'contact', channel: 'sms', contact: '08012345678' } }, phone);
  assert.ok('value' in sms && sms.value.verification.contact === '+2348012345678');
});

test('provider page uses the nonce and no inline handlers', () => {
  const html = providerSharePage('abc123');
  assert.ok(html.includes('nonce="abc123"'));
  assert.ok(!/\son[a-z]+=/i.test(html));
  assert.ok(!/\sstyle=/i.test(html));
});

import express from 'express';
import type { AddressInfo } from 'node:net';
import { createProviderShareRouter } from '../providerShare';

test('a code channel that cannot deliver is refused before anything is created', async () => {
  const app = express();
  app.use(express.json());
  const deps: any = {
    getAuthUserId: () => 'u1', callerCanShare: async () => true, sendEmail: async () => {}, sendSms: async () => {},
    normalisePhone: phone, notify: async () => {}, limiter: (_q: any, _s: any, n: any) => n(), secret: 's',
    publicBaseUrl: () => 'http://x', channels: () => ({ email: false, sms: false }),
  };
  app.use('/api/v1', createProviderShareRouter(deps));
  const srv = app.listen(0);
  try {
    const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/api/v1/provider-shares`;
    const post = (verification: any) => fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientName: 'Dr Ade', sections: ['allergies'], hours: 24, verification }) });
    const a = await post({ mode: 'contact', channel: 'email', contact: 'dr@clinic.ng' });
    assert.equal(a.status, 400);
    assert.equal((await a.json()).code, 'channel_unavailable');
    const b = await post({ mode: 'contact', channel: 'sms', contact: '08012345678' });
    assert.equal(b.status, 400);
  } finally { srv.close(); }
});
