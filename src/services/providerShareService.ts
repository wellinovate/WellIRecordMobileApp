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

export const providerShareService = {
  create: (body: CreateProviderShare) =>
    apiClient.post<{ share: ProviderShare; url: string; passcode?: string }>('/provider-shares', body),
  list: async () => (await apiClient.get<{ shares: ProviderShare[] }>('/provider-shares')).shares,
  revoke: async (id: string) =>
    (await apiClient.post<{ share: ProviderShare }>(`/provider-shares/${encodeURIComponent(id)}/revoke`)).share,
};
