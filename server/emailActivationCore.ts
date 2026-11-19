// Email activation link for new sign-ups.
//
// The sign-up email carries a link and the 6-digit code. Tapping the link confirms the address on a web page;
// the app, which is polling with a secret it made itself (the attempt id), then continues without the code.
// Typing the code still works. The attempt id never leaves the phone except in requests the app makes,
// so someone who only knows the email address cannot use the link's result.
//
// The rules are here with no database so tests can run them.
import crypto from 'crypto';

export const ACTIVATION_TTL_MS = 30 * 60 * 1000;
export const ATTEMPT_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export interface ActivationDoc {
  emailHash: string;
  attemptHash: string;
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
  activatedAt?: number;
}

export interface ActivationStore {
  insert(doc: ActivationDoc): Promise<void>;
  /** Removes older links for the same email and attempt, so a resend replaces the earlier link. */
  removeFor(emailHash: string, attemptHash: string): Promise<void>;
  findByToken(tokenHash: string): Promise<(ActivationDoc & { id: string }) | null>;
  findByAttempt(emailHash: string, attemptHash: string): Promise<(ActivationDoc & { id: string }) | null>;
  markActivated(id: string, at: number): Promise<void>;
  remove(id: string): Promise<void>;
}

const secret = () => process.env.OTP_HASH_KEY || process.env.JWT_SECRET || 'dev-only-otp-key';
const h = (kind: string, v: string) => crypto.createHmac('sha256', secret()).update(`activation:${kind}:${v}`).digest('hex');
const normEmail = (e: string) => String(e || '').trim().toLowerCase();

export function createActivationService(store: ActivationStore, now: () => number = Date.now) {
  return {
    /** Makes a link token for this email and app attempt. Returns null when the attempt id is missing or malformed. */
    async issue(email: string, attemptId: unknown): Promise<string | null> {
      if (typeof attemptId !== 'string' || !ATTEMPT_ID_PATTERN.test(attemptId)) return null;
      const emailHash = h('email', normEmail(email));
      const attemptHash = h('attempt', attemptId);
      const token = crypto.randomBytes(32).toString('hex');
      await store.removeFor(emailHash, attemptHash);
      await store.insert({ emailHash, attemptHash, tokenHash: h('token', token), createdAt: now(), expiresAt: now() + ACTIVATION_TTL_MS });
      return token;
    },

    /** The web page confirms the link. 'ok' also covers a link that was already used and is still valid. */
    async confirm(token: unknown): Promise<'ok' | 'invalid' | 'expired'> {
      if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return 'invalid';
      const doc = await store.findByToken(h('token', token));
      if (!doc) return 'invalid';
      if (doc.expiresAt <= now()) return 'expired';
      if (!doc.activatedAt) await store.markActivated(doc.id, now());
      return 'ok';
    },

    /** The app asks whether the link was tapped. */
    async isActivated(email: string, attemptId: unknown): Promise<boolean> {
      if (typeof attemptId !== 'string' || !ATTEMPT_ID_PATTERN.test(attemptId)) return false;
      const doc = await store.findByAttempt(h('email', normEmail(email)), h('attempt', attemptId));
      return Boolean(doc && doc.activatedAt && doc.expiresAt > now());
    },

    /** Used once, in place of the code, when the app finishes sign-up. */
    async consume(email: string, attemptId: unknown): Promise<boolean> {
      if (typeof attemptId !== 'string' || !ATTEMPT_ID_PATTERN.test(attemptId)) return false;
      const doc = await store.findByAttempt(h('email', normEmail(email)), h('attempt', attemptId));
      if (!doc || !doc.activatedAt || doc.expiresAt <= now()) return false;
      await store.remove(doc.id);
      return true;
    },
  };
}

export function memoryActivationStore(): ActivationStore & { size(): number } {
  let seq = 0;
  const rows: (ActivationDoc & { id: string })[] = [];
  return {
    size: () => rows.length,
    async insert(doc) { rows.push({ ...doc, id: String(++seq) }); },
    async removeFor(e, a) { for (let i = rows.length - 1; i >= 0; i--) if (rows[i].emailHash === e && rows[i].attemptHash === a) rows.splice(i, 1); },
    async findByToken(t) { return rows.find((r) => r.tokenHash === t) || null; },
    async findByAttempt(e, a) { return rows.filter((r) => r.emailHash === e && r.attemptHash === a).sort((x, y) => y.createdAt - x.createdAt)[0] || null; },
    async markActivated(id, at) { const r = rows.find((x) => x.id === id); if (r) r.activatedAt = at; },
    async remove(id) { const i = rows.findIndex((r) => r.id === id); if (i >= 0) rows.splice(i, 1); },
  };
}
