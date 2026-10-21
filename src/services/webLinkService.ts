import { apiClient } from './apiClient';

export interface WebLinkStatus {
  available: boolean;
  linked: boolean;
  fullName: string;
  linkedAt: string | null;
}

export interface WebVisit {
  id: string;
  scheduledFor: string;
  durationMin: number;
  status: string;
  visitType: 'virtual' | 'in_person';
  organizationName: string;
  reasonForVisit: string;
  joinOpensAt: string;
  joinClosesAt: string;
}

export interface WebVisitSession {
  url: string;
  token: string;
  room: string;
  closesAt: string;
}

export interface RecordLinkInfo {
  organization: string;
  firstName: string;
  status: string;
  consentVersion: string;
  scopes: string[];
}

export interface RecordLinkItem {
  id: string;
  organization: string;
  status: string;
  consentAt: string | null;
  consentScopes: string[];
  transferred: boolean;
  updatedAt: string;
}

const enc = encodeURIComponent;

export const webLinkService = {
  status: () => apiClient.get<{ success: boolean } & WebLinkStatus>('/web-link'),
  claim: (code: string) => apiClient.post<{ success: boolean; linked: boolean; fullName: string }>('/web-link/claim', { code }),
  unlink: () => apiClient.delete<{ success: boolean; linked: boolean; websiteNotified: boolean }>('/web-link'),

  async visits(): Promise<WebVisit[]> {
    const res = await apiClient.get<{ success: boolean; data: WebVisit[] }>('/web-link/appointments');
    return Array.isArray(res?.data) ? res.data : [];
  },
  async visitToken(id: string): Promise<WebVisitSession> {
    const res = await apiClient.post<{ success: boolean; data: WebVisitSession }>(`/web-link/appointments/${enc(id)}/token`, {});
    return res.data;
  },

  async recordLinks(): Promise<RecordLinkItem[]> {
    const res = await apiClient.get<{ success: boolean; data: RecordLinkItem[] }>('/web-link/record-links');
    return Array.isArray(res?.data) ? res.data : [];
  },
  async recordLinkInfo(token: string): Promise<RecordLinkInfo> {
    return (await apiClient.get<{ success: boolean; data: RecordLinkInfo }>(`/web-link/record-links/claim/${enc(token)}`)).data;
  },
  async sendCode(token: string): Promise<{ sentTo: string; expiresInMinutes: number }> {
    return (await apiClient.post<{ success: boolean; data: { sentTo: string; expiresInMinutes: number } }>(`/web-link/record-links/claim/${enc(token)}/otp`, {})).data;
  },
  async verifyCode(token: string, code: string): Promise<{ status: string }> {
    return (await apiClient.post<{ success: boolean; data: { status: string } }>(`/web-link/record-links/claim/${enc(token)}/verify`, { code })).data;
  },
  async consent(token: string, version: string, scopes: string[]): Promise<{ status: string }> {
    return (await apiClient.post<{ success: boolean; data: { status: string } }>(`/web-link/record-links/claim/${enc(token)}/consent`, { version, scopes })).data;
  },
  async withdraw(id: string): Promise<{ status: string }> {
    return (await apiClient.post<{ success: boolean; data: { status: string } }>(`/web-link/record-links/${enc(id)}/withdraw`, {})).data;
  },
};
