/**
 * WelliPay partner API. WelliPay asks WelliRecord to prove that a person
 * controls a WR-ID, without WelliPay ever seeing the person's phone or email.
 *
 *   POST /wellipay/v1/verifications                      { requestId, reference }
 *   POST /wellipay/v1/verifications/:requestId/confirm   { code }
 *
 * Calls carry "Authorization: Bearer <WELLIPAY_PARTNER_KEY>", a Unix-second
 * X-WelliPay-Timestamp and X-WelliPay-Signature (HMAC-SHA256 of
 * "<timestamp>.<raw body>"). The start call always answers 202, so it cannot
 * be used to find out which WR-IDs exist. The code goes by SMS when the
 * patient has a phone number, and by email otherwise.
 */
import crypto from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose, { Schema } from 'mongoose';
import { Account, UserProfile } from './models';

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const MAX_CODES_PER_WINDOW = 3;
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashCode(key: string, requestId: string, code: string): string {
  return crypto.createHmac('sha256', key).update(`${requestId}:${code}`).digest('hex');
}

export function safeEqual(a: unknown, b: unknown): boolean {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function signatureFor(key: string, timestamp: number | string, rawBody: string): string {
  return `sha256=${crypto.createHmac('sha256', key).update(`${timestamp}.${rawBody}`).digest('hex')}`;
}

export function checkRequestAuth(input: {
  key?: string;
  authorization?: string;
  timestamp?: string;
  signature?: string;
  rawBody?: string;
  nowSeconds?: number;
}): { ok: true } | { ok: false; status: number; reason: string } {
  const { key, authorization, timestamp, signature, rawBody } = input;
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!key) return { ok: false, status: 503, reason: 'not_configured' };
  if (!authorization || !safeEqual(authorization, `Bearer ${key}`)) return { ok: false, status: 401, reason: 'bad_key' };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > SIGNATURE_TOLERANCE_SECONDS) return { ok: false, status: 401, reason: 'stale' };
  if (typeof rawBody !== 'string' || !signature || !safeEqual(signature, signatureFor(key, ts, rawBody))) {
    return { ok: false, status: 401, reason: 'bad_signature' };
  }
  return { ok: true };
}

export function normalizeReference(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toUpperCase();
  return /^WR-[A-Z0-9]+(-[A-Z0-9]+)*$/.test(value) && value.length <= 40 ? value : null;
}

export const validRequestId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v);
export const validCode = (v: unknown): v is string => typeof v === 'string' && /^\d{6}$/.test(v);

const codeText = (code: string) =>
  `Your WelliRecord code to connect WelliPay is ${code}. It expires in 10 minutes. If you did not ask for this, ignore this message.`;

// Same collection name the main WelliRecord backend uses, so both services see the same rows if they share a database.
const VerificationSchema = new Schema(
  {
    requestId: { type: String, required: true, unique: true },
    reference: { type: String, required: true, index: true },
    userProfileId: { type: Schema.Types.ObjectId, required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);
VerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });
export const WellipayVerification: any =
  mongoose.models.WellipayVerification || mongoose.model('WellipayVerification', VerificationSchema, 'wellipayverifications');

export interface Senders {
  sendSms: (phone: string, message: string) => Promise<void>;
  sendEmail: (to: string, subject: string, text: string) => Promise<void>;
}

export function createWellipayRouter({ sendSms, sendEmail }: Senders) {
  const router = express.Router();
  const partnerKey = () => process.env.WELLIPAY_PARTNER_KEY?.trim();

  // Keep the raw body: the signature is computed over it.
  router.use(
    express.json({
      limit: '10kb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    })
  );
  router.use(rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests.' } }));

  router.use((req: Request, res: Response, next: NextFunction) => {
    const result = checkRequestAuth({
      key: partnerKey(),
      authorization: req.get('authorization'),
      timestamp: req.get('x-wellipay-timestamp'),
      signature: req.get('x-wellipay-signature'),
      rawBody: (req as any).rawBody,
    });
    if ('status' in result) {
      if (result.status === 503) console.error('[WelliPay] WELLIPAY_PARTNER_KEY is not set. Verification calls are refused.');
      return res.status(result.status).json({ error: 'Not authorised.' });
    }
    next();
  });

  // The patient behind a WR-ID, with the contacts to send a code to. Null when there is none.
  async function findPatient(reference: string) {
    const profile: any = await UserProfile.findOne({ wrId: reference }).lean();
    if (!profile) return null;
    const account: any = await Account.findById(profile.accountId).lean();
    if (account && (account.accountType === 'organization' || (account.role && account.role !== 'patient'))) return null;
    return {
      id: profile._id,
      phone: (profile.phone || account?.phoneNumber || account?.phone || '') as string,
      email: (profile.email || account?.email || '') as string,
    };
  }

  router.post('/verifications', async (req: Request, res: Response) => {
    const requestId = req.body?.requestId;
    const reference = normalizeReference(req.body?.reference);
    if (!validRequestId(requestId) || !reference) return res.status(400).json({ error: 'Invalid request.' });

    // Answer first, so response time and body are the same whether or not the WR-ID exists.
    res.status(202).json({ accepted: true });

    try {
      if (await WellipayVerification.exists({ requestId })) return;
      const patient = await findPatient(reference);
      if (!patient) return;
      const recent = await WellipayVerification.countDocuments({ reference, createdAt: { $gt: new Date(Date.now() - CODE_TTL_MS) } });
      if (recent >= MAX_CODES_PER_WINDOW) return;

      const code = generateCode();
      await WellipayVerification.create({
        requestId,
        reference,
        userProfileId: patient.id,
        codeHash: hashCode(partnerKey()!, requestId, code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      });
      if (patient.phone) await sendSms(patient.phone, codeText(code));
      else if (patient.email) await sendEmail(patient.email, 'Your WelliRecord code to connect WelliPay', codeText(code));
      else console.warn(`[WelliPay] ${reference} has no phone or email; no code sent.`);
    } catch (err: any) {
      console.error('[WelliPay] verification start failed:', err?.message || err);
    }
  });

  router.post('/verifications/:requestId/confirm', async (req: Request, res: Response) => {
    const { requestId } = req.params;
    const code = req.body?.code;
    if (!validRequestId(requestId) || !validCode(code)) return res.status(400).json({ verified: false });
    try {
      const now = new Date();
      // Count the attempt first, in one atomic step, so parallel guesses cannot beat the limit.
      const row = await WellipayVerification.findOneAndUpdate(
        { requestId, consumedAt: null, expiresAt: { $gt: now }, attempts: { $lt: MAX_ATTEMPTS } },
        { $inc: { attempts: 1 } },
        { new: true }
      );
      if (!row) return res.status(200).json({ verified: false });
      if (!safeEqual(row.codeHash, hashCode(partnerKey()!, requestId, code))) return res.status(200).json({ verified: false });
      // A code works once.
      const used = await WellipayVerification.findOneAndUpdate({ _id: row._id, consumedAt: null }, { consumedAt: now });
      if (!used) return res.status(200).json({ verified: false });
      return res.status(200).json({ verified: true, reference: row.reference });
    } catch (err: any) {
      console.error('[WelliPay] verification confirm failed:', err?.message || err);
      return res.status(500).json({ error: 'Could not check the code.' });
    }
  });

  return router;
}
