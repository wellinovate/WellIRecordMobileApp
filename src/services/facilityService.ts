/**
 * WelliRecord Healthcare Facility Directory Service
 * Fetches verified hospitals, diagnostic labs, pharmacies, and clinics from MongoDB backend,
 * and merges registered OrganizationProfile providers from /care/providers.
 */

import { apiClient } from './apiClient';
import { FACILITIES } from '../data/mockData';
import type { CareFacility, FacilityType } from '../data/types';

export const facilityService = {
  /**
   * Fetches health facilities with fallback to bundled directory,
   * merging website-registered OrganizationProfiles from /care/providers.
   */
  async fetchFacilities(): Promise<CareFacility[]> {
    try {
      const [facRes, provRes] = await Promise.allSettled([
        apiClient.get<any>('/care/facilities'),
        apiClient.get<{ success: boolean; providers: any[] }>('/care/providers'),
      ]);

      let facilitiesList: CareFacility[] = [];

      // 1. Process /care/facilities
      if (facRes.status === 'fulfilled' && facRes.value) {
        const res = facRes.value;
        const list = Array.isArray(res) ? res : res?.facilities || [];
        if (Array.isArray(list) && list.length > 0) {
          facilitiesList = list.map((f: any) => ({
            id: f.id || f._id?.toString() || `f_${Math.random()}`,
            wrOrgId: f.wrOrgId || f.id || null,
            name: f.name || f.facilityName || 'Healthcare Facility',
            type: (f.type || 'Hospital') as FacilityType,
            typeLabel: f.typeLabel || f.type || 'Healthcare Facility',
            leadName: f.leadName || 'Medical Director',
            leadTitle: f.leadTitle || 'Chief Medical Officer',
            address: f.address || (f.city && f.state ? `${f.city}, ${f.state}` : 'Lagos, Nigeria'),
            specialty: f.specialty || 'General Medicine',
            acceptingPatients: f.acceptingPatients !== undefined ? f.acceptingPatients : true,
            accredited: f.accredited !== undefined ? f.accredited : true,
            verified: f.verified !== undefined ? f.verified : (f.isVerified !== undefined ? f.isVerified : true),
            isVerified: f.isVerified !== undefined ? f.isVerified : (f.verified !== undefined ? f.verified : true),
            instantBooking: f.instantBooking !== undefined ? f.instantBooking : true,
            emoji: f.emoji || (f.type === 'Pharmacy' ? '💊' : f.type === 'Laboratory' ? '🧪' : '🏥'),
            gradient: f.gradient || 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)',
            acceptedHmos: f.acceptedHmos || ['Hygeia HMO', 'AXA Mansard Health', 'Reliance HMO'],
            consultationFeeNaira: f.consultationFeeNaira || 10000,
          }));
        }
      }

      // If /care/facilities didn't return items, initialize with bundled FACILITIES
      if (facilitiesList.length === 0) {
        facilitiesList = FACILITIES.map((f) => ({
          ...f,
          isVerified: f.isVerified !== undefined ? f.isVerified : f.verified,
        }));
      }

      // 2. Process /care/providers (website-registered OrganizationProfiles)
      if (provRes.status === 'fulfilled' && provRes.value) {
        const pRes = provRes.value;
        const provList = Array.isArray(pRes.providers) ? pRes.providers : [];

        for (const prov of provList) {
          if (!prov || !prov.name) continue;
          const provId = prov.id || prov.wrOrgId || prov._id?.toString();
          if (!provId) continue;

          // Check if already in facilitiesList to avoid duplicates
          const existingIdx = facilitiesList.findIndex(
            (f) => f.id === provId || (prov.wrOrgId && f.wrOrgId === prov.wrOrgId)
          );

          const rawType = (prov.type || '').toLowerCase();
          const normalizedType: FacilityType =
            rawType.includes('pharmacy') ? 'Pharmacy' :
            rawType.includes('lab') || rawType.includes('diagnostic') || rawType.includes('imaging') ? 'Laboratory' :
            rawType.includes('clinic') ? 'Clinic' :
            rawType.includes('private') ? 'Private Practice' : 'Hospital';

          const emoji =
            rawType.includes('pharmacy') ? '💊' :
            rawType.includes('lab') || rawType.includes('diagnostic') ? '🔬' :
            rawType.includes('clinic') ? '🩺' :
            rawType.includes('imaging') ? '🩻' : '🏥';

          const isVerified = Boolean(prov.isVerified);

          const mappedFacility: CareFacility = {
            id: provId,
            wrOrgId: prov.wrOrgId || provId,
            name: prov.name,
            type: normalizedType,
            typeLabel: prov.type || `${normalizedType} Provider`,
            leadName: prov.leadName || 'Medical Director / Attending Lead',
            leadTitle: prov.leadTitle || 'Registered Healthcare Provider',
            address: prov.address || 'Nigeria',
            specialty: prov.specialty || (prov.type ? `${prov.type} Services` : 'Comprehensive Healthcare'),
            acceptingPatients: true,
            accredited: isVerified,
            verified: isVerified,
            isVerified,
            logo: prov.logo || null,
            instantBooking: true,
            emoji,
            gradient: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
            acceptedHmos: prov.acceptedHmos || ['All Major HMOs', 'Private Pay'],
            consultationFeeNaira: prov.consultationFeeNaira || 10000,
          };

          if (existingIdx >= 0) {
            facilitiesList[existingIdx] = {
              ...facilitiesList[existingIdx],
              ...mappedFacility,
            };
          } else {
            facilitiesList.push(mappedFacility);
          }
        }
      }

      return facilitiesList;
    } catch {
      return FACILITIES.map((f) => ({
        ...f,
        isVerified: f.isVerified !== undefined ? f.isVerified : f.verified,
      }));
    }
  },
};
