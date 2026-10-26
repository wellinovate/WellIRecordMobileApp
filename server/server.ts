/**
 * WelliRecord Production MongoDB API Reference Server
 * Node.js / Express backend with Mongoose, Termii SMS Gateway & NDPR Compliant Endpoints.
 */

import { clinicPage, consultationsPage, ordersPage, pharmacyPage, registrationsPage, visitsPage } from './consolePages';
import { createRegistry } from './registry';
import { shouldWriteActive } from './registryCore';
import { resolveRegion } from './data/nigeriaRegions';
import { checkLegal, type LegalCheck } from './legalCore';
import { createClinicVisits } from './clinicVisits';
import { createSelfReported } from './selfReported';
import { eraseSelfReported } from './selfReportedModels';
import { createProviderGate, enforcementOn } from './providerVerification';
import { thirdPartyOcrOn } from './ocrPolicy';
import { auditIsRestricted } from './providerVerificationModels';
import { createBridgeProviders } from './bridgeProviders';
import { deleteClerkIdentity, eraseChildData } from './accountErasure';
import { accountDeletionPage } from './publicPages';
import crypto from 'crypto';
import express, { Request, Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { AccessToken } from 'livekit-server-sdk';
import bcrypt from 'bcryptjs';
import { createStaff } from './staff';
import { createPatientAuth } from './patientAuth';
import { verifyClerkSession } from './clerkVerify';
import { auditAccount, ACTION_LABELS } from './accountAudit';
import { reportSecrets } from './secretsCheck';
import mongoose from 'mongoose';
import { issueWelliId, IssuedId } from './welliId';
import dotenv from 'dotenv';
dotenv.config();
import {
  User,
  Account,
  Profile,
  UserProfile,
  FamilyMember,
  ChildVaccination,
  ChildGuardian,
  ClientError,
  ChildGrowth,
  HealthRecord,
  RecordFile,
  Prescription,
  Facility,
  ShareGrant,
  AccessAuditLog,
  ChatIntent,
  LabResult,
  VitalEntry,
  MedicationEntry,
  NotificationRecord,
  AppointmentRequest,
  AppointmentRead,
  AccessGrant,
  AccountAuditLog,
  LegalAcceptance,
} from './models';
import { createWellipayRouter } from './wellipayPartner';
import { createBooking, createPaystack } from './booking';
import { createPharmacyOrders } from './pharmacyOrders';
import { joinWindow } from './bookingCore';
import { BookingSlot } from './models';
import { createRecordFiles } from './recordFiles';
import { RECORD_FILES_PER_RECORD } from './recordFilesCore';
import { IMMUNIZATION_SCHEDULE, scheduleDoseByCode } from './data/immunizationSchedule';
import { createChildDevelopmentRouter } from './childDevelopment';
import { createChildFacilityRouter } from './childFacility';
import { createProviderShareRouter, sweepSealed } from './providerShare';
import { cleanAvatar } from './avatar';
import { anthropicCall, createAssistantRouter, geminiCall, parseGeminiSse } from './assistant';
import { providerSharePage } from './providerSharePage';
import { notifyRequested, notifyStatus, summarise, type NotifyDeps } from './appointmentNotify';
import { nearAbuja, nearbyCached, parseCoords, PLACE_KINDS, type PlaceKind } from './nearbyPlaces';
import { createProviderSource, isDoctorLike, mergeWelliFirst, ORG_FIELDS, providerContext, welliPlaces } from './welliProviders';
import { childToFhirBundle } from './fhir';
import { createWebLink, eraseWebLinks } from './webLink';
import { createChildReminderRouter, startChildReminderSweep, type ReminderDeps } from './childReminders';
import { auditChild, createChildAccessRouter, effectivePerms, resolveChildAccess, type PermKey } from './childAccess';

const app = express();
// Render sits behind a proxy. Without this every request shares the proxy's IP
// and the rate limiters count all users together.
app.set('trust proxy', 1);
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wellirecord';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required — refusing to start without it.');
}
reportSecrets();
const TERMII_API_KEY = process.env.TERMII_API_KEY || 'TL_TEST_KEY';

// CORS: allow explicit production, staging, and local preview/dev origins, or custom via ALLOWED_ORIGINS env var
const defaultAllowedOrigins = [
  'https://wellirecord.com',
  'https://www.wellirecord.com',
  'https://wellirecordmobileapp.onrender.com',
  'http://localhost:5173',
  'http://localhost:8443',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8443',
  'http://127.0.0.1:3000',
];
const customAllowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];
const allowedOrigins = [...defaultAllowedOrigins, ...customAllowedOrigins];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile native apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.wellirecord.com') ||
        /^https:\/\/([a-z0-9-]+\.)?onrender\.com$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy does not allow access from origin: ${origin}`));
    },
    credentials: true,
  })
);
// WelliPay partner API. Mounted before the global JSON parser: it needs the raw
// body for signature checks, and its code bodies must stay out of the request log.
app.use(
  '/wellipay/v1',
  createWellipayRouter({
    sendSms: sendWelliSms,
    sendEmail: async (to, subject, text) => {
      const r = await sendWelliEmail({ to, subject, text, html: `<p>${text}</p>` });
      if (!r.success) throw new Error('email not sent');
    },
  })
);
// Paystack payment webhook for consultation bookings. It needs the raw body for the signature check,
// so it is mounted before the JSON parser. The router is filled in once the booking module is built.
let bookingWebhook: express.Router | null = null;
app.use('/api/v1', (req, res, next) => (bookingWebhook ? bookingWebhook(req, res, next) : next()));
// Profile photos arrive as a small base64 JPEG inside the profile update, so those two routes
// take a larger body than the 100kb default.
const bigJson = express.json({ limit: '1500kb' });
const photoJson = express.json({ limit: '14mb' });
const attachJson = express.json({ limit: '4mb' });
const fileJson = express.json({ limit: '9mb' });
const smallJson = express.json();
app.use((req, res, next) => {
  // A scanned document photo is sent as base64, which is about a third bigger than the file.
  if (/^\/(api\/v1\/)?records\/ocr-extract\/?$/i.test(req.path)) return photoJson(req, res, next);
  if (/^\/(api\/v1\/)?(profile\/update|family\/[a-f0-9]{24}|provider-shares)\/?$/i.test(req.path)) return bigJson(req, res, next);
  if (/^\/(api\/v1\/)?pharmacy-orders\/attachments\/?$/i.test(req.path)) return attachJson(req, res, next);
  // A record file is sent as base64, up to about 8 MB of text for a 6 MB file.
  if (/^\/(api\/v1\/)?records\/files\/?$/i.test(req.path)) return fileJson(req, res, next);
  return smallJson(req, res, next);
});


// A body that is too large or not valid JSON gets a plain message the app can show.
app.use((err: any, _req: Request, res: Response, next: (e?: any) => void) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'That file is too large. Take the photo again at a lower size, or crop it.' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'The request could not be read.' });
  }
  return next(err);
});

// Rate limiters for auth OTP endpoints and OCR document processing
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // 5 requests per 10 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many verification code requests from this IP. Please try again after 10 minutes.' },
});

// Password reset: 10 attempts per 15 minutes per IP, separate from the OTP sign-in limiter.
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many password reset attempts. Please try again in 15 minutes.' },
});

// Staff accounts and roles (replaces the shared ADMIN_SECRET).
const staff = createStaff({ jwtSecret: JWT_SECRET, limiter: passwordResetLimiter });

// Provider verification (read-only side): the eligibility gate every clinical path calls. Applications and review live in the
// website backend. See providerVerification.ts.
const verification = createProviderGate();
if (!enforcementOn()) console.warn('[VERIFY] PROVIDER_VERIFICATION_ENFORCE=false: the eligibility gate is OFF');
if (!auditIsRestricted()) console.warn('[VERIFY] AUDIT_MONGO_URI is not set: the audit log is append-only in the app but not at database level');
app.use('/api/v1', staff.router);

// Patient second sign-in step (authenticator app code). Sign-in routes below call patientAuth.gate().
function issuePatientToken(p: { userId: string; email?: string | null; phoneNumber?: string | null }) {
  return jwt.sign(
    { userId: p.userId, ...(p.phoneNumber ? { phoneNumber: p.phoneNumber } : {}), email: p.email ?? null, role: 'patient' },
    JWT_SECRET as string,
    { expiresIn: '30d' }
  );
}
const patientAuth = createPatientAuth({
  jwtSecret: JWT_SECRET,
  sealKey: process.env.MFA_SECRET_KEY || undefined,
  limiter: passwordResetLimiter,
  getAuthUserId: (req) => getAuthUserId(req),
  accountLabel: async (id) => {
    if (!mongoose.isValidObjectId(id)) return '';
    const a: any = (await Account.findById(id).select('email phone').lean()) || (await User.findById(id).select('email phoneNumber').lean());
    return a?.email || a?.phone || a?.phoneNumber || '';
  },
  issueToken: issuePatientToken,
  onSignedIn: (req, p) => {
    if (!p.email) return;
    sendWelliEmail({
      to: p.email,
      subject: '🔐 New sign-in to your WelliRecord™ account',
      html: renderSignInNotificationEmailHtml({
        fullName: p.fullName || '',
        signedInAt: new Date().toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }),
        method: `${p.method} + authenticator code`,
        device: String(req.headers['user-agent'] || 'WelliRecord Mobile App'),
      }),
    }).catch((e) => console.error('[Sign-In Email Error]', e));
  },
});
app.use('/api/v1', patientAuth.router);

// Password sign-in: 8 tries per 15 minutes for one identifier from one address, 40 per address.
// A bcrypt check is slow on purpose, so unlimited guessing is also a way to tie the server up.
const loginIdentifierLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => `${req.ip}:${String(req.body?.identifier ?? '').toLowerCase().trim().slice(0, 120)}`,
  message: { success: false, message: 'Too many sign-in attempts. Please try again in 15 minutes.' },
});
const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many sign-in attempts. Please try again in 15 minutes.' },
});

const appointmentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 appointment writes per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many appointment requests. Please try again later.' },
});

const ocrLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 requests per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'OCR scan limit reached (20 scans per hour). Please try again later.' },
});

// Helper to extract authenticated user ID from Authorization header
// Per-account cutoff (unix seconds). Tokens issued before it are rejected.
// Set by "sign out other devices". Kept in memory for the sync auth check and
// reloaded from the database every minute.
const sessionsRevokedBefore = new Map<string, number>();

// Stamps the cutoff on whichever store (User or Account) holds each id.
async function revokeSessionsFor(ids: string[], nowSec = Math.floor(Date.now() / 1000)) {
  const when = new Date(nowSec * 1000);
  for (const id of ids) {
    if (!mongoose.isValidObjectId(id)) continue;
    await Promise.all([
      Account.updateOne({ _id: id }, { $set: { sessionsRevokedAt: when } }),
      User.updateOne({ _id: id }, { $set: { sessionsRevokedAt: when } }),
    ]);
    sessionsRevokedBefore.set(String(id), nowSec);
  }
}

async function loadSessionRevocations() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const query = { sessionsRevokedAt: { $exists: true, $ne: null } };
    const rows: any[] = [
      ...(await Account.find(query, 'sessionsRevokedAt').lean()),
      ...(await User.find(query, 'sessionsRevokedAt').lean()),
    ];
    for (const row of rows) {
      const cutoff = Math.floor(new Date(row.sessionsRevokedAt).getTime() / 1000);
      const key = String(row._id);
      sessionsRevokedBefore.set(key, Math.max(cutoff, sessionsRevokedBefore.get(key) || 0));
    }
  } catch (err) {
    console.warn('[Sessions] Could not load revocations:', err);
  }
}

// Remember when a signed-in person last used the app, at most once every few hours, for the active-patient count.
const lastActiveWrite = new Map<string, number>();
function touchActive(userId: string) {
  const now = Date.now();
  if (!shouldWriteActive(lastActiveWrite.get(userId), now) || !mongoose.isValidObjectId(userId) || mongoose.connection.readyState !== 1) return;
  lastActiveWrite.set(userId, now);
  if (lastActiveWrite.size > 50000) lastActiveWrite.clear();
  void UserProfile.updateOne({ accountId: new mongoose.Types.ObjectId(userId) }, { $set: { lastActiveAt: new Date(now) } }).catch(() => {});
}

function getAuthUserId(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded: any = jwt.verify(authHeader.substring(7), JWT_SECRET);
      const userId = decoded.userId || decoded.id || null;
      if (userId) {
        const cutoff = sessionsRevokedBefore.get(String(userId));
        if (cutoff && (typeof decoded.iat !== 'number' || decoded.iat < cutoff)) return null;
      }
      if (userId) touchActive(String(userId));
      return userId;
    } catch {
      return null;
    }
  }
  return null;
}

// Verify that the authenticated caller owns the target account or dependent
async function callerCanAccessOwner(authUserId: string, targetOwnerId: string, guardianPerm: PermKey | false = false): Promise<boolean> {
  if (!authUserId || !targetOwnerId) return false;
  if (targetOwnerId === authUserId || targetOwnerId === 'me') return true;
  if (mongoose.connection.readyState !== 1) return false;

  // Check if target is a dependent owned by the caller's account
  const conditions: any[] = [
    { _id: targetOwnerId, accountId: authUserId },
    { _id: targetOwnerId, userId: authUserId },
  ];
  if (mongoose.isValidObjectId(targetOwnerId)) {
    const targetObjId = new mongoose.Types.ObjectId(targetOwnerId);
    conditions.push(
      { _id: targetObjId, accountId: authUserId },
      { _id: targetObjId, userId: authUserId }
    );
    if (mongoose.isValidObjectId(authUserId)) {
      const authObjId = new mongoose.Types.ObjectId(authUserId);
      conditions.push(
        { _id: targetObjId, accountId: authObjId },
        { _id: targetObjId, userId: authObjId },
        { _id: targetOwnerId, accountId: authObjId },
        { _id: targetOwnerId, userId: authObjId }
      );
    }
  }

  const isDependent = await FamilyMember.exists({ $or: conditions });
  if (isDependent) return true;

  // A guardian added to a child may read, only where the route opts in and
  // their effective permissions (after any custody restriction) allow it.
  if (guardianPerm && mongoose.isValidObjectId(targetOwnerId)) {
    const g: any = await ChildGuardian.findOne({ childId: targetOwnerId, accountId: authUserId, status: 'active' });
    if (g && effectivePerms(g)[guardianPerm]) {
      if (guardianPerm === 'viewRecords') await auditChild(targetOwnerId, authUserId, 'guardian', 'records_viewed', '', 30);
      return true;
    }
  }
  return false;
}

// Opaque, unguessable public lookup token for 'bridge' (QR / share-link)
// grants — mirrors the web backend's WelliBridge token generation (24
// random bytes, base64url). Not a JWT: looked up directly against
// ShareGrant.shareToken, with a collision-check loop even though a
// collision is astronomically unlikely.
async function generateUniqueShareToken(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = crypto.randomBytes(24).toString('base64url');
    const existing = mongoose.connection.readyState === 1
      ? await ShareGrant.exists({ shareToken: token })
      : null;
    if (!existing) return token;
  }
  throw new Error('Could not generate a unique share token');
}

// Real-time in-app notification SSE active connections
const liveNotificationSubscribers = new Map<string, Response>();

function broadcastLiveNotification(notif: any) {
  const payload = `data: ${JSON.stringify(notif)}\n\n`;
  for (const [subId, clientRes] of liveNotificationSubscribers.entries()) {
    try {
      if (subId.startsWith(String(notif.userId))) {
        clientRes.write(payload);
      }
    } catch {
      liveNotificationSubscribers.delete(subId);
    }
  }
}

/**
 * Push Notification Dispatcher:
 * Dispatches an Expo Push Notification to all physical devices registered for
 * this user, creates a persistent notification record in MongoDB, and broadcasts
 * live to active SSE subscribers.
 */
async function dispatchPushNotification(params: {
  userId: string | mongoose.Types.ObjectId;
  title: string;
  body: string;
  type: 'critical_alert' | 'referral' | 'lab_result' | 'consent' | 'claim' | 'immunization' | 'prescription' | 'system';
  emoji?: string;
  tint?: string;
  categoryLabel?: string;
  actionLabel?: string;
  targetTab?: string;
  targetModal?: string;
  targetId?: string;
  metadata?: any;
}) {
  const {
    userId,
    title,
    body,
    type,
    emoji = '🔔',
    tint = '#e0e7ff',
    categoryLabel = 'Notification',
    actionLabel,
    targetTab,
    targetModal,
    targetId,
    metadata,
  } = params;

  console.log(`[PushEngine] Dispatching ${type} notification for user ${userId}: "${title}"`);

  let notifRecord: any = null;
  if (mongoose.connection.readyState === 1 && mongoose.isValidObjectId(userId)) {
    try {
      notifRecord = await NotificationRecord.create({
        userId: new mongoose.Types.ObjectId(userId),
        type,
        emoji,
        tint,
        categoryLabel,
        title,
        desc: body,
        time: 'Just now',
        read: false,
        actionLabel,
        targetTab,
        targetModal,
        targetId,
        metadata,
      });
    } catch (err) {
      console.warn('[PushEngine] Failed to save NotificationRecord:', err);
    }
  }

  // Live broadcast to in-app stream
  broadcastLiveNotification({
    id: notifRecord?._id?.toString() || `notif_${Date.now()}`,
    userId: String(userId),
    title,
    desc: body,
    type,
    emoji,
    tint,
    categoryLabel,
    actionLabel,
    targetTab,
    targetModal,
    targetId,
    metadata,
    time: 'Just now',
    read: false,
  });

  // Query Expo push tokens for this user
  let tokens: string[] = [];
  if (mongoose.connection.readyState === 1 && mongoose.isValidObjectId(userId)) {
    try {
      const [u, a, p] = await Promise.all([
        User.findById(userId).select('pushTokens').lean(),
        Account.findById(userId).select('pushTokens').lean(),
        UserProfile.findOne({ accountId: userId }).select('pushTokens').lean(),
      ]);
      const tokenSet = new Set<string>();
      (u?.pushTokens || []).forEach((t: string) => tokenSet.add(t));
      (a?.pushTokens || []).forEach((t: string) => tokenSet.add(t));
      (p?.pushTokens || []).forEach((t: string) => tokenSet.add(t));
      tokens = Array.from(tokenSet).filter((t) => typeof t === 'string' && t.startsWith('ExponentPushToken'));
    } catch (err) {
      console.warn('[PushEngine] Error querying push tokens:', err);
    }
  }

  // Dispatch to Expo Push API
  if (tokens.length > 0) {
    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title,
      body,
      data: {
        type,
        targetTab,
        targetModal,
        targetId,
        metadata,
      },
      priority: type === 'critical_alert' ? 'high' : 'default',
      channelId: type === 'critical_alert' ? 'emergency-alerts' : 'default',
    }));

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
      const data = await response.json();
      console.log('[PushEngine] Expo Push response:', data);
    } catch (pushErr) {
      console.warn('[PushEngine] Failed to dispatch to Expo Push service:', pushErr);
    }
  }

  return notifRecord;
}

// Diagnostic logging — temporary, remove once the real cause is found.
// Logs memory usage on every request and around each Places API batch,
// so we can see exactly where allocation spikes instead of guessing.
function logMemory(label: string) {
  const mem = process.memoryUsage();
  console.log(`[MEM] ${label} — heapUsed: ${Math.round(mem.heapUsed / 1024 / 1024)}MB, rss: ${Math.round(mem.rss / 1024 / 1024)}MB`);
}

const SENSITIVE_PATHS = [
  '/api/v1/auth',
  '/api/v1/profile',
  '/api/v1/family',
  '/api/v1/records',
  '/api/v1/prescriptions',
  '/api/v1/pharmacy',
  '/api/v1/health',
];

app.use((req, res, next) => {
  logMemory(`${req.method} ${req.path}`);
  const isSensitive = SENSITIVE_PATHS.some((p) => req.path.startsWith(p));
  console.log(`[REQUEST] ${req.method} ${req.path}`, isSensitive ? '[body redacted]' : JSON.stringify(req.body));
  next();
});

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log(`[WelliRecord API] Connected to MongoDB database: ${mongoose.connection.name}`);
  })
  .catch((err) => {
    console.warn(`[WelliRecord API] MongoDB connection notice (running in hybrid/demo mode): ${err.message}`);
  });

// 1. Health Check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    database: mongoose.connection.readyState === 1 ? 'connected (MongoDB)' : 'disconnected (Demo Mode)',
    service: 'WelliRecord Health Cloud API',
    region: 'af-south-1 (Lagos / West Africa)',
    ndprCompliant: true,
    timestamp: new Date().toISOString(),
  });
});

// In-Memory OTP Store with 5-minute TTL and max 5 attempts to prevent brute force
const MAX_OTP_ATTEMPTS = 5;

interface OtpEntry {
  code: string;
  expiresAt: number;
  mode: 'login' | 'signup';
  attempts: number;
  aliases: string[];
}

const otpCache = new Map<string, OtpEntry>();

function deleteOtpWithAliases(identifier: string, entry?: OtpEntry) {
  const record = entry || otpCache.get(identifier);
  if (record?.aliases && record.aliases.length > 0) {
    for (const alias of record.aliases) {
      otpCache.delete(alias);
    }
  }
  otpCache.delete(identifier);
}

function generateOtp(identifier: string, mode: 'login' | 'signup' = 'signup', additionalAliases: string[] = []): string {
  const code = crypto.randomInt(100000, 1000000).toString();
  const allAliases = Array.from(new Set([identifier, ...additionalAliases].filter(Boolean)));
  const entry: OtpEntry = {
    code,
    expiresAt: Date.now() + 5 * 60 * 1000,
    mode,
    attempts: 0,
    aliases: allAliases,
  };
  for (const id of allAliases) {
    otpCache.set(id, entry);
  }
  return code;
}

function getOtpEntry(identifier: string): OtpEntry | undefined {
  return otpCache.get(identifier);
}

function verifyStoredOtp(identifier: string, code: string): boolean {
  const entry = otpCache.get(identifier);
  if (!entry) return false; // No OTP was ever issued for this identifier — reject
  if (Date.now() > entry.expiresAt) {
    deleteOtpWithAliases(identifier, entry);
    return false;
  }
  if (entry.attempts >= MAX_OTP_ATTEMPTS) {
    deleteOtpWithAliases(identifier, entry);
    return false;
  }
  const isValid = entry.code === code;
  if (isValid) {
    deleteOtpWithAliases(identifier, entry);
    return true;
  }
  entry.attempts += 1;
  if (entry.attempts >= MAX_OTP_ATTEMPTS) {
    deleteOtpWithAliases(identifier, entry);
  }
  return false;
}

// WelliID: WR-<REGION><zone>-<suffix> (see welliId.ts). The region is where the person registered and never changes.
async function wrIdTaken(id: string): Promise<boolean> {
  if (mongoose.connection.readyState !== 1) return false;
  const [a, b] = await Promise.all([UserProfile.exists({ wrId: id }), FamilyMember.exists({ wrId: id })]);
  return Boolean(a || b);
}
async function newWelliId(state?: unknown): Promise<IssuedId> {
  return issueWelliId({ state, exists: wrIdTaken });
}
const cleanLga = (v: unknown) => String(v ?? '').replace(/[^\p{L}\p{N} .,'()/-]/gu, '').trim().slice(0, 60);
/** Registration and residence fields for a new profile. Residence starts as the state chosen and is editable later; the registration region is not. */
function registrationFields(issued: IssuedId, lga?: unknown) {
  return {
    registrationRegion: issued.region.code,
    registrationState: issued.hasRegion ? issued.region.name : '',
    residenceState: issued.hasRegion ? issued.region.name : '',
    residenceLga: cleanLga(lga),
    registeredAt: new Date(),
  };
}
/** The state a guardian registered in, so a child's ID carries the same region. */
async function guardianStateHint(accountId: unknown): Promise<string> {
  if (!accountId || mongoose.connection.readyState !== 1 || !mongoose.isValidObjectId(String(accountId))) return '';
  const p: any = await UserProfile.findOne({ accountId: new mongoose.Types.ObjectId(String(accountId)) }, 'registrationState').lean();
  return p?.registrationState || '';
}

// Normalizes a Nigerian phone number to E.164 format (+234XXXXXXXXXX)
function normalizeNigerianPhone(phone?: string): string {
  if (!phone) return '';
  const cleaned = phone.trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+234')) return cleaned;
  if (cleaned.startsWith('234') && cleaned.length === 13) return `+${cleaned}`;
  if (cleaned.startsWith('0') && cleaned.length === 11) return `+234${cleaned.slice(1)}`;
  if (cleaned.length === 10) return `+234${cleaned}`;
  return cleaned;
}

// Converts a Nigerian phone number to local 11-digit format (0XXXXXXXXXX)
function toLocalNigerianPhone(phone?: string): string {
  const e164 = normalizeNigerianPhone(phone);
  if (e164.startsWith('+234') && e164.length === 14) {
    return `0${e164.slice(4)}`;
  }
  return phone ? phone.replace(/[^0-9]/g, '') : '';
}

// Sends one plain SMS through Termii. Throws when Termii is not configured or rejects the message.
async function sendWelliSms(phone: string, message: string): Promise<void> {
  if (!TERMII_API_KEY || TERMII_API_KEY === 'TL_TEST_KEY') throw new Error('SMS is not configured');
  const response = await fetch('https://api.ng.termii.com/api/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: TERMII_API_KEY,
      to: String(phone).replace(/[^0-9]/g, '').replace(/^0/, '234'),
      from: 'N-Alert',
      sms: message,
      type: 'plain',
      channel: 'dnd',
    }),
  });
  const data: any = await response.json();
  if (!(data.code === 'ok' || data.message?.includes('Successfully'))) throw new Error(`SMS rejected: ${JSON.stringify(data)}`);
}

// Sends a WhatsApp message through Termii's WhatsApp channel. Off unless
// WHATSAPP_REMINDERS_ENABLED=true. Not tested against a live Termii account:
// business-initiated WhatsApp messages usually need an approved sender and
// template, so confirm that with Termii before switching it on.
async function sendWelliWhatsApp(phone: string, message: string): Promise<void> {
  if (process.env.WHATSAPP_REMINDERS_ENABLED !== 'true') throw new Error('WhatsApp is not switched on');
  if (!TERMII_API_KEY || TERMII_API_KEY === 'TL_TEST_KEY') throw new Error('WhatsApp is not configured');
  const response = await fetch('https://api.ng.termii.com/api/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: TERMII_API_KEY,
      to: String(phone).replace(/[^0-9]/g, '').replace(/^0/, '234'),
      from: process.env.TERMII_WHATSAPP_SENDER || 'WelliRecord',
      sms: message,
      type: 'plain',
      channel: 'whatsapp',
    }),
  });
  const data: any = await response.json();
  if (!(data.code === 'ok' || data.message?.includes('Successfully'))) throw new Error(`WhatsApp rejected: ${JSON.stringify(data)}`);
}

// 2. Termii Nigerian SMS OTP Dispatch
app.post('/api/v1/auth/otp/send', otpLimiter, async (req: Request, res: Response) => {
  const targetPhone = req.body.phoneNumber || req.body.phone || req.body.to;
  const mode = req.body.mode === 'login' ? 'login' : 'signup';

  if (!targetPhone) {
    return res.status(400).json({ success: false, message: 'Phone number is required' });
  }

  const formattedPhone = targetPhone.replace(/[^0-9]/g, '');
  const normalizedE164 = normalizeNigerianPhone(targetPhone);
  const localPhone = toLocalNigerianPhone(targetPhone);
  const aliases = [formattedPhone, normalizedE164, localPhone].filter(Boolean);

  const generatedCode = generateOtp(targetPhone, mode, aliases);
  const otpRec = otpCache.get(targetPhone);
  if (otpRec) {
    for (const a of aliases) {
      if (!otpRec.aliases.includes(a)) otpRec.aliases.push(a);
      otpCache.set(a, otpRec);
    }
  }

  try {
    if (TERMII_API_KEY && TERMII_API_KEY !== 'TL_TEST_KEY') {
      try {
        const response = await fetch('https://api.ng.termii.com/api/sms/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: TERMII_API_KEY,
            to: formattedPhone,
            from: 'N-Alert',
            sms: `Your WelliRecord authorization code is ${generatedCode}. Valid for 5 minutes. Do not share with anyone.`,
            type: 'plain',
            channel: 'dnd',
          }),
        });
        const data = await response.json();
        if (data.code === 'ok' || data.message?.includes('Successfully')) {
          return res.json({
            success: true,
            message: `Verification code sent to ${targetPhone} via SMS.`,
            expiresInSeconds: 300,
          });
        }
        // Termii rejected the message (sender ID, balance, DND route, bad
        // number). Log it and tell the app, instead of claiming it was sent.
        console.error('[SMS Rejected]', response.status, JSON.stringify(data));
        return res.status(502).json({
          success: false,
          message: 'We could not send the SMS code. Try again, or sign in with email.',
        });
      } catch (smsErr) {
        console.error('[SMS Error]', smsErr);
        return res.status(502).json({
          success: false,
          message: 'We could not reach the SMS service. Try again, or sign in with email.',
        });
      }
    }

    return res.json({
      success: true,
      message: `Verification code dispatched to ${targetPhone}.`,
      otpId: `otp_${Date.now()}`,
      expiresInSeconds: 300,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'SMS gateway error', error });
  }
});

// 2b. WelliRecord Email Dispatcher & Templates
interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

async function sendWelliEmail({ to, subject, html, text, from }: SendEmailOptions): Promise<{ success: boolean; delivered?: boolean; messageId?: string; error?: any }> {
  const fromAddress = from || process.env.EMAIL_FROM || 'WelliRecord <noreply@send.wellirecord.com>';
  
  // 1. Resend API
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [to],
          subject,
          html,
          text: text || html.replace(/<[^>]+>/g, ''),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        console.log('[EMAIL RESEND DISPATCHED]', to, data.id);
        return { success: true, delivered: true, messageId: data.id };
      } else {
        console.warn('[EMAIL RESEND WARN]', data);
      }
    } catch (e: any) {
      console.error('[EMAIL RESEND ERROR]', e.message);
    }
  }

  // 2. SendGrid API
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  if (sendgridApiKey) {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: fromAddress.match(/<([^>]+)>/)?.[1] || fromAddress, name: 'WelliRecord' },
          subject,
          content: [
            { type: 'text/html', value: html },
            { type: 'text/plain', value: text || html.replace(/<[^>]+>/g, '') },
          ],
        }),
      });
      if (response.ok || response.status === 202) {
        console.log('[EMAIL SENDGRID DISPATCHED]', to);
        return { success: true, delivered: true, messageId: `sg_${Date.now()}` };
      }
    } catch (e: any) {
      console.error('[EMAIL SENDGRID ERROR]', e.message);
    }
  }

  // 3. Fallback / Development Dispatch Logger
  console.log(`[EMAIL DISPATCHED TO ${to}] Subject: "${subject}"`);
  // Nothing was sent: no provider is configured or every one failed. Callers that must reach a person check `delivered`.
  return { success: true, delivered: false, messageId: `msg_${Date.now()}` };
}

function renderOtpEmailHtml({ fullName, code, expiresInMinutes }: { fullName?: string; code: string; expiresInMinutes?: number }): string {
  const formattedCode = code.split('').join(' ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your WelliRecord™ account</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);">
          <!-- Dark Navy Banner -->
          <tr>
            <td style="background-color: #041E42; padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">WelliRecord™</h1>
              <p style="margin: 6px 0 0 0; color: #93C5FD; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">ONE PATIENT. ONE TRUSTED RECORD. ACCESSIBLE WHEN IT MATTERS.</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #1E293B;">
                Hello <strong style="color: #041E42;">${fullName || 'WelliRecord Patient'}</strong>,
              </p>
              
              <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #0F172A;">
                🔐 Verify your WelliRecord™ account
              </h2>
              
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569;">
                Use the verification code below to continue with your WelliRecord™ account securely.
              </p>

              <!-- Verification Code Box -->
              <div style="background-color: #F0FDF4; border: 1px solid #86EFAC; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px 0;">
                <div style="font-size: 12px; font-weight: 700; color: #15803D; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px;">
                  YOUR VERIFICATION CODE
                </div>
                <div style="font-size: 38px; font-weight: 800; color: #041E42; letter-spacing: 10px; margin: 10px 0; font-family: monospace, -apple-system, sans-serif;">
                  ${formattedCode}
                </div>
                <div style="font-size: 13px; font-weight: 600; color: #16A34A;">
                  ⏱ Expires in ${expiresInMinutes || 10} minutes
                </div>
              </div>

              <!-- Security Warning -->
              <p style="margin: 0 0 12px 0; font-size: 14px; color: #475569; line-height: 1.5;">
                For your security, <strong>do not share this code with anyone</strong>. WelliRecord™ will never ask you to provide your verification code by phone, email, or message.
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #64748B; line-height: 1.5;">
                If you did not request this code, you can safely ignore this email. Your account remains secure.
              </p>

              <!-- Medical Tip -->
              <div style="background-color: #FFFBEB; border-left: 4px solid #F59E0B; border-radius: 8px; padding: 14px 18px; margin: 0 0 14px 0;">
                <div style="font-size: 14px; font-weight: 700; color: #92400E; margin-bottom: 4px;">
                  🩺 Medical Tip
                </div>
                <div style="font-size: 13px; color: #78350F; line-height: 1.5;">
                  Keep your health information accurate and up to date. Complete and maintain your health profile so your trusted record is ready when you need it.
                </div>
              </div>

              <!-- Security Tip -->
              <div style="background-color: #F0F9FF; border-left: 4px solid #0284C7; border-radius: 8px; padding: 14px 18px; margin: 0 0 8px 0;">
                <div style="font-size: 14px; font-weight: 700; color: #075985; margin-bottom: 4px;">
                  🔐 Security Tip
                </div>
                <div style="font-size: 13px; color: #0C4A6E; line-height: 1.5;">
                  Use a strong, unique password for your WelliRecord™ account and never share your login credentials with anyone.
                </div>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8FAFC; padding: 24px; text-align: center; border-top: 1px solid #E2E8F0;">
              <div style="font-size: 14px; font-weight: 700; color: #041E42; margin-bottom: 4px;">
                WelliRecord™
              </div>
              <div style="font-size: 13px; color: #475569; margin-bottom: 8px; font-style: italic;">
                One patient. One trusted record. Accessible when it matters.
              </div>
              <div style="font-size: 11px; color: #94A3B8;">
                Patient-Owned Health Records • Secure & Encrypted • Consent-Driven Access • Audit Trail
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderSignInNotificationEmailHtml({ fullName, signedInAt, method, device, dashboardUrl, securityUrl }: { fullName?: string; signedInAt?: string; method?: string; device?: string; dashboardUrl?: string; securityUrl?: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New sign-in to your WelliRecord™ account</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8FAFC; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);">
          <!-- Header Badge -->
          <tr>
            <td style="padding: 32px 32px 12px 32px;">
              <span style="display: inline-block; background-color: #E0F2FE; color: #0369A1; font-size: 11px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; padding: 6px 12px; border-radius: 100px;">
                SIGNED IN
              </span>
            </td>
          </tr>

          <!-- Main Greeting -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 800; color: #041E42;">
                Welcome back, ${fullName || 'WelliRecord Patient'}
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569; line-height: 1.5;">
                You just signed in to your WelliRecord™ health vault. Here's a quick summary of this sign-in for your records.
              </p>

              <!-- Sign-In Summary Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 14px 18px; font-size: 14px; color: #64748B; width: 35%; border-bottom: 1px solid #F1F5F9;">Signed in</td>
                  <td style="padding: 14px 18px; font-size: 14px; font-weight: 700; color: #041E42; border-bottom: 1px solid #F1F5F9;">${signedInAt || new Date().toLocaleString()}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 14px 18px; font-size: 14px; color: #64748B; border-bottom: 1px solid #F1F5F9;">Method</td>
                  <td style="padding: 14px 18px; font-size: 14px; font-weight: 700; color: #041E42; border-bottom: 1px solid #F1F5F9;">${method || 'Email & Login Code'}</td>
                </tr>
                <tr>
                  <td style="padding: 14px 18px; font-size: 14px; color: #64748B;">Device</td>
                  <td style="padding: 14px 18px; font-size: 13px; font-weight: 600; color: #041E42; line-height: 1.4;">${device || 'WelliRecord Mobile App (iOS)'}</td>
                </tr>
              </table>

              <!-- Action CTA -->
              <div style="margin-bottom: 24px;">
                <a href="${dashboardUrl || 'https://wellirecord.com'}" style="display: inline-block; background-color: #041E42; color: #FFFFFF; font-size: 15px; font-weight: 700; padding: 14px 28px; border-radius: 8px; text-decoration: none;">
                  Go to Dashboard
                </a>
              </div>

              <!-- Security Follow-up -->
              <p style="margin: 0; font-size: 14px; color: #64748B;">
                Wasn't you? <a href="${securityUrl || 'https://wellirecord.com/security'}" style="color: #041E42; font-weight: 700; text-decoration: underline;">Secure your account immediately</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #FAFAFA; padding: 24px 32px; border-top: 1px solid #E2E8F0;">
              <div style="font-size: 14px; font-weight: 800; color: #041E42; margin-bottom: 4px;">
                WelliRecord™
              </div>
              <div style="font-size: 13px; color: #64748B; font-style: italic; margin-bottom: 8px;">
                One patient. One trusted record. Accessible when it matters.
              </div>
              <div style="font-size: 12px; color: #94A3B8; margin-bottom: 16px;">
                Secure • Patient-Owned • Consent-Driven • Interoperable
              </div>
              <div style="font-size: 13px;">
                <a href="https://wellirecord.com" style="color: #041E42; text-decoration: underline; font-weight: 600; margin-right: 16px;">View Dashboard</a>
                <a href="https://wellirecord.com/privacy" style="color: #041E42; text-decoration: underline; font-weight: 600; margin-right: 16px;">Privacy Policy</a>
                <a href="https://wellirecord.com/support" style="color: #041E42; text-decoration: underline; font-weight: 600;">Contact Support</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// 2c. Email OTP Dispatch
app.post('/api/v1/auth/email/send', otpLimiter, async (req: Request, res: Response) => {
  const { email, fullName, name, mode } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email address is required' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const generatedCode = generateOtp(cleanEmail, mode === 'login' ? 'login' : 'signup');
  const recipientName = fullName || name || (cleanEmail.includes('@') ? cleanEmail.split('@')[0] : 'WelliRecord Patient');

  try {
    await sendWelliEmail({
      to: cleanEmail,
      subject: '🔐 Verify your WelliRecord™ account - Login Code',
      html: renderOtpEmailHtml({
        fullName: recipientName,
        code: generatedCode,
        expiresInMinutes: 10,
      }),
    });

    return res.json({
      success: true,
      message: `Verification code sent to ${cleanEmail}.`,
      otpId: `otp_${Date.now()}`,
      expiresInSeconds: 600,
    });
  } catch (err: any) {
    console.error('[EMAIL SEND ERROR]', err);
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Failed to send verification email' });
  }
});

// 2d. Generic Transactional Email Notification
app.post('/api/v1/notifications/email', async (req: Request, res: Response) => {
  const { to, subject, html, text, type: _type } = req.body;
  if (!to || (!html && !text)) {
    return res.status(400).json({ success: false, message: 'Recipient and content required' });
  }

  try {
    const result = await sendWelliEmail({
      to: to.trim(),
      subject: subject || 'Notification from WelliRecord™',
      html: html || `<p>${text}</p>`,
      text,
    });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Notification dispatch error' });
  }
});

// 3. Verify OTP & Issue JWT (Supports Phone or Email verification with MongoDB user lookup)
// Writes what a new account agreed to: one row per document and version. Never blocks sign-up.
async function saveLegal(accountId: unknown, legal: LegalCheck): Promise<void> {
  try {
    for (const d of legal.documents) {
      await LegalAcceptance.updateOne(
        { accountId: String(accountId), documentId: d.id, version: d.version },
        { $setOnInsert: { acceptedAt: legal.acceptedAt, source: 'signup' } },
        { upsert: true },
      );
    }
  } catch (err) {
    console.error('[legal] could not save acceptance', accountId, err);
  }
}

app.post('/api/v1/auth/otp/verify', async (req: Request, res: Response) => {
  const { phoneNumber, email, code } = req.body;

  if ((!phoneNumber && !email) || !code) {
    return res.status(400).json({ success: false, message: 'Phone number or email, and verification code required' });
  }

  const targetIdentifier = (email ? email.toLowerCase().trim() : phoneNumber?.trim()) || '';
  const cleanPhone = phoneNumber ? phoneNumber.replace(/[^0-9]/g, '') : '';
  const cleanEmail = email ? email.toLowerCase().trim() : (req.body.email ? req.body.email.toLowerCase().trim() : undefined);
  const normalizedE164 = phoneNumber ? normalizeNigerianPhone(phoneNumber) : '';
  const normalizedLocal = phoneNumber ? toLocalNigerianPhone(phoneNumber) : '';

  const candidateKeys = [
    targetIdentifier,
    cleanPhone,
    normalizedE164,
    normalizedLocal,
    cleanEmail,
  ].filter((k): k is string => Boolean(k));

  const reviewerOtp = process.env.REVIEWER_OTP;
  // Dedicated review accounts only (emails, comma-separated in
  // REVIEWER_ACCOUNTS; defaults to the two review mailboxes). The bypass is
  // disabled unless REVIEWER_OTP is at least 8 characters.
  const REVIEWER_ACCOUNTS = new Set(
    (process.env.REVIEWER_ACCOUNTS || 'appstore.review@wellirecord.com,googleplay.reviewer@wellirecord.com')
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter((v) => v.includes('@'))
  );
  const isReviewerBypass = Boolean(
    reviewerOtp &&
      reviewerOtp.length >= 8 &&
      code === reviewerOtp &&
      candidateKeys.some((k) => REVIEWER_ACCOUNTS.has(k.toLowerCase()))
  );

  const matchedKey = candidateKeys.find((k) => otpCache.has(k));
  const otpEntry = matchedKey ? getOtpEntry(matchedKey) : undefined;
  const requestedMode = otpEntry?.mode || (req.body.mode === 'login' ? 'login' : 'signup');

  if (!isReviewerBypass && (!matchedKey || !verifyStoredOtp(matchedKey, code))) {
    return res.status(400).json({ success: false, message: 'Invalid or expired authorization code' });
  }

  // Clean up any remaining aliases for this verified OTP
  for (const k of candidateKeys) {
    otpCache.delete(k);
  }

  try {
    let account = null;
    if (cleanEmail) {
      account = await Account.findOne({ email: cleanEmail });
    }
    if (!account && (phoneNumber || normalizedLocal)) {
      account = await Account.findOne({
        $or: [
          ...(normalizedLocal ? [{ phone: normalizedLocal }, { phoneNumber: normalizedLocal }] : []),
          ...(normalizedE164 ? [{ phone: normalizedE164 }, { phoneNumber: normalizedE164 }] : []),
          ...(phoneNumber ? [{ phone: phoneNumber }, { phoneNumber: phoneNumber }] : []),
        ],
      });
    }

    let user: any = account;
    if (!user && requestedMode === 'login') {
      if (cleanEmail) {
        user = await User.findOne({ email: cleanEmail });
      }
      if (!user && (phoneNumber || normalizedLocal)) {
        user = await User.findOne({
          $or: [
            ...(req.body.phoneNumber ? [{ phoneNumber: req.body.phoneNumber }] : []),
            ...(normalizedE164 ? [{ phoneNumber: normalizedE164 }] : []),
            ...(normalizedLocal ? [{ phoneNumber: normalizedLocal }] : []),
            ...(cleanPhone ? [{ phoneNumber: cleanPhone }, { phoneNumber: `+${cleanPhone}` }] : []),
          ],
        });
      }
    }

    if (!user) {
      if (requestedMode === 'login') {
        return res.status(404).json({
          success: false,
          message: 'No account found for this email or phone number. Please create a vault first.',
        });
      }

      if (!resolveRegion(req.body.state)) {
        return res.status(400).json({ success: false, code: 'state_required', message: 'Select your state of residence. It sets your WelliID.' });
      }
      const legal = checkLegal(req.body.legal);
      if (!legal.ok) {
        return res.status(400).json({ success: false, code: 'legal_required', message: 'Accept the Privacy & Data Protection Policy and the Terms and Conditions to create your account.' });
      }

      // Cross-model duplicate check — a password-based User account with
      // this email/phone already exists; don't create a separate Account.
      if (mongoose.connection.readyState === 1) {
        const existingUser = await User.findOne({
          $or: [
            ...(cleanEmail ? [{ email: cleanEmail }] : []),
            ...(normalizedE164 ? [{ phoneNumber: normalizedE164 }] : []),
          ],
        });
        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: 'An account with this email or phone number already exists. Try signing in with your password instead.',
          });
        }
      }

      if (mongoose.connection.readyState === 1) {
        const newPhone = normalizedE164 || (phoneNumber ? (phoneNumber.startsWith('+') ? phoneNumber : `+${cleanPhone}`) : undefined);
        const newEmail = cleanEmail || (req.body.email ? req.body.email.toLowerCase().trim() : undefined);
        const newName = req.body.fullName || req.body.name || (newEmail ? newEmail.split('@')[0] : 'WelliRecord Patient');

        account = new Account({
          phone: normalizedLocal || newPhone || '',
          phoneNumber: newPhone || '',
          email: newEmail,
          fullName: newName,
          name: newName,
          isPhoneVerified: Boolean(phoneNumber),
          isEmailVerified: Boolean(cleanEmail),
          authProvider: cleanEmail ? 'email_otp' : 'phone_otp',
          registrationState: resolveRegion(req.body.state)?.name,
          registrationLga: cleanLga(req.body.lga),
        });
        await account.save();
        await saveLegal(account._id, legal);
        user = account;
        console.log('[NEW ACCOUNT CREATED ON SIGNUP]', user._id, newName);
      } else {
        return res.status(404).json({ error: 'No account found for this user' });
      }
    }

    // 2nd lookup: Fetch matching profile from shared 'userprofiles' collection
    let profile: any = null;
    if (mongoose.connection.readyState === 1) {
      profile = await UserProfile.findOne({
        $or: [
          { accountId: user._id },
          ...(user.email ? [{ email: user.email.toLowerCase().trim() }] : []),
          ...(cleanEmail ? [{ email: cleanEmail }] : []),
          ...(user.phone ? [{ phone: user.phone }, { phone: user.phoneNumber }] : []),
        ],
      });

      // Migration: If no UserProfile exists, check legacy 'profiles' collection and copy over
      if (!profile) {
        const legacyProfile = await Profile.findOne({
          $or: [
            { accountId: user._id },
            ...(user.email ? [{ email: user.email.toLowerCase().trim() }] : []),
            ...(cleanEmail ? [{ email: cleanEmail }] : []),
          ],
        });

        if (legacyProfile) {
          console.log('[MIGRATION] Transferring profile from legacy profiles to userprofiles collection:', user.email || user._id);
          const legacyPhone = normalizeNigerianPhone(legacyProfile.phone || user.phone);
          const rawLegacyHmo = legacyProfile.hmoProvider || legacyProfile.insuranceProvider;
          const cleanLegacyHmo = (!rawLegacyHmo || rawLegacyHmo === 'Private Self-Pay / None' || rawLegacyHmo === 'None') ? null : rawLegacyHmo;

          profile = new UserProfile({
            accountId: user._id,
            fullName: legacyProfile.fullName || legacyProfile.name,
            email: legacyProfile.email || user.email || cleanEmail,
            phone: legacyPhone,
            contact: legacyPhone,
            gender: legacyProfile.gender,
            dateOfBirth: legacyProfile.dateOfBirth || legacyProfile.dob,
            bloodType: legacyProfile.bloodType,
            genotype: legacyProfile.genotype,
            hmoProvider: cleanLegacyHmo,
            hmoPolicyNumber: cleanLegacyHmo ? (legacyProfile.hmoPolicyNumber || legacyProfile.insuranceId) : null,
            allergies: legacyProfile.allergies,
            wrId: legacyProfile.memberId || (await newWelliId(user.registrationState)).id,
          });
          await profile.save();
        }
      }

      // If still no profile exists, create a genuine UserProfile document with wrId and passed signup data
      if (!profile) {
        const issued = await newWelliId(req.body.state || user.registrationState);
        const newWrId = issued.id;
        const profileName = req.body.fullName || req.body.name || user.fullName || null;
        const profileEmail = cleanEmail || (req.body.email ? req.body.email.toLowerCase().trim() : (user.email || null));
        const rawPhone = user.phone || user.phoneNumber || phoneNumber;
        const profilePhone = rawPhone ? (normalizeNigerianPhone(rawPhone) || rawPhone) : '';
        const rawHmo = req.body.hmoProvider || req.body.insuranceProvider || user.hmoProvider || null;
        const cleanHmo = (!rawHmo || rawHmo === 'Private Self-Pay / None' || rawHmo === 'None' || rawHmo === 'self_pay') ? null : rawHmo;

        profile = new UserProfile({
          accountId: user._id,
          fullName: profileName,
          email: profileEmail,
          phone: profilePhone,
          contact: profilePhone,
          dateOfBirth: req.body.dateOfBirth || req.body.dob || null,
          bloodType: req.body.bloodType || user.bloodType || 'O+',
          genotype: req.body.genotype || user.genotype || 'AA',
          hmoProvider: cleanHmo,
          hmoPolicyNumber: cleanHmo ? (req.body.hmoPolicyNumber || req.body.insuranceId || user.hmoPolicyNumber || null) : null,
          wrId: newWrId,
          ...registrationFields(issued, req.body.lga || user.registrationLga),
          authProvider: cleanEmail ? 'email_otp' : 'phone_otp',
          isEmailVerified: Boolean(cleanEmail || user.isEmailVerified),
        });
        await profile.save();
      } else {
        // If profile exists, ensure wrId and persist any missing profile fields from signup
        let updated = false;
        const rawHmo = req.body.hmoProvider || req.body.insuranceProvider;
        const cleanHmo = (!rawHmo || rawHmo === 'Private Self-Pay / None' || rawHmo === 'None' || rawHmo === 'self_pay') ? null : rawHmo;

        if (req.body.fullName && !profile.fullName) { profile.fullName = req.body.fullName; updated = true; }
        if (req.body.dateOfBirth && !profile.dateOfBirth) { profile.dateOfBirth = req.body.dateOfBirth; updated = true; }
        if (req.body.bloodType && !profile.bloodType) { profile.bloodType = req.body.bloodType; updated = true; }
        if (req.body.genotype && !profile.genotype) { profile.genotype = req.body.genotype; updated = true; }
        if (cleanHmo && !profile.hmoProvider) { profile.hmoProvider = cleanHmo; updated = true; }
        if (cleanHmo && req.body.hmoPolicyNumber && !profile.hmoPolicyNumber) { profile.hmoPolicyNumber = req.body.hmoPolicyNumber; updated = true; }
        if (!profile.wrId) { profile.wrId = (await newWelliId(user.registrationState)).id; updated = true; }
        if (updated) {
          await profile.save();
          console.log('[USERPROFILE UPDATED ON VERIFY]', profile._id);
        }
      }
    }

    const userId = user._id.toString();
    const phone = user.phoneNumber || user.phone || phoneNumber || '';
    const userEmail = user.email || profile?.email || cleanEmail || null;
    // Second step, if the person turned it on. A code by SMS or email can be intercepted (SIM swap,
    // mailbox takeover), so it does not replace the authenticator code.
    const mfaChallenge = await patientAuth.gate({
      userId,
      email: userEmail,
      phoneNumber: phone,
      fullName: profile?.fullName || user.fullName || null,
      method: cleanEmail ? 'Email code' : 'SMS code',
    });
    if (mfaChallenge) return res.json(mfaChallenge);

    const token = jwt.sign({ userId, phoneNumber: phone, email: userEmail, role: 'patient' }, JWT_SECRET, { expiresIn: '30d' });
    void auditAccount(req, userId, 'security', 'sign_in', 'You', cleanEmail ? 'Email code' : 'SMS code');

    // Send Sign-In Notification Email Asynchronously
    if (userEmail) {
      const userAgent = req.headers['user-agent'] || 'WelliRecord Mobile App (iOS / Android)';
      const authMethod = cleanEmail ? 'Email & Login Code' : 'Phone & SMS OTP';
      const nowFormatted = new Date().toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });

      sendWelliEmail({
        to: userEmail,
        subject: '🔐 New sign-in to your WelliRecord™ account',
        html: renderSignInNotificationEmailHtml({
          fullName: profile?.fullName || user.fullName || userEmail.split('@')[0],
          signedInAt: nowFormatted,
          method: authMethod,
          device: userAgent,
        }),
      }).catch((emailErr) => console.error('[Sign-In Email Error]', emailErr));
    }

    const userSessionData = {
      token,
      user: {
        id: userId,
        fullName: profile?.fullName || (profile?.firstName && profile?.lastName ? `${profile.firstName} ${profile.lastName}` : null) || profile?.name || user.fullName || userEmail,
        dateOfBirth: profile?.dateOfBirth || profile?.dob || null,
        memberId: profile?.wrId || profile?.memberId || user.patientIdentityId || null,
        wrId: profile?.wrId || null,
        phoneNumber: user.phoneNumber || user.phone || profile?.phone || phone,
        email: userEmail,
        bloodType: profile?.bloodType || user.bloodType || null,
        genotype: profile?.genotype || user.genotype || null,
        hmoProvider: profile?.hmoProvider || profile?.insuranceProvider || user.hmoProvider || null,
        hmoPolicyNumber: profile?.hmoPolicyNumber || profile?.policyNumber || user.hmoPolicyNumber || null,
        emergencyContacts: profile?.emergencyContacts || null,
        emergencyContact: profile?.emergencyContact || profile?.contact || null,
        contact: profile?.contact || null,
      },
    };

    return res.json(userSessionData);
  } catch (err) {
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Authentication error' });
  }
});

// 3c. Social Sign-In (Google / Apple via Clerk) — finds or creates a real
// Account + UserProfile from a verified identity. Never fabricates a
// fallback user; email is required since that's the reliable match key
// across web and mobile.
app.post('/api/v1/auth/social/verify', async (req: Request, res: Response) => {
  const { provider, fullName, clerkToken } = req.body;

  if (!provider || !clerkToken) {
    return res.status(400).json({ success: false, message: 'Provider and a Clerk session token are required' });
  }
  if (!['google', 'apple'].includes(provider)) {
    return res.status(400).json({ success: false, message: 'Unsupported provider' });
  }

  // The email comes from Clerk, never from the request. An email typed into the body proves nothing.
  const proof = await verifyClerkSession(clerkToken);
  if (!proof.ok) {
    if (proof.reason === 'not_configured') {
      console.error('[POST /auth/social/verify] CLERK_SECRET_KEY is not set; social sign-in is refused.');
      return res.status(503).json({ success: false, message: 'Social sign-in is not available right now.' });
    }
    if (proof.reason === 'upstream') {
      return res.status(503).json({ success: false, message: 'Could not check your sign-in. Please try again.' });
    }
    return res.status(401).json({ success: false, message: 'Your sign-in could not be verified. Please try again.' });
  }
  const cleanEmail = proof.identity!.email;

  try {
    let account = await Account.findOne({ email: cleanEmail });
    let isNewAccount = false;

    if (!account) {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ success: false, message: 'Database unavailable' });
      }

      const existingUser = await User.findOne({ email: cleanEmail });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists. Try signing in with your password instead.',
        });
      }

      const needState = !resolveRegion(req.body.state);
      const legal = checkLegal(req.body.legal);
      if (needState || !legal.ok) {
        return res.status(400).json({
          success: false,
          code: needState ? 'state_required' : 'legal_required',
          needState,
          needLegal: !legal.ok,
          message: 'Choose your state and accept the Privacy & Data Protection Policy and the Terms and Conditions to create your account.',
        });
      }

      const resolvedName = (fullName && fullName.trim()) || cleanEmail.split('@')[0];
      account = new Account({
        email: cleanEmail,
        fullName: resolvedName,
        name: resolvedName,
        phone: '',
        phoneNumber: '',
        isEmailVerified: true,
        authProvider: `${provider}_oauth`,
      });
      await account.save();
      await saveLegal(account._id, legal);
      isNewAccount = true;
      console.log('[NEW ACCOUNT CREATED VIA SOCIAL AUTH]', account._id, resolvedName, provider);
    }

    let profile = await UserProfile.findOne({
      $or: [{ accountId: account._id }, { email: cleanEmail }],
    });

    if (!profile) {
      const issued = await newWelliId(req.body.state);
      profile = new UserProfile({
        accountId: account._id,
        fullName: account.fullName,
        email: cleanEmail,
        wrId: issued.id,
        ...registrationFields(issued, req.body.lga),
        authProvider: `${provider}_oauth`,
        isEmailVerified: true,
        bloodType: 'O+',
        genotype: 'AA',
      });
      await profile.save();
    } else if (!profile.wrId) {
      profile.wrId = (await newWelliId(req.body.state)).id;
      await profile.save();
    }

    const userId = account._id.toString();

    const mfaChallenge = await patientAuth.gate({
      userId,
      email: cleanEmail,
      fullName: profile.fullName || account.fullName,
      method: provider === 'google' ? 'Google' : 'Apple',
    });
    if (mfaChallenge) return res.json(mfaChallenge);

    const token = jwt.sign({ userId, email: cleanEmail, role: 'patient' }, JWT_SECRET, { expiresIn: '30d' });
    void auditAccount(req, userId, 'security', 'sign_in', 'You', provider === 'google' ? 'Google' : 'Apple');

    // Reuse the existing sign-in notification email — same as password/OTP login
    const userAgent = req.headers['user-agent'] || 'WelliRecord Mobile App (iOS)';
    const nowFormatted = new Date().toLocaleString('en-US', {
      month: 'numeric', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
    });
    sendWelliEmail({
      to: cleanEmail,
      subject: '🔐 New sign-in to your WelliRecord™ account',
      html: renderSignInNotificationEmailHtml({
        fullName: profile.fullName || account.fullName,
        signedInAt: nowFormatted,
        method: provider === 'google' ? 'Google Sign-In' : 'Apple Sign-In',
        device: userAgent,
      }),
    }).catch((e) => console.error('[Sign-In Email Error]', e));

    return res.json({
      token,
      isNewAccount,
      user: {
        id: userId,
        fullName: profile.fullName || account.fullName,
        email: cleanEmail,
        phoneNumber: account.phoneNumber || account.phone || null,
        wrId: profile.wrId,
        memberId: profile.wrId,
        dateOfBirth: profile.dateOfBirth || null,
        bloodType: profile.bloodType || null,
        genotype: profile.genotype || null,
        hmoProvider: profile.hmoProvider || null,
        hmoPolicyNumber: profile.hmoPolicyNumber || null,
      },
    });
  } catch (err) {
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Social authentication error' });
  }
});

// 3d. Update Patient Profile (writes directly to shared 'userprofiles' collection)
const updateProfileHandler = async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const {
    accountId,
    userId,
    fullName,
    name,
    dateOfBirth,
    dob,
    gender,
    bloodType,
    genotype,
    hmoProvider,
    insuranceProvider,
    hmoPolicyNumber,
    insuranceId,
    memberId,
    wrId,
    allergies,
    conditions,
    address,
    homeAddress,
    contact,
    avatarUrl,
  } = req.body;

  const avatar = cleanAvatar(avatarUrl);
  if (avatar === null) {
    return res.status(400).json({ success: false, message: 'That photo could not be saved. Choose a smaller picture.' });
  }

  // Bound to caller's own account or a dependent owned by caller
  const targetId = (accountId || userId || authUserId) as string;
  const canAccess = await callerCanAccessOwner(authUserId, targetId);
  if (!canAccess) {
    return res.status(403).json({ success: false, message: 'Access denied: cannot update another user\'s profile' });
  }

  try {
    const searchConditions: any[] = [];
    if (mongoose.isValidObjectId(targetId)) {
      const objId = new mongoose.Types.ObjectId(targetId);
      searchConditions.push({ accountId: objId }, { _id: objId });
    }
    searchConditions.push({ accountId: targetId }, { _id: targetId });

    let profile: any = null;
    if (mongoose.connection.readyState === 1 && searchConditions.length > 0) {
      profile = await UserProfile.findOne({ $or: searchConditions });
    }

    if (!profile && mongoose.connection.readyState === 1) {
      profile = new UserProfile({
        accountId: mongoose.isValidObjectId(targetId) ? new mongoose.Types.ObjectId(targetId) : targetId,
        wrId: wrId || memberId || (await newWelliId(req.body.state)).id,
      });
    }

    if (profile) {
      const resolvedName = fullName !== undefined ? fullName : name;
      if (resolvedName !== undefined) {
        profile.fullName = resolvedName;
        profile.name = resolvedName;
      }
      const resolvedDob = dateOfBirth !== undefined ? dateOfBirth : dob;
      if (resolvedDob !== undefined) {
        profile.dateOfBirth = resolvedDob;
        profile.dob = resolvedDob;
      }
      if (gender !== undefined) profile.gender = gender;
      if (bloodType !== undefined) profile.bloodType = bloodType;
      if (genotype !== undefined) profile.genotype = genotype;
      const resolvedHmo = hmoProvider !== undefined ? hmoProvider : insuranceProvider;
      if (resolvedHmo !== undefined) {
        profile.hmoProvider = resolvedHmo;
        profile.insuranceProvider = resolvedHmo;
      }
      const resolvedPolicy = hmoPolicyNumber !== undefined ? hmoPolicyNumber : insuranceId;
      if (resolvedPolicy !== undefined) {
        profile.hmoPolicyNumber = resolvedPolicy;
        profile.insuranceId = resolvedPolicy;
      }
      if (allergies !== undefined) profile.allergies = allergies;
      if (conditions !== undefined) profile.conditions = conditions;
      const resolvedAddress = homeAddress !== undefined ? homeAddress : address;
      if (resolvedAddress !== undefined) {
        profile.homeAddress = resolvedAddress;
        profile.address = resolvedAddress;
      }
      if (contact !== undefined) profile.contact = contact;
      if (avatar !== undefined) {
        profile.avatarUrl = avatar;
        profile.avatar = avatar;
      }
      if (!profile.wrId) {
        profile.wrId = wrId || memberId || (await newWelliId(req.body.state)).id;
      }

      await profile.save();
    }

    return res.json({ success: true, message: 'Profile updated successfully', profile });
  } catch (err) {
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};
app.post(['/api/v1/profile/update', '/profile/update'], updateProfileHandler);
app.patch(['/api/v1/profile/update', '/profile/update'], updateProfileHandler);

// 3e. Fetch Current Patient Profile (reads from shared 'userprofiles' collection)
app.get(['/api/v1/profile/me', '/api/v1/profile'], async (req: Request, res: Response) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { userId, accountId } = req.query;
    const targetAccountId = (accountId || userId || authUserId) as string;

    const canAccess = await callerCanAccessOwner(authUserId, targetAccountId, 'viewRecords');
    if (!canAccess) {
      return res.status(403).json({ success: false, message: 'Access denied to requested profile' });
    }

    const searchConditions: any[] = [];
    if (mongoose.isValidObjectId(targetAccountId)) {
      const objId = new mongoose.Types.ObjectId(targetAccountId);
      searchConditions.push({ accountId: objId }, { _id: objId });
    }
    searchConditions.push({ accountId: targetAccountId }, { _id: targetAccountId });

    let profile: any = null;
    if (mongoose.connection.readyState === 1 && searchConditions.length > 0) {
      profile = await UserProfile.findOne({ $or: searchConditions });

      // Auto-migration check: If not found in UserProfile, check legacy 'profiles'
      if (!profile) {
        const legacyProfile = await Profile.findOne({ $or: searchConditions });
        if (legacyProfile) {
          console.log('[MIGRATION GET] Migrating legacy profile to userprofiles for account:', targetAccountId);
          profile = new UserProfile({
            accountId: legacyProfile.accountId || legacyProfile.userId || (mongoose.isValidObjectId(targetAccountId) ? new mongoose.Types.ObjectId(targetAccountId) : undefined),
            fullName: legacyProfile.fullName || legacyProfile.name,
            email: legacyProfile.email,
            phone: legacyProfile.phone,
            gender: legacyProfile.gender,
            dateOfBirth: legacyProfile.dateOfBirth || legacyProfile.dob,
            bloodType: legacyProfile.bloodType,
            genotype: legacyProfile.genotype,
            hmoProvider: legacyProfile.hmoProvider || legacyProfile.insuranceProvider,
            hmoPolicyNumber: legacyProfile.hmoPolicyNumber || legacyProfile.insuranceId,
            allergies: legacyProfile.allergies,
            wrId: legacyProfile.memberId || (await newWelliId()).id,
          });
          await profile.save();
        }
      }

      if (profile && !profile.wrId) {
        profile.wrId = (await newWelliId()).id;
        await profile.save();
      }
    }

    return res.json({
      success: true,
      profile: profile || null,
    });
  } catch (err) {
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// -------------------------------------------------------------
// 3f. FAMILY & DEPENDENTS MANAGEMENT ENDPOINTS
// -------------------------------------------------------------

// GET /api/v1/family/list — returns all family members for authenticated user
app.get(['/api/v1/family/list', '/api/v1/family'], async (req: Request, res: Response) => {
  try {
    const authUserId = getAuthUserId(req);
    const queryUserId = (req.query.accountId || req.query.userId || authUserId || '') as string;

    let familyMembers: any[] = [];
    if (mongoose.connection.readyState === 1 && (authUserId || queryUserId)) {
      const targetId = authUserId || queryUserId;
      const conditions: any[] = [];
      if (mongoose.isValidObjectId(targetId)) {
        conditions.push({ accountId: new mongoose.Types.ObjectId(targetId) });
        conditions.push({ userId: new mongoose.Types.ObjectId(targetId) });
      }
      conditions.push({ accountId: targetId });
      conditions.push({ userId: targetId });

      familyMembers = await FamilyMember.find({ $or: conditions }).sort({ createdAt: 1 });

      // Children other people added me to as a guardian.
      const joined: any[] = await ChildGuardian.find({ accountId: String(targetId), status: 'active' });
      const perms = new Map<string, any>();
      for (const g of joined) {
        const eff = effectivePerms(g);
        if (eff.viewRecords) perms.set(String(g.childId), eff);
      }
      if (perms.size) {
        const shared: any[] = await FamilyMember.find({ _id: { $in: [...perms.keys()] } }).sort({ createdAt: 1 });
        for (const m of shared) {
          m._shared = perms.get(String(m._id));
          familyMembers.push(m);
        }
      }
    }

    console.log(`[FAMILY LIST] Found ${familyMembers.length} dependents for ${authUserId || queryUserId}`);
    return res.json({
      success: true,
      familyMembers: familyMembers.map((m) => ({
        id: m._id.toString(),
        _id: m._id.toString(),
        accountId: m.accountId?.toString() || m.userId?.toString(),
        fullName: m.fullName || m.name,
        name: m.fullName || m.name,
        initials: m.initials,
        relationship: m.relationship || 'Dependent',
        role: m.role || 'dependent',
        dateOfBirth: m.dateOfBirth || (m.dob ? String(m.dob).split('T')[0] : null),
        dob: m.dateOfBirth || (m.dob ? String(m.dob).split('T')[0] : null),
        gender: m.gender || '',
        bloodType: m.bloodType || '',
        genotype: m.genotype || '',
        height: m.height || (m.heightCm ? `${m.heightCm} cm` : ''),
        weight: m.weight || (m.weightKg ? `${m.weightKg} kg` : ''),
        allergies: m.allergies || '',
        phone: m.phone || '',
        linkedAccountId: m.linkedAccountId?.toString() || null,
        wrId: m.wrId || null,
        childProfile: m.childProfile || null,
        sharedWithMe: Boolean(m._shared),
        myPermissions: m._shared || null,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
    });
  } catch (err) {
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Failed to fetch family members' });
  }
});

// POST /api/v1/family/add — creates a new family member document under the authenticated account
app.post(['/api/v1/family/add', '/api/v1/family'], async (req: Request, res: Response) => {
  try {
    const authUserId = getAuthUserId(req);
    const {
      accountId,
      userId,
      fullName,
      name,
      relationship,
      dateOfBirth,
      dob,
      gender,
      bloodType,
      genotype,
      height,
      weight,
      allergies,
      phone,
      linkedAccountId,
    } = req.body;

    const resolvedAccountId = authUserId || accountId || userId;
    const resolvedName = (fullName || name || '').trim();
    if (!resolvedName) {
      return res.status(400).json({ success: false, message: 'Family member full name is required' });
    }

    const initials = resolvedName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p: string) => p[0])
      .join('')
      .toUpperCase() || 'FM';

    let savedMember: any = null;
    if (mongoose.connection.readyState === 1) {
      const newDoc = new FamilyMember({
        accountId: resolvedAccountId && mongoose.isValidObjectId(resolvedAccountId) ? new mongoose.Types.ObjectId(resolvedAccountId) : undefined,
        userId: resolvedAccountId && mongoose.isValidObjectId(resolvedAccountId) ? new mongoose.Types.ObjectId(resolvedAccountId) : undefined,
        fullName: resolvedName,
        name: resolvedName,
        initials,
        relationship: relationship || 'Dependent',
        role: 'dependent',
        dateOfBirth: dateOfBirth || dob,
        dob: dateOfBirth || dob,
        gender: gender || '',
        bloodType: bloodType || '',
        genotype: genotype || '',
        height: height || '',
        weight: weight || '',
        allergies: allergies || '',
        phone: phone || '',
        linkedAccountId: linkedAccountId && mongoose.isValidObjectId(linkedAccountId) ? new mongoose.Types.ObjectId(linkedAccountId) : null,
        wrId: (await newWelliId(await guardianStateHint(resolvedAccountId))).id,
      });

      savedMember = await newDoc.save();
    } else {
      savedMember = {
        _id: `fm_${Date.now()}`,
        accountId: resolvedAccountId,
        fullName: resolvedName,
        name: resolvedName,
        initials,
        relationship: relationship || 'Dependent',
        role: 'dependent',
        dateOfBirth: dateOfBirth || dob,
        dob: dateOfBirth || dob,
        gender,
        bloodType,
        genotype,
        allergies,
        phone,
      };
    }

    return res.status(201).json({
      success: true,
      message: 'Family member added successfully',
      member: {
        id: savedMember._id.toString(),
        _id: savedMember._id.toString(),
        accountId: resolvedAccountId,
        fullName: savedMember.fullName || savedMember.name,
        name: savedMember.fullName || savedMember.name,
        initials: savedMember.initials,
        relationship: savedMember.relationship,
        role: 'dependent',
        dateOfBirth: savedMember.dateOfBirth || savedMember.dob,
        dob: savedMember.dateOfBirth || savedMember.dob,
        gender: savedMember.gender,
        bloodType: savedMember.bloodType,
        genotype: savedMember.genotype,
        allergies: savedMember.allergies,
        phone: savedMember.phone,
        wrId: savedMember.wrId || null,
        createdAt: savedMember.createdAt || new Date(),
      },
    });
  } catch (err) {
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Failed to add family member' });
  }
});

// PATCH /api/v1/family/:id — updates a dependent's details
app.patch('/api/v1/family/:id', async (req: Request, res: Response) => {
  try {
    const authUserId = getAuthUserId(req);
    const memberId = req.params.id;

    if (!mongoose.isValidObjectId(memberId)) {
      return res.status(400).json({ success: false, message: 'Invalid family member ID' });
    }

    const member = await FamilyMember.findById(memberId);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Family member not found' });
    }

    // Ownership check (if authenticated)
    if (authUserId && member.accountId && member.accountId.toString() !== authUserId && member.userId?.toString() !== authUserId) {
      return res.status(403).json({ success: false, message: 'Unauthorized to modify this family member' });
    }

    const {
      fullName,
      name,
      relationship,
      dateOfBirth,
      dob,
      gender,
      bloodType,
      genotype,
      height,
      weight,
      allergies,
      phone,
      avatarUrl,
    } = req.body;

    const avatar = cleanAvatar(avatarUrl);
    if (avatar === null) {
      return res.status(400).json({ success: false, message: 'That photo could not be saved. Choose a smaller picture.' });
    }

    const resolvedName = fullName !== undefined ? fullName : name;
    if (resolvedName !== undefined) {
      member.fullName = resolvedName;
      member.name = resolvedName;
      member.initials = resolvedName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p: string) => p[0])
        .join('')
        .toUpperCase();
    }
    if (relationship !== undefined) member.relationship = relationship;
    const resolvedDob = dateOfBirth !== undefined ? dateOfBirth : dob;
    if (resolvedDob !== undefined) {
      member.dateOfBirth = resolvedDob;
      member.dob = resolvedDob;
    }
    if (gender !== undefined) member.gender = gender;
    if (bloodType !== undefined) member.bloodType = bloodType;
    if (genotype !== undefined) member.genotype = genotype;
    if (height !== undefined) member.height = height;
    if (weight !== undefined) member.weight = weight;
    if (allergies !== undefined) member.allergies = allergies;
    if (phone !== undefined) member.phone = phone;
    if (avatar !== undefined) member.avatarUrl = avatar;

    await member.save();
    return res.json({
      success: true,
      message: 'Family member updated successfully',
      member,
    });
  } catch (err) {
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Failed to update family member' });
  }
});

// DELETE /api/v1/family/:id — removes a dependent
app.delete('/api/v1/family/:id', async (req: Request, res: Response) => {
  try {
    const authUserId = getAuthUserId(req);
    const memberId = req.params.id;

    if (!mongoose.isValidObjectId(memberId)) {
      return res.status(400).json({ success: false, message: 'Invalid family member ID' });
    }

    const member = await FamilyMember.findById(memberId);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Family member not found' });
    }

    // Ownership check (if authenticated)
    if (authUserId && member.accountId && member.accountId.toString() !== authUserId && member.userId?.toString() !== authUserId) {
      return res.status(403).json({ success: false, message: 'Unauthorized to delete this family member' });
    }

    await FamilyMember.findByIdAndDelete(memberId);
    console.log(`[FAMILY DELETE] Removed dependent ${memberId}`);
    return res.json({ success: true, message: 'Family member deleted successfully' });
  } catch (err) {
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Failed to delete family member' });
  }
});

// 3b. Sign In with Email / Phone and Password
app.post('/api/v1/auth/login', loginIpLimiter, loginIdentifierLimiter, async (req: Request, res: Response) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ success: false, message: 'Email/phone and password required' });
  }

  try {
    const cleanId = String(identifier).toLowerCase().trim();
    const phoneId = String(identifier).trim();
    let user: any = null;
    if (mongoose.connection.readyState === 1) {
      user = await User.findOne({ $or: [{ email: cleanId }, { phoneNumber: phoneId }] });
      // Accounts created through the OTP, Google or web flows live in the
      // Account store. Use its password when the User record has none.
      if (!user || !user.password) {
        const account: any = await Account.findOne({ $or: [{ email: cleanId }, { phone: phoneId }, { phoneNumber: phoneId }] }).select('+password');
        if (account && account.password) {
          user = {
            _id: account._id,
            password: account.password,
            fullName: account.fullName || account.name || '',
            email: account.email,
            phoneNumber: account.phoneNumber || account.phone,
          };
        }
      }
    }

    // No fallback to a fabricated account. No user, or no password on file,
    // or a mismatched password all return the same generic 401.
    if (!user || !user.password) {
      return res.status(401).json({ success: false, message: 'Invalid email/phone or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: 'Invalid email/phone or password' });
    }

    const userId = user._id.toString();
    const fullName = user.fullName;
    const email = user.email;
    const phoneNumber = user.phoneNumber;

    // Second step, if the person turned it on. No token is issued until it passes.
    const mfaChallenge = await patientAuth.gate({ userId, email, phoneNumber, fullName, method: 'Password' });
    if (mfaChallenge) return res.json(mfaChallenge);

    const token = jwt.sign({ userId, email, role: 'patient' }, JWT_SECRET, { expiresIn: '30d' });
    void auditAccount(req, userId, 'security', 'sign_in', 'You', 'Password');

    if (email) {
      const userAgent = req.headers['user-agent'] || 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/Safari';
      const authMethod = identifier.includes('@') ? 'Email & Password' : 'Phone & Password';
      const nowFormatted = new Date().toLocaleString('en-US', {
        month: 'numeric', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
      });
      sendWelliEmail({
        to: email,
        subject: '🔐 New sign-in to your WelliRecord™ account',
        html: renderSignInNotificationEmailHtml({ fullName, signedInAt: nowFormatted, method: authMethod, device: userAgent }),
      }).catch((emailErr) => console.error('[Sign-In Email Error]', emailErr));
    }

    return res.json({
      token,
      user: {
        id: userId,
        fullName,
        phoneNumber,
        email,
        bloodType: user.bloodType || null,
        genotype: user.genotype || null,
        hmoProvider: user.hmoProvider || null,
        hmoPolicyNumber: user.hmoPolicyNumber || null,
      },
    });
  } catch (err) {
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Sign in error' });
  }
});

// 3c. Register New Health Vault Account
app.post('/api/v1/auth/register', async (req: Request, res: Response) => {
  const { name, email, phone, password, dob, bloodType, genotype, insuranceProvider, insuranceId } = req.body;

  if (!name || (!email && !phone) || !password) {
    return res.status(400).json({ success: false, message: 'Name, email or phone, and password are required' });
  }
  const regState = req.body.state ? resolveRegion(req.body.state) : null;
  if (!regState) {
    return res.status(400).json({ success: false, code: 'state_required', message: 'Select your state of residence. It sets your WelliID.' });
  }
  const legal = checkLegal(req.body.legal);
  if (!legal.ok) {
    return res.status(400).json({ success: false, code: 'legal_required', message: 'Accept the Privacy & Data Protection Policy and the Terms and Conditions to create your account.' });
  }

  try {
    if (mongoose.connection.readyState === 1) {
      const cleanEmail = email ? email.toLowerCase().trim() : undefined;
      const cleanPhone = phone ? phone.trim() : undefined;
      const existing = await User.findOne({
        $or: [
          ...(cleanEmail ? [{ email: cleanEmail }] : []),
          ...(cleanPhone ? [{ phoneNumber: cleanPhone }] : []),
        ],
      });
      if (existing) {
        const clashField = existing.email === cleanEmail ? 'email' : 'phone number';
        return res.status(409).json({
          success: false,
          message: `An account with this ${clashField} already exists. Try signing in instead.`,
        });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let user = null;
    if (mongoose.connection.readyState === 1) {
      user = await User.create({
        fullName: name.trim(),
        email: email ? email.toLowerCase().trim() : undefined,
        phoneNumber: phone ? phone.trim() : undefined,
        password: passwordHash,
        dateOfBirth: dob ? new Date(dob) : undefined,
        bloodType: bloodType || undefined,
        genotype: genotype || undefined,
        hmoProvider: insuranceProvider || null,
        hmoPolicyNumber: insuranceId || null,
        isPhoneVerified: true,
        registrationState: regState?.name,
        registrationLga: cleanLga(req.body.lga),
      });
    }

    if (!user) {
      return res.status(500).json({ success: false, message: 'Database unavailable' });
    }
    await saveLegal(user._id, legal);

    const userId = user._id.toString();
    const token = jwt.sign({ userId, email: user.email, role: 'patient' }, JWT_SECRET, { expiresIn: '30d' });

    return res.status(201).json({
      token,
      user: {
        id: userId,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber || null,
        email: user.email || null,
        bloodType: user.bloodType || null,
        genotype: user.genotype || null,
        hmoProvider: user.hmoProvider || null,
        hmoPolicyNumber: user.hmoPolicyNumber || null,
      },
    });
  } catch (err) {
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Registration error' });
  }
});

// 3d. Password reset: emailed 6-digit code, then a new password.
// Responses never reveal whether an account exists for the email.
app.post('/api/v1/auth/password/forgot', passwordResetLimiter, async (req: Request, res: Response) => {
  const rawEmail = typeof req.body?.email === 'string' ? req.body.email : '';
  const cleanEmail = rawEmail.toLowerCase().trim();
  if (!cleanEmail.includes('@')) {
    return res.status(400).json({ success: false, message: 'A valid email address is required' });
  }
  try {
    if (mongoose.connection.readyState === 1) {
      const [user, account]: any[] = await Promise.all([
        User.findOne({ email: cleanEmail }),
        Account.findOne({ email: cleanEmail }),
      ]);
      const holder = user || account;
      if (holder) {
        const code = generateOtp(`reset:${cleanEmail}`, 'login');
        const sent = await sendWelliEmail({
          to: cleanEmail,
          subject: 'Reset your WelliRecord™ password',
          html: renderOtpEmailHtml({
            fullName: holder.fullName || holder.name || 'WelliRecord Patient',
            code,
            expiresInMinutes: 5,
          }),
        });
        if (!sent?.success) console.error('[Password forgot] email was not delivered for', cleanEmail);
      }
    }
  } catch (err) {
    console.error('[Password forgot ERROR]', err);
  }
  return res.json({
    success: true,
    message: 'If an account exists for this email, a reset code has been sent.',
  });
});

app.post('/api/v1/auth/password/reset', passwordResetLimiter, async (req: Request, res: Response) => {
  const cleanEmail = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  if (!cleanEmail || !code || newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({ success: false, message: 'Email, code and a password of at least 8 characters are required' });
  }
  if (!verifyStoredOtp(`reset:${cleanEmail}`, code)) {
    return res.status(400).json({ success: false, message: 'That code is invalid or has expired' });
  }
  try {
    const [user, account]: any[] = await Promise.all([
      User.findOne({ email: cleanEmail }),
      Account.findOne({ email: cleanEmail }),
    ]);
    if (!user && !account) {
      return res.status(400).json({ success: false, message: 'That code is invalid or has expired' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    const ids: string[] = [];
    // Write the same hash to both stores so /auth/login and the web app agree.
    if (user) {
      user.password = hash;
      await user.save();
      ids.push(String(user._id));
    }
    if (account) {
      await Account.updateOne({ _id: account._id }, { $set: { password: hash, passwordChangedAt: new Date() } });
      ids.push(String(account._id));
    }
    // Sign out every device that held the old password.
    await revokeSessionsFor(ids);
    for (const id of ids) void auditAccount(req, id, 'security', 'password_reset', 'You', 'All other devices signed out');
    return res.json({ success: true, message: 'Password updated. Sign in with your new password.' });
  } catch (err) {
    console.error('[Password reset ERROR]', err);
    return res.status(500).json({ success: false, message: 'Could not reset the password. Try again.' });
  }
});

// 3e. App unlock code. The app locks itself after 5 minutes idle and when it is reopened. The person can unlock with
// the phone's biometrics or passcode, or with a 6-digit code sent to the email or phone already on their own account.
// The destination is never taken from the request, so a stolen phone cannot send the code somewhere else.
const unlockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many unlock attempts. Try again in a few minutes.' },
});
const maskEmailAddress = (e: string) => e.replace(/^(.).*(@.*)$/, (_m, a, b) => `${a}***${b}`);
const maskPhoneNumber = (p: string) => (p.length > 4 ? `${'*'.repeat(p.length - 4)}${p.slice(-4)}` : p);

app.post('/api/v1/auth/unlock/send', unlockLimiter, async (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ success: false, message: 'Sign in again' });
  if (mongoose.connection.readyState !== 1 || !mongoose.isValidObjectId(userId)) {
    return res.status(503).json({ success: false, message: 'The code service is not available. Try again shortly.' });
  }
  try {
    const [account, user]: any[] = await Promise.all([
      Account.findById(userId).select('email phone fullName name').lean(),
      User.findById(userId).select('email phoneNumber fullName').lean(),
    ]);
    const email: string = String(account?.email || user?.email || '').trim().toLowerCase();
    const phone: string = String(account?.phone || user?.phoneNumber || '').trim();
    const name = account?.fullName || account?.name || user?.fullName || 'WelliRecord Patient';
    const wantsSms = req.body?.channel === 'sms';
    const channel: 'email' | 'sms' | null = wantsSms ? (phone ? 'sms' : email ? 'email' : null) : email ? 'email' : phone ? 'sms' : null;
    if (!channel) return res.status(409).json({ success: false, message: 'No email or phone is saved on this account.' });

    const code = generateOtp(`unlock:${userId}`, 'login');
    if (channel === 'email') {
      const sent = await sendWelliEmail({
        to: email,
        subject: 'Your WelliRecord™ unlock code',
        html: renderOtpEmailHtml({ fullName: name, code, expiresInMinutes: 5 }),
      });
      if (!sent?.success || sent.delivered === false) {
        return res.status(502).json({ success: false, message: 'We could not send the email. Try again, or use your phone lock.' });
      }
      return res.json({ success: true, channel, sentTo: maskEmailAddress(email), expiresInSeconds: 300 });
    }
    try {
      await sendWelliSms(phone, `Your WelliRecord unlock code is ${code}. Valid for 5 minutes. Do not share it.`);
    } catch (err) {
      console.error('[Unlock SMS]', err);
      return res.status(502).json({ success: false, message: 'We could not send the SMS. Try again, or use your phone lock.' });
    }
    return res.json({ success: true, channel, sentTo: maskPhoneNumber(phone), expiresInSeconds: 300 });
  } catch (err) {
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Could not send a code. Try again.' });
  }
});

app.post('/api/v1/auth/unlock/verify', unlockLimiter, async (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ success: false, message: 'Sign in again' });
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ success: false, message: 'Enter the 6-digit code' });
  if (!verifyStoredOtp(`unlock:${userId}`, code)) {
    return res.status(400).json({ success: false, message: 'That code is wrong or has expired. Ask for a new one.' });
  }
  void auditAccount(req, userId, 'security', 'app_unlocked_code', 'You', 'App unlocked with an emailed or texted code');
  return res.json({ success: true });
});

// 3f. Email and phone verification for a signed-in account. The person proves they own a new email or phone with a
// 6-digit code, then the account is updated. The code is bound to the account, the kind and the exact value, so it
// cannot be reused for another address. The change is written to both account stores and recorded in the account log.
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Try again in a few minutes.' },
});
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NG_MOBILE = /^\+234[789]\d{9}$/;

async function contactHolder(userId: string) {
  const [account, user]: any[] = await Promise.all([
    Account.findById(userId).select('email phone phoneNumber isEmailVerified isPhoneVerified fullName name').lean(),
    User.findById(userId).select('email phoneNumber isPhoneVerified fullName').lean(),
  ]);
  return { account, user };
}

app.get('/api/v1/auth/contact/status', async (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ success: false, message: 'Sign in again' });
  if (mongoose.connection.readyState !== 1 || !mongoose.isValidObjectId(userId)) {
    return res.status(503).json({ success: false, message: 'Not available right now. Try again shortly.' });
  }
  try {
    const { account, user } = await contactHolder(userId);
    const email = String(account?.email || user?.email || '');
    const phone = String(account?.phoneNumber || user?.phoneNumber || account?.phone || '');
    return res.json({
      success: true,
      email: email || null,
      // An account made with an emailed code, or after this check, has a proven email. Others are unproven.
      emailVerified: Boolean(email && account?.isEmailVerified),
      phone: phone || null,
      phoneVerified: Boolean(phone && (account?.isPhoneVerified || user?.isPhoneVerified)),
    });
  } catch (err) {
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Could not load your contact details.' });
  }
});

app.post('/api/v1/auth/contact/send', contactLimiter, async (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ success: false, message: 'Sign in again' });
  const kind = req.body?.kind === 'phone' ? 'phone' : req.body?.kind === 'email' ? 'email' : null;
  const raw = typeof req.body?.value === 'string' ? req.body.value : '';
  if (!kind) return res.status(400).json({ success: false, message: 'Choose email or phone' });
  if (mongoose.connection.readyState !== 1 || !mongoose.isValidObjectId(userId)) {
    return res.status(503).json({ success: false, message: 'Not available right now. Try again shortly.' });
  }
  const value = kind === 'email' ? raw.trim().toLowerCase() : normalizeNigerianPhone(raw);
  if (kind === 'email' && (!EMAIL_SHAPE.test(value) || value.length > 254)) {
    return res.status(400).json({ success: false, message: 'Enter a valid email address' });
  }
  if (kind === 'phone' && !NG_MOBILE.test(value)) {
    return res.status(400).json({ success: false, message: 'Enter a valid Nigerian mobile number' });
  }
  try {
    const me = new mongoose.Types.ObjectId(userId);
    const taken = kind === 'email'
      ? (await User.exists({ email: value, _id: { $ne: me } })) || (await Account.exists({ email: value, _id: { $ne: me } }))
      : (await User.exists({ phoneNumber: value, _id: { $ne: me } })) ||
        (await Account.exists({ $or: [{ phoneNumber: value }, { phone: value }, { phone: toLocalNigerianPhone(value) }], _id: { $ne: me } }));
    if (taken) return res.status(409).json({ success: false, message: `This ${kind === 'email' ? 'email' : 'number'} cannot be used for this account.` });

    const { account, user } = await contactHolder(userId);
    const name = account?.fullName || account?.name || user?.fullName || 'WelliRecord Patient';
    const code = generateOtp(`contact:${userId}:${kind}:${value}`, 'login');
    if (kind === 'email') {
      const sent = await sendWelliEmail({
        to: value,
        subject: 'Confirm your email for WelliRecord™',
        html: renderOtpEmailHtml({ fullName: name, code, expiresInMinutes: 5 }),
      });
      if (!sent?.success || sent.delivered === false) {
        return res.status(502).json({ success: false, message: 'We could not send the email. Check the address and try again.' });
      }
    } else {
      try {
        await sendWelliSms(value, `Your WelliRecord verification code is ${code}. Valid for 5 minutes. Do not share it.`);
      } catch (err) {
        console.error('[Contact SMS]', err);
        return res.status(502).json({ success: false, message: 'We could not send the SMS. Check the number and try again.' });
      }
    }
    return res.json({ success: true, expiresInSeconds: 300 });
  } catch (err) {
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Could not send a code. Try again.' });
  }
});

app.post('/api/v1/auth/contact/verify', contactLimiter, async (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ success: false, message: 'Sign in again' });
  const kind = req.body?.kind === 'phone' ? 'phone' : req.body?.kind === 'email' ? 'email' : null;
  const raw = typeof req.body?.value === 'string' ? req.body.value : '';
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  if (!kind || !/^\d{6}$/.test(code)) return res.status(400).json({ success: false, message: 'Enter the 6-digit code' });
  if (mongoose.connection.readyState !== 1 || !mongoose.isValidObjectId(userId)) {
    return res.status(503).json({ success: false, message: 'Not available right now. Try again shortly.' });
  }
  const value = kind === 'email' ? raw.trim().toLowerCase() : normalizeNigerianPhone(raw);
  if (!verifyStoredOtp(`contact:${userId}:${kind}:${value}`, code)) {
    return res.status(400).json({ success: false, message: 'That code is wrong or has expired. Ask for a new one.' });
  }
  try {
    const me = new mongoose.Types.ObjectId(userId);
    if (kind === 'email') {
      await Promise.all([
        User.updateOne({ _id: me }, { $set: { email: value } }),
        Account.updateOne({ _id: me }, { $set: { email: value, isEmailVerified: true } }),
      ]);
    } else {
      await Promise.all([
        User.updateOne({ _id: me }, { $set: { phoneNumber: value, isPhoneVerified: true } }),
        Account.updateOne({ _id: me }, { $set: { phoneNumber: value, phone: toLocalNigerianPhone(value), isPhoneVerified: true } }),
      ]);
    }
    void auditAccount(req, userId, 'security', kind === 'email' ? 'email_verified' : 'phone_verified', 'You', `${kind === 'email' ? 'Email' : 'Phone number'} confirmed with a code`);
    return res.json({ success: true, kind, value });
  } catch (err) {
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Could not save. Try again.' });
  }
});

// -------------------------------------------------------------
// CHILD HEALTH PROFILE: schedule, vaccinations, growth, identity
// -------------------------------------------------------------

const isoDate = (v: unknown): string | null => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
};
const cleanText = (v: unknown, max = 200): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim().slice(0, max);
  return t || undefined;
};
const cleanNumber = (v: unknown, min: number, max: number): number | undefined => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};

// Loads a child the signed-in caller may act on, checking one permission.
// The primary guardian has every permission. Sends the error response itself.
async function loadManagedChild(req: Request, res: Response, need: PermKey = 'viewRecords'): Promise<any | null> {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return null;
  }
  if (!mongoose.isValidObjectId(req.params.id) || mongoose.connection.readyState !== 1) {
    res.status(400).json({ success: false, message: 'Invalid family member' });
    return null;
  }
  const access = await resolveChildAccess(authUserId, req.params.id);
  if (!access) {
    res.status(404).json({ success: false, message: 'Family member not found' });
    return null;
  }
  if (!access.perms[need]) {
    res.status(403).json({ success: false, message: 'You do not have permission to do this' });
    return null;
  }
  (req as any).childAccess = access;
  return access.member;
}

const logChild = (req: Request, member: any, action: string, detail = '', dedupeMinutes = 0) => {
  const a = (req as any).childAccess;
  return auditChild(member._id, a?.actorId || 'unknown', a?.role || 'guardian', action, detail, dedupeMinutes);
};

function childProfilePayload(member: any) {
  return {
    id: String(member._id),
    wrId: member.wrId || null,
    fullName: member.fullName || member.name,
    dateOfBirth: member.dateOfBirth || (member.dob ? String(member.dob).split('T')[0] : null),
    gender: member.gender || '',
    bloodType: member.bloodType || '',
    genotype: member.genotype || '',
    allergies: member.allergies || '',
    childProfile: member.childProfile || {},
  };
}

const vaccinationPayload = (v: any) => ({
  id: String(v._id),
  vaccineCode: v.vaccineCode,
  vaccineName: v.vaccineName,
  administeredDate: v.administeredDate,
  facility: v.facility || '',
  provider: v.provider || '',
  lotNumber: v.lotNumber || '',
  manufacturer: v.manufacturer || '',
  expiryDate: v.expiryDate || '',
  site: v.site || '',
  route: v.route || '',
  reaction: v.reaction || '',
  notes: v.notes || '',
  verification: v.verification,
  verifiedBy: v.verifiedBy || '',
  verifiedAt: v.verifiedAt || null,
  verificationSource: v.verificationSource || '',
});

const growthPayload = (g: any) => ({
  id: String(g._id),
  measuredOn: g.measuredOn,
  weightKg: g.weightKg ?? null,
  lengthCm: g.lengthCm ?? null,
  headCircumferenceCm: g.headCircumferenceCm ?? null,
  source: g.source,
  notes: g.notes || '',
});

// GET /api/v1/immunization/schedule — the catalogue the app renders against.
app.get('/api/v1/immunization/schedule', (_req: Request, res: Response) => {
  res.json({ success: true, schedule: IMMUNIZATION_SCHEDULE });
});

// GET /api/v1/family/:id/child-profile — identity, vaccinations and growth in one call.
app.get('/api/v1/family/:id/child-profile', async (req: Request, res: Response) => {
  try {
    const member = await loadManagedChild(req, res);
    if (!member) return;
    await logChild(req, member, 'profile_viewed', '', 30);
    if (!member.wrId) {
      member.wrId = (await newWelliId(await guardianStateHint(member.accountId))).id;
      await member.save();
    }
    const [vaccinations, growth] = await Promise.all([
      ChildVaccination.find({ memberId: member._id }).sort({ administeredDate: 1 }),
      ChildGrowth.find({ memberId: member._id }).sort({ measuredOn: -1 }),
    ]);
    return res.json({
      success: true,
      profile: childProfilePayload(member),
      vaccinations: vaccinations.map(vaccinationPayload),
      growth: growth.map(growthPayload),
    });
  } catch (err) {
    console.error('[GET /family/:id/child-profile] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Could not load the child profile' });
  }
});

// GET /api/v1/family/:id/fhir — the child's record as a FHIR R4 Bundle (Patient, Immunization,
// Observation, AllergyIntolerance). Same permission as viewing the profile. Written to the access log.
app.get('/api/v1/family/:id/fhir', async (req: Request, res: Response) => {
  try {
    const member = await loadManagedChild(req, res);
    if (!member) return;
    const [vaccinations, growth] = await Promise.all([
      ChildVaccination.find({ memberId: member._id }).sort({ administeredDate: 1 }),
      ChildGrowth.find({ memberId: member._id }).sort({ measuredOn: -1 }),
    ]);
    await logChild(req, member, 'record_exported', 'FHIR');
    const profile = childProfilePayload(member);
    const bundle = childToFhirBundle(
      { ...profile, id: String(member._id) },
      vaccinations.map((v: any) => ({ ...v.toObject(), id: String(v._id) })),
      growth.map((g: any) => ({ ...g.toObject(), id: String(g._id) }))
    );
    res.type('application/fhir+json');
    return res.send(JSON.stringify(bundle));
  } catch (err) {
    console.error('[GET /family/:id/fhir] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Could not export the record' });
  }
});

// PATCH /api/v1/family/:id/child-profile — birth, location and emergency details.
app.patch('/api/v1/family/:id/child-profile', async (req: Request, res: Response) => {
  try {
    const member = await loadManagedChild(req, res, 'addRecords');
    if (!member) return;
    const b = req.body || {};
    const next: Record<string, any> = { ...(member.childProfile || {}) };
    const text: Array<[string, number]> = [
      ['preferredName', 60], ['birthRegistrationNo', 60], ['birthFacility', 120], ['community', 80],
      ['state', 60], ['lga', 80], ['address', 200], ['criticalAlerts', 300], ['birthNotes', 300],
    ];
    for (const [key, max] of text) {
      if (key in b) next[key] = cleanText(b[key], max) ?? null;
    }
    if ('deliveryMode' in b) {
      next.deliveryMode = ['Vaginal', 'Caesarean', 'Assisted'].includes(b.deliveryMode) ? b.deliveryMode : null;
    }
    if ('gestationalAgeWeeks' in b) next.gestationalAgeWeeks = cleanNumber(b.gestationalAgeWeeks, 20, 45) ?? null;
    if ('birthWeightKg' in b) next.birthWeightKg = cleanNumber(b.birthWeightKg, 0.3, 7) ?? null;
    if ('birthLengthCm' in b) next.birthLengthCm = cleanNumber(b.birthLengthCm, 20, 70) ?? null;
    if (b.emergencyContact && typeof b.emergencyContact === 'object') {
      next.emergencyContact = {
        name: cleanText(b.emergencyContact.name, 80) ?? null,
        relationship: cleanText(b.emergencyContact.relationship, 40) ?? null,
        phone: cleanText(b.emergencyContact.phone, 30) ?? null,
      };
    }
    if (b.school && typeof b.school === 'object') {
      const sc = b.school;
      next.school = {
        name: cleanText(sc.name, 120) ?? null,
        className: cleanText(sc.className, 40) ?? null,
        teacherName: cleanText(sc.teacherName, 80) ?? null,
        contactPhone: cleanText(sc.contactPhone, 30) ?? null,
        healthNotes: cleanText(sc.healthNotes, 300) ?? null,
        include: {
          emergencyContact: Boolean(sc.include?.emergencyContact),
          allergies: Boolean(sc.include?.allergies),
          conditions: Boolean(sc.include?.conditions),
          immunizations: Boolean(sc.include?.immunizations),
        },
      };
    }
    member.childProfile = next;
    member.markModified('childProfile');
    for (const key of ['bloodType', 'genotype', 'allergies', 'gender'] as const) {
      if (typeof b[key] === 'string') member[key] = b[key].trim().slice(0, 120);
    }
    await member.save();
    await logChild(req, member, 'details_updated');
    return res.json({ success: true, profile: childProfilePayload(member) });
  } catch (err) {
    console.error('[PATCH /family/:id/child-profile] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Could not save the child profile' });
  }
});

// POST /api/v1/family/:id/vaccinations — a guardian records a dose. Always unverified.
app.post('/api/v1/family/:id/vaccinations', async (req: Request, res: Response) => {
  try {
    const member = await loadManagedChild(req, res, 'addRecords');
    if (!member) return;
    const b = req.body || {};
    const dose = scheduleDoseByCode(String(b.vaccineCode || ''));
    if (!dose) return res.status(400).json({ success: false, message: 'Choose a vaccine from the list' });
    const administeredDate = isoDate(b.administeredDate);
    if (!administeredDate) return res.status(400).json({ success: false, message: 'Enter the date as YYYY-MM-DD' });
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (administeredDate > tomorrow) return res.status(400).json({ success: false, message: 'The date cannot be in the future' });
    const dob = isoDate(member.dateOfBirth || (member.dob ? String(member.dob).split('T')[0] : ''));
    if (dob && administeredDate < dob) {
      return res.status(400).json({ success: false, message: 'The date is before the child was born' });
    }
    const expiryDate = b.expiryDate ? isoDate(b.expiryDate) : undefined;
    if (b.expiryDate && !expiryDate) return res.status(400).json({ success: false, message: 'Enter the expiry date as YYYY-MM-DD' });

    const created = await ChildVaccination.create({
      memberId: member._id,
      ownerId: getAuthUserId(req),
      vaccineCode: dose.code,
      vaccineName: `${dose.vaccine}${dose.doseNumber ? ` (dose ${dose.doseNumber})` : ''}`,
      administeredDate,
      facility: cleanText(b.facility, 120),
      provider: cleanText(b.provider, 120),
      lotNumber: cleanText(b.lotNumber, 60),
      manufacturer: cleanText(b.manufacturer, 80),
      expiryDate,
      site: cleanText(b.site, 40),
      route: cleanText(b.route, 40) || dose.route,
      reaction: cleanText(b.reaction, 300),
      notes: cleanText(b.notes, 300),
      verification: 'caregiver_reported',
      scheduleVersion: IMMUNIZATION_SCHEDULE.version,
    });
    await logChild(req, member, 'vaccination_added', created.vaccineName);
    return res.status(201).json({ success: true, vaccination: vaccinationPayload(created) });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: 'This dose is already recorded for this child' });
    }
    console.error('[POST /family/:id/vaccinations] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Could not save the vaccination' });
  }
});

// DELETE /api/v1/family/:id/vaccinations/:vid — guardians can remove only their own unverified entries.
app.delete('/api/v1/family/:id/vaccinations/:vid', async (req: Request, res: Response) => {
  try {
    const member = await loadManagedChild(req, res, 'addRecords');
    if (!member) return;
    if (!mongoose.isValidObjectId(req.params.vid)) return res.status(400).json({ success: false, message: 'Invalid record' });
    const record: any = await ChildVaccination.findOne({ _id: req.params.vid, memberId: member._id });
    if (!record) return res.status(404).json({ success: false, message: 'Vaccination not found' });
    if (record.verification === 'provider_verified') {
      return res.status(403).json({ success: false, message: 'A provider verified this dose. Ask the clinic to correct it.' });
    }
    await record.deleteOne();
    await logChild(req, member, 'vaccination_removed', record.vaccineName);
    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /family/:id/vaccinations/:vid] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Could not remove the vaccination' });
  }
});

// POST /api/v1/family/:id/vaccinations/:vid/verify — provider side, admin secret.
// Body: { verifiedBy, source }. Only this route can set provider_verified.
app.post('/api/v1/family/:id/vaccinations/:vid/verify', staff.requireStaff('clinician', 'records_officer'), async (req: Request, res: Response) => {
  try {
    const { id, vid } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(vid)) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const verifiedBy = staff.actorName(req, cleanText(req.body?.verifiedBy, 120));
    if (!verifiedBy) return res.status(400).json({ success: false, message: 'verifiedBy is required' });
    const updated = await ChildVaccination.findOneAndUpdate(
      { _id: vid, memberId: id },
      {
        $set: {
          verification: 'provider_verified',
          verifiedBy,
          verifiedAt: new Date(),
          verificationSource: cleanText(req.body?.source, 160) || 'Provider confirmation',
        },
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Vaccination not found' });
    await auditChild(id, 'staff', 'admin', 'vaccination_verified', `${updated.vaccineName} by ${verifiedBy}`);
    return res.json({ success: true, vaccination: vaccinationPayload(updated) });
  } catch (err) {
    console.error('[POST /family/:id/vaccinations/:vid/verify] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Could not verify the vaccination' });
  }
});

// POST /api/v1/family/:id/growth — a measurement. DELETE removes the guardian's own entry.
app.post('/api/v1/family/:id/growth', async (req: Request, res: Response) => {
  try {
    const member = await loadManagedChild(req, res, 'addRecords');
    if (!member) return;
    const b = req.body || {};
    const measuredOn = isoDate(b.measuredOn);
    if (!measuredOn) return res.status(400).json({ success: false, message: 'Enter the date as YYYY-MM-DD' });
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (measuredOn > tomorrow) return res.status(400).json({ success: false, message: 'The date cannot be in the future' });
    const weightKg = cleanNumber(b.weightKg, 0.3, 150);
    const lengthCm = cleanNumber(b.lengthCm, 20, 220);
    const headCircumferenceCm = cleanNumber(b.headCircumferenceCm, 20, 70);
    if (weightKg === undefined && lengthCm === undefined && headCircumferenceCm === undefined) {
      return res.status(400).json({ success: false, message: 'Enter at least one valid measurement' });
    }
    const clientId = typeof b.clientId === 'string' && /^[\w-]{8,64}$/.test(b.clientId) ? b.clientId : undefined;
    if (clientId) {
      // A retry after a lost response returns the entry that already exists.
      const existing = await ChildGrowth.findOne({ memberId: member._id, clientId });
      if (existing) return res.status(200).json({ success: true, entry: growthPayload(existing) });
    }
    const created = await ChildGrowth.create({
      memberId: member._id,
      ownerId: getAuthUserId(req),
      clientId,
      measuredOn,
      weightKg,
      lengthCm,
      headCircumferenceCm,
      source: 'caregiver',
      notes: cleanText(b.notes, 300),
    });
    await logChild(req, member, 'growth_added', measuredOn);
    return res.status(201).json({ success: true, entry: growthPayload(created) });
  } catch (err) {
    console.error('[POST /family/:id/growth] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Could not save the measurement' });
  }
});

app.delete('/api/v1/family/:id/growth/:gid', async (req: Request, res: Response) => {
  try {
    const member = await loadManagedChild(req, res, 'addRecords');
    if (!member) return;
    if (!mongoose.isValidObjectId(req.params.gid)) return res.status(400).json({ success: false, message: 'Invalid record' });
    const removed = await ChildGrowth.findOneAndDelete({ _id: req.params.gid, memberId: member._id, source: 'caregiver' });
    if (!removed) return res.status(404).json({ success: false, message: 'Measurement not found' });
    await logChild(req, member, 'growth_removed', removed.measuredOn);
    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /family/:id/growth/:gid] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Could not remove the measurement' });
  }
});

const smsConfigured = () => Boolean(TERMII_API_KEY && TERMII_API_KEY !== 'TL_TEST_KEY');
const reminderDeps: ReminderDeps = {
  getAuthUserId,
  sendSms: sendWelliSms,
  sendWhatsapp: sendWelliWhatsApp,
  push: async (userId, title, body) => {
    await dispatchPushNotification({ userId, type: 'immunization', emoji: '💉', tint: '#ede9fe', title, body, categoryLabel: 'Vaccines' });
  },
  availability: () => ({ sms: smsConfigured(), whatsapp: smsConfigured() && process.env.WHATSAPP_REMINDERS_ENABLED === 'true' }),
};
app.use('/api/v1', createRegistry({ getAuthUserId, requireStaff: staff.requireStaff, actorName: staff.actorName }));
app.use('/api/v1', createChildDevelopmentRouter(getAuthUserId));
app.use('/api/v1', createChildReminderRouter(reminderDeps));
app.use(
  '/api/v1',
  createSelfReported({
    getAuthUserId,
    canAccess: (authUserId, ownerId, perm) => callerCanAccessOwner(authUserId, ownerId, perm),
    limiter: rateLimit({ windowMs: 15 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many tries. Please wait a few minutes.' } }),
  }).router
);
app.use(
  '/api/v1',
  createWebLink({
    getAuthUserId,
    limiter: rateLimit({ windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many tries. Please wait a few minutes.' } }),
  }).router
);
app.use(
  '/api/v1',
  createChildFacilityRouter({
    gate: (req, res, action, ctx) => verification.gateStaff(req, res, action, ctx),
    auditAccess: (a) => verification.auditRecordAccess(a),
    getAuthUserId,
    requireStaff: staff.requireStaff,
    limiter: passwordResetLimiter,
    codeSecret: JWT_SECRET,
    notify: async (userId, title, body) => {
      await dispatchPushNotification({ userId, type: 'system', title, body, categoryLabel: 'Family' });
    },
  })
);

const providerShareLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Try again later.' },
});
app.use(
  '/api/v1',
  createProviderShareRouter({
    getAuthUserId,
    callerCanShare: (authUserId, subjectId) =>
      subjectId === authUserId ? Promise.resolve(true) : callerCanAccessOwner(authUserId, subjectId, 'manageGuardians'),
    sendEmail: async (m) => {
      const r = await sendWelliEmail(m);
      if (!r.success || !r.delivered) throw new Error('email not delivered');
    },
    allowLive: process.env.ALLOW_LIVE_PROVIDER_SHARE === 'true',
    audit: (req, ownerId, kind, action, actor, detail) => void auditAccount(req, ownerId, kind, action, actor, detail),
    channels: () => ({ email: Boolean(process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY), sms: smsConfigured() }),
    sendSms: sendWelliSms,
    normalisePhone: normalizeNigerianPhone,
    notify: async (userId, title, body) => {
      await dispatchPushNotification({ userId, type: 'system', title, body, categoryLabel: 'Sharing' });
    },
    limiter: providerShareLimiter,
    secret: JWT_SECRET,
    publicBaseUrl: (req) => process.env.PUBLIC_API_BASE_URL || `${req.protocol}://${req.get('host')}`,
  })
);
// Live assistant. 30 questions an hour per signed-in person (per IP when signed out, which is refused anyway).
const assistantLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getAuthUserId(req) || req.ip || 'anon',
  message: { success: false, message: 'You have asked a lot of questions this hour. Try again later.' },
});
app.use(
  '/api/v1',
  createAssistantRouter({
    getAuthUserId,
    limiter: assistantLimiter,
    // Gemini when GEMINI_API_KEY is set (preferred when both are), otherwise Claude.
    call: process.env.GEMINI_API_KEY
      ? geminiCall(process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite')
      : process.env.ANTHROPIC_API_KEY
        ? anthropicCall(process.env.ANTHROPIC_API_KEY, process.env.ASSISTANT_MODEL || 'claude-haiku-5-5')
        : null,
    parse: process.env.GEMINI_API_KEY ? parseGeminiSse : undefined,
    extraContext: async () => providerContext(mongoose.connection.readyState === 1 ? await welliProviders() : []),
  })
);
app.get('/share/:token', (req, res) => {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
  );
  res.send(providerSharePage(nonce));
});

// App crash reports. Anonymous by design: no token or user id is read or stored.
const clientErrorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many reports' },
});
const scrubServer = (v: unknown, max: number) =>
  String(v ?? '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\b[0-9a-f]{24}\b/gi, '[id]')
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[number]')
    .slice(0, max);
app.post('/api/v1/client-errors', clientErrorLimiter, async (req: Request, res: Response) => {
  try {
    const b = req.body || {};
    await ClientError.create({
      name: scrubServer(b.name, 60),
      message: scrubServer(b.message, 300),
      stack: scrubServer(b.stack, 2000),
      where: scrubServer(b.where, 80),
      fatal: Boolean(b.fatal),
      appVersion: scrubServer(b.appVersion, 20),
      platform: scrubServer(b.platform, 20),
      osVersion: scrubServer(b.osVersion, 20),
    });
  } catch (err) {
    console.error('[client-errors] could not store a report', err);
  }
  // Always 204: the app never needs to react to a failed report.
  return res.status(204).end();
});
startChildReminderSweep(reminderDeps);
// Delete the encrypted copy of expired or withdrawn WelliBridge links.
setInterval(() => { sweepSealed().catch((e) => console.error('[sweepSealed]', e)); }, 60 * 60 * 1000).unref();
app.use(
  '/api/v1',
  createChildAccessRouter({
    getAuthUserId,
    requireStaff: staff.requireStaff,
    actorName: staff.actorName,
    limiter: passwordResetLimiter,
    sendEmail: async (to, subject, text) => {
      const r = await sendWelliEmail({ to, subject, text, html: `<p>${text}</p>` });
      if (!r.success) throw new Error('email not sent');
    },
    sendSms: sendWelliSms,
    notify: async (userId, title, body) => {
      await dispatchPushNotification({ userId, type: 'system', title, body, categoryLabel: 'Family' });
    },
  })
);

// 4. Fetch Health Records (MongoDB)
// The app reads a record as { id, ownerId, type }; the stored document uses _id, familyMemberId, recordType.
function recordForApp(doc: any, authUserId: string) {
  const r = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const owner = String(r.familyMemberId);
  return {
    ...r,
    id: String(r._id),
    ownerId: owner === authUserId ? 'me' : owner,
    type: r.recordType,
    extractedOcr: r.ocrData || undefined,
    // The app downloads a file with its sign-in token from this path under the API base.
    attachments: (Array.isArray(r.files) ? r.files : []).map((f: any) => ({ url: `/records/files/${String(f.fileId)}`, name: f.name || 'document', fileType: f.contentType || '' })),
  };
}

const USER_RECORD_TYPES = ['Lab Result', 'Prescription', 'Imaging', 'Clinical Note', 'Immunization', 'Receipt'];
const short = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

// POST /api/v1/records — files a record the patient scanned, typed or attached files to. Files are uploaded first (POST /records/files) and named here by fileIds.
app.post('/api/v1/records', async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) return res.status(401).json({ success: false, message: 'Authentication required' });
  try {
    const rawOwner = String(req.body?.ownerId || 'me');
    const ownerId = rawOwner === 'me' ? authUserId : rawOwner;
    if (!mongoose.isValidObjectId(ownerId)) return res.status(400).json({ success: false, message: 'Unknown profile' });
    if (!(await callerCanAccessOwner(authUserId, ownerId, 'addRecords'))) {
      return res.status(403).json({ success: false, message: 'You cannot add records to this profile' });
    }
    const type = String(req.body?.type || '');
    if (!USER_RECORD_TYPES.includes(type)) return res.status(400).json({ success: false, message: 'Choose a record type' });
    const title = short(req.body?.title, 200);
    if (!title) return res.status(400).json({ success: false, message: 'Give the record a title' });
    const keyValues = (Array.isArray(req.body?.extractedOcr?.keyValues) ? req.body.extractedOcr.keyValues : [])
      .slice(0, 50)
      .map((k: any) => ({ label: short(k?.label, 200), value: short(k?.value, 500) }));
    const wanted: string[] = (Array.isArray(req.body?.fileIds) ? req.body.fileIds : []).map(String).filter((v: string) => mongoose.isValidObjectId(v));
    if (wanted.length > RECORD_FILES_PER_RECORD) {
      return res.status(400).json({ success: false, message: `A record can hold up to ${RECORD_FILES_PER_RECORD} files.` });
    }
    const uploaded: any[] = wanted.length
      ? await RecordFile.find({ _id: { $in: wanted }, uploadedBy: new mongoose.Types.ObjectId(authUserId), ownerId: new mongoose.Types.ObjectId(ownerId), recordId: { $exists: false } }, 'name contentType bytes').lean()
      : [];
    if (uploaded.length !== new Set(wanted).size) {
      return res.status(400).json({ success: false, message: 'A file was not found. Upload it again.' });
    }
    const doc = await HealthRecord.create({
      userId: new mongoose.Types.ObjectId(authUserId),
      familyMemberId: new mongoose.Types.ObjectId(ownerId),
      title,
      recordType: type,
      date: short(req.body?.date, 40) || new Date().toISOString().slice(0, 10),
      provider: short(req.body?.provider, 200) || 'Patient upload',
      summary: short(req.body?.summary, 5000),
      ocrData: keyValues.length ? { keyValues, statusBadge: 'OCR Extracted' } : undefined,
      files: uploaded.map((f) => ({ fileId: f._id, name: f.name, contentType: f.contentType, bytes: f.bytes })),
    } as any);
    if (uploaded.length) {
      // The files now belong to the record, so they no longer expire.
      await RecordFile.updateMany({ _id: { $in: uploaded.map((f) => f._id) } }, { $set: { recordId: doc._id }, $unset: { expiresAt: 1 } });
    }
    return res.status(201).json(recordForApp(doc, authUserId));
  } catch (err) {
    console.error('[POST /records] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Could not save the record' });
  }
});

// DELETE /api/v1/records/:id — removes a record the caller can manage. Safe to repeat.
app.delete('/api/v1/records/:id', async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) return res.status(401).json({ success: false, message: 'Authentication required' });
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.json({ success: true, deleted: false });
    const rec: any = await HealthRecord.findById(req.params.id);
    if (!rec) return res.json({ success: true, deleted: false });
    if (!(await callerCanAccessOwner(authUserId, String(rec.familyMemberId), 'addRecords'))) {
      return res.status(403).json({ success: false, message: 'You cannot remove this record' });
    }
    await RecordFile.deleteMany({ recordId: rec._id });
    await rec.deleteOne();
    return res.json({ success: true, deleted: true });
  } catch (err) {
    console.error('[DELETE /records/:id] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Could not remove the record' });
  }
});

app.get('/api/v1/records', async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const rawOwnerId = (req.query.ownerId as string | undefined) || authUserId;
  // 'me' shorthand resolves to the logged-in user's own account id
  const ownerId = rawOwnerId === 'me' ? authUserId : rawOwnerId;

  try {
    const canAccess = await callerCanAccessOwner(authUserId, ownerId, 'viewRecords');
    if (!canAccess) {
      return res.status(403).json({ success: false, message: 'Access denied to requested records' });
    }

    if (mongoose.connection.readyState === 1) {
      const records = await HealthRecord.find({ familyMemberId: ownerId }).sort({ createdAt: -1 });
      return res.json(records.map((r) => recordForApp(r, authUserId)));
    }
    return res.json([]);
  } catch (err) {
    console.error('[GET /records] ERROR:', err);
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// Resolves OrganizationProfile ids to display names in one query so record
// lists can show "SYNLAB Ikeja" instead of an opaque ObjectId. Missing or
// unknown ids simply have no entry in the map.
async function organizationNames(ids: unknown[]): Promise<Map<string, string>> {
  const unique = Array.from(
    new Set(ids.filter((id) => id && mongoose.isValidObjectId(String(id))).map(String))
  );
  const names = new Map<string, string>();
  if (unique.length === 0) return names;
  const orgs: any[] = await OrganizationProfile.find(
    { _id: { $in: unique.map((id) => new mongoose.Types.ObjectId(id)) } },
    'organizationName'
  ).lean();
  for (const org of orgs) names.set(String(org._id), org.organizationName);
  return names;
}

// GET /api/v1/records/labs — provider-submitted lab results, read from the
// shared `labresults` collection the web backend writes to. authUserId from
// the JWT is the Account id, not the UserProfile id these records are keyed
// on, so resolve that first.
app.get('/api/v1/records/labs', async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, items: [] });
    }
    const profile = await UserProfile.findOne({ accountId: new mongoose.Types.ObjectId(authUserId) });
    if (!profile) {
      return res.json({ success: true, items: [] });
    }
    const labs: any[] = await LabResult.find({
      patientId: profile._id,
      recordStatus: 'active',
      patientVisible: true,
    })
      .sort({ resultedAt: -1, createdAt: -1 })
      .lean();
    const names = await organizationNames(labs.map((l) => l.organizationId));
    const items = labs.map((l) => ({
      ...l,
      organizationName: l.organizationId ? names.get(String(l.organizationId)) ?? null : null,
    }));
    return res.json({ success: true, items });
  } catch (err) {
    console.error('[GET /records/labs] ERROR:', err);
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/v1/records/vitals — provider-submitted vitals, read from the
// shared `vitals` collection the web backend writes to. Same pattern as
// /records/labs above.
app.get('/api/v1/records/vitals', async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, items: [] });
    }
    const profile = await UserProfile.findOne({ accountId: new mongoose.Types.ObjectId(authUserId) });
    if (!profile) {
      return res.json({ success: true, items: [] });
    }
    const vitals: any[] = await VitalEntry.find({
      patientId: profile._id,
      recordStatus: 'active',
      patientVisible: true,
    })
      .sort({ measuredAt: -1, createdAt: -1 })
      .lean();
    const names = await organizationNames(vitals.map((v) => v.organizationId));
    const items = vitals.map((v) => ({
      ...v,
      organizationName: v.organizationId ? names.get(String(v.organizationId)) ?? null : null,
    }));
    return res.json({ success: true, items });
  } catch (err) {
    console.error('[GET /records/vitals] ERROR:', err);
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/v1/records/medications — provider-submitted medications, read
// from the shared `medications` collection the web backend writes to. Same
// pattern as /records/labs above.
app.get('/api/v1/records/medications', async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, items: [] });
    }
    const profile = await UserProfile.findOne({ accountId: new mongoose.Types.ObjectId(authUserId) });
    if (!profile) {
      return res.json({ success: true, items: [] });
    }
    const meds: any[] = await MedicationEntry.find({
      patientId: profile._id,
      recordStatus: 'active',
      patientVisible: true,
    })
      .sort({ createdAt: -1 })
      .lean();
    // prescribedBy and organizationId both point at OrganizationProfile.
    const names = await organizationNames(
      meds.flatMap((m) => [m.prescribedBy, m.organizationId])
    );
    const items = meds.map((m) => {
      const orgId = m.prescribedBy ?? m.organizationId;
      return {
        ...m,
        organizationName: orgId ? names.get(String(orgId)) ?? null : null,
      };
    });
    return res.json({ success: true, items });
  } catch (err) {
    console.error('[GET /records/medications] ERROR:', err);
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/v1/lab-documents/proxy — streams Cloudinary attachment with inline disposition
app.get('/api/v1/lab-documents/proxy', async (req: Request, res: Response) => {
  try {
    // Signed-in callers (mobile app) send a Bearer token. The web app embeds
    // this route in an iframe, which cannot send headers, so requests that
    // originate from the WelliRecord web hosts are also accepted.
    const webOrigins = [
      'https://wellirecord.com',
      'https://www.wellirecord.com',
      'https://staging.wellirecord.com',
      'https://wellirecords.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000',
    ];
    const fromWeb = [req.headers.origin, req.headers.referer].some(
      (h) => typeof h === 'string' && webOrigins.some((o) => h === o || h.startsWith(`${o}/`))
    );
    if (!getAuthUserId(req) && !fromWeb) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { url } = req.query;
    let validHost = false;
    try {
      validHost = typeof url === 'string' && new URL(url).origin === 'https://res.cloudinary.com';
    } catch {
      validHost = false;
    }
    if (!url || typeof url !== 'string' || !validHost) {
      return res.status(400).json({ success: false, message: 'Invalid document URL' });
    }

    const upstream = await fetch(url);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ success: false, message: 'Failed to fetch document' });
    }

    // The server's global helmet CSP sets frame-ancestors 'self', which
    // blocks this exact route — the frontend embedding this PDF
    // (wellirecord.com) is a different origin than this backend
    // (wellirecord.onrender.com). Override it here so the patient-facing
    // app can actually iframe what this route serves.
    res.setHeader(
      'Content-Security-Policy',
      "frame-ancestors 'self' https://wellirecord.com https://www.wellirecord.com https://staging.wellirecord.com https://wellirecords.vercel.app http://localhost:5173 http://localhost:3000"
    );
    res.removeHeader('X-Frame-Options');

    let contentType = upstream.headers.get('content-type') || 'application/pdf';
    if (contentType === 'application/octet-stream' || !contentType) {
      contentType = 'application/pdf';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, max-age=3600');

    const buffer = Buffer.from(await upstream.arrayBuffer());
    return res.send(buffer);
  } catch (error) {
    console.error('[GET /lab-documents/proxy] ERROR:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// 4b. Fetch Prescriptions (MongoDB)
app.get('/api/v1/pharmacy/prescriptions', async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const rawOwnerId = (req.query.ownerId as string | undefined) || authUserId;
  const ownerId = rawOwnerId === 'me' ? authUserId : rawOwnerId;

  try {
    const canAccess = await callerCanAccessOwner(authUserId, ownerId, 'viewRecords');
    if (!canAccess) {
      return res.status(403).json({ success: false, message: 'Access denied to requested prescriptions' });
    }

    if (mongoose.connection.readyState === 1) {
      // Patient-initiated orders are listed by /pharmacy/orders, not here.
      const rxs: any[] = await Prescription.find({
        familyMemberId: ownerId,
        orderType: { $ne: 'patient_order' },
        status: { $nin: ['pending_review', 'rejected'] },
      })
        .sort({ createdAt: -1 })
        .lean();
      return res.json(
        rxs.map((rx) => ({
          id: String(rx._id),
          ownerId: String(rx.familyMemberId) === authUserId ? 'me' : String(rx.familyMemberId),
          medicationName: rx.medicationName,
          dosage: rx.dosage || '',
          frequency: rx.frequency || '',
          prescriber: rx.prescriber || '',
          prescribedDate: rx.prescribedDate || '',
          pharmacyProvider: rx.pharmacyProvider || '',
          totalPriceNaira: rx.totalPriceNaira || 0,
          hmoCoveredNaira: rx.hmoCoveredNaira || 0,
          patientCoPayNaira: rx.patientCoPayNaira || 0,
          refillsTotal: rx.refillsTotal || 0,
          refillsRemaining: rx.refillsRemaining || 0,
          status: rx.status,
          deliveryAddress: rx.deliveryAddress || '',
          eta: rx.eta || '',
          hmoProvider: rx.hmoProvider || undefined,
          notes: rx.notes || undefined,
        }))
      );
    }
    return res.json([]);
  } catch (err) {
    console.error('[GET /pharmacy/prescriptions] ERROR:', err);
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/v1/auth/sessions/revoke-others — signs every other device out.
// Returns a fresh token for the caller, who stays signed in.
app.post('/api/v1/auth/sessions/revoke-others', async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId || !mongoose.isValidObjectId(authUserId)) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Database unavailable' });
  }
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    await revokeSessionsFor([authUserId], nowSec);
    void auditAccount(req, authUserId, 'security', 'sessions_revoked', 'You');
    const current: any = jwt.verify(req.headers.authorization!.substring(7), JWT_SECRET as string);
    const token = jwt.sign(
      { userId: authUserId, email: current.email, phoneNumber: current.phoneNumber, role: current.role || 'patient' },
      JWT_SECRET as string,
      { expiresIn: '30d' }
    );
    return res.json({ success: true, token });
  } catch (err) {
    console.error('[POST /auth/sessions/revoke-others] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Could not sign out other devices' });
  }
});

// GET /api/v1/account/audit — the signed-in person's own security and access log.
// kind=security|access narrows it; before=<ISO date> pages back; newest first.
app.get('/api/v1/account/audit', async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) return res.status(401).json({ success: false, message: 'Authentication required' });
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ success: false, message: 'Database unavailable' });
  try {
    const query: any = { accountId: authUserId };
    if (req.query.kind === 'security' || req.query.kind === 'access') query.kind = req.query.kind;
    const before = req.query.before ? new Date(String(req.query.before)) : null;
    if (before && !Number.isNaN(before.getTime())) query.createdAt = { $lt: before };
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 100);
    const rows: any[] = await AccountAuditLog.find(query).sort({ createdAt: -1 }).limit(limit).lean();
    return res.json({
      success: true,
      entries: rows.map((r) => ({
        id: String(r._id),
        kind: r.kind,
        action: r.action,
        title: ACTION_LABELS[r.action] || r.action.replace(/_/g, ' '),
        actor: r.actorLabel,
        detail: r.detail || '',
        ip: r.ip || '',
        device: r.device || '',
        at: r.createdAt,
      })),
      nextBefore: rows.length === limit ? rows[rows.length - 1].createdAt : null,
    });
  } catch (err) {
    console.error('[GET /account/audit] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Could not load your log' });
  }
});

// POST /api/v1/pharmacy/prescriptions/:id/refill — the patient asks for a refill.
// Creates a pending_review order. A pharmacist approves it; approval spends one refill.
app.post('/api/v1/pharmacy/prescriptions/:id/refill', async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  const { id } = req.params;
  const deliveryAddress = String(req.body?.deliveryAddress || '').trim();
  const notes = String(req.body?.notes || '').trim().slice(0, 500);
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid prescription ID' });
  }
  if (!deliveryAddress) {
    return res.status(400).json({ success: false, message: 'A delivery address is required' });
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Database unavailable' });
  }
  try {
    const rx: any = await Prescription.findById(id);
    if (!rx || rx.orderType === 'patient_order') {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }
    const canAccess = await callerCanAccessOwner(authUserId, String(rx.familyMemberId));
    if (!canAccess) {
      return res.status(403).json({ success: false, message: 'Access denied to this prescription' });
    }
    if ((rx.refillsRemaining || 0) <= 0) {
      return res.status(409).json({ success: false, message: 'No refills left. Ask your prescriber for a new prescription.' });
    }
    const pending = await Prescription.findOne({ refillOf: rx._id, status: 'pending_review' }).lean();
    if (pending) {
      return res.status(409).json({ success: false, message: 'A refill for this prescription is already awaiting review.' });
    }
    const order = await Prescription.create({
      accountId: new mongoose.Types.ObjectId(authUserId),
      familyMemberId: rx.familyMemberId,
      medicationName: rx.medicationName,
      dosage: rx.dosage || '',
      quantity: 1,
      frequency: rx.frequency || '',
      prescriber: rx.prescriber || 'Refill request',
      prescribedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      pharmacyProvider: rx.pharmacyProvider || 'WelliRecord Pharmacy Network',
      deliveryAddress,
      deliveryType: 'home',
      notes,
      orderType: 'patient_order',
      refillOf: rx._id,
      status: 'pending_review',
      refillsTotal: 0,
      refillsRemaining: 0,
    } as any);
    return res.status(201).json({ success: true, message: 'Refill sent for pharmacist review', orderId: String(order._id) });
  } catch (err) {
    console.error('[POST /pharmacy/prescriptions/:id/refill] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Could not send the refill request' });
  }
});

// 4c. Patient-Initiated Medication Order (distinct from doctor-issued refills).
// Defaults to 'pending_review' rather than 'active' — no pharmacist/admin
// review workflow exists yet, so orders sit here until one is built. This
// avoids auto-dispensing prescription medication with zero human review.
app.post('/api/v1/pharmacy/orders', async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  const {
    familyMemberId,
    medicationName,
    dosage,
    quantity,
    deliveryAddress,
    deliveryType, // 'home' | 'hospital' | 'office' | 'pharmacy_pickup' | 'custom'
    notes,
  } = req.body;

  if (!medicationName || !deliveryAddress) {
    return res.status(400).json({ success: false, message: 'Medication name and delivery address are required' });
  }
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required to place an order' });
  }

  try {
    let order: any = null;
    if (mongoose.connection.readyState === 1) {
      const newDoc = new Prescription({
        accountId: new mongoose.Types.ObjectId(authUserId),
        familyMemberId: familyMemberId || authUserId,
        medicationName: medicationName.trim(),
        dosage: dosage || '',
        quantity: quantity || 1,
        frequency: '',
        prescriber: 'Patient-Requested Order',
        prescribedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        pharmacyProvider: 'WelliRecord Pharmacy Network',
        deliveryAddress,
        deliveryType: deliveryType || 'home',
        notes: notes || '',
        orderType: 'patient_order',
        status: 'pending_review',
        refillsTotal: 0,
        refillsRemaining: 0,
        totalPriceNaira: 0,
        hmoCoveredNaira: 0,
        patientCoPayNaira: 0,
      });
      order = await newDoc.save();
      console.log('[MEDICATION ORDER CREATED]', order._id, medicationName, authUserId);
    } else {
      return res.status(503).json({ success: false, message: 'Database unavailable' });
    }

    return res.status(201).json({
      success: true,
      message: 'Order submitted for pharmacist review',
      order,
    });
  } catch (err) {
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Failed to create medication order' });
  }
});

// Order status -> tracker step. Steps: 0 awaiting review, 1 prescription
// verified, 2 dispensed, 3 rider en route, 4 delivered, -1 rejected.
const ORDER_STATUS_STEPS: Record<string, { step: number; statusText: string }> = {
  pending_review: { step: 0, statusText: 'Awaiting pharmacist review' },
  refill_requested: { step: 0, statusText: 'Refill requested, awaiting review' },
  active: { step: 1, statusText: 'Prescription verified' },
  dispensed: { step: 2, statusText: 'Dispensed, preparing for dispatch' },
  in_transit: { step: 3, statusText: 'Rider en route' },
  delivered: { step: 4, statusText: 'Delivered' },
  rejected: { step: -1, statusText: 'Order not approved' },
};

function normalizeOrder(doc: any) {
  const meta = ORDER_STATUS_STEPS[doc.status] || { step: 0, statusText: String(doc.status || 'Unknown') };
  return {
    id: String(doc._id),
    medicationName: doc.medicationName,
    dosage: doc.dosage || '',
    quantity: doc.quantity || 1,
    status: doc.status,
    step: meta.step,
    statusText: meta.statusText,
    eta: doc.eta || '',
    deliveryAddress: doc.deliveryAddress || '',
    deliveryType: doc.deliveryType || 'home',
    familyMemberId: doc.familyMemberId ? String(doc.familyMemberId) : '',
    rejectionReason: doc.status === 'rejected' ? doc.rejectionReason || '' : undefined,
    rider: doc.status === 'in_transit' && doc.riderName ? { name: doc.riderName, phone: doc.riderPhone || '' } : undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// GET /api/v1/pharmacy/orders — the caller's own patient-initiated orders,
// newest first. Scoped to the authenticated account only.
app.get('/api/v1/pharmacy/orders', async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (mongoose.connection.readyState !== 1 || !mongoose.isValidObjectId(authUserId)) {
    return res.status(503).json({ success: false, message: 'Database unavailable' });
  }
  try {
    const docs = await Prescription.find({
      accountId: new mongoose.Types.ObjectId(authUserId),
      orderType: 'patient_order',
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({ success: true, orders: docs.map(normalizeOrder) });
  } catch (err) {
    console.error('[GET /pharmacy/orders] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Failed to load orders' });
  }
});

// GET /api/v1/pharmacy/orders/:id/status — tracker data for one order.
// Returns 404 (not 403) for orders the caller does not own.
app.get('/api/v1/pharmacy/orders/:id/status', async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  const orderId = String(req.params.id);
  if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(authUserId)) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Database unavailable' });
  }
  try {
    const doc: any = await Prescription.findOne({
      _id: new mongoose.Types.ObjectId(orderId),
      accountId: new mongoose.Types.ObjectId(authUserId),
    }).lean();
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    return res.json({ success: true, ...normalizeOrder(doc) });
  } catch (err) {
    console.error('[GET /pharmacy/orders/:id/status] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Failed to load order status' });
  }
});

// GET /api/v1/pharmacy/orders/pending — list all patient-initiated
// orders awaiting review, most recent first.
app.get('/api/v1/pharmacy/orders/pending', staff.requireStaff('pharmacist'), async (req: Request, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, orders: [] });
    }
    const orders = await Prescription.find({
      orderType: 'patient_order',
      status: 'pending_review',
    }).sort({ createdAt: -1 });
    return res.json({ success: true, orders });
  } catch (err) {
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Failed to fetch pending orders' });
  }
});

// POST /api/v1/pharmacy/orders/:id/approve — moves an order to 'active'
// so it enters the normal dispatch/refill flow. Optionally accepts
// pricing fields to populate at approval time.
app.post('/api/v1/pharmacy/orders/:id/approve', staff.requireStaff('pharmacist'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { totalPriceNaira, hmoCoveredNaira, patientCoPayNaira, refillsTotal, eta } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID' });
  }

  try {
    const order = await Prescription.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (order.status !== 'pending_review') {
      return res.status(409).json({ success: false, message: `Order is already '${order.status}', not pending review.` });
    }

    order.status = 'active';
    if ((order as any).refillOf) {
      await Prescription.updateOne(
        { _id: (order as any).refillOf, refillsRemaining: { $gt: 0 } },
        { $inc: { refillsRemaining: -1 } }
      );
    }
    if (totalPriceNaira !== undefined) order.totalPriceNaira = totalPriceNaira;
    if (hmoCoveredNaira !== undefined) order.hmoCoveredNaira = hmoCoveredNaira;
    if (patientCoPayNaira !== undefined) order.patientCoPayNaira = patientCoPayNaira;
    if (refillsTotal !== undefined) {
      order.refillsTotal = refillsTotal;
      order.refillsRemaining = refillsTotal;
    }
    if (eta !== undefined) order.eta = eta;
    await order.save();

    console.log('[MEDICATION ORDER APPROVED]', order._id, order.medicationName);

    // Notify the patient
    const account = order.accountId ? await Account.findById(order.accountId) : null;
    if (account?.email) {
      sendWelliEmail({
        to: account.email,
        subject: '✅ Your medication order has been approved',
        html: `<p>Your order for <strong>${order.medicationName}</strong> has been reviewed and approved by a licensed pharmacist. It's now being prepared for dispatch.</p>`,
      }).catch((e) => console.error('[Order Approval Email Error]', e));
    }

    return res.json({ success: true, message: 'Order approved', order });
  } catch (err) {
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Failed to approve order' });
  }
});

// POST /api/v1/pharmacy/orders/:id/reject — marks an order rejected
// with a reason, and notifies the patient why.
app.post('/api/v1/pharmacy/orders/:id/reject', staff.requireStaff('pharmacist'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID' });
  }
  if (!reason || !reason.trim()) {
    return res.status(400).json({ success: false, message: 'A rejection reason is required.' });
  }

  try {
    const order = await Prescription.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (order.status !== 'pending_review') {
      return res.status(409).json({ success: false, message: `Order is already '${order.status}', not pending review.` });
    }

    order.status = 'rejected';
    order.notes = `${order.notes || ''}\n[Rejected: ${reason.trim()}]`.trim();
    await order.save();

    console.log('[MEDICATION ORDER REJECTED]', order._id, order.medicationName, reason);

    const account = order.accountId ? await Account.findById(order.accountId) : null;
    if (account?.email) {
      sendWelliEmail({
        to: account.email,
        subject: 'Update on your medication order',
        html: `<p>Your order for <strong>${order.medicationName}</strong> could not be approved.</p><p><strong>Reason:</strong> ${reason.trim()}</p><p>Please contact support or your doctor if you have questions.</p>`,
      }).catch((e) => console.error('[Order Rejection Email Error]', e));
    }

    return res.json({ success: true, message: 'Order rejected', order });
  } catch (err) {
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Failed to reject order' });
  }
});

// Staff pages. Both sign in with a staff account (password, then authenticator code) and use
// the staff token; see server/consolePages.ts. /admin/orders no longer takes the shared secret.
app.get('/admin/orders', ordersPage);
app.get('/clinic', clinicPage);
app.get('/admin/consultations', consultationsPage);
app.get('/admin/pharmacy', pharmacyPage);
app.get('/clinic/visits', visitsPage);
app.get('/admin/registrations', registrationsPage);
// The video client for /clinic/visits is served from this server so the page's CSP can stay on 'self'.
app.get('/vendor/livekit-client.umd.js', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.type('application/javascript').sendFile(require.resolve('livekit-client'));
});
app.get('/account-deletion', accountDeletionPage);

// 5. Pre-signed Encrypted S3 Upload URL Generator
app.post('/api/v1/records/upload-url', (req: Request, res: Response) => {
  const { fileName, contentType } = req.body;
  const fileKey = `vault/encrypted/${Date.now()}_${fileName || 'document.pdf'}`;

  res.json({
    uploadUrl: `https://storage.wellirecord.com/upload/${fileKey}?signature=demo_sig_2026`,
    fileKey,
    contentType: contentType || 'application/pdf',
    expiresInSeconds: 900,
  });
});

// 5b. Document OCR Extraction (Google Cloud Vision + Claude structuring / heuristic fallback)
// Structures raw OCR text into record fields. Uses Claude if configured
// for reliable parsing of real-world document layouts; otherwise falls
// back to basic heuristics. Never fabricates data — if nothing can be
// extracted, returns null fields rather than inventing plausible values.
async function structureOcrText(rawText: string, recordType: string): Promise<{
  title: string;
  provider: string;
  summary: string;
  keyValues: Array<{ label: string; value: string }>;
}> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (anthropicKey) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Extract structured data from this ${recordType} document's OCR text. Respond ONLY with valid JSON, no markdown, no preamble, in this exact shape:
{"title": string, "provider": string, "summary": string, "keyValues": [{"label": string, "value": string}]}
If a field genuinely cannot be determined from the text, use an empty string for it. Do not invent or guess values not present in the text.

OCR TEXT:
${rawText}`,
          }],
        }),
      });
      const data = await response.json();
      const textBlock = data?.content?.find((b: any) => b.type === 'text')?.text;
      if (textBlock) {
        const cleaned = textBlock.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return {
          title: parsed.title || '',
          provider: parsed.provider || '',
          summary: parsed.summary || '',
          keyValues: Array.isArray(parsed.keyValues) ? parsed.keyValues : [],
        };
      }
    } catch (e: any) {
      console.error('[OCR Structuring - Claude Error]', e.message);
      // fall through to heuristic parsing below
    }
  }

  // Fallback: basic heuristic parsing — first non-empty line as title,
  // rest as summary. No fabricated provider/keyValues; better to leave
  // blank than invent plausible-looking clinical data.
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  return {
    title: lines[0] || `Scanned ${recordType}`,
    provider: '',
    summary: lines.slice(1).join(' ').slice(0, 500) || rawText.slice(0, 500),
    keyValues: [],
  };
}

const recordFileLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many uploads. Please try again later.' },
});
app.use(
  '/api/v1',
  createRecordFiles({
    getAuthUserId,
    canAccessOwner: (caller, owner, perm) => callerCanAccessOwner(caller, owner, (perm as PermKey) || false),
    sealKey: process.env.RECORD_SEAL_KEY || process.env.PHARMACY_SEAL_KEY || JWT_SECRET,
    limiter: recordFileLimiter,
  })
);

// Whether photo scanning is on. The app asks before it sends any photo and does not send one when this says no.
app.get('/api/v1/records/ocr-status', (req: Request, res: Response) => {
  if (!getAuthUserId(req)) return res.status(401).json({ success: false, message: 'Authentication required' });
  return res.json({ success: true, available: thirdPartyOcrOn() });
});

app.post('/api/v1/records/ocr-extract', ocrLimiter, async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  // Off by default: the photo would go to Google Cloud Vision and the text to a model provider (see ocrPolicy.ts).
  if (!thirdPartyOcrOn()) {
    return res.status(503).json({ success: false, code: 'ocr_off', message: 'Photo scanning is turned off to keep your documents private. Enter the details by hand.' });
  }

  const { imageBase64, recordType } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ success: false, message: 'Image data is required' });
  }
  if (typeof imageBase64 !== 'string' || imageBase64.length > 13_000_000) {
    return res.status(413).json({ success: false, message: 'That photo is too large to scan. Take it again at a lower size, or crop it.' });
  }

  const visionKey = process.env.GOOGLE_CLOUD_VISION_KEY;
  if (!visionKey) {
    return res.status(503).json({
      success: false,
      message: 'Document scanning is not configured yet. Please enter details manually.',
    });
  }

  try {
    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: imageBase64 },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          }],
        }),
      }
    );
    const visionData = await visionRes.json();

    if (visionData?.responses?.[0]?.error) {
      console.error('[Vision API Error]', visionData.responses[0].error);
      return res.status(502).json({ success: false, message: 'Document scanning service error. Please try again or enter details manually.' });
    }

    const rawText = visionData?.responses?.[0]?.fullTextAnnotation?.text;

    if (!rawText || !rawText.trim()) {
      return res.status(422).json({
        success: false,
        message: 'Could not read any text from this image. Try a clearer photo or enter details manually.',
      });
    }

    const structured = await structureOcrText(rawText, recordType || 'document');

    return res.json({ success: true, rawText, ...structured });
  } catch (err) {
    console.error('[OCR Error]', err);
    console.error('[500]', req.method, req.path, err);
    return res.status(500).json({ success: false, message: 'Document scanning failed. Please try again.' });
  }
});

// 6. Fetch Lagos Healthcare Facilities (MongoDB)
app.get(['/api/v1/care/facilities', '/api/v1/facilities'], async (_req: Request, res: Response) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const facilities = await Facility.find({ isVerified: true });
      return res.json({ success: true, facilities });
    }
    return res.json({ success: true, facilities: [] });
  } catch (err) {
    console.error('[500]', _req.method, _req.path, err);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// 6a. Organization Profiles / Healthcare Provider Directory (MongoDB)
// Read-only mirror of the website's OrganizationProfile — same MongoDB
// database, confirmed shared cluster. This model is never written to
// from the mobile backend; organizations are only ever created via
// the website's provider signup flow.
const OrganizationProfileSchema = new mongoose.Schema({}, { strict: false });
const OrganizationProfile: mongoose.Model<any> =
  (mongoose.models.OrganizationProfile as any) ||
  mongoose.model('OrganizationProfile', OrganizationProfileSchema, 'organizationprofiles');

// Approved WelliRecord providers, cached for five minutes. Used by the locators and the Assistant.
const approvedProviders = createProviderSource(() =>
  OrganizationProfile.find({ verificationStatus: 'approved' }, ORG_FIELDS).limit(500).lean() as any
);
// Independent doctors appear only while their linked provider verification is eligible (fails closed: unlinked means hidden).
const welliProviders = async () => {
  const list = await approvedProviders();
  const doctors = list.filter(isDoctorLike);
  if (!doctors.length) return list;
  const ok = await verification.eligibleOrgIds(doctors.map((p) => p.id));
  return list.filter((p) => !isDoctorLike(p) || ok.has(p.id));
};

app.get(['/api/v1/care/providers', '/api/v1/providers'], async (_req: Request, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, providers: [] });
    }
    const orgs: any[] = await OrganizationProfile.find(
      {},
      // Explicit field projection — never pull unbounded fields like a
      // base64 logo blob into memory. Only what the directory needs.
      'wrOrgId organizationName organizationType officeAddress verificationStatus phone location'
    )
      .limit(200) // hard cap, prevents unbounded growth as orgs scale
      .lean(); // skip Mongoose document overhead, return plain objects

    const providers = orgs.map((org: any) => ({
      id: org.wrOrgId || org._id.toString(),
      name: org.organizationName,
      type: org.organizationType,
      address: org.officeAddress || '',
      logo: null, // omit entirely from this endpoint — directory listing doesn't need it
      isVerified: org.verificationStatus === 'approved',
      wrOrgId: org.wrOrgId || null,
      phone: org.phone || null,
      // GeoJSON stores [longitude, latitude].
      lat: Array.isArray(org.location?.coordinates) ? org.location.coordinates[1] : null,
      lng: Array.isArray(org.location?.coordinates) ? org.location.coordinates[0] : null,
    }));
    return res.json({ success: true, providers });
  } catch (err) {
    console.error('[Provider Directory Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch provider directory' });
  }
});

// 6a-2. Clinician directory: active doctors/clinicians of approved organizations.
// Read-only mirror of the web backend's OrganizationMembership collection.
const OrganizationMembership: mongoose.Model<any> =
  (mongoose.models.OrganizationMembership as any) ||
  mongoose.model('OrganizationMembership', new mongoose.Schema({}, { strict: false }), 'organizationmemberships');

app.get('/api/v1/care/doctors', async (req: Request, res: Response) => {
  if (!getAuthUserId(req)) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, doctors: [] });
    }
    const memberships: any[] = await OrganizationMembership.find(
      { membershipRole: { $in: ['doctor', 'clinician'] }, isActive: true },
      'userId organizationId membershipRole'
    )
      .limit(300)
      .lean();

    const orgIds = Array.from(new Set(memberships.map((m) => String(m.organizationId)).filter((id) => mongoose.isValidObjectId(id))));
    const userIds = Array.from(new Set(memberships.map((m) => String(m.userId)).filter((id) => mongoose.isValidObjectId(id))));
    const [orgs, profiles]: [any[], any[]] = await Promise.all([
      OrganizationProfile.find(
        { _id: { $in: orgIds }, verificationStatus: 'approved' },
        'organizationName wrOrgId officeAddress'
      ).lean(),
      UserProfile.find({ _id: { $in: userIds } }, 'fullName name').lean(),
    ]);
    const orgById = new Map(orgs.map((o) => [String(o._id), o]));
    const profileById = new Map(profiles.map((p) => [String(p._id), p]));

    const doctors = memberships
      .map((m) => {
        const org = orgById.get(String(m.organizationId));
        const profile = profileById.get(String(m.userId));
        const name = profile?.fullName || profile?.name;
        if (!org || !name) return null;
        return {
          id: String(m._id),
          name,
          role: m.membershipRole === 'doctor' ? 'Doctor' : 'Clinician',
          organizationName: org.organizationName,
          organizationId: org.wrOrgId || String(org._id),
          address: org.officeAddress || '',
        };
      })
      .filter(Boolean);
    return res.json({ success: true, doctors });
  } catch (err) {
    console.error('[Doctors Directory Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch clinicians' });
  }
});

// 6b. Abuja Pharmacy Directory (Google Places API with 24-hour Cache)
// Locator-only: separate from verified WelliRecord partner facilities.
const ABUJA_PHARMACY_DISTRICTS = ['Wuse', 'Utako', 'Maitama', 'Asokoro', 'Jabi', 'Jahi', 'Wuye'];

let pharmacyCache: { data: any[]; fetchedAt: number; usedFallback: boolean } | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const ABUJA_FALLBACK_PHARMACIES = [
  {
    placeId: 'abuja_ph_1',
    name: 'HealthPlus Pharmacy & Beauty',
    address: 'Plot 1044, Adetokunbo Ademola Crescent, Wuse 2, Abuja',
    district: 'Wuse',
    lat: 9.0765,
    lng: 7.4789,
    rating: 4.6,
    openNow: true,
  },
  {
    placeId: 'abuja_ph_2',
    name: 'H-Medix Pharmacy & Supermarket',
    address: 'Adetokunbo Ademola Crescent, Wuse 2, Abuja',
    district: 'Wuse',
    lat: 9.0792,
    lng: 7.4812,
    rating: 4.8,
    openNow: true,
  },
  {
    placeId: 'abuja_ph_3',
    name: 'Medplus Pharmacy Maitama',
    address: 'Alvan Ikoku Way, Maitama, Abuja',
    district: 'Maitama',
    lat: 9.0882,
    lng: 7.4935,
    rating: 4.5,
    openNow: true,
  },
  {
    placeId: 'abuja_ph_4',
    name: 'Nett Pharmacy Jabi Lake Mall',
    address: 'Bala Sokoto Way, Jabi, Abuja',
    district: 'Jabi',
    lat: 9.0734,
    lng: 7.4241,
    rating: 4.4,
    openNow: true,
  },
  {
    placeId: 'abuja_ph_5',
    name: 'Rays Pharmacy & Stores',
    address: 'Plot 726, Cadastral Zone B04, Jabi, Abuja',
    district: 'Jabi',
    lat: 9.0689,
    lng: 7.4208,
    rating: 4.3,
    openNow: true,
  },
  {
    placeId: 'abuja_ph_6',
    name: 'Next Pharmacy & Wellness',
    address: 'Next Cash and Carry, Jahi District, Abuja',
    district: 'Jahi',
    lat: 9.0911,
    lng: 7.4385,
    rating: 4.7,
    openNow: true,
  },
  {
    placeId: 'abuja_ph_7',
    name: 'Bio-Organics Pharmacy',
    address: 'Yakubu Gowon Crescent, Asokoro, Abuja',
    district: 'Asokoro',
    lat: 9.0435,
    lng: 7.5255,
    rating: 4.4,
    openNow: false,
  },
  {
    placeId: 'abuja_ph_8',
    name: 'Mabushi/Wuye Community Pharmacy',
    address: 'Olusegun Obasanjo Way, Wuye District, Abuja',
    district: 'Wuye',
    lat: 9.0521,
    lng: 7.4529,
    rating: 4.2,
    openNow: true,
  },
  {
    placeId: 'abuja_ph_9',
    name: 'Utako Express Pharmacy',
    address: 'Shehu Yar’Adua Way, Utako, Abuja',
    district: 'Utako',
    lat: 9.0645,
    lng: 7.4412,
    rating: 4.3,
    openNow: true,
  },
];

let pharmacyFetchInFlight: Promise<any> | null = null;
let labFetchInFlight: Promise<any> | null = null;

async function fetchWithTimeout(url: string, ms: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function placesPost(req: { url: string; headers: Record<string, string>; body: unknown }, ms: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body), signal: controller.signal });
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

const nearbyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many searches. Try again later.' },
});

// Labs or pharmacies around the phone's position, anywhere. The curated Abuja list is only used
// when the key is missing or Google fails and the person is near Abuja.
async function nearbyHandler(kind: PlaceKind, req: Request, res: Response) {
  const key = kind === 'lab' ? 'labs' : kind === 'pharmacy' ? 'pharmacies' : 'places';
  const p = parseCoords(req.query as any);
  if (!p) return res.status(400).json({ success: false, message: 'Invalid location.' });
  // Curated Abuja lists exist for labs and pharmacies only; nothing is invented for the other kinds.
  const fallback = kind === 'lab' ? ABUJA_FALLBACK_LABS : kind === 'pharmacy' ? ABUJA_FALLBACK_PHARMACIES : [];
  const curated = () => (nearAbuja(p) ? { [key]: fallback, usedFallback: true } : { [key]: [], usedFallback: false });
  // Registered WelliRecord providers come first, and are shown even when Google is off or fails.
  const registered = mongoose.connection.readyState === 1 ? welliPlaces(kind, p, await welliProviders()) : [];
  const withRegistered = (list: any[]) => mergeWelliFirst(registered, list);
  const placesKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!placesKey) {
    const c: any = curated();
    return res.json({ success: true, ...c, [key]: withRegistered(c[key]), located: true });
  }
  try {
    const r = await nearbyCached(kind, p, placesKey, placesPost);
    return res.json({ success: true, [key]: withRegistered(r.places), usedFallback: false, located: true, radiusKm: r.radiusKm });
  } catch (err) {
    console.error(`[Nearby ${kind}]`, err);
    const c: any = curated();
    return res.json({ success: true, ...c, [key]: withRegistered(c[key]), located: true });
  }
}

// Hospitals, clinics and maternity care around the phone's position.
app.get('/api/v1/care/places', (req: Request, res: Response) => {
  const kind = String(req.query.kind || '') as PlaceKind;
  if (!['hospital', 'clinic', 'maternity'].includes(kind) || !PLACE_KINDS.includes(kind)) {
    return res.status(400).json({ success: false, message: 'Unknown kind.' });
  }
  return nearbyLimiter(req, res, () => nearbyHandler(kind, req, res));
});

app.get('/api/v1/care/pharmacies', async (req: Request, res: Response) => {
  if (req.query.lat !== undefined) return nearbyLimiter(req, res, () => nearbyHandler('pharmacy', req, res));
  const placesKey = process.env.GOOGLE_PLACES_API_KEY;

  if (pharmacyCache && Date.now() - pharmacyCache.fetchedAt < CACHE_TTL_MS) {
    return res.json({ success: true, pharmacies: pharmacyCache.data, usedFallback: pharmacyCache.usedFallback, cached: true });
  }

  if (!placesKey) {
    console.log('[Pharmacy Directory] GOOGLE_PLACES_API_KEY not set, using curated Abuja pharmacies');
    pharmacyCache = { data: ABUJA_FALLBACK_PHARMACIES, fetchedAt: Date.now(), usedFallback: true };
    return res.json({ success: true, pharmacies: ABUJA_FALLBACK_PHARMACIES, usedFallback: true, cached: false });
  }

  // In-flight lock: if a fetch is already running, wait for it instead
  // of starting a duplicate set of Places calls. Prevents concurrent
  // requests from multiplying memory/network load.
  if (pharmacyFetchInFlight) {
    const result = await pharmacyFetchInFlight;
    return res.json(result);
  }

  pharmacyFetchInFlight = (async () => {
    try {
      logMemory('before Places batch (pharmacies)');
      const allResults: any[] = [];

      for (const district of ABUJA_PHARMACY_DISTRICTS) {
        const query = encodeURIComponent(`pharmacy in ${district}, Abuja, Nigeria`);
        try {
          const placesData: any = await fetchWithTimeout(
            `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${placesKey}`,
            5000 // 5s timeout per district — don't let one slow call hang the whole batch
          );

          if (placesData.status === 'OK' && Array.isArray(placesData.results)) {
            placesData.results.forEach((place: any) => {
              allResults.push({
                placeId: place.place_id,
                name: place.name,
                address: place.formatted_address,
                district,
                lat: place.geometry?.location?.lat,
                lng: place.geometry?.location?.lng,
                rating: place.rating || null,
                openNow: place.opening_hours?.open_now ?? null,
              });
            });
          } else if (placesData.status !== 'ZERO_RESULTS') {
            console.error(`[Places API Error - Pharmacies - ${district}]`, placesData.status, placesData.error_message);
          }
        } catch (fetchErr) {
          console.error(`[Places API Timeout/Error - Pharmacies - ${district}]`, fetchErr);
          // continue to next district rather than failing the whole batch
        }
      }

      logMemory('after Places batch (pharmacies)');

      // Deduplicate — a pharmacy near a district border can appear in
      // multiple districts' search results. Keep the first occurrence.
      const seenPlaceIds = new Set<string>();
      const dedupedResults = allResults.filter((p) => {
        if (seenPlaceIds.has(p.placeId)) return false;
        seenPlaceIds.add(p.placeId);
        return true;
      });

      const usedFallback = dedupedResults.length === 0;
      const finalResults = usedFallback ? ABUJA_FALLBACK_PHARMACIES : dedupedResults;
      pharmacyCache = { data: finalResults, fetchedAt: Date.now(), usedFallback };
      return { success: true, pharmacies: finalResults, usedFallback, cached: false };
    } catch (err) {
      console.error('[Pharmacy Directory Error]', err);
      return { success: false, message: 'Failed to fetch pharmacy directory' };
    } finally {
      pharmacyFetchInFlight = null;
    }
  })();

  const result = await pharmacyFetchInFlight;
  return res.json(result);
});

// 6c. Abuja Diagnostic Laboratories Directory (Google Places API with 24-hour Cache)
// Locator-only: separate from verified WelliRecord partner facilities.
const ABUJA_LAB_DISTRICTS = [
  'Wuse',
  'Wuse Zone 1',
  'Wuse Zone 2',
  'Wuse Zone 3',
  'Wuse Zone 4',
  'Wuse Zone 5',
  'Wuse Zone 6',
  'Utako',
  'Maitama',
  'Asokoro',
  'Jabi',
  'Jahi',
  'Wuye',
];

let labCache: { data: any[]; fetchedAt: number; usedFallback: boolean } | null = null;

const ABUJA_FALLBACK_LABS = [
  {
    placeId: 'fallback_lab_1',
    name: 'Synlab Diagnostics Wuse',
    address: 'Plot 1083, Joseph Gomwalk Street, Garki II / Wuse II, Abuja',
    district: 'Wuse',
    lat: 9.0699,
    lng: 7.4785,
    rating: 4.6,
    openNow: true,
  },
  {
    placeId: 'fallback_lab_2',
    name: 'Clina-Lancet Laboratories Maitama',
    address: '3 Yedseram Street, Maitama, Abuja',
    district: 'Maitama',
    lat: 9.0935,
    lng: 7.4951,
    rating: 4.5,
    openNow: true,
  },
  {
    placeId: 'fallback_lab_3',
    name: 'Echoscan Diagnostic Centre Utako',
    address: 'Plot 288, Utako District, Shehu Yaradua Way, Abuja',
    district: 'Utako',
    lat: 9.0622,
    lng: 7.4398,
    rating: 4.3,
    openNow: true,
  },
  {
    placeId: 'fallback_lab_4',
    name: 'Clinix Healthcare & Diagnostic Center Jabi',
    address: 'Plot 1045, Off Obafemi Awolowo Way, Jabi, Abuja',
    district: 'Jabi',
    lat: 9.0718,
    lng: 7.4215,
    rating: 4.4,
    openNow: true,
  },
  {
    placeId: 'fallback_lab_5',
    name: 'Nordica Diagnostic & Fertility Centre Asokoro',
    address: 'Asokoro District, Near ECOWAS Secretariat, Abuja',
    district: 'Asokoro',
    lat: 9.0415,
    lng: 7.5218,
    rating: 4.7,
    openNow: false,
  },
  {
    placeId: 'fallback_lab_6',
    name: 'MECURE Healthcare Diagnostics Wuye',
    address: 'Olusegun Obasanjo Way, Wuye Commercial Zone, Abuja',
    district: 'Wuye',
    lat: 9.0542,
    lng: 7.4512,
    rating: 4.2,
    openNow: true,
  },
  {
    placeId: 'fallback_lab_7',
    name: 'DNA Labs Nigeria Jahi',
    address: 'Near Next Cash & Carry, Jahi District, Abuja',
    district: 'Jahi',
    lat: 9.0945,
    lng: 7.4352,
    rating: 4.5,
    openNow: true,
  },
];

app.get('/api/v1/care/labs', async (req: Request, res: Response) => {
  if (req.query.lat !== undefined) return nearbyLimiter(req, res, () => nearbyHandler('lab', req, res));
  const placesKey = process.env.GOOGLE_PLACES_API_KEY;

  if (labCache && Date.now() - labCache.fetchedAt < CACHE_TTL_MS) {
    return res.json({ success: true, labs: labCache.data, usedFallback: labCache.usedFallback, cached: true });
  }

  if (!placesKey) {
    labCache = { data: ABUJA_FALLBACK_LABS, fetchedAt: Date.now(), usedFallback: true };
    return res.json({ success: true, labs: ABUJA_FALLBACK_LABS, usedFallback: true, cached: false });
  }

  // In-flight lock: if a fetch is already running, wait for it instead
  // of starting a duplicate set of 13 Places calls. Prevents concurrent
  // requests from multiplying memory/network load.
  if (labFetchInFlight) {
    const result = await labFetchInFlight;
    return res.json(result);
  }

  labFetchInFlight = (async () => {
    try {
      logMemory('before Places batch (labs)');
      const allResults: any[] = [];
      for (const district of ABUJA_LAB_DISTRICTS) {
        const query = encodeURIComponent(`diagnostic laboratory in ${district}, Abuja, Nigeria`);
        try {
          const placesData: any = await fetchWithTimeout(
            `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${placesKey}`,
            5000 // 5s timeout per district — don't let one slow call hang the whole batch
          );
          if (placesData.status === 'OK' && Array.isArray(placesData.results)) {
            placesData.results.forEach((place: any) => {
              allResults.push({
                placeId: place.place_id,
                name: place.name,
                address: place.formatted_address,
                district,
                lat: place.geometry?.location?.lat,
                lng: place.geometry?.location?.lng,
                rating: place.rating || null,
                openNow: place.opening_hours?.open_now ?? null,
              });
            });
          } else if (placesData.status !== 'ZERO_RESULTS') {
            console.error(`[Places API Error - Labs - ${district}]`, placesData.status, placesData.error_message);
          }
        } catch (fetchErr) {
          console.error(`[Places API Timeout/Error - Labs - ${district}]`, fetchErr);
          // continue to next district rather than failing the whole batch
        }
      }

      logMemory('after Places batch (labs)');

      const seenPlaceIds = new Set<string>();
      const dedupedResults = allResults.filter((p) => {
        if (seenPlaceIds.has(p.placeId)) return false;
        seenPlaceIds.add(p.placeId);
        return true;
      });

      const usedFallback = dedupedResults.length === 0;
      const finalResults = usedFallback ? ABUJA_FALLBACK_LABS : dedupedResults;
      labCache = { data: finalResults, fetchedAt: Date.now(), usedFallback };
      return { success: true, labs: finalResults, usedFallback, cached: false };
    } catch (err) {
      console.error('[Lab Directory Error]', err);
      return { success: false, message: 'Failed to fetch lab directory' };
    } finally {
      labFetchInFlight = null;
    }
  })();

  const result = await labFetchInFlight;
  return res.json(result);
});

// ---------------------------------------------------------------------------
// Appointments. Requests made in the mobile app live in `appointmentrequests`
// (mobile facilities are not web organizations). Bookings made through the
// web backend live in the shared `appointments` collection, keyed by
// patientId = UserProfile._id. GET merges both; cancel handles both.
// ---------------------------------------------------------------------------
async function callerProfileIds(authUserId: string): Promise<mongoose.Types.ObjectId[]> {
  if (!mongoose.isValidObjectId(authUserId)) return [];
  const profiles = await UserProfile.find({ accountId: new mongoose.Types.ObjectId(authUserId) }, { _id: 1 }).lean();
  return profiles.map((p: any) => p._id);
}

// Email, SMS and push for appointment events. A channel counts as delivered only if it said so.
function appointmentChannels(userId: string, targetId: string): NotifyDeps {
  return {
    push: async ({ title, body }) => {
      await dispatchPushNotification({
        userId, type: 'system', emoji: '📅', tint: '#e0f2fe', categoryLabel: 'Appointment', title, body,
        actionLabel: 'View visits', targetModal: 'visits', targetTab: 'care', targetId,
      });
    },
    email: async (to, subject, text, html) => {
      const r = await sendWelliEmail({ to, subject, text, html });
      return Boolean(r.success && r.delivered);
    },
    sms: async (phone, message) => {
      const p = normalizeNigerianPhone(phone);
      if (!/^\+234[789]\d{9}$/.test(p)) return false;
      await sendWelliSms(p, message);
      return true;
    },
  };
}

async function accountContact(accountId: string): Promise<{ email?: string; phone?: string; name: string }> {
  const a: any = await Account.findById(accountId).select('email phone phoneNumber fullName name').lean();
  return { email: a?.email || undefined, phone: a?.phone || a?.phoneNumber || undefined, name: a?.fullName || a?.name || 'A patient' };
}

// Contact details for a facility that is on WelliRecord, read from its organisation profile.
async function facilityContact(facilityId?: string): Promise<{ email?: string; phone?: string } | null> {
  if (!facilityId) return null;
  const org: any = await OrganizationProfile.findOne(
    mongoose.isValidObjectId(facilityId) ? { $or: [{ _id: facilityId }, { wrOrgId: facilityId }] } : { wrOrgId: facilityId },
    'phone email officeEmail contactEmail adminEmail'
  ).lean();
  if (!org) return null;
  return { email: org.email || org.officeEmail || org.contactEmail || org.adminEmail || undefined, phone: org.phone || undefined };
}

function normalizeAppointmentRequest(doc: any) {
  return {
    id: String(doc._id),
    source: 'request' as const,
    facilityName: doc.facilityName,
    facilityAddress: doc.facilityAddress || '',
    familyMemberId: doc.familyMemberId || '',
    scheduledFor: doc.scheduledFor,
    timeSlot: doc.timeSlot,
    reason: doc.reason || '',
    visitType: (doc.visitType === 'video' ? 'video' : 'in_person') as 'video' | 'in_person',
    externalFacility: Boolean(doc.externalFacility),
    providerRemark: doc.providerRemark || '',
    status: doc.status as string,
    startsAt: doc.startsAt || undefined,
    bookingRef: doc.bookingRef || undefined,
    feeMinor: typeof doc.feeMinor === 'number' ? doc.feeMinor : undefined,
    currency: doc.currency || undefined,
    paymentMethod: doc.paymentMethod || undefined,
    paymentStatus: doc.paymentStatus || undefined,
    joinOpensAt: doc.startsAt && doc.visitType === 'video' ? joinWindow(new Date(doc.startsAt), doc.durationMin || 30, Date.now()).opensAt : undefined,
    visitSummary: doc.visitSummary?.authoredAt
      ? {
          diagnosis: doc.visitSummary.diagnosis || '',
          notes: doc.visitSummary.notes || '',
          authoredBy: doc.visitSummary.authoredBy || '',
        }
      : undefined,
  };
}

function normalizeWebAppointment(doc: any) {
  const map: Record<string, string> = {
    booked: 'confirmed',
    'checked-in': 'checked_in',
    cancelled: 'cancelled',
    'no-show': 'no_show',
    completed: 'completed',
  };
  return {
    id: String(doc._id),
    source: 'web' as const,
    facilityName: 'Clinic booking',
    facilityAddress: '',
    familyMemberId: '',
    scheduledFor: doc.scheduledFor,
    timeSlot: '',
    reason: doc.reasonForVisit || '',
    visitType: 'in_person' as const,
    status: map[doc.status] || String(doc.status || ''),
  };
}

// POST /api/v1/telehealth/appointments/:id/summary
// Called by the clinician side (web console backend) after a visit, with the
// admin secret. Marks the visit completed, files a clinical note in the
// patient's vault, optionally records a prescription, and notifies the patient.
app.post('/api/v1/telehealth/appointments/:id/summary', staff.requireStaff('clinician'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const diagnosis = String(req.body?.diagnosis || '').trim().slice(0, 300);
  const notes = String(req.body?.notes || '').trim().slice(0, 4000);
  const authoredBy = staff.actorName(req, String(req.body?.authoredBy || '').trim().slice(0, 120));
  const rx = req.body?.prescription;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid appointment ID' });
  }
  if (!(await verification.gateStaff(req, res, 'write_clinical_note'))) return;
  if (rx && typeof rx.medicationName === 'string' && rx.medicationName.trim() && !(await verification.gateStaff(req, res, 'write_prescription'))) return;
  if (!diagnosis && !notes) {
    return res.status(400).json({ success: false, message: 'A diagnosis or notes are required' });
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Database unavailable' });
  }
  try {
    const appt: any = await AppointmentRequest.findById(id);
    if (!appt || appt.visitType !== 'video') {
      return res.status(404).json({ success: false, message: 'Video visit not found' });
    }
    if (appt.status === 'completed') {
      return res.status(409).json({ success: false, message: 'This visit already has a summary' });
    }
    if (appt.status !== 'confirmed') {
      return res.status(409).json({ success: false, message: `A ${appt.status} visit cannot be completed` });
    }
    const accountId = String(appt.accountId);
    const memberId = appt.familyMemberId && mongoose.isValidObjectId(appt.familyMemberId) ? String(appt.familyMemberId) : accountId;
    const date = new Date(appt.scheduledFor).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'Africa/Lagos' });

    appt.visitSummary = { diagnosis, notes, authoredBy, authoredAt: new Date() };
    appt.status = 'completed';
    appt.notifiedStatus = 'completed';
    await appt.save();

    await HealthRecord.create({
      userId: new mongoose.Types.ObjectId(accountId),
      familyMemberId: new mongoose.Types.ObjectId(memberId),
      title: diagnosis ? `Video visit: ${diagnosis}` : `Video visit with ${appt.facilityName}`,
      recordType: 'Clinical Note',
      date,
      provider: authoredBy ? `${authoredBy}, ${appt.facilityName}` : appt.facilityName,
      summary: [diagnosis, notes].filter(Boolean).join('\n\n'),
    } as any);

    if (rx && typeof rx.medicationName === 'string' && rx.medicationName.trim()) {
      const refills = Math.max(0, Math.min(12, Number(rx.refillsTotal) || 0));
      await Prescription.create({
        accountId: new mongoose.Types.ObjectId(accountId),
        familyMemberId: memberId,
        medicationName: rx.medicationName.trim().slice(0, 200),
        dosage: String(rx.dosage || '').slice(0, 200),
        frequency: String(rx.frequency || '').slice(0, 200),
        prescriber: authoredBy || appt.facilityName,
        prescribedDate: date,
        pharmacyProvider: String(rx.pharmacyProvider || 'WelliRecord Pharmacy Network').slice(0, 200),
        refillsTotal: refills,
        refillsRemaining: refills,
        status: 'active',
        notes: `Prescribed during a video visit with ${appt.facilityName}.`,
      } as any);
    }

    dispatchPushNotification({
      userId: accountId,
      type: 'system',
      emoji: '📝',
      tint: '#e0e7ff',
      categoryLabel: 'Appointment',
      title: 'Visit notes added',
      body: `${appt.facilityName} added notes from your video visit to your records.`,
      actionLabel: 'View visits',
      targetModal: 'visits',
      targetTab: 'records',
      targetId: String(appt._id),
    }).catch((e: any) => console.warn('[Visit summary] notify failed:', e));

    return res.json({ success: true });
  } catch (err) {
    console.error('[POST /telehealth/summary] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Could not save the visit summary' });
  }
});

// POST /api/v1/telehealth/appointments/:id/token
// Issues a short-lived LiveKit token for the caller's own confirmed video
// visit, on the day of the visit (Africa/Lagos). Room name contract with the
// clinician client: `wr-visit-<appointmentId>`. The clinician's token must be
// issued by the web backend for the same room using the same LiveKit project.
app.post('/api/v1/telehealth/appointments/:id/token', appointmentLimiter, async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  const livekitUrl = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!livekitUrl || !apiKey || !apiSecret) {
    return res.status(503).json({ success: false, message: 'Video visits are not set up yet.' });
  }
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(authUserId)) {
    return res.status(404).json({ success: false, message: 'Appointment not found' });
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Database unavailable' });
  }
  try {
    const appt: any = await AppointmentRequest.findOne({
      _id: new mongoose.Types.ObjectId(id),
      accountId: new mongoose.Types.ObjectId(authUserId),
    }).lean();
    if (!appt || appt.visitType !== 'video') {
      return res.status(404).json({ success: false, message: 'Video visit not found' });
    }
    if (appt.status !== 'confirmed') {
      return res.status(409).json({ success: false, message: 'This visit has not been confirmed by the facility yet.' });
    }
    if (appt.startsAt) {
      // Booked from the provider's own hours: the join button works from 10 minutes before the start.
      const w = joinWindow(new Date(appt.startsAt), appt.durationMin || 30, Date.now());
      if (!w.open) {
        return res.status(409).json({ success: false, message: Date.now() < w.opensAt.getTime() ? 'The visit is not ready yet. You can join 10 minutes before the start.' : 'This visit has ended.', code: 'join_window_closed', opensAt: w.opensAt });
      }
    } else {
      const lagosToday = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
      const visitDay = new Date(appt.scheduledFor).toISOString().slice(0, 10);
      if (lagosToday !== visitDay) {
        return res.status(409).json({ success: false, message: 'You can join on the day of your visit.' });
      }
    }

    const profile: any = await UserProfile.findOne({ accountId: new mongoose.Types.ObjectId(authUserId) }, 'fullName name').lean();
    const room = `wr-visit-${id}`;
    const at = new AccessToken(apiKey, apiSecret, {
      identity: `patient-${authUserId}`,
      name: profile?.fullName || profile?.name || 'Patient',
      ttl: '1h',
    });
    at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });
    const token = await at.toJwt();
    return res.json({ success: true, url: livekitUrl, token, room });
  } catch (err) {
    console.error('[POST /telehealth/token] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Could not start the video visit' });
  }
});

// POST /api/v1/appointments/requests
app.post('/api/v1/appointments/requests', appointmentLimiter, async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (mongoose.connection.readyState !== 1 || !mongoose.isValidObjectId(authUserId)) {
    return res.status(503).json({ success: false, message: 'Database unavailable' });
  }

  const { facilityId, facilityName, facilityAddress, date, timeSlot, reason, familyMemberId, visitType, providerRemark, externalFacility } = req.body || {};
  if (providerRemark !== undefined && (typeof providerRemark !== 'string' || providerRemark.length > 800)) {
    return res.status(400).json({ success: false, message: 'Remark must be 800 characters or fewer' });
  }
  if (visitType !== undefined && visitType !== 'in_person' && visitType !== 'video') {
    return res.status(400).json({ success: false, message: 'Visit type must be in_person or video' });
  }
  const when = new Date(String(date || ''));
  if (Number.isNaN(when.getTime())) {
    return res.status(400).json({ success: false, message: 'A valid date is required' });
  }
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const oneYearOut = new Date(startOfToday.getTime() + 366 * 24 * 60 * 60 * 1000);
  if (when < startOfToday || when > oneYearOut) {
    return res.status(400).json({ success: false, message: 'Choose a date within the next year' });
  }
  if (typeof timeSlot !== 'string' || !timeSlot.trim() || timeSlot.length > 80) {
    return res.status(400).json({ success: false, message: 'A time slot is required' });
  }
  if (reason !== undefined && (typeof reason !== 'string' || reason.length > 500)) {
    return res.status(400).json({ success: false, message: 'Reason must be 500 characters or fewer' });
  }

  try {
    if (familyMemberId && !(await callerCanAccessOwner(authUserId, String(familyMemberId), 'bookAppointments'))) {
      return res.status(403).json({ success: false, message: 'You cannot book for this family member' });
    }

    let name = typeof facilityName === 'string' ? facilityName.trim().slice(0, 120) : '';
    let address = typeof facilityAddress === 'string' ? facilityAddress.trim().slice(0, 200) : '';
    if (facilityId && mongoose.isValidObjectId(String(facilityId))) {
      const f: any = await Facility.findById(String(facilityId)).lean();
      if (f) {
        name = f.name;
        address = f.address || address;
      }
    }
    if (!name) {
      return res.status(400).json({ success: false, message: 'A facility is required' });
    }

    const doc = await AppointmentRequest.create({
      accountId: new mongoose.Types.ObjectId(authUserId),
      familyMemberId: familyMemberId ? String(familyMemberId) : undefined,
      facilityId: facilityId ? String(facilityId) : undefined,
      facilityName: name,
      facilityAddress: address,
      scheduledFor: when,
      timeSlot: timeSlot.trim(),
      reason: typeof reason === 'string' ? reason.trim() : '',
      visitType: visitType === 'video' ? 'video' : 'in_person',
      externalFacility: externalFacility === true,
      providerRemark: typeof providerRemark === 'string' ? providerRemark.trim() : '',
      status: 'requested',
    });
    // Tell the patient (push, email, SMS) and the facility where we have a contact for it.
    let notifiedText = '';
    try {
      const me = await accountContact(authUserId);
      let patientName = me.name;
      if (familyMemberId) {
        const fm: any = await FamilyMember.findById(String(familyMemberId)).select('fullName name').lean();
        patientName = fm?.fullName || fm?.name || patientName;
      }
      const external = externalFacility === true;
      const fc = external ? null : await facilityContact(facilityId ? String(facilityId) : undefined);
      const result = await Promise.race([
        notifyRequested({ patient: appointmentChannels(authUserId, String(doc._id)) }, doc, patientName, me, fc),
        new Promise<null>((r) => setTimeout(() => r(null), 10000)),
      ]);
      if (result) {
        notifiedText = summarise(result, external);
        await AppointmentRequest.updateOne({ _id: doc._id }, { $set: { notified: result } });
      }
    } catch (nErr) {
      console.error('[POST /appointments/requests] notify failed:', nErr);
    }
    return res.status(201).json({ success: true, appointment: normalizeAppointmentRequest(doc), notice: notifiedText });
  } catch (err) {
    console.error('[POST /appointments/requests] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Failed to create appointment request' });
  }
});

// GET /api/v1/appointments — the caller's requests plus their web bookings.
app.get('/api/v1/appointments', async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (mongoose.connection.readyState !== 1 || !mongoose.isValidObjectId(authUserId)) {
    return res.status(503).json({ success: false, message: 'Database unavailable' });
  }
  try {
    const profileIds = await callerProfileIds(authUserId);
    const [requests, web] = await Promise.all([
      AppointmentRequest.find({ accountId: new mongoose.Types.ObjectId(authUserId) })
        .sort({ scheduledFor: 1 })
        .limit(200)
        .lean(),
      profileIds.length
        ? AppointmentRead.find({ patientId: { $in: profileIds } }).sort({ scheduledFor: 1 }).limit(200).lean()
        : Promise.resolve([]),
    ]);
    const items = [...requests.map(normalizeAppointmentRequest), ...web.map(normalizeWebAppointment)].sort(
      (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
    );
    return res.json({ success: true, appointments: items });
  } catch (err) {
    console.error('[GET /appointments] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Failed to load appointments' });
  }
});

// POST /api/v1/appointments/:id/cancel — owner only; 404 for anything else.
app.post('/api/v1/appointments/:id/cancel', appointmentLimiter, async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  const id = String(req.params.id);
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(authUserId)) {
    return res.status(404).json({ success: false, message: 'Appointment not found' });
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Database unavailable' });
  }
  try {
    const oid = new mongoose.Types.ObjectId(id);
    const own = await AppointmentRequest.findOne({ _id: oid, accountId: new mongoose.Types.ObjectId(authUserId) });
    if (own) {
      if (own.status === 'cancelled') {
        return res.json({ success: true, appointment: normalizeAppointmentRequest(own) });
      }
      if (own.status === 'completed') {
        return res.status(409).json({ success: false, message: 'A completed visit cannot be cancelled' });
      }
      own.status = 'cancelled';
      if (own.paymentStatus === 'paid') own.paymentStatus = 'refund_due';
      await own.save();
      if (own.startsAt) await BookingSlot.deleteMany({ appointmentId: own._id });
      return res.json({ success: true, appointment: normalizeAppointmentRequest(own) });
    }

    const profileIds = await callerProfileIds(authUserId);
    const web: any = profileIds.length ? await AppointmentRead.findOne({ _id: oid, patientId: { $in: profileIds } }) : null;
    if (!web) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    if (web.status !== 'booked') {
      return res.status(409).json({ success: false, message: `A ${web.status} appointment cannot be cancelled` });
    }
    web.status = 'cancelled';
    await web.save();
    return res.json({ success: true, appointment: normalizeWebAppointment(web) });
  } catch (err) {
    console.error('[POST /appointments/:id/cancel] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Failed to cancel appointment' });
  }
});

// Pharmacy orders are built after booking but share its Paystack webhook, so the handler is looked up late.
let pharmacyOrders: ReturnType<typeof createPharmacyOrders> | null = null;

// Consultation booking (fees, hours, slot holds, payment). See booking.ts.
const booking = createBooking({
  facilityEligible: (staffIds, facilityId) => verification.facilityEligible(staffIds, facilityId),
  getAuthUserId,
  limiter: appointmentLimiter,
  requireStaff: staff.requireStaff,
  callerCanBook: (authUserId, familyMemberId) => callerCanAccessOwner(authUserId, familyMemberId, 'bookAppointments'),
  accountEmail: async (accountId) => (await accountContact(accountId)).email,
  normalize: normalizeAppointmentRequest,
  push: async (accountId, appointmentId, title, body) => {
    await appointmentChannels(accountId, appointmentId).push({ title, body });
  },
  listFacilities: async () => {
    const mobile: any[] = await Facility.find({}, 'name address city').limit(300).lean();
    const registered = await welliProviders();
    return [
      ...mobile.map((f) => ({ id: String(f._id), name: String(f.name), address: [f.address, f.city].filter(Boolean).join(', ') })),
      ...registered.map((p) => ({ id: p.id, name: p.name, address: p.address, registered: true, type: p.type, lat: p.lat, lng: p.lng })),
    ];
  },
  paystack: createPaystack(process.env.PAYSTACK_SECRET_KEY),
  otherReference: async (reference) => (pharmacyOrders ? pharmacyOrders.verifyAndSettle(reference) : false),
});
bookingWebhook = booking.webhook;
app.use('/api/v1', booking.router);
booking.startSweeps();

// Visits console: confirm or cancel requests, join the video room, file the summary. See clinicVisits.ts.
const clinicVisits = createClinicVisits({
  requireStaff: staff.requireStaff,
  gate: (req, res, action) => verification.gateStaff(req, res, action),
  releaseSlot: booking.releaseSlot,
  push: async (accountId, appointmentId, title, body) => {
    await appointmentChannels(accountId, appointmentId).push({ title, body });
  },
});
app.use('/api/v1', clinicVisits.router);
// Providers who signed up on the website set up their own bookings and work their visits. See bridgeProviders.ts.
app.use(
  '/api/v1',
  createBridgeProviders({
    registeredIds: async () => new Set((await welliProviders()).map((p) => p.id)),
    listVisits: clinicVisits.listVisits,
    confirmVisit: clinicVisits.confirmVisit,
    cancelVisit: clinicVisits.cancelVisit,
    videoToken: clinicVisits.videoToken,
    decideHmo: booking.decideHmo,
  }).router
);

// Pharmacy ordering (quote, checkout, payment, handover code). See pharmacyOrders.ts.
pharmacyOrders = createPharmacyOrders({
  getAuthUserId,
  limiter: appointmentLimiter,
  requireStaff: staff.requireStaff,
  paystack: createPaystack(process.env.PAYSTACK_SECRET_KEY),
  accountContact,
  notify: async (accountId, orderId, title, body) => {
    await dispatchPushNotification({
      userId: accountId, type: 'prescription', emoji: '💊', tint: '#dcfce7', categoryLabel: 'Pharmacy', title, body,
      actionLabel: 'View order', targetModal: 'pharmacyOrders', targetTab: 'care', targetId: orderId,
    });
  },
  audit: (req, accountId, action, actor, detail) => auditAccount(req, accountId, 'access', action, actor, detail),
  sealKey: process.env.PHARMACY_SEAL_KEY || JWT_SECRET,
  listFacilities: async () => {
    const mobile: any[] = await Facility.find({}, 'name address city').limit(300).lean();
    const registered = await welliProviders();
    return [
      ...mobile.map((f) => ({ id: String(f._id), name: String(f.name), address: [f.address, f.city].filter(Boolean).join(', ') })),
      ...registered.map((p) => ({ id: p.id, name: p.name, address: p.address, registered: true, type: p.type, lat: p.lat, lng: p.lng })),
    ];
  },
  registeredIds: async () => new Set((await welliProviders()).map((p) => p.id)),
});
app.use('/api/v1', pharmacyOrders.router);
pharmacyOrders.startSweeps();

// 7. Create Share Grant & Audit Log (MongoDB)
// Not in the original audit, found while reviewing a later feature: this was
// fully unauthenticated, and grantorUserId was a freshly-generated random
// ObjectId instead of the caller — anyone could write fake share grants and
// fake NDPR access-audit-log entries for any recipient, attributed to
// nobody real. That's both a spam/DoS vector and a corruption risk for a
// compliance-mandated audit trail. Now requires auth, attributes the grant
// to the real caller, and verifies every recordId actually belongs to them
// (or a dependent they manage) before a grant can reference it.
app.post('/api/v1/shares/grants', async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const { recipientId, recipientType, recipientName, recordIds, expiry, familyMemberId } = req.body;

  try {
    let shareToken: string | undefined;

    if (recipientType === 'bridge') {
      // Public QR / share-link grant (e.g. the Emergency Medical ID card):
      // not tied to specific HealthRecord ids — it unlocks one family
      // member's emergency summary via an opaque token instead.
      const targetOwnerId = familyMemberId || 'me';
      const owned = await callerCanAccessOwner(authUserId, String(targetOwnerId));
      if (!owned) {
        return res.status(403).json({ success: false, message: 'Cannot share a profile you do not own' });
      }
      shareToken = await generateUniqueShareToken();
    } else if (Array.isArray(recordIds) && recordIds.length > 0) {
      for (const recordId of recordIds) {
        const record = await HealthRecord.findById(recordId).select('familyMemberId').lean();
        if (!record) {
          return res.status(404).json({ success: false, message: `Record ${recordId} not found` });
        }
        const owned = await callerCanAccessOwner(authUserId, String(record.familyMemberId));
        if (!owned) {
          return res.status(403).json({ success: false, message: 'Cannot share a record you do not own' });
        }
      }
    }

    let grantId = `grant_${Date.now()}`;
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);

    if (mongoose.connection.readyState === 1) {
      const grant = await ShareGrant.create({
        grantorUserId: new mongoose.Types.ObjectId(authUserId),
        recipientType,
        recipientId,
        recipientName,
        recordIds: recordIds || [],
        familyMemberId:
          recipientType === 'bridge' && familyMemberId && mongoose.isValidObjectId(familyMemberId)
            ? new mongoose.Types.ObjectId(familyMemberId)
            : undefined,
        shareToken,
        expiryCode: expiry || '24h',
        expiresAt,
        status: 'active',
      });
      grantId = grant._id.toString();
      void auditAccount(req, authUserId, 'access', 'record_shared_consent', String(recipientName || 'A provider'), `${recipientType}${recordIds?.length ? `, ${recordIds.length} record(s)` : ''}`);

      await AccessAuditLog.create({
        grantId: grant._id,
        accessedByName: recipientName,
        accessorRole: recipientType === 'facility' ? 'Clinical Team' : 'Physician',
        facilityName: recipientName,
        action: 'view',
        recordsCount: recordIds?.length || 1,
        ipAddress: req.ip || '127.0.0.1',
      });
    } else if (recipientType === 'bridge') {
      // No DB connection — a bridge grant with no persisted token is
      // useless (nothing could ever resolve it), unlike the demo-mode
      // doctor/facility grants above which are just UI stand-ins.
      return res.status(503).json({ success: false, message: 'Share service temporarily unavailable' });
    }

    const baseUrl = process.env.PUBLIC_API_BASE_URL || `${req.protocol}://${req.get('host')}`;

    res.json({
      id: grantId,
      recipientType,
      recipientId,
      recipientName,
      recordIds,
      expiry,
      expiresAt: expiresAt.toISOString(),
      status: 'active',
      ...(shareToken ? { shareToken, shareUrl: `${baseUrl}/api/v1/shares/bridge/${shareToken}` } : {}),
    });
  } catch (err) {
    console.error('[500]', req.method, req.path, err);
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
});

// Minimal HTML escaper for values interpolated into the bridge page below —
// this route is public, so anything a user put into their own name/
// allergies/conditions fields must not be able to break out of the markup.
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 7b. Emergency Bridge — public, token-gated redemption of a 'bridge' share
// grant created above. Deliberately unauthenticated by design (first
// responders scanning a QR code have no WelliRecord account), the same way
// the web backend's WelliBridge GET /bridge/:token works: access control
// lives entirely in the opaque, unguessable token, not in a session. Scope
// is deliberately narrow — only the emergency-card fields, never full
// health records — and the token must be active and unexpired.
app.get('/api/v1/shares/bridge/:token', async (req: Request, res: Response) => {
  const { token } = req.params;
  res.set('Content-Type', 'text/html; charset=utf-8');

  const renderError = (status: number, message: string) =>
    res.status(status).send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>WelliRecord Emergency ID</title></head><body style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:0 20px;color:#0f172a;"><h2>${escapeHtml(message)}</h2><p>This link may have expired or been revoked by the patient.</p></body></html>`);

  if (!token || mongoose.connection.readyState !== 1) {
    return renderError(404, 'Link not found');
  }

  try {
    const grant = await ShareGrant.findOne({ shareToken: token, recipientType: 'bridge' });
    if (!grant) {
      return renderError(404, 'This link is invalid or does not exist');
    }
    if (grant.status === 'revoked') {
      return renderError(410, 'This link has been revoked by the patient');
    }
    if (grant.expiresAt && grant.expiresAt.getTime() <= Date.now()) {
      return renderError(410, 'This link has expired');
    }

    const targetOwnerId = grant.familyMemberId ? String(grant.familyMemberId) : String(grant.grantorUserId);
    let emergency: {
      name?: string; dob?: any; bloodType?: string; genotype?: string;
      allergies?: string; conditions?: string; contact?: string;
      emergencyContacts?: any[]; wrId?: string;
    } | null = null;

    if (targetOwnerId === String(grant.grantorUserId)) {
      const profile = await UserProfile.findOne({ accountId: grant.grantorUserId }).lean();
      if (profile) {
        emergency = {
          name: profile.fullName || profile.name,
          dob: profile.dateOfBirth || profile.dob,
          bloodType: profile.bloodType,
          genotype: profile.genotype,
          allergies: profile.allergies,
          conditions: profile.conditions,
          contact: profile.contact,
          emergencyContacts: profile.emergencyContacts,
          wrId: profile.wrId,
        };
      }
    } else {
      const member = await FamilyMember.findById(targetOwnerId).lean();
      if (member) {
        emergency = {
          name: member.fullName || member.name,
          dob: member.dateOfBirth || member.dob,
          bloodType: member.bloodType,
          genotype: member.genotype,
          allergies: member.allergies,
          conditions: (member as any).conditions,
          contact: (member as any).contact,
          emergencyContacts: (member as any).emergencyContacts,
        };
      }
    }

    if (!emergency) {
      return renderError(404, 'No emergency profile found for this link');
    }

    const contacts = Array.isArray(emergency.emergencyContacts) ? emergency.emergencyContacts : [];
    const contactsHtml = contacts.length
      ? contacts
          .map(
            (c: any) =>
              `<li>${escapeHtml(c?.name)}${c?.relationship ? ` (${escapeHtml(c.relationship)})` : ''}${c?.phone ? ` — ${escapeHtml(c.phone)}` : ''}</li>`
          )
          .join('')
      : '<li>None on file</li>';

    // 1. Record Access Audit Log for this Emergency Scan (NDPR compliance)
    if (mongoose.connection.readyState === 1) {
      try {
        void auditAccount(req, String(grant.grantorUserId), 'access', 'emergency_scan', 'Emergency QR scan', 'Emergency summary was opened');
        await AccessAuditLog.create({
          grantId: grant._id,
          accessedByName: 'First Responder / WelliBridge QR',
          accessorRole: 'Emergency First Responder',
          facilityName: 'WelliBridge Emergency Scan',
          action: 'emergency_scan',
          recordsCount: 1,
          ipAddress: req.ip || '127.0.0.1',
          metadata: {
            token,
            targetOwnerId,
            userAgent: req.get('user-agent'),
            scannedAt: new Date(),
          },
        });
      } catch (logErr) {
        console.warn('[Bridge] Failed to write emergency AccessAuditLog:', logErr);
      }
    }

    // 2. Dispatch Real-Time Push Notification & In-App Alert to the Patient
    const patientName = emergency.name || 'Patient';
    const scanTimeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    dispatchPushNotification({
      userId: grant.grantorUserId,
      type: 'critical_alert',
      emoji: '🚨',
      tint: '#ffe4e6',
      categoryLabel: 'Emergency Alert',
      title: '🚨 Emergency Medical ID Accessed!',
      body: `Your Emergency Medical ID (${patientName}) was scanned by a first responder at ${scanTimeStr}. Tap to review access details or revoke link immediately.`,
      actionLabel: 'Review Security Log',
      targetModal: 'emergency',
      targetTab: 'home',
      metadata: {
        token,
        grantId: grant._id.toString(),
        patientName,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('user-agent'),
        scannedAt: new Date().toISOString(),
      },
    }).catch((err) => console.warn('[Bridge] Push dispatch error:', err));

    res.status(200).send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WelliRecord Emergency ID</title>
</head>
<body style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:0 20px;color:#0f172a;">
  <div style="margin-bottom:20px;padding:10px 14px;background:#ecfdf5;border:1px solid #10b981;border-radius:8px;font-size:13px;color:#065f46;">
    🛡️ <strong>Real-Time Security Notice:</strong> The patient has been automatically notified that this Emergency Medical ID was accessed at ${scanTimeStr}.
  </div>
  <h2 style="margin-bottom:0;">${escapeHtml(emergency.name || 'WelliRecord Patient')}</h2>
  ${emergency.wrId ? `<p style="color:#64748b;margin-top:4px;">ID: ${escapeHtml(emergency.wrId)}</p>` : ''}
  ${emergency.dob ? `<p>DOB: ${escapeHtml(emergency.dob)}</p>` : ''}
  <p><strong>Blood Type:</strong> ${escapeHtml(emergency.bloodType || 'Unknown')}</p>
  <p><strong>Genotype:</strong> ${escapeHtml(emergency.genotype || 'Unknown')}</p>
  <p><strong>Allergies:</strong> ${escapeHtml(emergency.allergies || 'None on file')}</p>
  <p><strong>Conditions:</strong> ${escapeHtml(emergency.conditions || 'None on file')}</p>
  <p><strong>Emergency Contacts:</strong></p>
  <ul>${contactsHtml}</ul>
  <p style="color:#94a3b8;font-size:12px;margin-top:32px;">Shared via WelliRecord Emergency Medical ID. This link expires automatically and was shared by the patient.</p>
</body>
</html>`);
  } catch (err) {
    return renderError(500, 'Something went wrong loading this link');
  }
});

// 2FA Preference Toggle Endpoint
app.post('/api/v1/auth/2fa/toggle', async (req: Request, res: Response) => {
  const { twoFactorEnabled } = req.body;
  // Signed-in callers only, and only their own account. This route used to accept an email or phone
  // from the body with no token, which let anyone switch the flag for any account.
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

  try {
    if (mongoose.connection.readyState === 1 && mongoose.isValidObjectId(userId)) {
      await User.findByIdAndUpdate(userId, { twoFactorEnabled: Boolean(twoFactorEnabled) });
      await Account.findByIdAndUpdate(userId, { twoFactorEnabled: Boolean(twoFactorEnabled) });    }

    return res.json({
      success: true,
      twoFactorEnabled: Boolean(twoFactorEnabled),
      message: `Two-Factor Authentication ${twoFactorEnabled ? 'enabled' : 'disabled'} successfully.`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to update 2FA setting' });
  }
});

// Register a device push token (Expo push token) for the authenticated user.
// Stored on both User and Account models since either may represent the
// logged-in patient depending on which flow created the record.
app.post('/api/v1/auth/push-token', async (req: Request, res: Response) => {
  const { pushToken } = req.body;
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!pushToken || typeof pushToken !== 'string') {
    return res.status(400).json({ success: false, message: 'pushToken is required' });
  }
  try {
    let decoded: any = null;
    if (token) {
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch {}
    }
    const userId = decoded?.userId || decoded?.id;
    const email = decoded?.email;
    const phoneNumber = decoded?.phoneNumber;
    if (!userId && !email && !phoneNumber) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (mongoose.connection.readyState === 1) {
      const update = { $addToSet: { pushTokens: pushToken } };
      if (userId) {
        await User.findByIdAndUpdate(userId, update);
        await Account.findByIdAndUpdate(userId, update);
      } else if (email) {
        await User.findOneAndUpdate({ email }, update);
        await Account.findOneAndUpdate({ email }, update);
      } else if (phoneNumber) {
        const normalized = normalizeNigerianPhone(phoneNumber);
        await User.findOneAndUpdate({ phoneNumber: normalized }, update);
        await Account.findOneAndUpdate({ phone: normalized }, update);
      }
    }
    return res.json({ success: true, message: 'Push token registered' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to register push token' });
  }
});

// Real-Time Notification Stream (SSE)
app.get('/api/v1/notifications/stream', (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const subId = `${authUserId}_${Date.now()}`;
  liveNotificationSubscribers.set(subId, res);

  res.write(`data: ${JSON.stringify({ type: 'connected', time: new Date().toISOString() })}\n\n`);

  req.on('close', () => {
    liveNotificationSubscribers.delete(subId);
  });
});

// Fetch Notifications for Authenticated User
app.get('/api/v1/notifications', async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, notifications: [] });
    }

    const items = await NotificationRecord.find({
      userId: new mongoose.Types.ObjectId(authUserId),
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.json({
      success: true,
      notifications: items.map((item) => ({
        id: item._id.toString(),
        type: item.type,
        emoji: item.emoji,
        tint: item.tint,
        categoryLabel: item.categoryLabel,
        title: item.title,
        desc: item.desc,
        time: item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : item.time,
        read: item.read,
        actionLabel: item.actionLabel,
        targetTab: item.targetTab,
        targetModal: item.targetModal,
        targetId: item.targetId,
        metadata: item.metadata,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch notifications' });
  }
});

// Mark Notification as Read
app.post('/api/v1/notifications/:id/read', async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const { id } = req.params;
  try {
    if (mongoose.connection.readyState === 1 && mongoose.isValidObjectId(id)) {
      await NotificationRecord.findOneAndUpdate(
        { _id: id, userId: authUserId },
        { read: true }
      );
    }
    return res.json({ success: true, message: 'Marked as read' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Test Trigger: Instant Emergency Medical ID Access Alert
app.post('/api/v1/notifications/test-emergency-alert', async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    let patientName = 'You';
    if (mongoose.connection.readyState === 1) {
      const p = await UserProfile.findOne({ accountId: authUserId }).lean();
      if (p) patientName = p.fullName || p.name || 'You';
    }

    const testToken = `test_token_${Date.now()}`;
    const scanTimeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const notif = await dispatchPushNotification({
      userId: authUserId,
      type: 'critical_alert',
      emoji: '🚨',
      tint: '#ffe4e6',
      categoryLabel: 'Emergency Alert',
      title: '🚨 Emergency Medical ID Accessed!',
      body: `Your Emergency Medical ID (${patientName}) was scanned by a first responder at ${scanTimeStr}. Tap to review access details or revoke link immediately.`,
      actionLabel: 'Review Security Log',
      targetModal: 'emergency',
      targetTab: 'home',
      metadata: {
        token: testToken,
        grantId: 'test-grant',
        patientName,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('user-agent'),
        scannedAt: new Date().toISOString(),
      },
    });

    return res.json({ success: true, message: 'Test emergency alert dispatched successfully', notification: notif });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Revoke Emergency Bridge Token Immediately (Locks QR code from further access)
app.post('/api/v1/shares/bridge/revoke/:token', async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const { token } = req.params;
  try {
    if (mongoose.connection.readyState === 1) {
      const grant = await ShareGrant.findOne({ shareToken: token });
      if (!grant) {
        return res.status(404).json({ success: false, message: 'Share grant not found for this token' });
      }

      if (String(grant.grantorUserId) !== String(authUserId)) {
        const owned = await callerCanAccessOwner(authUserId, String(grant.familyMemberId || grant.grantorUserId));
        if (!owned) {
          return res.status(403).json({ success: false, message: 'Cannot revoke a share grant you do not own' });
        }
      }

      grant.status = 'revoked';
      await grant.save();
      void auditAccount(req, authUserId, 'access', 'share_revoked', 'You', String(grant.recipientName || 'Share link'));

      await AccessAuditLog.create({
        grantId: grant._id,
        accessedByName: 'Patient (Self / Security Action)',
        accessorRole: 'Patient Owner',
        facilityName: 'WelliRecord Mobile Security Control',
        action: 'revoke',
        recordsCount: 0,
        ipAddress: req.ip || '127.0.0.1',
        metadata: {
          token,
          revokedAt: new Date(),
        },
      });
    }

    return res.json({
      success: true,
      status: 'revoked',
      message: 'Emergency share link revoked successfully. First responders can no longer access this profile with this QR code.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to revoke link' });
  }
});

// -------------------------------------------------------------
// CONSENT: patient-managed access grants
// -------------------------------------------------------------
// Reads and writes the shared `accessgrants` collection that the web backend
// checks before showing a patient's record to a provider. Statuses:
//   pending  — a provider asked; no access until the patient approves
//   active   — access allowed until expiresAt
//   rejected / revoked / expired — no access
const GRANT_CATEGORIES = [
  'vitals', 'medications', 'allergies', 'diagnoses', 'lab-results',
  'radiology', 'procedures', 'immunizations', 'vision',
];

const consentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many consent changes. Please try again later.' },
});

// A grant whose end time has passed no longer gives access, even if a
// cleanup job has not flipped its stored status yet.
function effectiveGrantStatus(g: any): string {
  if (g.status === 'active' && g.expiresAt && new Date(g.expiresAt).getTime() <= Date.now()) {
    return 'expired';
  }
  return g.status;
}

function normalizeGrant(g: any, names: Map<string, string>) {
  const orgId = g.granteeOrganizationId || g.granteeUserId || g.requestedBy;
  return {
    id: String(g._id),
    status: effectiveGrantStatus(g),
    granteeType: g.granteeType,
    granteeName:
      g.granteeType === 'link'
        ? 'Share link'
        : (orgId && names.get(String(orgId))) || 'Provider',
    accessScope: g.accessScope,
    category: g.category || null,
    recordFrom: g.recordFrom || null,
    recordTo: g.recordTo || null,
    startsAt: g.startsAt || null,
    expiresAt: g.expiresAt || null,
    permissions: {
      view: g.permissions?.view !== false,
      download: !!g.permissions?.download,
      reshare: !!g.permissions?.reshare,
      write: !!g.permissions?.write,
    },
    purpose: g.purpose || null,
    // Whether a provider started this request (true) or the patient shared
    // on their own (false).
    requestedByProvider: !!g.requestedBy,
    rejectionReason: g.rejectionReason || null,
    createdAt: g.createdAt,
    reviewedAt: g.reviewedAt || null,
    revokedAt: g.revokedAt || null,
  };
}

// Loads a grant only if it belongs to the caller's own profile(s).
async function ownGrant(authUserId: string, id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  const profileIds = await callerProfileIds(authUserId);
  if (!profileIds.length) return null;
  return AccessGrant.findOne({ _id: new mongoose.Types.ObjectId(id), patientId: { $in: profileIds } });
}

async function respondWithGrant(res: Response, grant: any) {
  const names = await organizationNames([grant.granteeOrganizationId, grant.granteeUserId, grant.requestedBy]);
  return res.json({ success: true, grant: normalizeGrant(grant, names) });
}

// GET /api/v1/access/grants — everything the caller has shared or been asked
// to share, newest first. Share-link (QR) grants are listed without tokens.
app.get('/api/v1/access/grants', async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Database unavailable' });
  }
  try {
    const profileIds = await callerProfileIds(authUserId);
    if (!profileIds.length) return res.json({ success: true, grants: [] });
    const docs: any[] = await AccessGrant.find({ patientId: { $in: profileIds } })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    const names = await organizationNames(
      docs.flatMap((g) => [g.granteeOrganizationId, g.granteeUserId, g.requestedBy])
    );
    return res.json({ success: true, grants: docs.map((g) => normalizeGrant(g, names)) });
  } catch (err) {
    console.error('[GET /access/grants] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Failed to load consent grants' });
  }
});

// POST /api/v1/access/grants/code — sends the signed-in patient a one-time
// code (email if the account has one, otherwise SMS). The code must be sent
// back with POST /access/grants to confirm the share.
const shareCodeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many confirmation codes requested. Try again later.' },
});

function maskContact(value: string): string {
  if (value.includes('@')) {
    const [name, domain] = value.split('@');
    return `${name.slice(0, 2)}***@${domain}`;
  }
  return `${value.slice(0, 4)}***${value.slice(-2)}`;
}

app.post('/api/v1/access/grants/code', shareCodeLimiter, async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (!mongoose.isValidObjectId(authUserId) || mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Database unavailable' });
  }
  try {
    const account: any = await Account.findById(authUserId).select('email phoneNumber phone').lean();
    const email: string | undefined = account?.email;
    const phone: string | undefined = account?.phoneNumber || account?.phone;
    if (!email && !phone) {
      return res.status(404).json({ success: false, message: 'No email or phone number on your account to send a code to' });
    }

    const code = generateOtp(`consent:${authUserId}`);
    const text = `Your WelliRecord code to confirm sharing your health record is ${code}. Valid for 5 minutes. Do not share it with anyone.`;

    if (email) {
      const result = await sendWelliEmail({
        to: email,
        subject: 'Confirm sharing your WelliRecord',
        text,
        html: `<p>${text}</p><p>If you did not start this, ignore this message and do not share the code.</p>`,
      });
      if (!result.success) {
        console.error('[POST /access/grants/code] email failed:', result.error);
        return res.status(502).json({ success: false, message: 'We could not send the confirmation code. Try again.' });
      }
      return res.json({ success: true, channel: 'email', sentTo: maskContact(email), expiresInSeconds: 300 });
    }

    if (!TERMII_API_KEY || TERMII_API_KEY === 'TL_TEST_KEY') {
      return res.status(502).json({ success: false, message: 'SMS is not available. Add an email to your account.' });
    }
    const response = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TERMII_API_KEY,
        to: String(phone).replace(/[^0-9]/g, ''),
        from: 'N-Alert',
        sms: text,
        type: 'plain',
        channel: 'dnd',
      }),
    });
    const data: any = await response.json();
    if (data.code === 'ok' || data.message?.includes('Successfully')) {
      return res.json({ success: true, channel: 'sms', sentTo: maskContact(String(phone)), expiresInSeconds: 300 });
    }
    console.error('[POST /access/grants/code] SMS Rejected', response.status, JSON.stringify(data));
    return res.status(502).json({ success: false, message: 'We could not send the confirmation code. Try again.' });
  } catch (err) {
    console.error('[POST /access/grants/code] ERROR:', err);
    return res.status(502).json({ success: false, message: 'We could not send the confirmation code. Try again.' });
  }
});

// POST /api/v1/access/grants — the patient shares with an organization.
// Body: { granteeOrganizationId (id or WR-ORG id), accessScope: 'full-record'
// | 'category', category?, durationDays?, purpose? }. View-only.
app.post('/api/v1/access/grants', consentLimiter, async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Database unavailable' });
  }

  const { granteeOrganizationId, accessScope, category, durationDays, purpose, code } = req.body || {};
  if (typeof granteeOrganizationId !== 'string' || !granteeOrganizationId.trim()) {
    return res.status(400).json({ success: false, message: 'Choose a provider to share with' });
  }
  if (accessScope !== 'full-record' && accessScope !== 'category') {
    return res.status(400).json({ success: false, message: 'Choose what to share' });
  }
  if (accessScope === 'category' && !GRANT_CATEGORIES.includes(category)) {
    return res.status(400).json({ success: false, message: 'Choose a valid record category' });
  }
  const days = durationDays === undefined ? 7 : Number(durationDays);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return res.status(400).json({ success: false, message: 'Duration must be between 1 and 365 days' });
  }
  if (purpose !== undefined && (typeof purpose !== 'string' || purpose.length > 300)) {
    return res.status(400).json({ success: false, message: 'Purpose must be 300 characters or fewer' });
  }
  // Sharing needs the one-time code sent by POST /access/grants/code.
  if (typeof code !== 'string' || !verifyStoredOtp(`consent:${authUserId}`, code.trim())) {
    return res.status(400).json({ success: false, message: 'Invalid or expired confirmation code' });
  }

  try {
    const profileIds = await callerProfileIds(authUserId);
    if (!profileIds.length) {
      return res.status(404).json({ success: false, message: 'Complete your profile before sharing records' });
    }
    const wanted = granteeOrganizationId.trim();
    const org: any = await OrganizationProfile.findOne(
      mongoose.isValidObjectId(wanted) ? { _id: wanted } : { wrOrgId: wanted },
      'organizationName'
    ).lean();
    if (!org) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    const now = new Date();
    const existing = await AccessGrant.findOne({
      patientId: profileIds[0],
      granteeType: 'organization',
      granteeOrganizationId: org._id,
      accessScope,
      category: accessScope === 'category' ? category : null,
      status: 'active',
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `You already share this with ${org.organizationName}. Revoke it first to change it.`,
      });
    }

    const grant = await AccessGrant.create({
      patientId: profileIds[0],
      grantedBy: new mongoose.Types.ObjectId(authUserId),
      granteeType: 'organization',
      granteeOrganizationId: org._id,
      accessScope,
      category: accessScope === 'category' ? category : null,
      startsAt: now,
      expiresAt: new Date(now.getTime() + days * 24 * 60 * 60 * 1000),
      permissions: { view: true, download: false, reshare: false, write: false },
      purpose: typeof purpose === 'string' && purpose.trim() ? purpose.trim() : null,
      status: 'active',
      reviewedAt: now,
    });
    const names = new Map<string, string>([[String(org._id), org.organizationName]]);
    return res.status(201).json({ success: true, grant: normalizeGrant(grant, names) });
  } catch (err) {
    console.error('[POST /access/grants] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Failed to create the consent grant' });
  }
});

// POST /api/v1/access/grants/:id/approve — pending request -> active.
// Optional body { durationDays } overrides the requested duration.
app.post('/api/v1/access/grants/:id/approve', consentLimiter, async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  try {
    const grant: any = await ownGrant(authUserId, String(req.params.id));
    if (!grant) return res.status(404).json({ success: false, message: 'Consent request not found' });
    if (grant.status !== 'pending') {
      return res.status(409).json({ success: false, message: `A ${effectiveGrantStatus(grant)} request cannot be approved` });
    }
    const now = new Date();
    let expiresAt: Date;
    if (req.body?.durationDays !== undefined) {
      const days = Number(req.body.durationDays);
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        return res.status(400).json({ success: false, message: 'Duration must be between 1 and 365 days' });
      }
      expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    } else if (grant.expiresAt && new Date(grant.expiresAt).getTime() > now.getTime()) {
      expiresAt = new Date(grant.expiresAt);
    } else {
      expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    grant.status = 'active';
    grant.startsAt = now;
    grant.expiresAt = expiresAt;
    grant.reviewedAt = now;
    grant.grantedBy = new mongoose.Types.ObjectId(authUserId);
    await grant.save();
    return respondWithGrant(res, grant);
  } catch (err) {
    console.error('[POST /access/grants/:id/approve] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Failed to approve the request' });
  }
});

// POST /api/v1/access/grants/:id/reject — pending request -> rejected.
app.post('/api/v1/access/grants/:id/reject', consentLimiter, async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  const reason = req.body?.reason;
  if (reason !== undefined && (typeof reason !== 'string' || reason.length > 500)) {
    return res.status(400).json({ success: false, message: 'Reason must be 500 characters or fewer' });
  }
  try {
    const grant: any = await ownGrant(authUserId, String(req.params.id));
    if (!grant) return res.status(404).json({ success: false, message: 'Consent request not found' });
    if (grant.status !== 'pending') {
      return res.status(409).json({ success: false, message: `A ${effectiveGrantStatus(grant)} request cannot be rejected` });
    }
    grant.status = 'rejected';
    grant.reviewedAt = new Date();
    grant.rejectionReason = typeof reason === 'string' && reason.trim() ? reason.trim() : null;
    await grant.save();
    return respondWithGrant(res, grant);
  } catch (err) {
    console.error('[POST /access/grants/:id/reject] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Failed to reject the request' });
  }
});

// POST /api/v1/access/grants/:id/revoke — ends future access immediately.
app.post('/api/v1/access/grants/:id/revoke', consentLimiter, async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  try {
    const grant: any = await ownGrant(authUserId, String(req.params.id));
    if (!grant) return res.status(404).json({ success: false, message: 'Consent grant not found' });
    if (grant.status === 'revoked') return respondWithGrant(res, grant);
    if (grant.status !== 'active' && grant.status !== 'pending') {
      return res.status(409).json({ success: false, message: `A ${effectiveGrantStatus(grant)} grant cannot be revoked` });
    }
    grant.status = 'revoked';
    grant.revokedAt = new Date();
    grant.revokedBy = new mongoose.Types.ObjectId(authUserId);
    await grant.save();
    return respondWithGrant(res, grant);
  } catch (err) {
    console.error('[POST /access/grants/:id/revoke] ERROR:', err);
    return res.status(500).json({ success: false, message: 'Failed to revoke access' });
  }
});

// Account Deletion Endpoint (NDPR Right to Erasure)
app.delete('/api/v1/auth/account', async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  try {
    let decoded: any = null;
    if (token) {
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch {}
    }

    const userId = decoded?.userId || decoded?.id;
    const email = decoded?.email || req.body?.email;
    const phoneNumber = decoded?.phoneNumber || req.body?.phoneNumber || req.body?.phone;

    let deletedSomething = false;
    let erasedEmail: string | undefined = typeof email === 'string' ? email : undefined;

    if (mongoose.connection.readyState === 1) {
      let targetUser: any = null;
      let targetAccount: any = null;

      // 1. Resolve by userId / accountId (supports both User model and Account model where _id === userId)
      if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        targetUser = await User.findById(userId);
        targetAccount = await Account.findById(userId);
      }

      // 2. Fallback lookup by email
      if (!targetUser && !targetAccount && email) {
        const cleanEmail = email.toLowerCase().trim();
        targetUser = await User.findOne({ email: cleanEmail });
        targetAccount = await Account.findOne({ email: cleanEmail });
      }

      // 3. Fallback lookup by phone number
      if (!targetUser && !targetAccount && phoneNumber) {
        const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
        const normalizedE164 = normalizeNigerianPhone(phoneNumber);
        const normalizedLocal = toLocalNigerianPhone(phoneNumber);
        targetAccount = await Account.findOne({
          $or: [
            ...(normalizedLocal ? [{ phone: normalizedLocal }, { phoneNumber: normalizedLocal }] : []),
            ...(normalizedE164 ? [{ phone: normalizedE164 }, { phoneNumber: normalizedE164 }] : []),
            ...(phoneNumber ? [{ phone: phoneNumber }, { phoneNumber: phoneNumber }] : []),
            ...(cleanPhone ? [{ phone: cleanPhone }, { phoneNumber: cleanPhone }] : []),
          ],
        });
        if (!targetAccount) {
          targetUser = await User.findOne({
            $or: [
              ...(normalizedE164 ? [{ phoneNumber: normalizedE164 }] : []),
              ...(normalizedLocal ? [{ phoneNumber: normalizedLocal }] : []),
              ...(cleanPhone ? [{ phoneNumber: cleanPhone }] : []),
            ],
          });
        }
      }

      // Collect all candidate ObjectIds associated with this identity
      erasedEmail = targetUser?.email || targetAccount?.email || erasedEmail;
      const candidateIds: any[] = [];
      if (userId && mongoose.Types.ObjectId.isValid(userId)) candidateIds.push(new mongoose.Types.ObjectId(userId));
      if (targetUser?._id) candidateIds.push(targetUser._id);
      if (targetAccount?._id) candidateIds.push(targetAccount._id);

      if (targetUser || targetAccount || candidateIds.length > 0) {
        let deletedUser = null;
        let deletedAccount = null;

        if (targetUser?._id) {
          deletedUser = await User.findByIdAndDelete(targetUser._id);
        } else if (userId && mongoose.Types.ObjectId.isValid(userId)) {
          deletedUser = await User.findByIdAndDelete(userId);
        }

        if (targetAccount?._id) {
          deletedAccount = await Account.findByIdAndDelete(targetAccount._id);
        } else if (userId && mongoose.Types.ObjectId.isValid(userId)) {
          deletedAccount = await Account.findByIdAndDelete(userId);
        }

        deletedSomething = Boolean(deletedUser || deletedAccount);

        // Delete all associated patient vault records across both models (UserProfile uses accountId, HealthRecord uses userId/familyMemberId)
        if (candidateIds.length > 0) {
          await Profile.deleteMany({ $or: [{ userId: { $in: candidateIds } }, { accountId: { $in: candidateIds } }] });
          await UserProfile.deleteMany({ $or: [{ accountId: { $in: candidateIds } }, { userId: { $in: candidateIds } }] });
          await eraseWebLinks(candidateIds); // the link to the website account, on both sides
          {
            const ownMembers: any[] = await FamilyMember.find({ $or: [{ accountId: { $in: candidateIds } }, { userId: { $in: candidateIds } }] }, { _id: 1 }).lean();
            await eraseSelfReported(candidateIds, ownMembers.map((m) => m._id)); // measurements, medications and family history entered by hand
          }
          await eraseChildData(candidateIds); // children's vaccines, growth, guardians, logs, clinic codes, reminders
          await FamilyMember.deleteMany({ $or: [{ accountId: { $in: candidateIds } }, { userId: { $in: candidateIds } }] });
          await HealthRecord.deleteMany({ $or: [{ userId: { $in: candidateIds } }, { familyMemberId: { $in: candidateIds } }] });
          await RecordFile.deleteMany({ $or: [{ uploadedBy: { $in: candidateIds } }, { ownerId: { $in: candidateIds } }] });
          await Prescription.deleteMany({ $or: [{ accountId: { $in: candidateIds } }, { userId: { $in: candidateIds } }, { familyMemberId: { $in: candidateIds } }] });
          await ShareGrant.deleteMany({ $or: [{ accountId: { $in: candidateIds } }, { userId: { $in: candidateIds } }] });
          await AccessAuditLog.deleteMany({ $or: [{ accountId: { $in: candidateIds } }, { userId: { $in: candidateIds } }] });
        }
      }
    }

    if (!deletedSomething) {
      console.error('[DELETE /auth/account] No account found to delete. userId:', userId, 'email:', email, 'phoneNumber:', phoneNumber);
      return res.status(404).json({
        success: false,
        message: 'No account found to delete.',
      });
    }

    // Sign-in identity at Clerk (Google/Apple). Best effort: the local data is already gone.
    const signInIdentity = await deleteClerkIdentity(typeof erasedEmail === 'string' ? erasedEmail : undefined);
    if (signInIdentity === 'failed') console.error('[DELETE /auth/account] Could not remove the Clerk identity for an erased account');

    return res.json({
      success: true,
      signInIdentity,
      message: 'Account and associated patient vault records successfully erased in compliance with NDPR.',
    });
  } catch (err: any) {
    console.error('[DELETE /auth/account] Error during account erasure:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to delete account' });
  }
});

// 7b. Chatbot Assistant Endpoints

// Maps this backend's actual role values to a chatbot audience.
// Adjust the role list to match whatever roles exist on the User/Account model —
// server.ts already signs tokens with role: 'patient' for patient accounts;
// fill in the real provider/staff role name(s) once confirmed.
function resolveAudience(decodedToken: any): 'patient' | 'provider' {
  const role = decodedToken?.role;
  if (role && role !== 'patient') return 'provider';
  return 'patient';
}

function getAuthAudience(req: Request): 'patient' | 'provider' {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return 'patient';
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return resolveAudience(decoded);
  } catch {
    return 'patient';
  }
}

app.post(['/api/v1/chatbot/open', '/chatbot/open'], async (req: Request, res: Response) => {
  const audience = getAuthAudience(req);
  const rootKey = audience === 'provider' ? 'provider_start_over' : 'start_over';

  try {
    if (mongoose.connection.readyState === 1) {
      const root = await ChatIntent.findOne({ intentKey: rootKey, audience });
      if (root) {
        return res.json({ message: root.message, options: root.options, audience: root.audience });
      }
    }
  } catch (err) {
    console.error('[Chatbot Open Error]', err);
  }

  // Fallback — patient menu only, same as before. Provider fallback isn't
  // hardcoded here; if the DB is unreachable, provider users see the patient
  // fallback menu rather than nothing. Acceptable for now, revisit if it matters.
  return res.json({
    message: 'Hello! I am your WelliRecord Health Assistant. How can I help you manage your records today?',
    options: [
      { label: 'Share my medical records', nextIntentKey: 'share_records' },
      { label: 'Find a hospital or doctor', nextIntentKey: 'find_care' },
      { label: 'Prescription & pharmacy refill', nextIntentKey: 'refill_rx' },
      { label: 'Emergency ID & WelliBridge', nextIntentKey: 'emergency_id' }
    ],
    audience: 'patient'
  });
});

app.post(['/api/v1/chatbot/respond', '/chatbot/respond'], async (req: Request, res: Response) => {
  const { intentKey } = req.body || {};
  const audience = getAuthAudience(req);
  const rootKey = audience === 'provider' ? 'provider_start_over' : 'start_over';

  try {
    if (mongoose.connection.readyState === 1) {
      const flow = await ChatIntent.findOne({ intentKey: intentKey || rootKey });
      if (flow) {
        return res.json({ message: flow.message, options: flow.options, audience: flow.audience });
      }
    }
  } catch (err) {
    console.error('[Chatbot Respond Error]', err);
  }

  return res.json({
    message: 'Hello! I am your WelliRecord Health Assistant. How can I help you manage your records today?',
    options: [
      { label: 'Share my medical records', nextIntentKey: 'share_records' },
      { label: 'Find a hospital or doctor', nextIntentKey: 'find_care' },
      { label: 'Prescription & pharmacy refill', nextIntentKey: 'refill_rx' },
      { label: 'Emergency ID & WelliBridge', nextIntentKey: 'emergency_id' }
    ],
    audience: 'patient'
  });
});

// Tells the patient when a facility confirms or cancels an appointment request.
// The facility changes the status elsewhere (web console), so this sweeps for
// changes. Only requests updated in the last 2 days are considered.
async function sweepAppointmentStatusNotifications() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const changed: any[] = await AppointmentRequest.find({
      status: { $in: ['confirmed', 'cancelled'] },
      updatedAt: { $gte: since },
      $expr: { $ne: [{ $ifNull: ['$notifiedStatus', ''] }, '$status'] },
    }).limit(50);
    for (const appt of changed) {
      const claimed = await AppointmentRequest.updateOne(
        { _id: appt._id, status: appt.status, notifiedStatus: appt.notifiedStatus ?? null },
        { $set: { notifiedStatus: appt.status } }
      );
      if (!claimed.modifiedCount) continue;
      const me = await accountContact(String(appt.accountId));
      await notifyStatus(appointmentChannels(String(appt.accountId), String(appt._id)), appt, appt.status as 'confirmed' | 'cancelled', me);
    }
  } catch (err) {
    console.warn('[Appointment sweep] failed:', err);
  }
}
setInterval(sweepAppointmentStatusNotifications, 60 * 1000).unref();
if (mongoose.connection.readyState === 1) loadSessionRevocations();
else mongoose.connection.once('open', () => { loadSessionRevocations(); });
setInterval(loadSessionRevocations, 60 * 1000).unref();

// 8. Start Server
app.listen(PORT, () => {
  console.log(`[WelliRecord API] Cloud server running with MongoDB on port ${PORT}`);
});

export { app, otpCache, verifyStoredOtp, generateOtp };
export default app;

