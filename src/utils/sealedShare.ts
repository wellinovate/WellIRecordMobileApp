// End-to-end encryption for WelliBridge links. The phone encrypts the shared record with a random
// AES-256-GCM key. The server stores only the ciphertext. The key travels in the link after the
// '#', which browsers never send to a server, and the provider's browser decrypts with WebCrypto.
import { gcm } from '@noble/ciphers/aes.js';

export const SEAL_AAD = 'wellibridge:v1';

const enc = new TextEncoder();

export function toBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + (i + 1 < bytes.length ? chars[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? chars[n & 63] : '=');
  }
  return out;
}

export const toBase64Url = (bytes: Uint8Array) => toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export interface Sealed {
  /** AES-GCM ciphertext with the 16-byte tag appended, base64. */
  ciphertext: string;
  /** 12-byte nonce, base64. */
  iv: string;
  /** 32-byte key, base64url. Goes in the link fragment only. */
  key: string;
}

export function sealRecord(record: unknown, randomBytes: (n: number) => Uint8Array): Sealed {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const plain = enc.encode(JSON.stringify(record));
  const sealed = gcm(key, iv, enc.encode(SEAL_AAD)).encrypt(plain);
  return { ciphertext: toBase64(sealed), iv: toBase64(iv), key: toBase64Url(key) };
}

// The key goes after '#', so it is never part of a request.
export const linkWithKey = (url: string, key: string) => `${url}#k=${key}`;
