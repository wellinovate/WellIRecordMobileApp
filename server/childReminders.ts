// Vaccine reminders for guardians, by app notification, SMS or WhatsApp.
//
// Rules:
// - App notifications are on by default. SMS and WhatsApp need an explicit
//   opt-in with a phone number, and the time of the opt-in is stored.
// - Only routine doses are reminded. Programme doses are never nagged.
// - A dose that already has a record (even unverified) is not reminded.
// - Messages carry no vaccine names. They say that doses are due and point to the app.
// - Sent between 08:00 and 19:59 Lagos time. Each reminder is logged once.

import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ChildGuardian, ChildVaccination, FamilyMember, ReminderLog, ReminderPreference } from './models';
import { IMMUNIZATION_SCHEDULE } from './data/immunizationSchedule';
import { auditChild, effectivePerms, resolveChildAccess } from './childAccess';

export type ReminderChannel = 'push' | 'sms' | 'whatsapp';
export type ReminderKind = 'due_soon' | 'due' | 'overdue';

export interface ReminderDeps {
  getAuthUserId: (req: Request) => string | null;
  sendSms: (phone: string, text: string) => Promise<void>;
  sendWhatsapp: (phone: string, text: string) => Promise<void>;
  push: (userId: string, title: string, body: string) => Promise<void>;
  availability: () => { sms: boolean; whatsapp: boolean };
}

const DAY = 24 * 60 * 60 * 1000;
const DUE_SOON_DAYS = 7;
/** Overdue reminders stop after 8 weeks. A clinician decides about catch-up doses. */
const OVERDUE_REMINDER_DAYS = 56;
const MAX_ATTEMPTS = 3;
const MAX_SENDS_PER_SWEEP = 300;

const addDays = (iso: string, days: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY).toISOString().slice(0, 10);

export function lagosToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
function lagosHour(now = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', hour12: false }).format(now)) % 24;
}
function isoWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / DAY - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export interface DueGroup {
  kind: ReminderKind;
  count: number;
  key: string;
}

/**
 * Groups the doses that need a reminder today. Mirrors buildDoseRows in
 * src/utils/immunization.ts: due from dueDays, overdue after dueDays + graceDays.
 */
export function dueGroups(dob: string, takenCodes: Set<string>, today: string): DueGroup[] {
  const groups = new Map<ReminderKind, { count: number; days: Set<number> }>();
  const week = isoWeek(today);
  for (const dose of IMMUNIZATION_SCHEDULE.doses) {
    if (dose.track !== 'routine' || takenCodes.has(dose.code)) continue;
    const dueDate = addDays(dob, dose.dueDays);
    const overdueFrom = addDays(dueDate, dose.graceDays);
    let kind: ReminderKind | null = null;
    if (today > overdueFrom) kind = today <= addDays(overdueFrom, OVERDUE_REMINDER_DAYS) ? 'overdue' : null;
    else if (today >= dueDate) kind = 'due';
    else if (today >= addDays(dueDate, -DUE_SOON_DAYS)) kind = 'due_soon';
    if (!kind) continue;
    const g = groups.get(kind) || { count: 0, days: new Set<number>() };
    g.count += 1;
    g.days.add(dose.dueDays);
    groups.set(kind, g);
  }
  return [...groups.entries()].map(([kind, g]) => ({
    kind,
    count: g.count,
    key: `${kind}:${[...g.days].sort((a, b) => a - b).join(',')}${kind === 'overdue' ? `:${week}` : ''}`,
  }));
}

function messageFor(kind: ReminderKind, count: number, name: string): { title: string; body: string } {
  const doses = count === 1 ? '1 vaccine dose' : `${count} vaccine doses`;
  if (kind === 'due_soon') return { title: 'Vaccines due soon', body: `${name} has ${doses} due in about a week. Book a visit at your clinic.` };
  if (kind === 'due') return { title: 'Vaccines due now', body: `${name} has ${doses} due now. Book a visit at your clinic.` };
  return { title: 'Vaccines past due', body: `${name} has ${doses} past due. Ask your clinic what to do next.` };
}

/** Returns a number in 234XXXXXXXXXX form, or null. */
export function normalizeNgMobile(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '');
  const national = digits.startsWith('234') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
  return /^[789]\d{9}$/.test(national) ? `234${national}` : null;
}

interface Recipient {
  accountId: string;
  push: boolean;
  sms: boolean;
  whatsapp: boolean;
  phone?: string;
}

async function recipientsFor(child: any): Promise<Recipient[]> {
  const ids = new Set<string>();
  const primary = String(child.accountId || child.userId || '');
  if (primary) ids.add(primary);
  const guardians: any[] = await ChildGuardian.find({ childId: child._id, status: 'active' });
  for (const g of guardians) {
    if (g.accountId && effectivePerms(g).receiveReminders) ids.add(g.accountId);
  }
  const prefs: any[] = await ReminderPreference.find({ childId: child._id, accountId: { $in: [...ids] } });
  const byAccount = new Map(prefs.map((p) => [p.accountId, p]));
  return [...ids].map((accountId) => {
    const p = byAccount.get(accountId);
    return p
      ? { accountId, push: p.push, sms: p.sms && Boolean(p.smsConsentAt), whatsapp: p.whatsapp && Boolean(p.whatsappConsentAt), phone: p.phone }
      : { accountId, push: true, sms: false, whatsapp: false };
  });
}

export async function runChildReminderSweep(deps: ReminderDeps, now = new Date()): Promise<{ sent: number; failed: number; skipped: number }> {
  const result = { sent: 0, failed: 0, skipped: 0 };
  if (mongoose.connection.readyState !== 1) return result;
  const hour = lagosHour(now);
  if (hour < 8 || hour >= 20) return result;
  const today = lagosToday(now);
  const avail = deps.availability();
  const youngest = addDays(today, -6 * 366);
  const children: any[] = await FamilyMember.find({ relationship: 'Child', dateOfBirth: { $gte: youngest, $lte: today } }).limit(1000);

  for (const child of children) {
    if (result.sent + result.failed >= MAX_SENDS_PER_SWEEP) break;
    const dob = String(child.dateOfBirth || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) continue;
    const taken = new Set((await ChildVaccination.find({ memberId: child._id }).select('vaccineCode').lean()).map((v: any) => v.vaccineCode));
    const groups = dueGroups(dob, taken, today);
    if (!groups.length) continue;
    const name = child.childProfile?.preferredName || String(child.fullName || child.name || 'Your child').split(' ')[0];
    const recipients = await recipientsFor(child);

    for (const group of groups) {
      const msg = messageFor(group.kind, group.count, name);
      for (const r of recipients) {
        const channels: ReminderChannel[] = [];
        if (r.push) channels.push('push');
        if (r.sms) channels.push('sms');
        if (r.whatsapp) channels.push('whatsapp');
        for (const channel of channels) {
          const where = { childId: child._id, accountId: r.accountId, channel, key: group.key };
          let log: any = await ReminderLog.findOne(where);
          if (log && (log.status !== 'failed' || log.attempts >= MAX_ATTEMPTS)) continue;
          if (!log) {
            try {
              log = await ReminderLog.create({ ...where, status: 'pending' });
            } catch {
              continue; // another run created it first
            }
          }
          try {
            if (channel === 'push') {
              await deps.push(r.accountId, msg.title, msg.body);
            } else if (!r.phone) {
              throw Object.assign(new Error('no phone number'), { skip: true });
            } else if (channel === 'sms') {
              if (!avail.sms) throw Object.assign(new Error('SMS is not configured'), { skip: true });
              await deps.sendSms(r.phone, `WelliRecord: ${msg.body} Manage reminders in the app.`);
            } else {
              if (!avail.whatsapp) throw Object.assign(new Error('WhatsApp is not switched on'), { skip: true });
              await deps.sendWhatsapp(r.phone, `WelliRecord: ${msg.body} Manage reminders in the app.`);
            }
            log.status = 'sent';
            result.sent += 1;
          } catch (err: any) {
            log.attempts += 1;
            log.error = String(err?.message || err).slice(0, 200);
            if (err?.skip) {
              log.status = 'skipped';
              result.skipped += 1;
            } else {
              log.status = 'failed';
              result.failed += 1;
            }
          }
          await log.save();
        }
      }
    }
  }
  return result;
}

export function startChildReminderSweep(deps: ReminderDeps) {
  const tick = () => runChildReminderSweep(deps).then((r) => { if (r.sent || r.failed) console.log('[ChildReminders]', r); }).catch((err) => console.warn('[ChildReminders] sweep failed:', err));
  setTimeout(tick, 2 * 60 * 1000).unref();
  setInterval(tick, 60 * 60 * 1000).unref();
}

export function createChildReminderRouter(deps: ReminderDeps) {
  const router = express.Router();

  async function load(req: Request, res: Response) {
    const actorId = deps.getAuthUserId(req);
    if (!actorId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return null;
    }
    const a = await resolveChildAccess(actorId, req.params.id);
    if (!a || !a.perms.receiveReminders) {
      res.status(a ? 403 : 404).json({ success: false, message: a ? 'You do not have permission to get reminders for this child' : 'Family member not found' });
      return null;
    }
    return a;
  }

  const payload = (p: any) => ({
    push: p ? p.push : true,
    sms: Boolean(p?.sms && p?.smsConsentAt),
    whatsapp: Boolean(p?.whatsapp && p?.whatsappConsentAt),
    phone: p?.phone || '',
    smsConsentAt: p?.smsConsentAt || null,
    whatsappConsentAt: p?.whatsappConsentAt || null,
  });

  router.get('/family/:id/reminders', async (req: Request, res: Response) => {
    try {
      const a = await load(req, res);
      if (!a) return;
      const pref: any = await ReminderPreference.findOne({ childId: a.member._id, accountId: a.actorId });
      const dob = String(a.member.dateOfBirth || '');
      const taken = new Set((await ChildVaccination.find({ memberId: a.member._id }).select('vaccineCode').lean()).map((v: any) => v.vaccineCode));
      const upcoming = /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dueGroups(dob, taken, lagosToday()).map(({ kind, count }) => ({ kind, count })) : [];
      return res.json({ success: true, preferences: payload(pref), availability: deps.availability(), upcoming });
    } catch (err) {
      console.error('[GET reminders] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not load reminder settings' });
    }
  });

  // PUT /family/:id/reminders { push, sms, whatsapp, phone }
  router.put('/family/:id/reminders', async (req: Request, res: Response) => {
    try {
      const a = await load(req, res);
      if (!a) return;
      const b = req.body || {};
      const avail = deps.availability();
      const wantSms = Boolean(b.sms);
      const wantWa = Boolean(b.whatsapp);
      const phone = normalizeNgMobile(b.phone);
      if ((wantSms || wantWa) && !phone) {
        return res.status(400).json({ success: false, message: 'Enter a Nigerian mobile number to get SMS or WhatsApp reminders' });
      }
      if (wantSms && !avail.sms) return res.status(409).json({ success: false, message: 'SMS reminders are not available yet' });
      if (wantWa && !avail.whatsapp) return res.status(409).json({ success: false, message: 'WhatsApp reminders are not switched on yet' });

      const prev: any = await ReminderPreference.findOne({ childId: a.member._id, accountId: a.actorId });
      const now = new Date();
      const next = {
        push: b.push !== false,
        sms: wantSms,
        whatsapp: wantWa,
        phone: wantSms || wantWa ? phone! : undefined,
        // Keep the original opt-in time while a channel stays on. Clear it when it is turned off.
        smsConsentAt: wantSms ? (prev?.sms && prev?.smsConsentAt ? prev.smsConsentAt : now) : null,
        whatsappConsentAt: wantWa ? (prev?.whatsapp && prev?.whatsappConsentAt ? prev.whatsappConsentAt : now) : null,
      };
      const saved: any = await ReminderPreference.findOneAndUpdate(
        { childId: a.member._id, accountId: a.actorId },
        { $set: next, ...(next.phone ? {} : { $unset: { phone: 1 } }) },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      await auditChild(a.member._id, a.actorId, a.role, 'reminder_prefs_updated', ['app', wantSms && 'SMS', wantWa && 'WhatsApp'].filter(Boolean).join(', '));
      return res.json({ success: true, preferences: payload(saved) });
    } catch (err) {
      console.error('[PUT reminders] ERROR:', err);
      return res.status(500).json({ success: false, message: 'Could not save reminder settings' });
    }
  });

  return router;
}
