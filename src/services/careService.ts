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
  /** A Google listing, not a WelliRecord facility: nobody is notified by us. */
  externalFacility?: boolean;
  /** Remark that points the provider to WelliRecord. */
  providerRemark?: string;
}

export type AppointmentStatus =
  | 'requested'
  | 'awaiting_payment'
  | 'awaiting_hmo'
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
  externalFacility?: boolean;
  providerRemark?: string;
  status: AppointmentStatus | string;
  /** Set for visits booked from a provider's published hours. */
  startsAt?: string;
  bookingRef?: string;
  feeMinor?: number;
  currency?: string;
  paymentMethod?: 'online' | 'in_person' | 'hmo';
  paymentStatus?: string;
  /** When the Join button for a virtual visit opens. */
  joinOpensAt?: string;
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

export type PlaceKind = 'hospital' | 'clinic' | 'maternity';

export interface NearbyPlaceItem {
  placeId: string;
  name: string;
  address: string;
  district: string;
  lat: number;
  lng: number;
  rating: number | null;
  openNow: boolean | null;
  distanceKm?: number;
  welliRecord?: boolean;
  facilityId?: string;
}

export const careService = {
  /** Hospitals, clinics or maternity care around a point. Needs a position. */
  async fetchPlaces(kind: PlaceKind, pos: { lat: number; lng: number }): Promise<{ places: NearbyPlaceItem[]; radiusKm?: number }> {
    const res = await apiClient.get<{ success: boolean; places: NearbyPlaceItem[]; radiusKm?: number }>(
      `/care/places?kind=${kind}&lat=${pos.lat}&lng=${pos.lng}`
    );
    return { places: Array.isArray(res?.places) ? res.places : [], radiusKm: res?.radiusKm };
  },

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
  async requestAppointment(payload: AppointmentRequestPayload): Promise<{ appointment: AppointmentItem; notice: string }> {
    const res = await apiClient.post<{ success: boolean; appointment: AppointmentItem; notice?: string }>(
      '/appointments/requests',
      payload
    );
    return { appointment: res.appointment, notice: res.notice || '' };
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
