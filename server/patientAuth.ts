// Second sign-in step for patients: a code from an authenticator app (TOTP), with 8 single-use
// recovery codes. Reuses the staff TOTP maths in totp.ts.
//
// How it fits in: a sign-in route that has proved the first factor (password, emailed or texted
// code, Clerk) calls `gate()`. If the person has turned the second step on, the route does not
// issue a session token. It returns `{ mfaRequired, mfaToken }` and the app asks for the code,
// then calls POST /auth/mfa/verify, which issues the token.

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Router, Request, Response, RequestHandler } from 'express';
import { PatientMfa } from './models';
import { auditAccount } from './accountAudit';
import { hashRecovery, newRecoveryCodes, newSecret, openSecret, otpauthUrl, sealSecret, verifyTotp } from './totp';

export const MFA_MAX_FAILS = 5;
export const MFA_LOCK_MS = 15 * 60 * 1000;

// ----- challenge token (proves the first factor, valid for 5 minutes, only good for /auth/mfa/verify) -----

const challengeKey = (jwtSecret: string) =>
  crypto.createHash('sha256').update(`welli-patient-mfa-challenge-v1:${jwtSecret}`).digest();

export interface PendingSignIn {
  userId: string;
  email?: string | null;
  phoneNumber?: string | null;
  fullName?: string | null;
  method: string;
}

export function signChallenge(jwtSecret: string, p: PendingSignIn): string {
  return jwt.sign({ typ: 'patient-mfa', ...p }, challengeKey(jwtSecret), { expiresIn: '5m' });
}

export function verifyChallenge(jwtSecret: string, token: unknown): PendingSignIn | null {
  try {
    const d: any = jwt.verify(String(token ?? ''), challengeKey(jwtSecret));
    if (d?.typ !== 'patient-mfa' || !d.userId) return null;
    return { userId: String(d.userId), email: d.email ?? null, phoneNumber: d.phoneNumber ?? null, fullName: d.fullName ?? null, method: String(d.method || 'sign-in') };
  } catch {
    return null;
  }
}

// ----- checking a code (pure, so it can be tested without a database) -----

export interface MfaState {
  secretEnc?: string;
  recovery: string[];
  lastStep: number;
  failCount: number;
  lockedUntil?: Date | null;
}

export type SecondStepResult =
  | { result: 'ok'; patch: Partial<MfaState>; usedRecovery: boolean }
  | { result: 'bad'; patch: Partial<MfaState>; locked: boolean }
  | { result: 'locked'; retryAfterSec: number };

export function evaluateSecondStep(
  rec: MfaState,
  input: { code?: unknown; recoveryCode?: unknown },
  jwtSecret: string,
  now = Date.now()
): SecondStepResult {
  if (rec.lockedUntil && rec.lockedUntil.getTime() > now) {
    return { result: 'locked', retryAfterSec: Math.ceil((rec.lockedUntil.getTime() - now) / 1000) };
  }
  const fail = (): SecondStepResult => {
    const failCount = (rec.failCount || 0) + 1;
    if (failCount >= MFA_MAX_FAILS) {
      return { result: 'bad', locked: true, patch: { failCount: 0, lockedUntil: new Date(now + MFA_LOCK_MS) } };
    }
    return { result: 'bad', locked: false, patch: { failCount } };
  };

  if (input.recoveryCode) {
    const h = hashRecovery(jwtSecret, input.recoveryCode);
    if (!rec.recovery.includes(h)) return fail();
    return { result: 'ok', usedRecovery: true, patch: { recovery: rec.recovery.filter((x) => x !== h), failCount: 0, lockedUntil: null } };
  }
  const secret = rec.secretEnc ? openSecret(jwtSecret, rec.secretEnc) : null;
  const step = secret ? verifyTotp(secret, input.code, now, rec.lastStep ?? -1) : null;
  if (step === null) return fail();
  return { result: 'ok', usedRecovery: false, patch: { lastStep: step, failCount: 0, lockedUntil: null } };
}

// ----- router -----

export interface PatientAuthDeps {
  jwtSecret: string;
  /**
   * Key that seals authenticator secrets and hashes recovery codes. Set MFA_SECRET_KEY so rotating
   * JWT_SECRET does not lock everyone out of their second step. Falls back to jwtSecret.
   */
  sealKey?: string;
  limiter: RequestHandler;
  getAuthUserId: (req: Request) => string | null;
  /** Label shown in the authenticator app, usually the account email. */
  accountLabel: (userId: string) => Promise<string>;
  /** Builds the same session token the other sign-in routes issue. */
  issueToken: (p: PendingSignIn) => string;
  /** Called once the second step passes, to send the usual "new sign-in" email. */
  onSignedIn?: (req: Request, p: PendingSignIn) => void;
}

export function createPatientAuth(deps: PatientAuthDeps) {
  const router = Router();
  const sealKey = deps.sealKey || deps.jwtSecret;

  /** True if the person has turned the second step on. */
  async function isEnabled(userId: string): Promise<boolean> {
    try {
      return Boolean(await PatientMfa.exists({ accountId: String(userId), enabled: true }));
    } catch (err) {
      // Fail closed: if we cannot tell, do not hand out a session.
      console.error('[patientAuth] could not read MFA state:', err);
      throw err;
    }
  }

  /**
   * Sign-in routes call this after the first factor. Returns the response body to send when a
   * second step is needed, or null when the route may issue its token as usual.
   */
  async function gate(p: PendingSignIn): Promise<Record<string, unknown> | null> {
    if (!(await isEnabled(p.userId))) return null;
    return {
      success: true,
      mfaRequired: true,
      mfaToken: signChallenge(deps.jwtSecret, p),
      user: { id: p.userId, fullName: p.fullName ?? undefined, email: p.email ?? undefined, phoneNumber: p.phoneNumber ?? undefined },
    };
  }

  const authed = (req: Request, res: Response): string | null => {
    const id = deps.getAuthUserId(req);
    if (!id) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return null;
    }
    return id;
  };

  async function applyPatch(rec: any, patch: Partial<MfaState>) {
    Object.assign(rec, patch);
    await rec.save();
  }

  router.get('/auth/mfa/status', async (req, res) => {
    const id = authed(req, res);
    if (!id) return;
    try {
      const rec: any = await PatientMfa.findOne({ accountId: id }).lean();
      res.json({ success: true, enabled: Boolean(rec?.enabled), recoveryCodesLeft: rec?.enabled ? rec.recovery.length : 0 });
    } catch (err) {
      console.error('[GET /auth/mfa/status] ERROR:', err);
      res.status(500).json({ success: false, message: 'Could not read your sign-in settings' });
    }
  });

  router.post('/auth/mfa/setup', deps.limiter, async (req, res) => {
    const id = authed(req, res);
    if (!id) return;
    try {
      const existing: any = await PatientMfa.findOne({ accountId: id });
      if (existing?.enabled) return res.status(409).json({ success: false, message: 'The second step is already on. Turn it off first to set it up again.' });
      const secret = newSecret();
      const sealed = sealSecret(sealKey, secret);
      if (existing) {
        existing.secretEnc = sealed;
        existing.lastStep = -1;
        await existing.save();
      } else {
        await PatientMfa.create({ accountId: id, secretEnc: sealed, enabled: false, recovery: [] });
      }
      const label = (await deps.accountLabel(id)) || 'account';
      res.json({ success: true, secret, otpauthUrl: otpauthUrl(secret, label, 'WelliRecord') });
    } catch (err) {
      console.error('[POST /auth/mfa/setup] ERROR:', err);
      res.status(500).json({ success: false, message: 'Could not start setup' });
    }
  });

  router.post('/auth/mfa/enable', deps.limiter, async (req, res) => {
    const id = authed(req, res);
    if (!id) return;
    try {
      const rec: any = await PatientMfa.findOne({ accountId: id });
      if (!rec?.secretEnc) return res.status(409).json({ success: false, message: 'Start setup first.' });
      if (rec.enabled) return res.status(409).json({ success: false, message: 'The second step is already on.' });
      const secret = openSecret(sealKey, rec.secretEnc);
      const step = secret ? verifyTotp(secret, req.body?.code, Date.now(), -1) : null;
      if (step === null) return res.status(400).json({ success: false, message: 'That code did not match. Check the time on your phone and try again.' });
      const codes = newRecoveryCodes();
      rec.enabled = true;
      rec.enabledAt = new Date();
      rec.lastStep = step;
      rec.failCount = 0;
      rec.recovery = codes.map((c) => hashRecovery(sealKey, c));
      await rec.save();
      await auditAccount(req, id, 'security', 'mfa_enabled', 'You');
      res.json({ success: true, recoveryCodes: codes });
    } catch (err) {
      console.error('[POST /auth/mfa/enable] ERROR:', err);
      res.status(500).json({ success: false, message: 'Could not turn on the second step' });
    }
  });

  /** Shared by disable and recovery-codes: the caller must pass a fresh code. */
  async function requireFreshCode(req: Request, res: Response, id: string) {
    const rec: any = await PatientMfa.findOne({ accountId: id });
    if (!rec?.enabled) {
      res.status(409).json({ success: false, message: 'The second step is not on.' });
      return null;
    }
    const out = evaluateSecondStep(rec, req.body ?? {}, sealKey);
    if (out.result === 'locked') {
      res.status(429).json({ success: false, message: 'Too many wrong codes. Try again in a few minutes.', retryAfterSec: out.retryAfterSec });
      return null;
    }
    await applyPatch(rec, out.patch);
    if (out.result === 'bad') {
      await auditAccount(req, id, 'security', out.locked ? 'mfa_locked' : 'mfa_failed', 'Someone using your session');
      res.status(400).json({ success: false, message: 'That code did not match.' });
      return null;
    }
    return rec;
  }

  router.post('/auth/mfa/disable', deps.limiter, async (req, res) => {
    const id = authed(req, res);
    if (!id) return;
    try {
      const rec = await requireFreshCode(req, res, id);
      if (!rec) return;
      await PatientMfa.deleteOne({ accountId: id });
      await auditAccount(req, id, 'security', 'mfa_disabled', 'You');
      res.json({ success: true });
    } catch (err) {
      console.error('[POST /auth/mfa/disable] ERROR:', err);
      res.status(500).json({ success: false, message: 'Could not turn off the second step' });
    }
  });

  router.post('/auth/mfa/recovery-codes', deps.limiter, async (req, res) => {
    const id = authed(req, res);
    if (!id) return;
    try {
      const rec = await requireFreshCode(req, res, id);
      if (!rec) return;
      const codes = newRecoveryCodes();
      rec.recovery = codes.map((c: string) => hashRecovery(sealKey, c));
      await rec.save();
      await auditAccount(req, id, 'security', 'mfa_recovery_codes', 'You');
      res.json({ success: true, recoveryCodes: codes });
    } catch (err) {
      console.error('[POST /auth/mfa/recovery-codes] ERROR:', err);
      res.status(500).json({ success: false, message: 'Could not make new recovery codes' });
    }
  });

  // Finishes a sign-in that returned mfaRequired.
  router.post('/auth/mfa/verify', deps.limiter, async (req, res) => {
    const pending = verifyChallenge(deps.jwtSecret, req.body?.mfaToken);
    if (!pending) return res.status(401).json({ success: false, message: 'Start sign-in again.', code: 'mfa_challenge_expired' });
    try {
      const rec: any = await PatientMfa.findOne({ accountId: pending.userId, enabled: true });
      if (!rec) return res.status(401).json({ success: false, message: 'Start sign-in again.', code: 'mfa_challenge_expired' });
      const out = evaluateSecondStep(rec, req.body ?? {}, sealKey);
      if (out.result === 'locked') {
        return res.status(429).json({ success: false, message: 'Too many wrong codes. Try again in a few minutes.', retryAfterSec: out.retryAfterSec });
      }
      await applyPatch(rec, out.patch);
      if (out.result === 'bad') {
        await auditAccount(req, pending.userId, 'security', out.locked ? 'mfa_locked' : 'mfa_failed', 'Someone signing in');
        return res.status(400).json({ success: false, message: 'That code did not match.' });
      }
      const token = deps.issueToken(pending);
      await auditAccount(req, pending.userId, 'security', 'sign_in_mfa', 'You', `${pending.method}${out.usedRecovery ? ', recovery code' : ''}`);
      deps.onSignedIn?.(req, pending);
      res.json({
        success: true,
        token,
        recoveryCodesLeft: rec.recovery.length,
        user: { id: pending.userId, fullName: pending.fullName ?? undefined, email: pending.email ?? undefined, phoneNumber: pending.phoneNumber ?? undefined },
      });
    } catch (err) {
      console.error('[POST /auth/mfa/verify] ERROR:', err);
      res.status(500).json({ success: false, message: 'Could not finish sign-in' });
    }
  });

  return { router, gate, isEnabled };
}
