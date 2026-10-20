import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { beforeEach, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { resetClerkKeyCache, verifyClerkSession } from '../clerkVerify';

const pair = () => crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const good = pair();
const other = pair();
const jwk = { ...(good.publicKey.export({ format: 'jwk' }) as object), kid: 'ins_1', alg: 'RS256', use: 'sig' };
const NOW = Date.UTC(2026, 9, 20, 12);
const sec = Math.floor(NOW / 1000);

const tokenWith = (key: crypto.KeyObject, claims: object = {}, kid = 'ins_1') =>
  jwt.sign({ sub: 'user_abc123', iat: sec - 10, exp: sec + 60, ...claims }, key, { algorithm: 'RS256', keyid: kid, noTimestamp: true });

function fakeFetch(user: any = null, status = 200) {
  return async (url: string) => {
    if (url.endsWith('/v1/jwks')) return { ok: true, status: 200, json: async () => ({ keys: [jwk] }) };
    if (url.includes('/v1/users/')) return { ok: status < 400, status, json: async () => user };
    throw new Error(`unexpected ${url}`);
  };
}
const verifiedUser = { primary_email_address_id: 'e1', email_addresses: [{ id: 'e1', email_address: 'Ada@Example.com', verification: { status: 'verified' } }] };

describe('verifyClerkSession', () => {
  beforeEach(() => resetClerkKeyCache());
  const base = { secretKey: 'sk_test_x', now: NOW };

  it('returns the verified primary email, lowercased', async () => {
    const r = await verifyClerkSession(tokenWith(good.privateKey), { ...base, fetchImpl: fakeFetch(verifiedUser) });
    assert.equal(r.ok, true);
    assert.equal(r.identity?.email, 'ada@example.com');
    assert.equal(r.identity?.userId, 'user_abc123');
  });
  it('refuses when no secret key is configured', async () => {
    const r = await verifyClerkSession(tokenWith(good.privateKey), { secretKey: '', now: NOW, fetchImpl: fakeFetch(verifiedUser) });
    assert.equal(r.reason, 'not_configured');
  });
  it('rejects a token signed with another key', async () => {
    const r = await verifyClerkSession(tokenWith(other.privateKey), { ...base, fetchImpl: fakeFetch(verifiedUser) });
    assert.equal(r.reason, 'invalid_token');
  });
  it('rejects an expired token', async () => {
    const r = await verifyClerkSession(tokenWith(good.privateKey, { exp: sec - 5 }), { ...base, fetchImpl: fakeFetch(verifiedUser) });
    assert.equal(r.reason, 'invalid_token');
  });
  it('rejects an unknown key id and a non-user subject', async () => {
    assert.equal((await verifyClerkSession(tokenWith(good.privateKey, {}, 'ins_nope'), { ...base, fetchImpl: fakeFetch(verifiedUser) })).reason, 'invalid_token');
    assert.equal((await verifyClerkSession(tokenWith(good.privateKey, { sub: 'org_1' }), { ...base, fetchImpl: fakeFetch(verifiedUser) })).reason, 'invalid_token');
  });
  it('rejects junk and an unsigned token', async () => {
    assert.equal((await verifyClerkSession('abc', { ...base, fetchImpl: fakeFetch(verifiedUser) })).reason, 'invalid_token');
    assert.equal((await verifyClerkSession(undefined, { ...base, fetchImpl: fakeFetch(verifiedUser) })).reason, 'invalid_token');
    const none = jwt.sign({ sub: 'user_abc123' }, '', { algorithm: 'none' as any });
    assert.equal((await verifyClerkSession(none, { ...base, fetchImpl: fakeFetch(verifiedUser) })).reason, 'invalid_token');
  });
  it('refuses an unverified email', async () => {
    const u = { ...verifiedUser, email_addresses: [{ id: 'e1', email_address: 'a@b.co', verification: { status: 'unverified' } }] };
    assert.equal((await verifyClerkSession(tokenWith(good.privateKey), { ...base, fetchImpl: fakeFetch(u) })).reason, 'no_verified_email');
  });
  it('reports an upstream failure separately from a bad token', async () => {
    assert.equal((await verifyClerkSession(tokenWith(good.privateKey), { ...base, fetchImpl: fakeFetch(null, 500) })).reason, 'upstream');
  });
});
