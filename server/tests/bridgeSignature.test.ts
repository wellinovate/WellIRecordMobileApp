import test from 'node:test';
import assert from 'node:assert/strict';
import { bridgeSign, bridgeVerify, callMain } from '../bridgeSignature';

const secret = 'x'.repeat(40);
const req = { method: 'POST', path: '/api/v1/bridge/link/claim', body: { code: 'ABCD1234', mobileAccountId: 'm1' } };

test('a signed request verifies, and tampering fails', () => {
  const headers = bridgeSign({ secret, ...req });
  assert.equal(bridgeVerify({ secret, ...req, headers }).ok, true);
  assert.equal(bridgeVerify({ secret, ...req, body: { code: 'ZZZZ9999' }, headers }).ok, false);
  assert.equal(bridgeVerify({ secret, ...req, path: '/api/v1/bridge/other', headers }).ok, false);
  assert.equal(bridgeVerify({ secret: 'y'.repeat(40), ...req, headers }).ok, false);
});

test('stale requests and repeated nonces are refused; a short secret switches it off', () => {
  const old = bridgeSign({ secret, ...req, ts: Date.now() - 6 * 60_000 });
  assert.equal(bridgeVerify({ secret, ...req, headers: old }).reason, 'stale');
  const seen = new Map<string, number>();
  const h = bridgeSign({ secret, ...req });
  assert.equal(bridgeVerify({ secret, ...req, headers: h, seen }).ok, true);
  assert.equal(bridgeVerify({ secret, ...req, headers: h, seen }).reason, 'replayed');
  assert.equal(bridgeVerify({ secret: 'short', ...req, headers: h }).reason, 'not_configured');
});

test('signatures match the website backend scheme (fixed vector)', () => {
  // Computed with shared/utils/bridgeSignature.js in the WelliRecord repo for the same inputs.
  const h = bridgeSign({ secret, method: 'GET', path: '/api/v1/bridge/x?y=1', ts: 1_700_000_000_000, nonce: 'abcdef0123456789' });
  assert.match(h['x-bridge-sig'], /^[a-f0-9]{64}$/);
  assert.equal(h['x-bridge-sig'], FIXED);
});

test('callMain signs the request and reports failures without throwing', async () => {
  process.env.BRIDGE_SECRET = secret;
  let seenHeaders: any = null;
  const ok = await callMain('POST', '/api/v1/bridge/link/claim', { a: 1 }, (async (_u: any, init: any) => {
    seenHeaders = init.headers;
    return { ok: true, status: 200, json: async () => ({ success: true, data: { hello: 1 } }) };
  }) as any);
  assert.deepEqual(ok.data, { hello: 1 });
  assert.ok(seenHeaders['x-bridge-sig']);
  const down = await callMain('GET', '/api/v1/bridge/x', undefined, (async () => { throw new Error('offline'); }) as any);
  assert.equal(down.status, 0);
  delete process.env.BRIDGE_SECRET;
  assert.equal((await callMain('GET', '/x')).status, 503);
});
const FIXED = 'ff5c08fb7c87bce8c9f20679431563d1f68a6c2d45be0a22a0cc5bd6b8373fc9';
