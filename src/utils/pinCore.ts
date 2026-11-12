// Rules for the app PIN. No React Native, no storage, so it can be tested on its own.
// The PIN is a second way to unlock the app, next to fingerprint or face. It lives on this phone only:
// the server never sees it. Only a salted hash is kept, in the phone's secure storage.
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';

export const PIN_LENGTH = 6;
export const MAX_PIN_ATTEMPTS = 5; // wrong tries in a row before the PIN is refused until another unlock works
export const PIN_ITERATIONS = 10_000;

export interface PinRecord {
  v: 1;
  salt: string; // hex
  hash: string; // hex
  iter: number;
}

export const isPinFormat = (v: string) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(v);

/** Why a new PIN is refused, or null when it is fine. Blocks the guesses people try first. */
export function weakPinReason(pin: string): string | null {
  if (!isPinFormat(pin)) return `Use exactly ${PIN_LENGTH} digits.`;
  if (/^(\d)\1+$/.test(pin)) return 'Do not use the same digit six times.';
  const d = pin.split('').map(Number);
  const step = d[1] - d[0];
  if ((step === 1 || step === -1) && d.every((n, i) => i === 0 || n - d[i - 1] === step)) {
    return 'Do not use a run of digits such as 123456.';
  }
  return null;
}

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string) => new Uint8Array((h.match(/.{2}/g) ?? []).map((x) => parseInt(x, 16)));

/** The salt must be random bytes from the phone (expo-crypto); it is passed in so this file stays testable. */
export function makePinRecord(pin: string, salt: Uint8Array, iter = PIN_ITERATIONS): PinRecord {
  const hash = pbkdf2(sha256, pin, salt, { c: iter, dkLen: 32 });
  return { v: 1, salt: toHex(salt), hash: toHex(hash), iter };
}

/** Compares in constant time over the whole hash. */
export function checkPin(pin: string, rec: PinRecord): boolean {
  if (!isPinFormat(pin) || rec?.v !== 1) return false;
  const got = pbkdf2(sha256, pin, fromHex(rec.salt), { c: rec.iter, dkLen: 32 });
  const want = fromHex(rec.hash);
  if (want.length !== got.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

export function parsePinRecord(raw: string | null | undefined): PinRecord | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw);
    if (r?.v === 1 && /^[0-9a-f]+$/.test(r.salt) && /^[0-9a-f]{64}$/.test(r.hash) && Number.isInteger(r.iter) && r.iter > 0) return r as PinRecord;
  } catch {
    /* a damaged record counts as no PIN */
  }
  return null;
}

export const attemptsLeft = (fails: number) => Math.max(0, MAX_PIN_ATTEMPTS - fails);
export const pinBlocked = (fails: number) => fails >= MAX_PIN_ATTEMPTS;
