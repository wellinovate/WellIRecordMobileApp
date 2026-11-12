// Identity check with a National Identity Number (NIN) through 2AM Connect.
// GET /identity/nin/status and POST /identity/nin (token). The NIN is used once and never stored, logged or returned.
import express, { Request, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { UserProfile } from './models';
import { NinAttempt } from './ninModels';
import { lookupNin, ninConfig } from './ninClient';
import { NIN_METHOD } from './ninCore';
import { verifyNin, type NinDeps } from './ninService';

export interface NinRouteDeps {
  getAuthUserId: (req: Request) => string | null;
  limiter: RequestHandler;
  audit?: (req: Request, accountId: string, action: string, detail: string) => void | Promise<void>;
}

const oid = (id: string) => new mongoose.Types.ObjectId(id);

const deps: NinDeps = {
  getProfile: async (accountId) =>
    (await UserProfile.findOne({ accountId: oid(accountId) }).select('fullName name firstName middleName lastName dateOfBirth dob identityVerifiedAt').lean()) as any,
  countAttempts: (accountId, since, outcomes) =>
    NinAttempt.countDocuments({ accountId: oid(accountId), createdAt: { $gte: since }, outcome: { $in: outcomes } }),
  countAllAttempts: (since) => NinAttempt.countDocuments({ createdAt: { $gte: since } }),
  recordAttempt: (row) => NinAttempt.create({ ...row, accountId: oid(row.accountId) }),
  markVerified: (accountId, at) =>
    UserProfile.updateOne(
      { accountId: oid(accountId) },
      { $set: { identityVerifiedAt: at, identityVerifiedBy: 'system', identityVerifiedMethod: NIN_METHOD } }
    ),
  lookup: lookupNin,
};

export function createNin(d: NinRouteDeps) {
  const router = express.Router();
  const who = (req: Request) => {
    const id = d.getAuthUserId(req);
    return id && mongoose.isValidObjectId(id) ? id : null;
  };

  router.get('/identity/nin/status', async (req, res) => {
    const accountId = who(req);
    if (!accountId) return res.status(401).json({ success: false, message: 'Sign in to continue.' });
    try {
      const p: any = await UserProfile.findOne({ accountId: oid(accountId) }).select('identityVerifiedAt identityVerifiedMethod').lean();
      if (!p) return res.status(404).json({ success: false, message: 'Profile not found.' });
      return res.json({
        success: true,
        verified: Boolean(p.identityVerifiedAt),
        verifiedAt: p.identityVerifiedAt || null,
        method: p.identityVerifiedMethod || null,
        available: ninConfig().enabled,
      });
    } catch (err: any) {
      console.error('[nin] status:', err?.message);
      return res.status(500).json({ success: false, message: 'Could not load your status. Try again.' });
    }
  });

  router.post('/identity/nin', d.limiter, async (req, res) => {
    const accountId = who(req);
    if (!accountId) return res.status(401).json({ success: false, message: 'Sign in to continue.' });
    try {
      const r = await verifyNin({ accountId, nin: req.body?.nin, consent: req.body?.consent, deps });
      if (!r.ok) return res.status(r.status).json({ success: false, code: r.code, message: r.message });
      if (!r.already) await d.audit?.(req, accountId, 'identity_verified', 'Identity checked against NIN');
      return res.json({ success: true, verified: true, already: Boolean(r.already), verifiedAt: r.verifiedAt });
    } catch (err: any) {
      console.error('[nin] verify:', err?.message); // message only: the request body holds the NIN
      return res.status(500).json({ success: false, message: 'Could not complete the check. Try again.' });
    }
  });

  return { router };
}
