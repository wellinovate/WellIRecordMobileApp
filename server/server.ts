/**
 * WelliRecord Production MongoDB API Reference Server
 * Node.js / Express backend with Mongoose, Termii SMS Gateway & NDPR Compliant Endpoints.
 */

import crypto from 'crypto';
import express, { Request, Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import {
  User,
  Account,
  Profile,
  UserProfile,
  FamilyMember,
  HealthRecord,
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
} from './models';

const app = express();
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wellirecord';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required — refusing to start without it.');
}
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
app.use(express.json());

// Rate limiters for auth OTP endpoints and OCR document processing
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // 5 requests per 10 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many verification code requests from this IP. Please try again after 10 minutes.' },
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
function getAuthUserId(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded: any = jwt.verify(authHeader.substring(7), JWT_SECRET);
      return decoded.userId || decoded.id || null;
    } catch {
      return null;
    }
  }
  return null;
}

// Verify that the authenticated caller owns the target account or dependent
async function callerCanAccessOwner(authUserId: string, targetOwnerId: string): Promise<boolean> {
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
  return Boolean(isDependent);
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

// WelliRecord ID Generator (Format: WR-XXXX-XXXX)
function generateWelliRecordId(): string {
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const timestamp = Date.now().toString().slice(-4);
  return `WR-${timestamp}-${random}`;
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
            termiiResponse: data,
            expiresInSeconds: 300,
          });
        }
      } catch (smsErr) {
        console.error('[SMS Error]', smsErr);
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

async function sendWelliEmail({ to, subject, html, text, from }: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: any }> {
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
        return { success: true, messageId: data.id };
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
        return { success: true, messageId: `sg_${Date.now()}` };
      }
    } catch (e: any) {
      console.error('[EMAIL SENDGRID ERROR]', e.message);
    }
  }

  // 3. Fallback / Development Dispatch Logger
  console.log(`[EMAIL DISPATCHED TO ${to}] Subject: "${subject}"`);
  return { success: true, messageId: `msg_${Date.now()}` };
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
    return res.status(500).json({ success: false, message: 'Failed to send verification email', error: err.message });
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
    return res.status(500).json({ success: false, message: 'Notification dispatch error', error: err.message });
  }
});

// 3. Verify OTP & Issue JWT (Supports Phone or Email verification with MongoDB user lookup)
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
  const REVIEWER_ACCOUNTS = new Set([
    'appstore.review@wellirecord.com',
    'googleplay.reviewer@wellirecord.com',
    '09062002094',
    '+2349062002094',
    '2349062002094',
  ]);
  const isReviewerBypass = Boolean(
    reviewerOtp &&
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
        });
        await account.save();
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
            wrId: legacyProfile.memberId || generateWelliRecordId(),
          });
          await profile.save();
        }
      }

      // If still no profile exists, create a genuine UserProfile document with wrId and passed signup data
      if (!profile) {
        const newWrId = generateWelliRecordId();
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
        if (!profile.wrId) { profile.wrId = generateWelliRecordId(); updated = true; }
        if (updated) {
          await profile.save();
          console.log('[USERPROFILE UPDATED ON VERIFY]', profile._id);
        }
      }
    }

    const userId = user._id.toString();
    const phone = user.phoneNumber || user.phone || phoneNumber || '';
    const userEmail = user.email || profile?.email || cleanEmail || null;
    const token = jwt.sign({ userId, phoneNumber: phone, email: userEmail, role: 'patient' }, JWT_SECRET, { expiresIn: '30d' });

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
    return res.status(500).json({ success: false, message: 'Authentication error', error: err });
  }
});

// 3c. Social Sign-In (Google / Apple via Clerk) — finds or creates a real
// Account + UserProfile from a verified identity. Never fabricates a
// fallback user; email is required since that's the reliable match key
// across web and mobile.
app.post('/api/v1/auth/social/verify', async (req: Request, res: Response) => {
  const { provider, email, fullName } = req.body;

  if (!provider || !email) {
    return res.status(400).json({ success: false, message: 'Provider and email are required' });
  }
  if (!['google', 'apple'].includes(provider)) {
    return res.status(400).json({ success: false, message: 'Unsupported provider' });
  }

  const cleanEmail = email.toLowerCase().trim();

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
      isNewAccount = true;
      console.log('[NEW ACCOUNT CREATED VIA SOCIAL AUTH]', account._id, resolvedName, provider);
    }

    let profile = await UserProfile.findOne({
      $or: [{ accountId: account._id }, { email: cleanEmail }],
    });

    if (!profile) {
      profile = new UserProfile({
        accountId: account._id,
        fullName: account.fullName,
        email: cleanEmail,
        wrId: generateWelliRecordId(),
        authProvider: `${provider}_oauth`,
        isEmailVerified: true,
        bloodType: 'O+',
        genotype: 'AA',
      });
      await profile.save();
    } else if (!profile.wrId) {
      profile.wrId = generateWelliRecordId();
      await profile.save();
    }

    const userId = account._id.toString();
    const token = jwt.sign({ userId, email: cleanEmail, role: 'patient' }, JWT_SECRET, { expiresIn: '30d' });

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
    return res.status(500).json({ success: false, message: 'Social authentication error', error: err });
  }
});

// 3d. Update Patient Profile (writes directly to shared 'userprofiles' collection)
app.post(['/api/v1/profile/update', '/profile/update'], async (req: Request, res: Response) => {
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
  } = req.body;

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
        wrId: wrId || memberId || generateWelliRecordId(),
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
      if (!profile.wrId) {
        profile.wrId = wrId || memberId || generateWelliRecordId();
      }

      await profile.save();
    }

    return res.json({ success: true, message: 'Profile updated successfully', profile });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update profile', error: err });
  }
});

// 3e. Fetch Current Patient Profile (reads from shared 'userprofiles' collection)
app.get(['/api/v1/profile/me', '/api/v1/profile'], async (req: Request, res: Response) => {
  try {
    const authUserId = getAuthUserId(req);
    if (!authUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { userId, accountId } = req.query;
    const targetAccountId = (accountId || userId || authUserId) as string;

    const canAccess = await callerCanAccessOwner(authUserId, targetAccountId);
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
            wrId: legacyProfile.memberId || generateWelliRecordId(),
          });
          await profile.save();
        }
      }

      if (profile && !profile.wrId) {
        profile.wrId = generateWelliRecordId();
        await profile.save();
      }
    }

    return res.json({
      success: true,
      profile: profile || null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch profile', error: err });
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
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch family members', error: err });
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
        createdAt: savedMember.createdAt || new Date(),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to add family member', error: err });
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
    } = req.body;

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

    await member.save();
    return res.json({
      success: true,
      message: 'Family member updated successfully',
      member,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update family member', error: err });
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
    return res.status(500).json({ success: false, message: 'Failed to delete family member', error: err });
  }
});

// 3b. Sign In with Email / Phone and Password
app.post('/api/v1/auth/login', async (req: Request, res: Response) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ success: false, message: 'Email/phone and password required' });
  }

  try {
    let user = null;
    if (mongoose.connection.readyState === 1) {
      user = await User.findOne({
        $or: [{ email: identifier.toLowerCase().trim() }, { phoneNumber: identifier.trim() }],
      });
    }

    // No fallback to a fabricated account. No user, or no password on file,
    // or a mismatched password all return the same generic 401 — never
    // reveal which case it was, and never issue a token.
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

    const token = jwt.sign({ userId, email, role: 'patient' }, JWT_SECRET, { expiresIn: '30d' });

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
    return res.status(500).json({ success: false, message: 'Sign in error', error: err });
  }
});

// 3c. Register New Health Vault Account
app.post('/api/v1/auth/register', async (req: Request, res: Response) => {
  const { name, email, phone, password, dob, bloodType, genotype, insuranceProvider, insuranceId } = req.body;

  if (!name || (!email && !phone) || !password) {
    return res.status(400).json({ success: false, message: 'Name, email or phone, and password are required' });
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
        bloodType: bloodType || 'O+',
        genotype: genotype || 'AA',
        hmoProvider: insuranceProvider || null,
        hmoPolicyNumber: insuranceId || null,
        isPhoneVerified: true,
      });
    }

    if (!user) {
      return res.status(500).json({ success: false, message: 'Database unavailable' });
    }

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
    return res.status(500).json({ success: false, message: 'Registration error', error: err });
  }
});

// 4. Fetch Health Records (MongoDB)
app.get('/api/v1/records', async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const rawOwnerId = (req.query.ownerId as string | undefined) || authUserId;
  // 'me' shorthand resolves to the logged-in user's own account id
  const ownerId = rawOwnerId === 'me' ? authUserId : rawOwnerId;

  try {
    const canAccess = await callerCanAccessOwner(authUserId, ownerId);
    if (!canAccess) {
      return res.status(403).json({ success: false, message: 'Access denied to requested records' });
    }

    if (mongoose.connection.readyState === 1) {
      const records = await HealthRecord.find({ familyMemberId: ownerId }).sort({ createdAt: -1 });
      return res.json(records);
    }
    return res.json([]);
  } catch (err) {
    console.error('[GET /records] ERROR:', err);
    return res.status(500).json({ success: false, error: err });
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
    return res.status(500).json({ success: false, error: err });
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
    return res.status(500).json({ success: false, error: err });
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
    return res.status(500).json({ success: false, error: err });
  }
});

// GET /api/v1/lab-documents/proxy — streams Cloudinary attachment with inline disposition
app.get('/api/v1/lab-documents/proxy', async (req: Request, res: Response) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string' || !url.startsWith('https://res.cloudinary.com/')) {
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
    const canAccess = await callerCanAccessOwner(authUserId, ownerId);
    if (!canAccess) {
      return res.status(403).json({ success: false, message: 'Access denied to requested prescriptions' });
    }

    if (mongoose.connection.readyState === 1) {
      const rxs = await Prescription.find({ familyMemberId: ownerId }).sort({ createdAt: -1 });
      return res.json(rxs);
    }
    return res.json([]);
  } catch (err) {
    console.error('[GET /pharmacy/prescriptions] ERROR:', err);
    return res.status(500).json({ success: false, error: err });
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
    return res.status(500).json({ success: false, message: 'Failed to create medication order', error: err });
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

// Simple shared-secret admin auth — no staff/role system exists yet.
// Protects the pending-order review endpoints only. Replace with real
// staff accounts + RBAC once that system is built.
function requireAdminSecret(req: Request, res: Response, next: () => void) {
  const provided = req.headers['x-admin-secret'];
  const expected = process.env.ADMIN_SECRET;
  if (!expected) {
    return res.status(503).json({ success: false, message: 'Admin review is not configured yet.' });
  }
  const providedBuf = Buffer.from(String(provided || ''));
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
  }
  next();
}

// GET /api/v1/pharmacy/orders/pending — list all patient-initiated
// orders awaiting review, most recent first.
app.get('/api/v1/pharmacy/orders/pending', requireAdminSecret, async (req: Request, res: Response) => {
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
    return res.status(500).json({ success: false, message: 'Failed to fetch pending orders', error: err });
  }
});

// POST /api/v1/pharmacy/orders/:id/approve — moves an order to 'active'
// so it enters the normal dispatch/refill flow. Optionally accepts
// pricing fields to populate at approval time.
app.post('/api/v1/pharmacy/orders/:id/approve', requireAdminSecret, async (req: Request, res: Response) => {
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
    return res.status(500).json({ success: false, message: 'Failed to approve order', error: err });
  }
});

// POST /api/v1/pharmacy/orders/:id/reject — marks an order rejected
// with a reason, and notifies the patient why.
app.post('/api/v1/pharmacy/orders/:id/reject', requireAdminSecret, async (req: Request, res: Response) => {
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
    return res.status(500).json({ success: false, message: 'Failed to reject order', error: err });
  }
});

// Minimal internal admin page for reviewing patient-initiated medication
// orders. No staff/role system exists yet — gated by the same
// ADMIN_SECRET used by the /pharmacy/orders/* endpoints. Not linked from
// anywhere in the app; access this directly at /admin/orders.
app.get('/admin/orders', (_req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WelliRecord — Order Review</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F8FAFC; margin: 0; padding: 24px; color: #0F172A; }
  .container { max-width: 720px; margin: 0 auto; }
  h1 { font-size: 20px; font-weight: 800; margin-bottom: 4px; }
  .sub { color: #64748B; font-size: 13px; margin-bottom: 24px; }
  #authGate { background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
  #authGate input { width: 100%; padding: 10px 12px; border: 1px solid #E2E8F0; border-radius: 8px; font-size: 14px; margin-bottom: 10px; }
  #authGate button { background: #041E42; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 14px; }
  #authError { color: #DC2626; font-size: 13px; margin-top: 8px; display: none; }
  #ordersSection { display: none; }
  .order-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 14px; padding: 16px; margin-bottom: 14px; }
  .order-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
  .med-name { font-size: 15px; font-weight: 800; }
  .meta { font-size: 12px; color: #64748B; margin-top: 3px; }
  .status-badge { background: #FEF3C7; color: #92400E; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 999px; white-space: nowrap; }
  .field-row { font-size: 12.5px; color: #334155; margin: 3px 0; }
  .field-row b { color: #0F172A; }
  .actions { display: flex; gap: 8px; margin-top: 14px; }
  .actions button { flex: 1; padding: 10px; border-radius: 10px; border: none; font-weight: 700; font-size: 13px; cursor: pointer; }
  .approve-btn { background: #059669; color: #fff; }
  .reject-btn { background: #fff; color: #DC2626; border: 1.5px solid #FECACA !important; }
  .empty { text-align: center; color: #94A3B8; padding: 60px 0; font-size: 14px; }
  .msg { font-size: 13px; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; display: none; }
  .msg.success { background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; }
  .msg.error { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; }
  #refreshBtn { background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 12.5px; cursor: pointer; margin-bottom: 16px; }
</style>
</head>
<body>
<div class="container">
  <h1>Medication Order Review</h1>
  <div class="sub">Internal tool — orders pending pharmacist approval</div>

  <div id="authGate">
    <input type="password" id="secretInput" placeholder="Enter admin secret">
    <button onclick="authenticate()">Unlock</button>
    <div id="authError">Invalid admin credentials.</div>
  </div>

  <div id="ordersSection">
    <div id="msg" class="msg"></div>
    <button id="refreshBtn" onclick="loadOrders()">↻ Refresh</button>
    <div id="ordersList"></div>
  </div>
</div>

<script>
  let ADMIN_SECRET = '';

  async function authenticate() {
    const secret = document.getElementById('secretInput').value.trim();
    if (!secret) return;
    try {
      const res = await fetch('/api/v1/pharmacy/orders/pending', {
        headers: { 'x-admin-secret': secret }
      });
      if (res.status === 401) {
        document.getElementById('authError').style.display = 'block';
        return;
      }
      ADMIN_SECRET = secret;
      document.getElementById('authGate').style.display = 'none';
      document.getElementById('ordersSection').style.display = 'block';
      loadOrders();
    } catch (err) {
      document.getElementById('authError').textContent = 'Could not reach server.';
      document.getElementById('authError').style.display = 'block';
    }
  }

  function showMsg(text, type) {
    const el = document.getElementById('msg');
    el.textContent = text;
    el.className = 'msg ' + type;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  }

  async function loadOrders() {
    const list = document.getElementById('ordersList');
    list.innerHTML = '<div class="empty">Loading…</div>';
    try {
      const res = await fetch('/api/v1/pharmacy/orders/pending', {
        headers: { 'x-admin-secret': ADMIN_SECRET }
      });
      const data = await res.json();
      const orders = data.orders || [];
      if (orders.length === 0) {
        list.innerHTML = '<div class="empty">No orders pending review.</div>';
        return;
      }
      list.innerHTML = orders.map(renderOrder).join('');
    } catch (err) {
      list.innerHTML = '<div class="empty">Failed to load orders.</div>';
    }
  }

  function renderOrder(o) {
    const created = o.createdAt ? new Date(o.createdAt).toLocaleString() : '';
    return \`
      <div class="order-card">
        <div class="order-top">
          <div>
            <div class="med-name">\${escapeHtml(o.medicationName || 'Unnamed medication')}</div>
            <div class="meta">Submitted \${created}</div>
          </div>
          <div class="status-badge">PENDING REVIEW</div>
        </div>
        <div class="field-row"><b>Dosage:</b> \${escapeHtml(o.dosage || '—')}</div>
        <div class="field-row"><b>Quantity:</b> \${o.quantity || 1}</div>
        <div class="field-row"><b>Delivery:</b> \${escapeHtml(o.deliveryAddress || '—')} (\${escapeHtml(o.deliveryType || 'home')})</div>
        \${o.notes ? '<div class="field-row"><b>Notes:</b> ' + escapeHtml(o.notes) + '</div>' : ''}
        <div class="actions">
          <button class="approve-btn" onclick="approveOrder('\${o._id}')">Approve</button>
          <button class="reject-btn" onclick="rejectOrder('\${o._id}')">Reject</button>
        </div>
      </div>
    \`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function approveOrder(id) {
    if (!confirm('Approve this order? It will move to active status.')) return;
    try {
      const res = await fetch('/api/v1/pharmacy/orders/' + id + '/approve', {
        method: 'POST',
        headers: { 'x-admin-secret': ADMIN_SECRET, 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        showMsg('Order approved.', 'success');
        loadOrders();
      } else {
        showMsg(data.message || 'Failed to approve.', 'error');
      }
    } catch (err) {
      showMsg('Network error approving order.', 'error');
    }
  }

  async function rejectOrder(id) {
    const reason = prompt('Reason for rejection (required):');
    if (!reason || !reason.trim()) return;
    try {
      const res = await fetch('/api/v1/pharmacy/orders/' + id + '/reject', {
        method: 'POST',
        headers: { 'x-admin-secret': ADMIN_SECRET, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (data.success) {
        showMsg('Order rejected.', 'success');
        loadOrders();
      } else {
        showMsg(data.message || 'Failed to reject.', 'error');
      }
    } catch (err) {
      showMsg('Network error rejecting order.', 'error');
    }
  }

  document.getElementById('secretInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') authenticate();
  });
</script>
</body>
</html>`);
});


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

app.post('/api/v1/records/ocr-extract', ocrLimiter, async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const { imageBase64, recordType } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ success: false, message: 'Image data is required' });
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
    return res.status(500).json({ success: false, message: 'Document scanning failed. Please try again.', error: err });
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
    return res.status(500).json({ success: false, error: err });
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

app.get(['/api/v1/care/providers', '/api/v1/providers'], async (_req: Request, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, providers: [] });
    }
    const orgs: any[] = await OrganizationProfile.find(
      {},
      // Explicit field projection — never pull unbounded fields like a
      // base64 logo blob into memory. Only what the directory needs.
      'wrOrgId organizationName organizationType officeAddress verificationStatus'
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
    }));
    return res.json({ success: true, providers });
  } catch (err) {
    console.error('[Provider Directory Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch provider directory' });
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

app.get('/api/v1/care/pharmacies', async (req: Request, res: Response) => {
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
    status: doc.status as string,
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
    status: map[doc.status] || String(doc.status || ''),
  };
}

// POST /api/v1/appointments/requests
app.post('/api/v1/appointments/requests', appointmentLimiter, async (req: Request, res: Response) => {
  const authUserId = getAuthUserId(req);
  if (!authUserId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (mongoose.connection.readyState !== 1 || !mongoose.isValidObjectId(authUserId)) {
    return res.status(503).json({ success: false, message: 'Database unavailable' });
  }

  const { facilityId, facilityName, facilityAddress, date, timeSlot, reason, familyMemberId } = req.body || {};
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
    if (familyMemberId && !(await callerCanAccessOwner(authUserId, String(familyMemberId)))) {
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
      status: 'requested',
    });
    return res.status(201).json({ success: true, appointment: normalizeAppointmentRequest(doc) });
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
      own.status = 'cancelled';
      await own.save();
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
    res.status(500).json({ success: false, error: err });
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
  const { twoFactorEnabled, email, phone } = req.body;
  const token = req.headers.authorization?.replace('Bearer ', '');

  try {
    let decoded: any = null;
    if (token) {
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch {}
    }

    const userId = decoded?.userId || decoded?.id;
    const targetEmail = decoded?.email || email;
    const targetPhone = decoded?.phoneNumber || phone;

    if (mongoose.connection.readyState === 1) {
      if (userId) {
        await User.findByIdAndUpdate(userId, { twoFactorEnabled: Boolean(twoFactorEnabled) });
        await Account.findByIdAndUpdate(userId, { twoFactorEnabled: Boolean(twoFactorEnabled) });
      } else if (targetEmail) {
        await User.findOneAndUpdate({ email: targetEmail }, { twoFactorEnabled: Boolean(twoFactorEnabled) });
        await Account.findOneAndUpdate({ email: targetEmail }, { twoFactorEnabled: Boolean(twoFactorEnabled) });
      } else if (targetPhone) {
        const normalized = normalizeNigerianPhone(targetPhone);
        await User.findOneAndUpdate({ phoneNumber: normalized }, { twoFactorEnabled: Boolean(twoFactorEnabled) });
        await Account.findOneAndUpdate({ phone: normalized }, { twoFactorEnabled: Boolean(twoFactorEnabled) });
      }
    }

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

  const { granteeOrganizationId, accessScope, category, durationDays, purpose } = req.body || {};
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
          await FamilyMember.deleteMany({ $or: [{ accountId: { $in: candidateIds } }, { userId: { $in: candidateIds } }] });
          await HealthRecord.deleteMany({ $or: [{ userId: { $in: candidateIds } }, { familyMemberId: { $in: candidateIds } }] });
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

    return res.json({
      success: true,
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

// 8. Start Server
app.listen(PORT, () => {
  console.log(`[WelliRecord API] Cloud server running with MongoDB on port ${PORT}`);
});

export { app, otpCache, verifyStoredOtp, generateOtp };
export default app;

