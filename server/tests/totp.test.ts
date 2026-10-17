import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  base32Decode, base32Encode, hashRecovery, hotp, newRecoveryCodes, newSecret, normaliseRecovery, openSecret,
  otpauthUrl, sealSecret, totp, verifyTotp,
} from '../totp';

// RFC 6238 appendix B, SHA-1, secret "12345678901234567890", 8 digit codes.
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));
const RFC: [number, string][] = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
  [20000000000, '65353130'],
];

describe('TOTP', () => {
  it('matches the RFC 6238 test vectors', () => {
    for (const [t, expected] of RFC) assert.equal(totp(RFC_SECRET, t * 1000, 8), expected, `t=${t}`);
  });
  it('gives the 6 digit form of the same vectors', () => {
    assert.equal(totp(RFC_SECRET, 59_000), '287082');
  });
  it('matches the RFC 4226 HOTP vectors', () => {
    const s = Buffer.from('12345678901234567890');
    ['755224', '287082', '359152', '969429', '338314', '254676'].forEach((c, i) => assert.equal(hotp(s, i), c));
  });
  it('accepts the current code and one step of drift, not two', () => {
    const t = 1_700_000_000_000;
    const code = totp(RFC_SECRET, t);
    assert.notEqual(verifyTotp(RFC_SECRET, code, t), null);
    assert.notEqual(verifyTotp(RFC_SECRET, code, t + 30_000), null);
    assert.notEqual(verifyTotp(RFC_SECRET, code, t - 30_000), null);
    assert.equal(verifyTotp(RFC_SECRET, code, t + 90_000), null);
  });
  it('rejects malformed codes and wrong codes', () => {
    const t = 1_700_000_000_000;
    for (const bad of ['', '12345', '1234567', 'abcdef', null, undefined, '000000x']) assert.equal(verifyTotp(RFC_SECRET, bad, t), null);
    const right = totp(RFC_SECRET, t);
    const wrong = String((Number(right) + 1) % 1_000_000).padStart(6, '0');
    assert.equal(verifyTotp(RFC_SECRET, wrong, t), null);
  });
  it('blocks replay of a code already used', () => {
    const t = 1_700_000_000_000;
    const code = totp(RFC_SECRET, t);
    const step = verifyTotp(RFC_SECRET, code, t)!;
    assert.equal(verifyTotp(RFC_SECRET, code, t, step), null);
  });
  it('ignores spaces in the typed code', () => {
    const t = 1_700_000_000_000;
    const c = totp(RFC_SECRET, t);
    assert.notEqual(verifyTotp(RFC_SECRET, `${c.slice(0, 3)} ${c.slice(3)}`, t), null);
  });
});

describe('base32 and provisioning', () => {
  it('round-trips and tolerates case, spaces and dashes', () => {
    const s = newSecret();
    assert.equal(s.length, 32);
    assert.equal(base32Encode(base32Decode(s)), s);
    assert.deepEqual(base32Decode(s.toLowerCase().replace(/(.{4})/g, '$1 ')), base32Decode(s));
  });
  it('encodes the RFC secret as the well-known string', () => {
    assert.equal(RFC_SECRET, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });
  it('builds an otpauth URL authenticator apps accept', () => {
    const u = otpauthUrl('ABC234', 'dr@clinic.ng');
    assert.match(u, /^otpauth:\/\/totp\/WelliRecord%20Staff%3Adr%40clinic\.ng\?secret=ABC234&issuer=WelliRecord%20Staff/);
    assert.match(u, /digits=6&period=30/);
  });
});

describe('secrets at rest and recovery codes', () => {
  it('seals and opens a secret, and fails with another key or tampering', () => {
    const sealed = sealSecret('jwt-a', 'JBSWY3DPEHPK3PXP');
    assert.ok(!sealed.includes('JBSWY3DPEHPK3PXP'));
    assert.equal(openSecret('jwt-a', sealed), 'JBSWY3DPEHPK3PXP');
    assert.equal(openSecret('jwt-b', sealed), null);
    assert.equal(openSecret('jwt-a', sealed.slice(0, -3) + 'AAA'), null);
  });
  it('produces 8 distinct recovery codes that hash the same however typed', () => {
    const codes = newRecoveryCodes();
    assert.equal(codes.length, 8);
    assert.equal(new Set(codes).size, 8);
    for (const c of codes) assert.match(c, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    assert.equal(hashRecovery('k', codes[0]), hashRecovery('k', codes[0].toLowerCase().replace('-', ' ')));
    assert.notEqual(hashRecovery('k', codes[0]), hashRecovery('k', codes[1]));
    assert.equal(normaliseRecovery('ab-12 cd'), 'AB12CD');
  });
});
