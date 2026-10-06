/**
 * WelliRecord Healthcare Provider Directory & Telehealth Service
 * Queries Lagos hospitals/clinics and manages appointments and video sessions.
 */

import { CONFIG } from './config';
import { apiClient } from './apiClient';
import { FACILITIES } from '../data/mockData';
import type { CareFacility } from '../data/types';

export interface AppointmentRequestPayload {
  facilityId?: string;
  facilityName?: string;
  facilityAddress?: string;
  familyMemberId?: string;
  /** YYYY-MM-DD */
  date: string;
  timeSlot: string;
  reason?: string;
}

export type AppointmentStatus =
  | 'requested'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'no_show'
  | 'cancelled';

export interface AppointmentItem {
  id: string;
  source: 'request' | 'web';
  facilityName: string;
  facilityAddress: string;
  familyMemberId: string;
  scheduledFor: string;
  timeSlot: string;
  reason: string;
  status: AppointmentStatus | string;
}

export const careService = {
  /**
   * Queries verified healthcare facilities in Lagos with specialty and HMO filtering
   */
  async fetchFacilities(params?: { query?: string; type?: string; specialty?: string }): Promise<CareFacility[]> {
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 300));
      let results = [...FACILITIES];

      if (params?.type && params.type !== 'All') {
        results = results.filter((f) => f.typeLabel.toLowerCase().includes(params.type!.toLowerCase()));
      }

      if (params?.specialty && params.specialty !== 'All') {
        results = results.filter((f) => f.specialty.toLowerCase().includes(params.specialty!.toLowerCase()));
      }

      if (params?.query) {
        const q = params.query.toLowerCase();
        results = results.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.address.toLowerCase().includes(q) ||
            f.specialty.toLowerCase().includes(q) ||
            f.acceptedHmos?.some((h) => h.toLowerCase().includes(q))
        );
      }

      return results;
    }

    return apiClient.get<CareFacility[]>('/care/facilities', { params });
  },

  /**
   * Sends an appointment request to the server. The facility confirms it.
   */
  async requestAppointment(payload: AppointmentRequestPayload): Promise<AppointmentItem> {
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 400));
      return {
        id: `apt_${Date.now()}`,
        source: 'request',
        facilityName: payload.facilityName || 'Demo facility',
        facilityAddress: payload.facilityAddress || '',
        familyMemberId: payload.familyMemberId || '',
        scheduledFor: new Date(payload.date).toISOString(),
        timeSlot: payload.timeSlot,
        reason: payload.reason || '',
        status: 'requested',
      };
    }
    const res = await apiClient.post<{ success: boolean; appointment: AppointmentItem }>(
      '/appointments/requests',
      payload
    );
    return res.appointment;
  },

  /**
   * Lists the caller's appointment requests and web bookings, soonest first.
   */
  async fetchAppointments(): Promise<AppointmentItem[]> {
    if (CONFIG.demoMode) return [];
    const res = await apiClient.get<{ success: boolean; appointments: AppointmentItem[] }>('/appointments');
    return Array.isArray(res?.appointments) ? res.appointments : [];
  },

  async cancelAppointment(id: string): Promise<AppointmentItem | null> {
    if (CONFIG.demoMode) return null;
    const res = await apiClient.post<{ success: boolean; appointment: AppointmentItem }>(
      `/appointments/${id}/cancel`,
      {}
    );
    return res.appointment;
  },
};
