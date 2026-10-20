import { apiClient } from './apiClient';

export type ShareSection = 'allergies' | 'conditions' | 'medications' | 'records' | 'vaccinations' | 'growth';

export interface ProviderShare {
  id: string;
  subjectId: string;
  recipientName: string;
  purpose: string;
  sections: ShareSection[];
  expiresAt: string;
  createdAt: string;
  state: 'active' | 'expired' | 'revoked' | 'locked';
  mode: 'contact' | 'passcode';
  /** True when the record was encrypted on the phone and the server holds only ciphertext. */
  encrypted?: boolean;
  contact: string;
  channel: 'email' | 'sms' | null;
  openedCount: number;
  lastOpenedAt: string | null;
}

export interface CreateProviderShare {
  subjectId: string;
  recipientName: string;
  purpose?: string;
  sections: ShareSection[];
  hours: number;
  verification:
    | { mode: 'passcode' }
    | { mode: 'contact'; channel: 'email' | 'sms'; contact: string };
}

export interface SealedCopy { ciphertext: string; iv: string }

export const providerShareService = {
  /** The record as it would be shared now. The app encrypts it before it is uploaded. */
  snapshot: (body: { subjectId: string; sections: ShareSection[]; purpose?: string; recordIds?: string[] }) =>
    apiClient.post<{ sections: ShareSection[]; record: unknown }>('/provider-shares/snapshot', body),
  create: (body: CreateProviderShare & { sealed: SealedCopy }) =>
    apiClient.post<{ share: ProviderShare; url: string; passcode?: string }>('/provider-shares', body),
  list: async () => (await apiClient.get<{ shares: ProviderShare[] }>('/provider-shares')).shares,
  revoke: async (id: string) =>
    (await apiClient.post<{ share: ProviderShare }>(`/provider-shares/${encodeURIComponent(id)}/revoke`)).share,
};
