import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

// Signed requests between the mobile backend and the website backend. Same scheme as
// shared/utils/bridgeSignature.js in the WelliRecord repo: keep the two identical in behaviour.
// Both sides hold BRIDGE_SECRET. The signature covers time, a one-time nonce, method, full path
// with query and a hash of the body.

export const BRIDGE_MAX_SKEW_MS = 5 * 60 * 1000;
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export const bodyString = (body: unknown): string =>
  body === undefined || body === null || (typeof body === 'object' && !Object.keys(body as object).length) ? '' : typeof body === 'string' ? body : JSON.stringify(body);

export function bridgeSign(a: { secret: string; method: string; path: string; body?: unknown; ts?: number; nonce?: string }) {
  const ts = a.ts ?? Date.now();
  const nonce = a.nonce ?? crypto.randomBytes(12).toString('hex');
  const base = [ts, nonce, a.method.toUpperCase(), a.path, sha256(bodyString(a.body))].join('.');
  const sig = crypto.createHmac('sha256', a.secret).update(base).digest('hex');
  return { 'x-bridge-ts': String(ts), 'x-bridge-nonce': nonce, 'x-bridge-sig': sig };
}

export function bridgeVerify(a: {
  secret: string;
  method: string;
  path: string;
  body?: unknown;
  headers: Record<string, unknown>;
  now?: number;
  seen?: Map<string, number>;
}): { ok: boolean; reason?: string } {
  const now = a.now ?? Date.now();
  if (!a.secret || a.secret.length < 24) return { ok: false, reason: 'not_configured' };
  const ts = Number(a.headers['x-bridge-ts']);
  const nonce = String(a.headers['x-bridge-nonce'] || '');
  const sig = String(a.headers['x-bridge-sig'] || '');
  if (!Number.isFinite(ts) || !/^[a-f0-9]{16,64}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(sig)) return { ok: false, reason: 'bad_headers' };
  if (Math.abs(now - ts) > BRIDGE_MAX_SKEW_MS) return { ok: false, reason: 'stale' };
  const expected = bridgeSign({ secret: a.secret, method: a.method, path: a.path, body: a.body, ts, nonce })['x-bridge-sig'];
  const x = Buffer.from(expected, 'hex');
  const y = Buffer.from(sig, 'hex');
  if (x.length !== y.length || !crypto.timingSafeEqual(x, y)) return { ok: false, reason: 'bad_signature' };
  if (a.seen) {
    for (const [k, t] of a.seen) if (now - t > BRIDGE_MAX_SKEW_MS) a.seen.delete(k);
    if (a.seen.has(nonce)) return { ok: false, reason: 'replayed' };
    a.seen.set(nonce, now);
  }
  return { ok: true };
}

const seenNonces = new Map<string, number>();

/** Express middleware for routes the website backend calls. Answers 401 without saying why. */
export function requireBridge(req: Request, res: Response, next: NextFunction) {
  const r = bridgeVerify({ secret: process.env.BRIDGE_SECRET || '', method: req.method, path: req.originalUrl, body: req.body, headers: req.headers as any, seen: seenNonces });
  if (!r.ok) {
    if (r.reason === 'not_configured') return res.status(503).json({ success: false, message: 'The bridge is not switched on.' });
    return res.status(401).json({ success: false, message: 'Not allowed.' });
  }
  next();
}

export const bridgeConfigured = () => (process.env.BRIDGE_SECRET || '').length >= 24;
export const MAIN_API_URL = () => (process.env.MAIN_API_URL || 'https://wellirecord.onrender.com').replace(/\/+$/, '');

export interface BridgeResult<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  message?: string;
  code?: string;
  opensAt?: string;
}

/** Call the website backend. Never throws; a network failure is status 0. */
export async function callMain<T = any>(method: 'GET' | 'POST' | 'DELETE' | 'PUT', path: string, body?: unknown, fetchImpl: typeof fetch = fetch): Promise<BridgeResult<T>> {
  if (!bridgeConfigured()) return { ok: false, status: 503, message: 'Linking is not switched on yet.' };
  const headers: Record<string, string> = { ...bridgeSign({ secret: process.env.BRIDGE_SECRET!, method, path, body }) };
  const text = bodyString(body);
  if (text) headers['content-type'] = 'application/json';
  try {
    const r = await fetchImpl(`${MAIN_API_URL()}${path}`, { method, headers, body: text || undefined, signal: AbortSignal.timeout(15_000) });
    const j: any = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, status: r.status, data: (j?.data ?? j) as T } : { ok: false, status: r.status, message: j?.message, code: j?.code, opensAt: j?.opensAt };
  } catch {
    return { ok: false, status: 0, message: 'The website could not be reached. Try again in a moment.' };
  }
}
