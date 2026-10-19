import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, randomBytes as nodeRandom } from 'node:crypto';
import { linkWithKey, SEAL_AAD, sealRecord, toBase64, toBase64Url } from '../src/utils/sealedShare';

const rnd = (n: number) => new Uint8Array(nodeRandom(n));
const fromB64 = (s: string) => new Uint8Array(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));

// Decrypts the way the provider page does, with WebCrypto.
async function openLikeBrowser(s: { ciphertext: string; iv: string }, key: string, aad = SEAL_AAD) {
  const k = await webcrypto.subtle.importKey('raw', fromB64(key), 'AES-GCM', false, ['decrypt']);
  const plain = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(s.iv), additionalData: new TextEncoder().encode(aad) }, k, fromB64(s.ciphertext));
  return JSON.parse(new TextDecoder().decode(plain));
}

test('base64 matches Node for every length', () => {
  for (let n = 0; n < 40; n++) {
    const b = rnd(n);
    assert.equal(toBase64(b), Buffer.from(b).toString('base64'));
    assert.equal(toBase64Url(b), Buffer.from(b).toString('base64url'));
  }
});

test('a sealed record opens with WebCrypto and the key from the link', async () => {
  const record = { patient: { name: 'Ada Obi — ñ' }, allergies: 'Penicillin' };
  const s = sealRecord(record, rnd);
  assert.deepEqual(await openLikeBrowser(s, s.key), record);
});

test('the ciphertext does not contain the plain text', () => {
  const s = sealRecord({ allergies: 'Penicillin' }, rnd);
  assert.ok(!Buffer.from(s.ciphertext, 'base64').toString('latin1').includes('Penicillin'));
});

test('a wrong key, a changed byte or another context fails', async () => {
  const s = sealRecord({ a: 1 }, rnd);
  await assert.rejects(openLikeBrowser(s, sealRecord({}, rnd).key));
  const bytes = fromB64(s.ciphertext); bytes[0] ^= 1;
  await assert.rejects(openLikeBrowser({ ...s, ciphertext: Buffer.from(bytes).toString('base64') }, s.key));
  await assert.rejects(openLikeBrowser(s, s.key, 'other'));
});

test('each seal uses a fresh key and nonce, and the link keeps the key in the fragment', () => {
  const a = sealRecord({ a: 1 }, rnd), b = sealRecord({ a: 1 }, rnd);
  assert.notEqual(a.key, b.key); assert.notEqual(a.iv, b.iv);
  const link = linkWithKey('https://x.test/share/tok', a.key);
  assert.equal(new URL(link).search, ''); assert.equal(new URL(link).hash, `#k=${a.key}`);
});

// The provider page's own decrypt code, run against what the phone produces.
import { SEAL_JS } from '../server/providerSharePage';

test('the provider page code opens what the phone sealed', async () => {
  const record = { patient: { name: 'Ada' }, medications: [{ name: 'Amoxicillin' }] };
  const s = sealRecord(record, rnd);
  const openSealed = new Function('fragKey', `${SEAL_JS};return openSealed;`)(s.key);
  assert.deepEqual(await openSealed({ ciphertext: s.ciphertext, iv: s.iv }), record);
  const wrong = new Function('fragKey', `${SEAL_JS};return openSealed;`)(sealRecord({}, rnd).key);
  await assert.rejects(wrong({ ciphertext: s.ciphertext, iv: s.iv }));
  const missing = new Function('fragKey', `${SEAL_JS};return openSealed;`)(null);
  await assert.rejects(missing({ ciphertext: s.ciphertext, iv: s.iv }));
});
