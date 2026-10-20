// Checks a Clerk session token on the server, so a social sign-in is proved by Clerk and not by
// an email address typed into a request. Needs CLERK_SECRET_KEY (Clerk dashboard > API keys).
//
// 1. Fetch Clerk's public signing keys (cached for an hour) and verify the token's signature.
// 2. Read the user behind the token from the Clerk API and return their verified primary email.

import crypto from 'crypto';
import jwt from 'jsonwebtoken';

type FetchLike = (url: string, init?: any) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;

export interface ClerkIdentity {
  userId: string;
  email: string;
}

const KEY_TTL_MS = 60 * 60 * 1000;
let keyCache: { at: number; keys: any[] } | null = null;

export function resetClerkKeyCache() {
  keyCache = null;
}

async function loadKeys(secretKey: string, fetchImpl: FetchLike, now: number, force = false): Promise<any[]> {
  if (!force && keyCache && now - keyCache.at < KEY_TTL_MS) return keyCache.keys;
  const r = await fetchImpl('https://api.clerk.com/v1/jwks', { headers: { Authorization: `Bearer ${secretKey}` } });
  if (!r.ok) throw new Error(`Clerk keys ${r.status}`);
  const body = await r.json();
  const keys = Array.isArray(body?.keys) ? body.keys : [];
  keyCache = { at: now, keys };
  return keys;
}

export interface ClerkVerifyResult {
  ok: boolean;
  identity?: ClerkIdentity;
  reason?: 'not_configured' | 'invalid_token' | 'no_verified_email' | 'upstream';
}

export async function verifyClerkSession(
  token: unknown,
  opts: { secretKey?: string; fetchImpl?: FetchLike; now?: number } = {}
): Promise<ClerkVerifyResult> {
  const secretKey = opts.secretKey ?? process.env.CLERK_SECRET_KEY;
  if (!secretKey) return { ok: false, reason: 'not_configured' };
  if (typeof token !== 'string' || token.length < 20 || token.length > 8000) return { ok: false, reason: 'invalid_token' };
  const fetchImpl = opts.fetchImpl ?? (fetch as unknown as FetchLike);
  const now = opts.now ?? Date.now();

  let claims: any;
  try {
    const header: any = jwt.decode(token, { complete: true })?.header;
    if (!header?.kid || header.alg !== 'RS256') return { ok: false, reason: 'invalid_token' };

    let keys = await loadKeys(secretKey, fetchImpl, now);
    let jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) {
      keys = await loadKeys(secretKey, fetchImpl, now, true); // key may have rotated
      jwk = keys.find((k) => k.kid === header.kid);
    }
    if (!jwk) return { ok: false, reason: 'invalid_token' };

    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    claims = jwt.verify(token, publicKey, { algorithms: ['RS256'], clockTimestamp: Math.floor(now / 1000) });
  } catch (err: any) {
    if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError' || err?.name === 'NotBeforeError') {
      return { ok: false, reason: 'invalid_token' };
    }
    return { ok: false, reason: 'upstream' };
  }

  const sub = typeof claims?.sub === 'string' ? claims.sub : '';
  if (!/^user_[A-Za-z0-9]+$/.test(sub)) return { ok: false, reason: 'invalid_token' };

  try {
    const r = await fetchImpl(`https://api.clerk.com/v1/users/${encodeURIComponent(sub)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (r.status === 404) return { ok: false, reason: 'invalid_token' };
    if (!r.ok) return { ok: false, reason: 'upstream' };
    const user = await r.json();
    const addresses: any[] = Array.isArray(user?.email_addresses) ? user.email_addresses : [];
    const primary = addresses.find((a) => a.id === user.primary_email_address_id) ?? addresses[0];
    const verified = primary?.verification?.status === 'verified';
    const email = String(primary?.email_address ?? '').toLowerCase().trim();
    if (!verified || !email) return { ok: false, reason: 'no_verified_email' };
    return { ok: true, identity: { userId: sub, email } };
  } catch {
    return { ok: false, reason: 'upstream' };
  }
}
