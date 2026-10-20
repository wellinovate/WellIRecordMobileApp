import { apiClient } from './apiClient';

export interface MfaStatus {
  enabled: boolean;
  recoveryCodesLeft: number;
}

export interface MfaSetup {
  secret: string;
  otpauthUrl: string;
}

export type AuditKind = 'security' | 'access';

export interface AuditEntry {
  id: string;
  kind: AuditKind;
  action: string;
  title: string;
  actor: string;
  detail: string;
  ip: string;
  device: string;
  at: string;
}

/** A code from the authenticator app, or one of the 8 recovery codes. */
export type SecondStepProof = { code: string } | { recoveryCode: string };

export const securityService = {
  async mfaStatus(): Promise<MfaStatus> {
    const r = await apiClient.get<{ enabled: boolean; recoveryCodesLeft: number }>('/auth/mfa/status');
    return { enabled: Boolean(r?.enabled), recoveryCodesLeft: r?.recoveryCodesLeft ?? 0 };
  },

  async mfaSetup(): Promise<MfaSetup> {
    const r = await apiClient.post<{ secret: string; otpauthUrl: string }>('/auth/mfa/setup', {});
    return { secret: r.secret, otpauthUrl: r.otpauthUrl };
  },

  async mfaEnable(code: string): Promise<string[]> {
    const r = await apiClient.post<{ recoveryCodes: string[] }>('/auth/mfa/enable', { code });
    return r.recoveryCodes;
  },

  async mfaDisable(proof: SecondStepProof): Promise<void> {
    await apiClient.post('/auth/mfa/disable', proof);
  },

  async mfaNewRecoveryCodes(proof: SecondStepProof): Promise<string[]> {
    const r = await apiClient.post<{ recoveryCodes: string[] }>('/auth/mfa/recovery-codes', proof);
    return r.recoveryCodes;
  },

  async auditLog(kind?: AuditKind, before?: string): Promise<{ entries: AuditEntry[]; nextBefore: string | null }> {
    const q = new URLSearchParams();
    if (kind) q.set('kind', kind);
    if (before) q.set('before', before);
    q.set('limit', '50');
    const r = await apiClient.get<{ entries: AuditEntry[]; nextBefore: string | null }>(`/account/audit?${q.toString()}`);
    return { entries: r?.entries ?? [], nextBefore: r?.nextBefore ?? null };
  },
};
