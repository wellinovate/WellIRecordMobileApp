// Staff accounts for the provider and operations side.
//
// Replaces the single shared ADMIN_SECRET. Each person has their own login, a
// role, and every staff action is logged against them. Staff tokens are signed
// with a different key from patient tokens, so one can never pass as the other.
//
// The old x-admin-secret header still works while ALLOW_LEGACY_ADMIN_SECRET is
// not 'false', so the web console and the /admin/orders page keep running until
// they move over. Each legacy call is logged. Set it to 'false' to switch it off.

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import express, { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { StaffActionLog, StaffRole, StaffUser } from './models';

export const STAFF_ROLES: StaffRole[] = ['admin', 'clinician', 'pharmacist', 'records_officer'];

/** What each role is for. Admin can do everything below. */
export const ROLE_DESCRIPTION: Record<StaffRole, string> = {
  admin: 'Manages staff accounts and can do anything below',
  clinician: 'Confirms vaccinations and posts visit summaries',
  pharmacist: 'Reviews and approves medication orders',
  records_officer: 'Confirms vaccinations, checks guardian identity, applies custody locks',
};

export interface StaffContext {
  id: string;
  name: string;
  role: StaffRole;
  organization?: string;
  legacy: boolean;
  mustChangePassword: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    staff?: StaffContext;
  }
}

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const TOKEN_HOURS = 8;

// ----- pure helpers (tested) -----

export function passwordProblem(password: unknown, email = ''): string | null {
  const p = typeof password === 'string' ? password : '';
  if (p.length < 12) return 'Use at least 12 characters';
  if (p.length > 128) return 'Use 128 characters or fewer';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Use letters and at least one number';
  if (email && p.toLowerCase().includes(email.split('@')[0].toLowerCase()) && email.split('@')[0].length >= 4) {
    return 'Do not include your email name in the password';
  }
  return null;
}

export function roleAllowed(role: StaffRole, allowed: StaffRole[]): boolean {
  return role === 'admin' || allowed.length === 0 || allowed.includes(role);
}

export function staffSigningKey(jwtSecret: string): string {
  return crypto.createHmac('sha256', jwtSecret).update('welli-staff-tokens-v1').digest('hex');
}

export function signStaffToken(jwtSecret: string, user: { id: string; role: StaffRole; tokenVersion: number }): string {
  return jwt.sign({ typ: 'staff', sid: user.id, role: user.role, tv: user.tokenVersion }, staffSigningKey(jwtSecret), {
    expiresIn: `${TOKEN_HOURS}h`,
  });
}

export function verifyStaffToken(jwtSecret: string, token: string): { sid: string; role: StaffRole; tv: number } | null {
  try {
    const d: any = jwt.verify(token, staffSigningKey(jwtSecret));
    if (d?.typ !== 'staff' || !d.sid) return null;
    return { sid: String(d.sid), role: d.role, tv: Number(d.tv) || 0 };
  } catch {
    return null;
  }
}

export function tempPassword(): string {
  // 16 characters, letters and digits, no look-alikes.
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(16);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${out.slice(0, 15)}7`;
}

// ----- factory -----

export interface StaffDeps {
  jwtSecret: string;
  limiter: RequestHandler;
}

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

export function createStaff(deps: StaffDeps) {
  const router = express.Router();

  const legacyAllowed = () => String(process.env.ALLOW_LEGACY_ADMIN_SECRET ?? 'true').toLowerCase() !== 'false';

  function legacySecretOk(req: Request): boolean {
    const expected = process.env.ADMIN_SECRET;
    const provided = req.headers['x-admin-secret'];
    if (!expected || !provided) return false;
    const a = Buffer.from(String(provided));
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  async function resolve(req: Request): Promise<StaffContext | { error: number; message: string } | null> {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      const decoded = verifyStaffToken(deps.jwtSecret, auth.substring(7));
      if (decoded) {
        const user: any = await StaffUser.findById(decoded.sid);
        if (!user || user.status !== 'active' || user.tokenVersion !== decoded.tv) {
          return { error: 401, message: 'Your session has ended. Sign in again.' };
        }
        return { id: String(user._id), name: user.name, role: user.role, organization: user.organization || undefined, legacy: false, mustChangePassword: user.mustChangePassword };
      }
    }
    if (req.headers['x-admin-secret']) {
      if (!process.env.ADMIN_SECRET) return { error: 503, message: 'Admin access is not configured yet.' };
      if (!legacyAllowed()) return { error: 401, message: 'The shared admin secret is switched off. Sign in with a staff account.' };
      if (!legacySecretOk(req)) return { error: 401, message: 'Invalid admin credentials.' };
      console.warn(`[STAFF] legacy x-admin-secret used for ${req.method} ${req.path}`);
      return { id: 'legacy-secret', name: 'Shared admin secret', role: 'admin', legacy: true, mustChangePassword: false };
    }
    return null;
  }

  /** Allows the listed roles. Admin always passes. Sets req.staff. */
  function requireStaff(...allowed: StaffRole[]): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const ctx = await resolve(req);
        if (!ctx) return res.status(401).json({ success: false, message: 'Staff sign-in required.' });
        if ('error' in ctx) return res.status(ctx.error).json({ success: false, message: ctx.message });
        if (ctx.mustChangePassword && !req.path.endsWith('/auth/change-password')) {
          return res.status(403).json({ success: false, message: 'Change your password before continuing.', code: 'password_change_required' });
        }
        if (!roleAllowed(ctx.role, allowed)) {
          return res.status(403).json({ success: false, message: 'Your role cannot do this.' });
        }
        req.staff = ctx;
        // Every change made by staff is logged against the person (reads are not).
        if (req.method !== 'GET') {
          void logAction(req, `${req.method} ${req.route?.path ?? req.path}`, req.params?.id);
        }
        return next();
      } catch (err) {
        console.error('[STAFF] auth error:', err);
        return res.status(500).json({ success: false, message: 'Could not check your sign-in.' });
      }
    };
  }

  /** The name to record. A signed-in person is always themselves; the legacy secret takes the typed name. */
  function actorName(req: Request, typed?: unknown): string {
    if (req.staff && !req.staff.legacy) return req.staff.name;
    return clean(typed, 120);
  }

  async function logAction(req: Request, action: string, target?: string, detail?: string) {
    try {
      const s = req.staff;
      if (!s) return;
      await StaffActionLog.create({
        staffId: s.id,
        staffName: s.name,
        role: s.role,
        action,
        target: target ? clean(target, 80) : undefined,
        detail: detail ? clean(detail, 300) : undefined,
        legacy: s.legacy,
      });
    } catch (err) {
      console.error('[STAFF] could not write action log:', err);
    }
  }

  const publicUser = (u: any) => ({
    id: String(u._id),
    email: u.email,
    name: u.name,
    role: u.role,
    organization: u.organization || '',
    status: u.status,
    mustChangePassword: u.mustChangePassword,
    lastLoginAt: u.lastLoginAt || null,
  });

  // POST /staff/bootstrap — creates the first admin. Needs ADMIN_SECRET and works only while no admin exists.
  router.post('/staff/bootstrap', deps.limiter, async (req: Request, res: Response) => {
    try {
      if (!process.env.ADMIN_SECRET) return res.status(503).json({ success: false, message: 'ADMIN_SECRET is not set.' });
      if (!legacySecretOk(req)) return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
      if (await StaffUser.exists({ role: 'admin' })) {
        return res.status(409).json({ success: false, message: 'An admin already exists. Sign in and add staff from there.' });
      }
      const email = clean(req.body?.email, 160).toLowerCase();
      const name = clean(req.body?.name, 120);
      if (!/^\S+@\S+\.\S+$/.test(email) || !name) return res.status(400).json({ success: false, message: 'A name and valid email are required' });
      const problem = passwordProblem(req.body?.password, email);
      if (problem) return res.status(400).json({ success: false, message: problem });
      const user = await StaffUser.create({
        email,
        name,
        role: 'admin',
        passwordHash: await bcrypt.hash(String(req.body.password), 12),
        mustChangePassword: false,
        createdBy: 'bootstrap',
      });
      await StaffActionLog.create({ staffId: String(user._id), staffName: name, role: 'admin', action: 'staff_bootstrap', legacy: true });
      return res.status(201).json({ success: true, staff: publicUser(user) });
    } catch (err) {
      console.error('[POST /staff/bootstrap] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not create the first admin' });
    }
  });

  // POST /staff/auth/login { email, password }
  router.post('/staff/auth/login', deps.limiter, async (req: Request, res: Response) => {
    const generic = { success: false, message: 'Email or password is wrong.' };
    try {
      const email = clean(req.body?.email, 160).toLowerCase();
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const user: any = email ? await StaffUser.findOne({ email }) : null;
      if (!user) {
        await bcrypt.compare(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi'); // even out timing
        return res.status(401).json(generic);
      }
      if (user.status !== 'active') return res.status(401).json(generic);
      if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        return res.status(429).json({ success: false, message: `Too many wrong passwords. Try again in ${LOCK_MINUTES} minutes.` });
      }
      if (!(await bcrypt.compare(password, user.passwordHash))) {
        user.failedAttempts = (user.failedAttempts || 0) + 1;
        if (user.failedAttempts >= MAX_FAILED) {
          user.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
          user.failedAttempts = 0;
        }
        await user.save();
        return res.status(401).json(generic);
      }
      user.failedAttempts = 0;
      user.lockedUntil = undefined;
      user.lastLoginAt = new Date();
      await user.save();
      const token = signStaffToken(deps.jwtSecret, { id: String(user._id), role: user.role, tokenVersion: user.tokenVersion });
      return res.json({ success: true, token, staff: publicUser(user) });
    } catch (err) {
      console.error('[POST /staff/auth/login] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not sign in' });
    }
  });

  // POST /staff/auth/change-password { currentPassword, newPassword } — signs out other sessions.
  router.post('/staff/auth/change-password', requireStaff(), async (req: Request, res: Response) => {
    try {
      if (req.staff!.legacy) return res.status(400).json({ success: false, message: 'Sign in with a staff account first.' });
      const user: any = await StaffUser.findById(req.staff!.id);
      if (!user || !(await bcrypt.compare(String(req.body?.currentPassword || ''), user.passwordHash))) {
        return res.status(401).json({ success: false, message: 'Current password is wrong.' });
      }
      const problem = passwordProblem(req.body?.newPassword, user.email);
      if (problem) return res.status(400).json({ success: false, message: problem });
      user.passwordHash = await bcrypt.hash(String(req.body.newPassword), 12);
      user.mustChangePassword = false;
      user.tokenVersion += 1;
      await user.save();
      await logAction(req, 'staff_password_changed', String(user._id));
      const token = signStaffToken(deps.jwtSecret, { id: String(user._id), role: user.role, tokenVersion: user.tokenVersion });
      return res.json({ success: true, token, staff: publicUser(user) });
    } catch (err) {
      console.error('[POST /staff/auth/change-password] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not change the password' });
    }
  });

  router.get('/staff/me', requireStaff(), async (req: Request, res: Response) => {
    res.json({ success: true, staff: req.staff, roles: ROLE_DESCRIPTION });
  });

  // ----- admin only -----
  router.get('/staff/users', requireStaff('admin'), async (_req: Request, res: Response) => {
    const users = await StaffUser.find().sort({ createdAt: 1 });
    res.json({ success: true, staff: users.map(publicUser) });
  });

  // POST /staff/users { email, name, role, organization } — returns a one-time temporary password.
  router.post('/staff/users', requireStaff('admin'), async (req: Request, res: Response) => {
    try {
      const email = clean(req.body?.email, 160).toLowerCase();
      const name = clean(req.body?.name, 120);
      const role = req.body?.role as StaffRole;
      if (!/^\S+@\S+\.\S+$/.test(email) || !name) return res.status(400).json({ success: false, message: 'A name and valid email are required' });
      if (!STAFF_ROLES.includes(role)) return res.status(400).json({ success: false, message: `Role must be one of ${STAFF_ROLES.join(', ')}` });
      if (await StaffUser.exists({ email })) return res.status(409).json({ success: false, message: 'That email already has an account' });
      const temp = tempPassword();
      const user = await StaffUser.create({
        email,
        name,
        role,
        organization: clean(req.body?.organization, 120) || undefined,
        passwordHash: await bcrypt.hash(temp, 12),
        mustChangePassword: true,
        createdBy: req.staff!.name,
      });
      await logAction(req, 'staff_created', String(user._id), `${email} as ${role}`);
      return res.status(201).json({ success: true, staff: publicUser(user), temporaryPassword: temp });
    } catch (err) {
      console.error('[POST /staff/users] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not create the account' });
    }
  });

  // PATCH /staff/users/:id { role, status, name, organization }
  router.patch('/staff/users/:id', requireStaff('admin'), async (req: Request, res: Response) => {
    try {
      const user: any = await StaffUser.findById(req.params.id);
      if (!user) return res.status(404).json({ success: false, message: 'Staff account not found' });
      const losingAdmin =
        user.role === 'admin' && user.status === 'active' && (req.body?.status === 'disabled' || (req.body?.role && req.body.role !== 'admin'));
      if (losingAdmin && (await StaffUser.countDocuments({ role: 'admin', status: 'active' })) <= 1) {
        return res.status(409).json({ success: false, message: 'Keep at least one active admin' });
      }
      if (req.body?.role !== undefined) {
        if (!STAFF_ROLES.includes(req.body.role)) return res.status(400).json({ success: false, message: 'Unknown role' });
        user.role = req.body.role;
      }
      if (req.body?.status !== undefined) {
        if (!['active', 'disabled'].includes(req.body.status)) return res.status(400).json({ success: false, message: 'Unknown status' });
        user.status = req.body.status;
      }
      if (req.body?.name !== undefined) user.name = clean(req.body.name, 120) || user.name;
      if (req.body?.organization !== undefined) user.organization = clean(req.body.organization, 120);
      user.tokenVersion += 1; // role or status changes end open sessions
      await user.save();
      await logAction(req, 'staff_updated', String(user._id), `role ${user.role}, ${user.status}`);
      return res.json({ success: true, staff: publicUser(user) });
    } catch (err) {
      console.error('[PATCH /staff/users/:id] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not update the account' });
    }
  });

  router.post('/staff/users/:id/reset-password', requireStaff('admin'), async (req: Request, res: Response) => {
    try {
      const user: any = await StaffUser.findById(req.params.id);
      if (!user) return res.status(404).json({ success: false, message: 'Staff account not found' });
      const temp = tempPassword();
      user.passwordHash = await bcrypt.hash(temp, 12);
      user.mustChangePassword = true;
      user.tokenVersion += 1;
      user.failedAttempts = 0;
      user.lockedUntil = undefined;
      await user.save();
      await logAction(req, 'staff_password_reset', String(user._id));
      return res.json({ success: true, temporaryPassword: temp });
    } catch (err) {
      console.error('[POST /staff/users/:id/reset-password] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not reset the password' });
    }
  });

  router.get('/staff/actions', requireStaff('admin'), async (_req: Request, res: Response) => {
    const rows = await StaffActionLog.find().sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, actions: rows });
  });

  return { router, requireStaff, actorName, logAction };
}
