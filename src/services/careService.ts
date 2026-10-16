/**
 * WelliRecord Healthcare Provider Directory & Telehealth Service
 * Queries Lagos hospitals/clinics and manages appointments and video sessions.
 */

import { apiClient } from './apiClient';
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
  visitType?: 'in_person' | 'video';
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
  visitType?: 'in_person' | 'video';
  status: AppointmentStatus | string;
  visitSummary?: { diagnosis: string; notes: string; authoredBy: string };
}

export interface DirectoryDoctor {
  id: string;
  name: string;
  role: string;
  organizationName: string;
  organizationId: string;
  address: string;
}

export interface TelehealthSession {
  url: string;
  token: string;
  room: string;
}

export const careService = {
  async fetchTelehealthToken(appointmentId: string): Promise<TelehealthSession> {
    const res = await apiClient.post<{ success: boolean } & TelehealthSession>(
      `/telehealth/appointments/${encodeURIComponent(appointmentId)}/token`,
      {}
    );
    return { url: res.url, token: res.token, room: res.room };
  },

  async fetchDoctors(): Promise<DirectoryDoctor[]> {
    const res = await apiClient.get<{ success: boolean; doctors: DirectoryDoctor[] }>('/care/doctors');
    return Array.isArray(res?.doctors) ? res.doctors : [];
  },

  /**
   * Queries verified healthcare facilities in Lagos with specialty and HMO filtering
   */
  async fetchFacilities(params?: { query?: string; type?: string; specialty?: string }): Promise<CareFacility[]> {

    return apiClient.get<CareFacility[]>('/care/facilities', { params });
  },

  /**
   * Sends an appointment request to the server. The facility confirms it.
   */
  async requestAppointment(payload: AppointmentRequestPayload): Promise<AppointmentItem> {
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
    const res = await apiClient.get<{ success: boolean; appointments: AppointmentItem[] }>('/appointments');
    return Array.isArray(res?.appointments) ? res.appointments : [];
  },

  async cancelAppointment(id: string): Promise<AppointmentItem | null> {
    const res = await apiClient.post<{ success: boolean; appointment: AppointmentItem }>(
      `/appointments/${id}/cancel`,
      {}
    );
    return res.appointment;
  },
};
