/**
 * Consultation booking: provider fees and open times, holding a slot, confirming with a payment method.
 * The server decides the fee and the final status. The app only displays them.
 */

import { apiClient } from './apiClient';
import type { AppointmentItem } from './careService';

export type VisitMode = 'in_person' | 'video';
export type PayMethod = 'online' | 'in_person' | 'hmo';

export interface BookableSlot {
  startsAt: string;
  label: string;
}

export interface BookableProvider {
  facilityId: string;
  name: string;
  address: string;
  specialty: string;
  mode: VisitMode;
  feeMinor: number;
  currency: string;
  acceptsHmo: string[];
  payAtVisit: boolean;
  onlinePayment: boolean;
  slotMinutes: number;
  slots: BookableSlot[];
}

export interface BookingConfig {
  onlinePayment: boolean;
  termsVersion: string;
  terms: string[];
  holdMinutes: number;
}

export interface BookingHmoInput {
  provider: string;
  policyId: string;
  policyLabel: string;
  preAuthId?: string;
  preAuthStatus?: string;
}

export const bookingService = {
  async config(): Promise<BookingConfig> {
    const r = await apiClient.get<BookingConfig & { success: boolean }>('/booking/config');
    return { onlinePayment: !!r.onlinePayment, termsVersion: r.termsVersion, terms: r.terms || [], holdMinutes: r.holdMinutes || 10 };
  },

  /** Whether a facility has published consultation fees and hours. Fails quietly to "no". */
  async offers(facilityId: string): Promise<{ inPerson: boolean; virtual: boolean }> {
    try {
      const r = await apiClient.get<{ inPerson: boolean; virtual: boolean }>(`/booking/offers/${encodeURIComponent(facilityId)}`, { timeoutMs: 5000 });
      return { inPerson: !!r.inPerson, virtual: !!r.virtual };
    } catch {
      return { inPerson: false, virtual: false };
    }
  },

  async dates(mode: VisitMode, facilityId?: string): Promise<string[]> {
    const r = await apiClient.get<{ dates: { date: string }[] }>('/booking/dates', { params: { mode, days: 30, facilityId } });
    return (r.dates || []).map((d) => d.date);
  },

  async availability(mode: VisitMode, date: string, facilityId?: string): Promise<BookableProvider[]> {
    const r = await apiClient.get<{ providers: BookableProvider[] }>('/booking/availability', { params: { mode, date, facilityId } });
    return r.providers || [];
  },

  async hold(facilityId: string, mode: VisitMode, startsAt: string): Promise<{ holdId: string; expiresAt: string }> {
    const r = await apiClient.post<{ holdId: string; expiresAt: string }>('/booking/holds', { facilityId, mode, startsAt });
    return { holdId: r.holdId, expiresAt: r.expiresAt };
  },

  async release(holdId: string): Promise<void> {
    try {
      await apiClient.delete(`/booking/holds/${encodeURIComponent(holdId)}`);
    } catch {
      /* the hold expires on its own */
    }
  },

  async confirm(body: {
    holdId: string;
    paymentMethod: PayMethod;
    familyMemberId?: string;
    reason?: string;
    hmo?: BookingHmoInput;
  }): Promise<{ appointment: AppointmentItem; authorizationUrl?: string; notice: string }> {
    const r = await apiClient.post<{ appointment: AppointmentItem; authorizationUrl?: string; notice?: string }>('/booking/confirm', {
      ...body,
      acceptTerms: true,
    });
    return { appointment: r.appointment, authorizationUrl: r.authorizationUrl, notice: r.notice || '' };
  },

  async status(id: string): Promise<AppointmentItem> {
    const r = await apiClient.get<{ appointment: AppointmentItem }>(`/booking/${encodeURIComponent(id)}`);
    return r.appointment;
  },
};
