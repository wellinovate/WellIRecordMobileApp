/**
 * WelliRecord Healthcare Facility Directory Service
 * Fetches verified hospitals, diagnostic labs, pharmacies, and clinics from MongoDB backend.
 */

import { apiClient } from './apiClient';
import { FACILITIES } from '../data/mockData';
import type { CareFacility } from '../data/types';

export const facilityService = {
  /**
   * Fetches health facilities with fallback to bundled directory
   */
  async fetchFacilities(): Promise<CareFacility[]> {
    try {
      const res = await apiClient.get<any>('/care/facilities');
      const list = Array.isArray(res) ? res : res?.facilities || [];

      if (Array.isArray(list) && list.length > 0) {
        return list.map((f: any) => ({
          id: f.id || f._id?.toString() || `f_${Math.random()}`,
          name: f.name || f.facilityName || 'Healthcare Facility',
          type: f.type || 'Hospital',
          typeLabel: f.typeLabel || f.type || 'Healthcare Facility',
          leadName: f.leadName || 'Medical Director',
          leadTitle: f.leadTitle || 'Chief Medical Officer',
          address: f.address || (f.city && f.state ? `${f.city}, ${f.state}` : 'Lagos, Nigeria'),
          specialty: f.specialty || 'General Medicine',
          acceptingPatients: f.acceptingPatients !== undefined ? f.acceptingPatients : true,
          accredited: f.accredited !== undefined ? f.accredited : true,
          verified: f.verified !== undefined ? f.verified : (f.isVerified !== undefined ? f.isVerified : true),
          instantBooking: f.instantBooking !== undefined ? f.instantBooking : true,
          emoji: f.emoji || (f.type === 'Pharmacy' ? '💊' : f.type === 'Laboratory' ? '🧪' : '🏥'),
          gradient: f.gradient || 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)',
          acceptedHmos: f.acceptedHmos || ['Hygeia HMO', 'AXA Mansard Health', 'Reliance HMO'],
          consultationFeeNaira: f.consultationFeeNaira || 10000,
        }));
      }

      return FACILITIES;
    } catch {
      return FACILITIES;
    }
  },
};
