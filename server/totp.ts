// Time-based one-time passwords (RFC 6238) for staff sign-in, with no extra dependency.
// HMAC-SHA1, 30 second steps, 6 digits: what Google Authenticator, Microsoft Authenticator,
// Authy and 1Password all expect. Pure functions so they can be tested against the RFC vectors.

import crypto from 'crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const STEP_SECONDS = 30;
export const DIGITS = 6;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error('Not a base32 string');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function newSecret(): string {
  return base32Encode(crypto.randomBytes(20)); // 160 bits, as RFC 4226 recommends
}

export const stepFor = (ms: number) => Math.floor(ms / 1000 / STEP_SECONDS);

export function hotp(secret: Buffer, counter: number, digits = DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', secret).update(msg).digest();
  const o = h[h.length - 1] & 0x0f;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export function totp(secretB32: string, ms: number, digits = DIGITS): string {
  return hotp(base32Decode(secretB32), stepFor(ms), digits);
}

/**
 * Checks a code against the current step and one step either side (clock drift).
 * `lastUsedStep` blocks replay: a code is accepted only for a step later than the last one used.
 * Returns the matched step, or null.
 */
export function verifyTotp(secretB32: string, code: unknown, ms: number, lastUsedStep = -1): number | null {
  const given = String(code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(given)) return null;
  const secret = base32Decode(secretB32);
  const now = stepFor(ms);
  let matched: number | null = null;
  for (const step of [now - 1, now, now + 1]) {
    const expected = hotp(secret, step);
    // compare every candidate so timing does not reveal which step matched
    const same = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given));
    if (same && step > lastUsedStep && (matched === null || step > matched)) matched = step;
  }
  return matched;
}

export function otpauthUrl(secretB32: string, account: string, issuer = 'WelliRecord Staff'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

// ----- secrets at rest -----

const key = (jwtSecret: string) => crypto.createHash('sha256').update(`welli-mfa-secrets-v1:${jwtSecret}`).digest();

/** AES-256-GCM. Output: iv.tag.ciphertext, base64url parts. */
export function sealSecret(jwtSecret: string, plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(jwtSecret), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString('base64url')).join('.');
}

export function openSecret(jwtSecret: string, sealed: string): string | null {
  try {
    const [iv, tag, ct] = sealed.split('.').map((p) => Buffer.from(p, 'base64url'));
    const d = crypto.createDecipheriv('aes-256-gcm', key(jwtSecret), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// ----- recovery codes -----

const RC_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    let s = '';
    for (let i = 0; i < 10; i++) s += RC_ALPHABET[crypto.randomInt(RC_ALPHABET.length)];
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
}

export const normaliseRecovery = (v: unknown) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const hashRecovery = (jwtSecret: string, code: unknown) =>
  crypto.createHmac('sha256', jwtSecret).update(`mfa-recovery:${normaliseRecovery(code)}`).digest('hex');
