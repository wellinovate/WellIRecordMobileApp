import { apiClient } from './apiClient';

export interface NinStatus {
  verified: boolean;
  verifiedAt: string | null;
  method: string | null;
  available: boolean;
}

export const ninService = {
  async status(): Promise<NinStatus> {
    const r = await apiClient.get<NinStatus & { success: boolean }>('/identity/nin/status');
    return { verified: Boolean(r.verified), verifiedAt: r.verifiedAt ?? null, method: r.method ?? null, available: Boolean(r.available) };
  },
  /** Sends the NIN once. The server never stores it and the app keeps it only in the text box. */
  async verify(nin: string): Promise<{ verified: boolean; already: boolean; verifiedAt: string }> {
    return apiClient.post('/identity/nin', { nin, consent: true });
  },
};
