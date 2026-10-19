// WelliBridge provider sharing. A patient (or guardian) shares part of a record with a provider who
// has no WelliRecord account, by link or QR code. The link expires, can be withdrawn, and opens only
// after a one-time code. The code goes to the provider's own email or phone, or the patient reads it
// out (passcode). Link token and codes are stored only as keyed hashes.
import crypto from 'crypto';
import express, { Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import {
  ChildGrowth, ChildVaccination, FamilyMember, HealthRecord, Prescription, ProviderShare, UserProfile,
} from './models';

export const SECTIONS = ['allergies', 'conditions', 'medications', 'records', 'vaccinations', 'growth'] as const;
export type Section = (typeof SECTIONS)[number];
export const MIN_HOURS = 1;
export const MAX_HOURS = 168; // 7 days
export const DEFAULT_HOURS = 24;
export const OTP_MINUTES = 10;
export const SESSION_MINUTES = 15;
export const MAX_SENDS_PER_HOUR = 5;
export const FAILS_BEFORE_COOLDOWN = 5;
export const COOLDOWN_MINUTES = 15;
export const LIFETIME_FAILS_LOCK = 15;

const HOUR = 60 * 60 * 1000;
const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

// ----- pure helpers (unit tested) -----
export const newToken = () => crypto.randomBytes(24).toString('base64url');
export const newCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
export const hashToken = (secret: string, token: string) =>
  crypto.createHmac('sha256', secret).update(`provider-share:token:${token}`).digest('hex');
export const hashCodeFor = (secret: string, shareId: string, code: string) =>
  crypto.createHmac('sha256', secret).update(`provider-share:code:${shareId}:${String(code).replace(/\D/g, '')}`).digest('hex');
export const sameHash = (a?: string, b?: string) => {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};
const sessionKey = (secret: string) => crypto.createHmac('sha256', secret).update('provider-share-session').digest();

export function maskContact(channel: string | undefined, contact: string | undefined): string {
  const c = String(contact || '');
  if (channel === 'email') {
    const [u, d = ''] = c.split('@');
    const dot = d.lastIndexOf('.');
    return `${u.slice(0, 1)}***@${d.slice(0, 1)}***${dot > 0 ? d.slice(dot) : ''}`;
  }
  return c.length > 4 ? `${c.slice(0, 4)} ••• ••• ${c.slice(-3)}` : '•••';
}

export type ShareState = 'active' | 'expired' | 'revoked' | 'locked';
export function shareState(s: { expiresAt: Date; revokedAt?: Date | null; lockedAt?: Date | null }, now = Date.now()): ShareState {
  if (s.revokedAt) return 'revoked';
  if (s.lockedAt) return 'locked';
  if (new Date(s.expiresAt).getTime() <= now) return 'expired';
  return 'active';
}

export function parseCreate(body: any, normalisePhone: (p: string) => string): { ok: true; value: any } | { ok: false; message: string } {
  const recipientName = clean(body?.recipientName, 120);
  if (recipientName.length < 2) return { ok: false, message: 'Enter the name of the doctor or clinic' };
  const sections = Array.from(new Set((Array.isArray(body?.sections) ? body.sections : []).map(String))).filter((s) =>
    (SECTIONS as readonly string[]).includes(s as string)
  ) as Section[];
  if (!sections.length) return { ok: false, message: 'Choose at least one thing to share' };
  const rawHours = Number(body?.hours ?? DEFAULT_HOURS);
  if (!Number.isFinite(rawHours) || rawHours < MIN_HOURS || rawHours > MAX_HOURS) {
    return { ok: false, message: `Choose a time between ${MIN_HOURS} hour and ${MAX_HOURS / 24} days` };
  }
  const v = body?.verification || {};
  let verification: any;
  if (v.mode === 'passcode') verification = { mode: 'passcode' };
  else if (v.mode === 'contact') {
    if (v.channel === 'email') {
      const email = clean(v.contact, 160).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, message: "Enter the provider's email address" };
      verification = { mode: 'contact', channel: 'email', contact: email };
    } else if (v.channel === 'sms') {
      const phone = normalisePhone(clean(v.contact, 30));
      if (!/^\+234[789]\d{9}$/.test(phone)) return { ok: false, message: "Enter the provider's Nigerian mobile number" };
      verification = { mode: 'contact', channel: 'sms', contact: phone };
    } else return { ok: false, message: 'Choose email or SMS for the code' };
  } else return { ok: false, message: 'Choose how the provider gets the code' };
  return { ok: true, value: { recipientName, purpose: clean(body?.purpose, 200) || undefined, sections, hours: rawHours, verification } };
}

// ----- router -----
export interface ShareDeps {
  getAuthUserId: (req: Request) => string | null;
  callerCanShare: (authUserId: string, subjectId: string) => Promise<boolean>;
  sendEmail: (m: { to: string; subject: string; html: string }) => Promise<void>;
  sendSms: (phone: string, message: string) => Promise<void>;
  normalisePhone: (p: string) => string;
  notify: (userId: string, title: string, body: string, critical?: boolean) => Promise<void>;
  limiter: RequestHandler;
  secret: string;
  publicBaseUrl: (req: Request) => string;
  /** Which code channels can really deliver. When omitted, both are assumed to work. */
  channels?: () => { email: boolean; sms: boolean };
}

export function createProviderShareRouter(deps: ShareDeps) {
  const router = express.Router();
  const noStore = (res: Response) => { res.setHeader('Cache-Control', 'no-store'); };

  const publicShare = (s: any) => ({
    id: String(s._id),
    subjectId: s.subjectId,
    recipientName: s.recipientName,
    purpose: s.purpose || '',
    sections: s.sections,
    expiresAt: s.expiresAt,
    createdAt: s.createdAt,
    state: shareState(s),
    mode: s.mode,
    contact: s.mode === 'contact' ? maskContact(s.contactChannel, s.contact) : '',
    channel: s.contactChannel || null,
    openedCount: (s.views || []).length,
    lastOpenedAt: (s.views || []).length ? s.views[s.views.length - 1].at : null,
  });

  async function byToken(token: string) {
    if (!token || token.length < 20 || token.length > 80) return null;
    return (await ProviderShare.findOne({ tokenHash: hashToken(deps.secret, token) })) as any;
  }
  const badState = (res: Response, state: ShareState) => {
    const message =
      state === 'expired' ? 'This link has expired. Ask the patient for a new one.'
      : state === 'revoked' ? 'The patient has withdrawn this link.'
      : 'This link is locked after too many wrong codes. Ask the patient for a new one.';
    return res.status(410).json({ success: false, code: state, message });
  };
  const notFound = (res: Response) => res.status(404).json({ success: false, code: 'invalid', message: 'This link is not valid.' });

  // ----- patient side -----
  router.post('/provider-shares', deps.limiter, async (req: Request, res: Response) => {
    try {
      const authUserId = deps.getAuthUserId(req);
      if (!authUserId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const parsed = parseCreate(req.body, deps.normalisePhone);
      if ('message' in parsed) return res.status(400).json({ success: false, message: parsed.message });
      const p = parsed.value;
      if (p.verification.mode === 'contact' && deps.channels && !deps.channels()[p.verification.channel as 'email' | 'sms']) {
        return res.status(400).json({
          success: false,
          code: 'channel_unavailable',
          message: `${p.verification.channel === 'email' ? 'Email' : 'SMS'} codes are not set up yet. Choose "I will tell them" and give the provider the passcode yourself.`,
        });
      }
      const rawSubject = String(req.body?.subjectId || 'me');
      const subjectIsSelf = rawSubject === 'me' || rawSubject === authUserId;
      const subjectId = subjectIsSelf ? authUserId : rawSubject;
      if (!mongoose.isValidObjectId(subjectId)) return res.status(400).json({ success: false, message: 'Unknown profile' });
      if (!(await deps.callerCanShare(authUserId, subjectId))) {
        return res.status(403).json({ success: false, message: 'You cannot share this profile' });
      }
      if (!subjectIsSelf) {
        const member: any = await FamilyMember.findById(subjectId).select('custodyLock').lean();
        if (member?.custodyLock?.active) return res.status(423).json({ success: false, message: 'This profile is locked. Sharing is paused.' });
      } else if (p.sections.some((s: string) => s === 'vaccinations' || s === 'growth')) {
        p.sections = p.sections.filter((s: string) => s !== 'vaccinations' && s !== 'growth');
        if (!p.sections.length) return res.status(400).json({ success: false, message: 'Choose at least one thing to share' });
      }
      const token = newToken();
      const _id = new mongoose.Types.ObjectId();
      const passcode = p.verification.mode === 'passcode' ? newCode() : undefined;
      const share: any = await ProviderShare.create({
        _id,
        ownerId: new mongoose.Types.ObjectId(authUserId),
        subjectId,
        subjectIsSelf,
        recipientName: p.recipientName,
        purpose: p.purpose,
        sections: p.sections,
        expiresAt: new Date(Date.now() + p.hours * HOUR),
        tokenHash: hashToken(deps.secret, token),
        mode: p.verification.mode,
        contactChannel: p.verification.channel,
        contact: p.verification.contact,
        passcodeHash: passcode ? hashCodeFor(deps.secret, String(_id), passcode) : undefined,
        views: [],
      });
      return res.status(201).json({
        success: true,
        share: publicShare(share),
        url: `${deps.publicBaseUrl(req)}/share/${token}`,
        ...(passcode ? { passcode } : {}),
      });
    } catch (err) {
      console.error('[POST /provider-shares] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not create the link' });
    }
  });

  router.get('/provider-shares', async (req: Request, res: Response) => {
    try {
      const authUserId = deps.getAuthUserId(req);
      if (!authUserId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const rows = await ProviderShare.find({ ownerId: new mongoose.Types.ObjectId(authUserId) }).sort({ createdAt: -1 }).limit(50);
      return res.json({ success: true, shares: rows.map(publicShare) });
    } catch (err) {
      console.error('[GET /provider-shares] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not load shared links' });
    }
  });

  router.post('/provider-shares/:id/revoke', async (req: Request, res: Response) => {
    try {
      const authUserId = deps.getAuthUserId(req);
      if (!authUserId) return res.status(401).json({ success: false, message: 'Authentication required' });
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Link not found' });
      const s: any = await ProviderShare.findOneAndUpdate(
        { _id: req.params.id, ownerId: new mongoose.Types.ObjectId(authUserId), revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date(), otpHash: undefined } },
        { new: true }
      );
      if (!s) {
        const exists: any = await ProviderShare.findOne({ _id: req.params.id, ownerId: new mongoose.Types.ObjectId(authUserId) });
        if (exists) return res.json({ success: true, share: publicShare(exists) });
        return res.status(404).json({ success: false, message: 'Link not found' });
      }
      return res.json({ success: true, share: publicShare(s) });
    } catch (err) {
      console.error('[POST /provider-shares/:id/revoke] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not withdraw the link' });
    }
  });

  // ----- provider side (public) -----
  router.get('/provider-share/:token/info', deps.limiter, async (req: Request, res: Response) => {
    try {
      noStore(res);
      const s = await byToken(req.params.token);
      if (!s) return notFound(res);
      const state = shareState(s);
      if (state !== 'active') return badState(res, state);
      return res.json({
        success: true,
        mode: s.mode,
        channel: s.contactChannel || null,
        sentTo: s.mode === 'contact' ? maskContact(s.contactChannel, s.contact) : '',
        recipientName: s.recipientName,
        purpose: s.purpose || '',
        expiresAt: s.expiresAt,
      });
    } catch (err) {
      console.error('[GET /provider-share/:token/info] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not open the link' });
    }
  });

  router.post('/provider-share/:token/otp', deps.limiter, async (req: Request, res: Response) => {
    try {
      noStore(res);
      const s = await byToken(req.params.token);
      if (!s) return notFound(res);
      const state = shareState(s);
      if (state !== 'active') return badState(res, state);
      if (s.mode !== 'contact') return res.status(400).json({ success: false, message: 'Ask the patient for the code.' });
      if (s.cooldownUntil && s.cooldownUntil.getTime() > Date.now()) {
        return res.status(429).json({ success: false, message: 'Too many wrong codes. Try again in a few minutes.' });
      }
      const now = Date.now();
      if (!s.otpWindowStart || now - s.otpWindowStart.getTime() >= HOUR) {
        await ProviderShare.updateOne({ _id: s._id }, { $set: { otpWindowStart: new Date(now), otpSendCount: 0 } });
      }
      const claimed: any = await ProviderShare.findOneAndUpdate(
        { _id: s._id, otpSendCount: { $lt: MAX_SENDS_PER_HOUR } },
        { $inc: { otpSendCount: 1 } },
        { new: true }
      );
      if (!claimed) return res.status(429).json({ success: false, message: 'Too many codes requested. Try again later.' });
      const code = newCode();
      await ProviderShare.updateOne(
        { _id: s._id },
        { $set: { otpHash: hashCodeFor(deps.secret, String(s._id), code), otpExpiresAt: new Date(now + OTP_MINUTES * 60 * 1000) } }
      );
      try {
        if (s.contactChannel === 'email') {
          await deps.sendEmail({
            to: s.contact,
            subject: 'Your WelliRecord access code',
            html: `<p>A patient has shared health information with you through WelliRecord.</p><p>Your code is <strong style="font-size:22px;letter-spacing:3px">${code}</strong></p><p>It works for ${OTP_MINUTES} minutes. Do not share it. If you were not expecting this, ignore this message.</p>`,
          });
        } else {
          await deps.sendSms(s.contact, `WelliRecord code: ${code}. A patient shared records with you. Valid ${OTP_MINUTES} minutes. Do not share this code.`);
        }
      } catch (err) {
        console.error('[provider-share otp] send failed:', err);
        await ProviderShare.updateOne({ _id: s._id }, { $unset: { otpHash: 1, otpExpiresAt: 1 } });
        return res.status(502).json({ success: false, message: 'We could not send the code. Ask the patient to check the contact they entered.' });
      }
      return res.json({ success: true, sentTo: maskContact(s.contactChannel, s.contact), expiresInSeconds: OTP_MINUTES * 60 });
    } catch (err) {
      console.error('[POST /provider-share/:token/otp] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not send the code' });
    }
  });

  router.post('/provider-share/:token/verify', deps.limiter, async (req: Request, res: Response) => {
    try {
      noStore(res);
      const s = await byToken(req.params.token);
      if (!s) return notFound(res);
      const state = shareState(s);
      if (state !== 'active') return badState(res, state);
      if (s.cooldownUntil && s.cooldownUntil.getTime() > Date.now()) {
        return res.status(429).json({ success: false, message: 'Too many wrong codes. Try again in a few minutes.' });
      }
      const code = String(req.body?.code ?? '').replace(/\D/g, '');
      if (code.length !== 6) return res.status(400).json({ success: false, message: 'Enter the 6-digit code.' });
      // Claim an attempt first, atomically, so parallel guesses cannot exceed the limits.
      const claimed: any = await ProviderShare.findOneAndUpdate(
        { _id: s._id, lockedAt: { $exists: false }, lifetimeFailures: { $lt: LIFETIME_FAILS_LOCK } },
        { $inc: { failures: 1, lifetimeFailures: 1 } },
        { new: true }
      );
      if (!claimed) return badState(res, 'locked');
      if (claimed.failures > FAILS_BEFORE_COOLDOWN) {
        return res.status(429).json({ success: false, message: 'Too many wrong codes. Try again in a few minutes.' });
      }
      const expected = claimed.mode === 'passcode'
        ? claimed.passcodeHash
        : claimed.otpHash && claimed.otpExpiresAt && claimed.otpExpiresAt.getTime() > Date.now() ? claimed.otpHash : undefined;
      if (claimed.mode === 'contact' && !expected) {
        await ProviderShare.updateOne({ _id: s._id }, { $inc: { failures: -1, lifetimeFailures: -1 } });
        return res.status(400).json({ success: false, code: 'need_code', message: 'Ask for a new code.' });
      }
      if (!sameHash(hashCodeFor(deps.secret, String(s._id), code), expected)) {
        const set: any = {};
        if (claimed.failures >= FAILS_BEFORE_COOLDOWN) {
          set.cooldownUntil = new Date(Date.now() + COOLDOWN_MINUTES * 60 * 1000);
          set.failures = 0;
          set.otpHash = undefined;
        }
        if (claimed.lifetimeFailures >= LIFETIME_FAILS_LOCK) set.lockedAt = new Date();
        if (Object.keys(set).length) await ProviderShare.updateOne({ _id: s._id }, { $set: set });
        if (set.lockedAt) {
          deps.notify(String(s.ownerId), 'Shared link locked', `The link you shared with ${s.recipientName} was locked after too many wrong codes.`, true).catch(() => {});
        }
        return res.status(401).json({
          success: false,
          message: 'That code is not right.',
          attemptsLeft: Math.max(0, FAILS_BEFORE_COOLDOWN - claimed.failures),
        });
      }
      await ProviderShare.updateOne(
        { _id: s._id },
        {
          $set: { failures: 0 },
          $inc: { lifetimeFailures: -1 },
          $unset: { otpHash: 1, otpExpiresAt: 1, cooldownUntil: 1 },
          $push: { views: { $each: [{ at: new Date(), ip: req.ip, userAgent: clean(req.get('user-agent'), 160) }], $slice: -50 } },
        }
      );
      const remaining = Math.max(60, Math.floor((s.expiresAt.getTime() - Date.now()) / 1000));
      const ttl = Math.min(SESSION_MINUTES * 60, remaining);
      const session = jwt.sign({ sid: String(s._id), kind: 'provider-share' }, sessionKey(deps.secret), { expiresIn: ttl });
      const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });
      deps
        .notify(String(s.ownerId), 'Your shared link was opened', `${s.recipientName} opened the records you shared, at ${time}. You can withdraw the link any time in Share with a provider.`, true)
        .catch(() => {});
      return res.json({ success: true, session, sessionExpiresInSeconds: ttl });
    } catch (err) {
      console.error('[POST /provider-share/:token/verify] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not check the code' });
    }
  });

  router.get('/provider-share/:token/record', deps.limiter, async (req: Request, res: Response) => {
    try {
      noStore(res);
      const s = await byToken(req.params.token);
      if (!s) return notFound(res);
      const state = shareState(s);
      if (state !== 'active') return badState(res, state);
      const auth = req.headers.authorization;
      let ok = false;
      if (auth && auth.startsWith('Bearer ')) {
        try {
          const d: any = jwt.verify(auth.substring(7), sessionKey(deps.secret));
          ok = d?.kind === 'provider-share' && d.sid === String(s._id);
        } catch { ok = false; }
      }
      if (!ok) return res.status(401).json({ success: false, code: 'need_code', message: 'Enter the code to open this record.' });
      return res.json({ success: true, expiresAt: s.expiresAt, ...(await buildRecord(s)) });
    } catch (err) {
      console.error('[GET /provider-share/:token/record] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not load the record' });
    }
  });

  return router;
}

// What the provider sees. Only the sections the patient ticked. Documents and files are never included.
export async function buildRecord(s: any) {
  const sections: string[] = s.sections || [];
  const subjectId = String(s.subjectId);
  const oid = new mongoose.Types.ObjectId(subjectId);
  const src: any = s.subjectIsSelf
    ? await UserProfile.findOne({ accountId: oid }).lean()
    : await FamilyMember.findById(oid).lean();
  const dob = src?.dateOfBirth || (src?.dob ? String(src.dob).split('T')[0] : null);
  const out: any = {
    patient: {
      name: src?.fullName || src?.name || 'Patient',
      wrId: src?.wrId || null,
      dateOfBirth: dob,
      sex: src?.gender || null,
      bloodType: sections.includes('allergies') ? src?.bloodType || null : null,
      genotype: sections.includes('allergies') ? src?.genotype || null : null,
    },
    sections,
    purpose: s.purpose || '',
    note: 'Shared by the patient through WelliRecord. Information is as recorded by the patient or their clinics. Check anything critical with the patient.',
  };
  if (sections.includes('allergies')) out.allergies = src?.allergies || '';
  if (sections.includes('conditions')) out.conditions = src?.conditions || '';
  const ownerKeys: any[] = [subjectId, oid];
  if (sections.includes('medications')) {
    const rows: any[] = await Prescription.find({
      familyMemberId: { $in: ownerKeys },
      status: { $nin: ['rejected', 'pending_review'] },
    }).sort({ createdAt: -1 }).limit(100).lean();
    out.medications = rows.map((r) => ({
      name: r.medicationName, dosage: r.dosage, frequency: r.frequency || '', prescriber: r.prescriber || '',
      prescribedDate: r.prescribedDate || '', status: r.status,
    }));
  }
  if (sections.includes('records')) {
    const rows: any[] = await HealthRecord.find({ familyMemberId: { $in: ownerKeys } }).sort({ date: -1 }).limit(100).lean();
    out.records = rows.map((r) => ({
      title: r.title, type: r.recordType, date: r.date, provider: r.provider || '', summary: r.summary || '',
      lab: r.labReportDetails
        ? {
            specimen: r.labReportDetails.specimenType, collected: r.labReportDetails.collectedDate, reported: r.labReportDetails.reportedDate,
            interpretation: r.labReportDetails.clinicalInterpretation || '', biomarkers: r.labReportDetails.biomarkers || [],
          }
        : null,
      hasAttachment: Boolean(r.fileS3Key),
    }));
  }
  if (!s.subjectIsSelf && sections.includes('vaccinations')) {
    const rows: any[] = await ChildVaccination.find({ memberId: oid }).sort({ administeredDate: 1 }).lean();
    out.vaccinations = rows.map((v) => ({
      name: v.vaccineName, date: v.administeredDate, confirmed: v.verification === 'provider_verified', lot: v.lotNumber || '',
    }));
  }
  if (!s.subjectIsSelf && sections.includes('growth')) {
    const rows: any[] = await ChildGrowth.find({ memberId: oid }).sort({ measuredOn: 1 }).lean();
    out.growth = rows.map((g) => ({ date: g.measuredOn, weightKg: g.weightKg ?? null, lengthCm: g.lengthCm ?? null, headCm: g.headCircumferenceCm ?? null }));
  }
  return out;
}
