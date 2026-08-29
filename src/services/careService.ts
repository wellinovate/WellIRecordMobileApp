/**
 * WelliRecord Healthcare Provider Directory & Telehealth Service
 * Queries Lagos hospitals/clinics and manages appointments and video sessions.
 */

import { CONFIG } from './config';
import { apiClient } from './apiClient';
import { FACILITIES } from '../data/mockData';
import type { CareFacility } from '../data/types';

export interface BookAppointmentPayload {
  facilityId: string;
  patientId: string;
  appointmentDate: string;
  timeSlot: string;
  reason: string;
  hmoProvider?: string;
}

export interface AppointmentConfirmation {
  appointmentId: string;
  facilityName: string;
  appointmentDate: string;
  timeSlot: string;
  status: 'confirmed' | 'pending_preauth';
  qrCheckInCode: string;
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
   * Books a hospital consultation or lab appointment with HMO verification
   */
  async bookAppointment(payload: BookAppointmentPayload): Promise<AppointmentConfirmation> {
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 500));
      return {
        appointmentId: `apt_${Date.now()}`,
        facilityName: 'Lagoon Hospital Lekki',
        appointmentDate: payload.appointmentDate || 'Tomorrow',
        timeSlot: payload.timeSlot || '10:30 AM',
        status: 'confirmed',
        qrCheckInCode: `WL-APT-${Date.now()}`,
      };
    }

    return apiClient.post<AppointmentConfirmation>('/care/appointments', payload);
  },
};
