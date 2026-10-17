// Who may do what on a child's profile.
//
// The primary guardian is the FamilyMember's accountId. Other adults are
// ChildGuardian rows. Effective permissions are computed in one place
// (effectivePerms) so a custody restriction always wins over a grant.

import crypto from 'crypto';
import express, { Request, Response, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { Account, ChildAuditLog, ChildGuardian, FamilyMember, User } from './models';

export const PERMISSION_KEYS = ['viewRecords', 'addRecords', 'bookAppointments', 'receiveReminders', 'manageGuardians'] as const;
export type PermKey = (typeof PERMISSION_KEYS)[number];
export type Perms = Record<PermKey, boolean>;

const ALL: Perms = { viewRecords: true, addRecords: true, bookAppointments: true, receiveReminders: true, manageGuardians: true };
const NONE: Perms = { viewRecords: false, addRecords: false, bookAppointments: false, receiveReminders: false, manageGuardians: false };

export const RELATIONSHIPS = ['Mother', 'Father', 'Legal guardian', 'Caregiver', 'Other'] as const;

export function effectivePerms(g: any): Perms {
  if (!g || g.status !== 'active') return { ...NONE };
  const granted: Perms = { ...NONE, ...(g.permissions?.toObject ? g.permissions.toObject() : g.permissions || {}) };
  const r = g.restriction;
  if (r?.active) {
    if (r.level === 'blocked') return { ...NONE };
    return { ...NONE, viewRecords: granted.viewRecords };
  }
  return granted;
}

export interface ChildAccess {
  member: any;
  actorId: string;
  role: 'primary' | 'guardian';
  perms: Perms;
  guardian?: any;
  /** An admin custody lock is on. The primary cannot manage guardians or transfer. */
  locked: boolean;
}

export async function resolveChildAccess(actorId: string, childId: string): Promise<ChildAccess | null> {
  if (!actorId || !mongoose.isValidObjectId(childId) || mongoose.connection.readyState !== 1) return null;
  const member: any = await FamilyMember.findById(childId);
  if (!member) return null;
  const locked = Boolean(member.custodyLock?.active);
  if (String(member.accountId || '') === actorId || String(member.userId || '') === actorId) {
    return { member, actorId, role: 'primary', perms: locked ? { ...ALL, manageGuardians: false } : { ...ALL }, locked };
  }
  const guardian: any = await ChildGuardian.findOne({ childId: member._id, accountId: actorId, status: 'active' });
  if (!guardian) return null;
  const perms = effectivePerms(guardian);
  if (!PERMISSION_KEYS.some((k) => perms[k])) return null;
  if (locked) perms.manageGuardians = false;
  return { member, actorId, role: 'guardian', perms, guardian, locked };
}

export async function actorName(id: string): Promise<string> {
  if (!mongoose.isValidObjectId(id)) return 'Unknown';
  const acc: any = await Account.findById(id).select('fullName name firstName lastName email').lean();
  if (acc) return acc.fullName || acc.name || [acc.firstName, acc.lastName].filter(Boolean).join(' ') || acc.email || 'Account';
  const user: any = await User.findById(id).select('fullName email').lean();
  return user?.fullName || user?.email || 'Account';
}

async function accountEmail(id: string): Promise<string | undefined> {
  if (!mongoose.isValidObjectId(id)) return undefined;
  const acc: any = await Account.findById(id).select('email').lean();
  if (acc?.email) return acc.email;
  const user: any = await User.findById(id).select('email').lean();
  return user?.email || undefined;
}

/** Writes one audit row. `dedupeMinutes` skips repeats of the same actor and action (for views). Never throws. */
export async function auditChild(
  childId: any,
  actorId: string,
  actorRole: 'primary' | 'guardian' | 'admin' | 'system',
  action: string,
  detail = '',
  dedupeMinutes = 0,
): Promise<void> {
  try {
    if (dedupeMinutes > 0) {
      const since = new Date(Date.now() - dedupeMinutes * 60 * 1000);
      if (await ChildAuditLog.exists({ childId, actorId, action, createdAt: { $gte: since } })) return;
    }
    const name = actorRole === 'admin' ? 'WelliRecord staff' : actorRole === 'system' ? 'WelliRecord' : await actorName(actorId);
    await ChildAuditLog.create({ childId, actorId, actorName: name, actorRole, action, detail: detail.slice(0, 300) });
  } catch (err) {
    console.warn('[ChildAudit] could not write:', err);
  }
}

const sha = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newCode(len = 8): string {
  let out = '';
  for (let i = 0; i < len; i++) out += INVITE_ALPHABET[crypto.randomInt(INVITE_ALPHABET.length)];
  return out;
}
const clean = (v: unknown, max = 120): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim().slice(0, max);
  return t || undefined;
};
const MAX_GUARDIANS = 6;

function pickPermissions(input: any, base: Partial<Perms> = {}, canGrantManage: boolean): Perms {
  const out: Perms = { ...NONE, viewRecords: true, receiveReminders: true, ...base };
  for (const k of PERMISSION_KEYS) {
    if (input && typeof input[k] === 'boolean') out[k] = input[k];
  }
  if (!canGrantManage) out.manageGuardians = Boolean(base.manageGuardians);
  return out;
}

const guardianPayload = (g: any) => ({
  id: String(g._id),
  displayName: g.displayName,
  relationship: g.relationship,
  status: g.status,
  inviteEmail: g.inviteEmail || '',
  invitePhone: g.invitePhone || '',
  inviteExpiresAt: g.status === 'pending' ? g.inviteExpiresAt : null,
  permissions: g.permissions?.toObject ? g.permissions.toObject() : g.permissions,
  effective: effectivePerms(g),
  restriction: g.restriction?.active
    ? { level: g.restriction.level, reason: g.restriction.reason || '', orderReference: g.restriction.orderReference || '', setAt: g.restriction.setAt }
    : null,
  identityVerified: Boolean(g.identityVerified),
  acceptedAt: g.acceptedAt || null,
});

export interface ChildAccessDeps {
  getAuthUserId: (req: Request) => string | null;
  requireAdminSecret: RequestHandler;
  limiter: RequestHandler;
  sendEmail: (to: string, subject: string, text: string) => Promise<void>;
  sendSms: (phone: string, text: string) => Promise<void>;
  notify: (userId: string, title: string, body: string) => Promise<void>;
}

export function createChildAccessRouter(deps: ChildAccessDeps) {
  const router = express.Router();

  // Resolves the caller's access to :id, or sends the error.
  async function access(req: Request, res: Response, need?: PermKey | 'primary'): Promise<ChildAccess | null> {
    const actorId = deps.getAuthUserId(req);
    if (!actorId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return null;
    }
    const a = await resolveChildAccess(actorId, req.params.id);
    if (!a) {
      res.status(404).json({ success: false, message: 'Family member not found' });
      return null;
    }
    if (need === 'primary' && a.role !== 'primary') {
      res.status(403).json({ success: false, message: 'Only the primary guardian can do this' });
      return null;
    }
    if (need && need !== 'primary' && !a.perms[need]) {
      const lockedMsg = need === 'manageGuardians' && a.locked ? 'Guardian changes are locked on this profile. Contact WelliRecord support.' : 'You do not have permission to do this';
      res.status(a.locked && need === 'manageGuardians' ? 423 : 403).json({ success: false, message: lockedMsg });
      return null;
    }
    return a;
  }

  const role = (a: ChildAccess) => a.role;

  // GET /family/:id/guardians
  router.get('/family/:id/guardians', async (req: Request, res: Response) => {
    try {
      const a = await access(req, res);
      if (!a) return;
      const rows: any[] = await ChildGuardian.find({ childId: a.member._id, status: { $in: ['pending', 'active'] } }).sort({ createdAt: 1 });
      const canSeeAll = a.role === 'primary' || a.perms.manageGuardians;
      const visible = canSeeAll ? rows : rows.filter((g) => g.accountId === a.actorId);
      const transfer = a.member.pendingTransfer;
      return res.json({
        success: true,
        you: { role: a.role, permissions: a.perms, locked: a.locked },
        primary: { name: await actorName(String(a.member.accountId || a.member.userId || '')) },
        custodyLock: a.member.custodyLock?.active ? { orderReference: a.member.custodyLock.orderReference || '', note: a.member.custodyLock.note || '' } : null,
        guardians: visible.map(guardianPayload),
        pendingTransfer:
          canSeeAll && transfer?.expiresAt && new Date(transfer.expiresAt) > new Date()
            ? { guardianId: transfer.guardianId, expiresAt: transfer.expiresAt }
            : null,
      });
    } catch (err) {
      console.error('[GET guardians] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not load guardians' });
    }
  });

  // POST /family/:id/guardians — invite. The code is returned once so it can be handed over in person.
  router.post('/family/:id/guardians', async (req: Request, res: Response) => {
    try {
      const a = await access(req, res, 'manageGuardians');
      if (!a) return;
      const b = req.body || {};
      const relationship = RELATIONSHIPS.find((r) => r === b.relationship);
      const displayName = clean(b.displayName, 80);
      if (!relationship || !displayName) {
        return res.status(400).json({ success: false, message: 'Choose a relationship and enter a name' });
      }
      const email = clean(b.email, 120)?.toLowerCase();
      const phone = clean(b.phone, 30);
      if (email && !email.includes('@')) return res.status(400).json({ success: false, message: 'Enter a valid email address' });
      const open = await ChildGuardian.countDocuments({ childId: a.member._id, status: { $in: ['pending', 'active'] } });
      if (open >= MAX_GUARDIANS) {
        return res.status(409).json({ success: false, message: `A child can have up to ${MAX_GUARDIANS} extra guardians` });
      }
      const code = newCode();
      const g: any = await ChildGuardian.create({
        childId: a.member._id,
        displayName,
        relationship,
        inviteEmail: email,
        invitePhone: phone,
        inviteCodeHash: sha(code),
        inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'pending',
        permissions: pickPermissions(b.permissions, {}, a.role === 'primary'),
        invitedBy: a.actorId,
      });
      const inviter = await actorName(a.actorId);
      const text = `${inviter} invited you to help look after a child's health profile on WelliRecord. Open the app, go to Family access, choose "I have an invite code" and enter ${code}. It expires in 7 days.`;
      const delivery: string[] = [];
      if (email) {
        try { await deps.sendEmail(email, 'You were invited on WelliRecord', text); delivery.push('email'); } catch { /* shown to the inviter below */ }
      }
      if (phone) {
        try { await deps.sendSms(phone, text); delivery.push('sms'); } catch { /* shown to the inviter below */ }
      }
      await auditChild(a.member._id, a.actorId, role(a), 'guardian_invited', `${displayName} (${relationship})`);
      return res.status(201).json({ success: true, guardian: guardianPayload(g), inviteCode: code, deliveredBy: delivery });
    } catch (err) {
      console.error('[POST guardians] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not create the invitation' });
    }
  });

  // POST /family/guardians/accept { code } — the invited adult joins.
  router.post('/family/guardians/accept', deps.limiter, async (req: Request, res: Response) => {
    try {
      const actorId = deps.getAuthUserId(req);
      if (!actorId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const code = clean(req.body?.code, 20)?.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!code) return res.status(400).json({ success: false, message: 'Enter the invite code' });
      const g: any = await ChildGuardian.findOne({ inviteCodeHash: sha(code), status: 'pending', inviteExpiresAt: { $gt: new Date() } });
      if (!g) return res.status(400).json({ success: false, message: 'That code is invalid or has expired' });
      const child: any = await FamilyMember.findById(g.childId);
      if (!child) return res.status(400).json({ success: false, message: 'That code is invalid or has expired' });
      if (String(child.accountId || '') === actorId || String(child.userId || '') === actorId) {
        return res.status(400).json({ success: false, message: 'You are already the primary guardian of this child' });
      }
      if (await ChildGuardian.exists({ childId: g.childId, accountId: actorId, status: 'active' })) {
        return res.status(409).json({ success: false, message: 'You already have access to this child' });
      }
      g.accountId = actorId;
      g.status = 'active';
      g.acceptedAt = new Date();
      g.inviteCodeHash = undefined;
      g.inviteExpiresAt = undefined;
      await g.save();
      await auditChild(g.childId, actorId, 'guardian', 'guardian_joined', `${g.displayName} (${g.relationship})`);
      const primaryId = String(child.accountId || child.userId || '');
      if (primaryId) await deps.notify(primaryId, 'Guardian joined', `${g.displayName} accepted your invitation.`).catch(() => {});
      return res.json({ success: true, childId: String(g.childId) });
    } catch (err) {
      console.error('[POST guardians/accept] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not accept the invitation' });
    }
  });

  // PATCH /family/:id/guardians/:gid — relationship and permissions.
  router.patch('/family/:id/guardians/:gid', async (req: Request, res: Response) => {
    try {
      const a = await access(req, res, 'manageGuardians');
      if (!a) return;
      const g: any = mongoose.isValidObjectId(req.params.gid) ? await ChildGuardian.findOne({ _id: req.params.gid, childId: a.member._id }) : null;
      if (!g || g.status === 'revoked') return res.status(404).json({ success: false, message: 'Guardian not found' });
      if (a.role !== 'primary' && g.permissions?.manageGuardians) {
        return res.status(403).json({ success: false, message: 'Only the primary guardian can change a guardian who manages others' });
      }
      const b = req.body || {};
      if (b.relationship) {
        const rel = RELATIONSHIPS.find((r) => r === b.relationship);
        if (rel) g.relationship = rel;
      }
      if (b.permissions) {
        const current = g.permissions?.toObject ? g.permissions.toObject() : g.permissions;
        g.permissions = pickPermissions(b.permissions, current, a.role === 'primary');
      }
      await g.save();
      await auditChild(a.member._id, a.actorId, role(a), 'guardian_updated', g.displayName);
      return res.json({ success: true, guardian: guardianPayload(g) });
    } catch (err) {
      console.error('[PATCH guardian] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not update the guardian' });
    }
  });

  // DELETE /family/:id/guardians/:gid — remove someone, or leave.
  router.delete('/family/:id/guardians/:gid', async (req: Request, res: Response) => {
    try {
      const a = await access(req, res);
      if (!a) return;
      const g: any = mongoose.isValidObjectId(req.params.gid) ? await ChildGuardian.findOne({ _id: req.params.gid, childId: a.member._id }) : null;
      if (!g || g.status === 'revoked') return res.status(404).json({ success: false, message: 'Guardian not found' });
      const leaving = g.accountId === a.actorId;
      if (!leaving) {
        if (!a.perms.manageGuardians) return res.status(a.locked ? 423 : 403).json({ success: false, message: a.locked ? 'Guardian changes are locked on this profile. Contact WelliRecord support.' : 'You do not have permission to do this' });
        if (a.role !== 'primary' && g.permissions?.manageGuardians) {
          return res.status(403).json({ success: false, message: 'Only the primary guardian can remove a guardian who manages others' });
        }
      }
      g.status = 'revoked';
      g.inviteCodeHash = undefined;
      await g.save();
      await auditChild(a.member._id, a.actorId, role(a), leaving ? 'guardian_left' : 'guardian_removed', g.displayName);
      return res.json({ success: true });
    } catch (err) {
      console.error('[DELETE guardian] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not remove the guardian' });
    }
  });

  // PUT /family/:id/guardians/:gid/restriction — custody restriction. Primary only.
  // { level: 'blocked' | 'view_only' | 'none', reason, orderReference }
  router.put('/family/:id/guardians/:gid/restriction', async (req: Request, res: Response) => {
    try {
      const a = await access(req, res, 'primary');
      if (!a) return;
      const g: any = mongoose.isValidObjectId(req.params.gid) ? await ChildGuardian.findOne({ _id: req.params.gid, childId: a.member._id }) : null;
      if (!g || g.status === 'revoked') return res.status(404).json({ success: false, message: 'Guardian not found' });
      const level = req.body?.level;
      if (level === 'none') {
        g.restriction = { active: false };
        await g.save();
        await auditChild(a.member._id, a.actorId, 'primary', 'restriction_cleared', g.displayName);
      } else if (level === 'blocked' || level === 'view_only') {
        const reason = clean(req.body?.reason, 300);
        if (!reason) return res.status(400).json({ success: false, message: 'Give a reason. It is shown in the access log.' });
        g.restriction = { active: true, level, reason, orderReference: clean(req.body?.orderReference, 80), setBy: a.actorId, setAt: new Date() };
        await g.save();
        await auditChild(a.member._id, a.actorId, 'primary', 'restriction_set', `${g.displayName}: ${level === 'blocked' ? 'blocked' : 'view only'}. ${reason}`);
      } else {
        return res.status(400).json({ success: false, message: 'Choose blocked, view_only or none' });
      }
      return res.json({ success: true, guardian: guardianPayload(g) });
    } catch (err) {
      console.error('[PUT restriction] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not save the restriction' });
    }
  });

  // POST /family/:id/transfer { guardianId } — primary asks to hand over. A code goes to the target's own email.
  router.post('/family/:id/transfer', async (req: Request, res: Response) => {
    try {
      const a = await access(req, res, 'primary');
      if (!a) return;
      if (a.locked) return res.status(423).json({ success: false, message: 'Transfers are locked on this profile. Contact WelliRecord support.' });
      const gid = String(req.body?.guardianId || '');
      const g: any = mongoose.isValidObjectId(gid) ? await ChildGuardian.findOne({ _id: gid, childId: a.member._id, status: 'active' }) : null;
      if (!g || !g.accountId) return res.status(400).json({ success: false, message: 'Choose a guardian who has joined' });
      if (g.restriction?.active) return res.status(409).json({ success: false, message: 'Clear the restriction on this guardian before transferring' });
      const email = await accountEmail(g.accountId);
      if (!email) return res.status(422).json({ success: false, message: 'That guardian has no email on their account' });
      const code = newCode(6);
      a.member.pendingTransfer = {
        guardianId: String(g._id),
        toAccountId: g.accountId,
        codeHash: sha(code),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        attempts: 0,
        requestedBy: a.actorId,
      };
      a.member.markModified('pendingTransfer');
      await a.member.save();
      const from = await actorName(a.actorId);
      await deps.sendEmail(email, 'Accept responsibility for a child on WelliRecord', `${from} wants to make you the primary guardian of a child's profile on WelliRecord. If you agree, open the app, go to the child's Access tab and enter ${code}. It expires in 24 hours. If you did not expect this, ignore this message.`);
      await auditChild(a.member._id, a.actorId, 'primary', 'transfer_requested', g.displayName);
      return res.json({ success: true, expiresAt: a.member.pendingTransfer.expiresAt });
    } catch (err) {
      console.error('[POST transfer] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not start the transfer' });
    }
  });

  router.delete('/family/:id/transfer', async (req: Request, res: Response) => {
    try {
      const a = await access(req, res, 'primary');
      if (!a) return;
      a.member.pendingTransfer = undefined;
      a.member.markModified('pendingTransfer');
      await a.member.save();
      await auditChild(a.member._id, a.actorId, 'primary', 'transfer_cancelled');
      return res.json({ success: true });
    } catch (err) {
      console.error('[DELETE transfer] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not cancel the transfer' });
    }
  });

  // POST /family/:id/transfer/accept { code } — the target takes over.
  router.post('/family/:id/transfer/accept', deps.limiter, async (req: Request, res: Response) => {
    try {
      const actorId = deps.getAuthUserId(req);
      if (!actorId) return res.status(401).json({ success: false, message: 'Authentication required' });
      const a = await resolveChildAccess(actorId, req.params.id);
      const t = a?.member?.pendingTransfer;
      if (!a || a.role !== 'guardian' || !t || t.toAccountId !== actorId || new Date(t.expiresAt) < new Date()) {
        return res.status(400).json({ success: false, message: 'That code is invalid or has expired' });
      }
      if (a.locked) return res.status(423).json({ success: false, message: 'Transfers are locked on this profile. Contact WelliRecord support.' });
      const code = clean(req.body?.code, 20)?.toUpperCase().replace(/[^A-Z0-9]/g, '') || '';
      if ((t.attempts || 0) >= 5 || sha(code) !== t.codeHash) {
        t.attempts = (t.attempts || 0) + 1;
        if (t.attempts >= 5) a.member.pendingTransfer = undefined;
        a.member.markModified('pendingTransfer');
        await a.member.save();
        return res.status(400).json({ success: false, message: 'That code is invalid or has expired' });
      }
      const oldPrimary = String(a.member.accountId || a.member.userId || '');
      const newId = new mongoose.Types.ObjectId(actorId);
      a.member.accountId = newId;
      a.member.userId = newId;
      a.member.pendingTransfer = undefined;
      a.member.markModified('pendingTransfer');
      await a.member.save();
      // The new primary no longer needs a guardian row.
      await ChildGuardian.updateOne({ _id: a.guardian._id }, { $set: { status: 'revoked' } });
      // The previous primary stays on as a guardian, without the power to manage others.
      await ChildGuardian.create({
        childId: a.member._id,
        accountId: oldPrimary,
        displayName: await actorName(oldPrimary),
        relationship: 'Legal guardian',
        status: 'active',
        permissions: { viewRecords: true, addRecords: true, bookAppointments: true, receiveReminders: true, manageGuardians: false },
        invitedBy: actorId,
        acceptedAt: new Date(),
      });
      await auditChild(a.member._id, actorId, 'primary', 'transfer_completed', `From ${await actorName(oldPrimary)} to ${await actorName(actorId)}`);
      if (oldPrimary) await deps.notify(oldPrimary, 'Primary guardian changed', 'Responsibility for the child was transferred. You stay on as a guardian.').catch(() => {});
      return res.json({ success: true });
    } catch (err) {
      console.error('[POST transfer/accept] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not complete the transfer' });
    }
  });

  // GET /family/:id/audit — primary or a guardian who manages guardians.
  router.get('/family/:id/audit', async (req: Request, res: Response) => {
    try {
      const a = await access(req, res);
      if (!a) return;
      if (a.role !== 'primary' && !a.perms.manageGuardians) {
        return res.status(403).json({ success: false, message: 'You do not have permission to see the access log' });
      }
      const rows: any[] = await ChildAuditLog.find({ childId: a.member._id }).sort({ createdAt: -1 }).limit(100);
      return res.json({
        success: true,
        entries: rows.map((r) => ({ id: String(r._id), at: r.createdAt, actorName: r.actorName, actorRole: r.actorRole, action: r.action, detail: r.detail || '' })),
      });
    } catch (err) {
      console.error('[GET audit] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not load the access log' });
    }
  });

  // Staff routes (admin secret) --------------------------------------------

  // POST /family/:id/custody { action: 'lock' | 'unlock', orderReference, note, setBy }
  router.post('/family/:id/custody', deps.requireAdminSecret, async (req: Request, res: Response) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id' });
      const member: any = await FamilyMember.findById(req.params.id);
      if (!member) return res.status(404).json({ success: false, message: 'Family member not found' });
      const action = req.body?.action;
      const setBy = clean(req.body?.setBy, 120);
      if (!setBy) return res.status(400).json({ success: false, message: 'setBy is required' });
      if (action === 'lock') {
        member.custodyLock = { active: true, orderReference: clean(req.body?.orderReference, 80), note: clean(req.body?.note, 300), setBy, setAt: new Date() };
        member.pendingTransfer = undefined;
        member.markModified('pendingTransfer');
      } else if (action === 'unlock') {
        member.custodyLock = { active: false, clearedBy: setBy, clearedAt: new Date() };
      } else {
        return res.status(400).json({ success: false, message: 'action must be lock or unlock' });
      }
      member.markModified('custodyLock');
      await member.save();
      await auditChild(member._id, 'staff', 'admin', action === 'lock' ? 'custody_locked' : 'custody_unlocked', `${setBy}. ${clean(req.body?.orderReference, 80) || ''}`);
      return res.json({ success: true });
    } catch (err) {
      console.error('[POST custody] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not update the custody lock' });
    }
  });

  // POST /family/:id/guardians/:gid/verify-identity { verifiedBy } — a staff check of the adult's identity.
  router.post('/family/:id/guardians/:gid/verify-identity', deps.requireAdminSecret, async (req: Request, res: Response) => {
    try {
      const verifiedBy = clean(req.body?.verifiedBy, 120);
      if (!verifiedBy) return res.status(400).json({ success: false, message: 'verifiedBy is required' });
      if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.gid)) return res.status(400).json({ success: false, message: 'Invalid id' });
      const g: any = await ChildGuardian.findOneAndUpdate({ _id: req.params.gid, childId: req.params.id }, { $set: { identityVerified: true } }, { new: true });
      if (!g) return res.status(404).json({ success: false, message: 'Guardian not found' });
      await auditChild(g.childId, 'staff', 'admin', 'guardian_identity_verified', `${g.displayName} by ${verifiedBy}`);
      return res.json({ success: true, guardian: guardianPayload(g) });
    } catch (err) {
      console.error('[POST verify-identity] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not record the verification' });
    }
  });

  return router;
}
