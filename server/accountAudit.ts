// Security and access log for an adult's own account. Children have ChildAuditLog; this is the
// same idea for the signed-in person. It records sign-ins, changes to sign-in security, and every
// time someone other than the owner reads or receives the record. The owner's own reading of
// their own record is not logged: that would bury the entries that matter.

import type { Request } from 'express';
import { AccountAuditLog } from './models';

export type AuditKind = 'security' | 'access';

/** Masks the last part of an address so the log does not become a location trail. */
export function maskIp(ip: unknown): string {
  const s = String(ip ?? '').replace(/^::ffff:/, '').trim();
  if (!s) return '';
  if (s.includes(':')) return s.split(':').slice(0, 3).join(':') + ':…';
  const p = s.split('.');
  return p.length === 4 ? `${p[0]}.${p[1]}.${p[2]}.x` : s.slice(0, 40);
}

export function describeDevice(ua: unknown): string {
  const s = String(ua ?? '');
  if (!s) return '';
  const os = /Android/i.test(s) ? 'Android' : /iPhone|iPad|iOS/i.test(s) ? 'iOS' : /Windows/i.test(s) ? 'Windows' : /Mac OS/i.test(s) ? 'Mac' : /Linux/i.test(s) ? 'Linux' : '';
  const app = /okhttp|Expo|ReactNative|WelliRecord/i.test(s) ? 'WelliRecord app' : /Chrome|Safari|Firefox|Edg/i.test(s) ? 'Browser' : '';
  return [app, os].filter(Boolean).join(' on ') || s.slice(0, 60);
}

export async function auditAccount(
  req: Request | null,
  accountId: string,
  kind: AuditKind,
  action: string,
  actorLabel: string,
  detail = ''
): Promise<void> {
  try {
    if (!accountId) return;
    await AccountAuditLog.create({
      accountId: String(accountId),
      kind,
      action,
      actorLabel: actorLabel.slice(0, 120),
      detail: detail.slice(0, 300),
      ip: req ? maskIp(req.ip || req.socket?.remoteAddress) : '',
      device: req ? describeDevice(req.headers['user-agent']) : '',
    });
  } catch (err) {
    console.warn('[AccountAudit] could not write:', err);
  }
}

export const ACTION_LABELS: Record<string, string> = {
  sign_in: 'Signed in',
  sign_in_mfa: 'Signed in with second step',
  mfa_failed: 'Wrong second-step code',
  mfa_locked: 'Second step locked after wrong codes',
  mfa_enabled: 'Second sign-in step turned on',
  mfa_disabled: 'Second sign-in step turned off',
  mfa_recovery_codes: 'New recovery codes made',
  password_reset: 'Password reset',
  sessions_revoked: 'Signed out other devices',
  share_created: 'Provider link created',
  share_revoked: 'Provider link withdrawn',
  share_opened: 'Provider link opened',
  share_locked: 'Provider link locked after wrong codes',
  record_shared_consent: 'Record shared with a provider',
  emergency_scan: 'Emergency card scanned',
  prescription_shared: 'Prescription sent to a pharmacy',
  prescription_viewed: 'Prescription opened by a pharmacy',
};
