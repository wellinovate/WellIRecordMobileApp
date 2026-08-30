/**
 * WelliRecord Patient Profile Service
 * Manages patient identity, demographics, cloud sync, and health passport retrieval.
 */

import { apiClient } from './apiClient';
import type { FamilyMember } from '../data/types';

export interface ProfileResponse {
  success: boolean;
  profile?: any;
  message?: string;
}

export const profileService = {
  /**
   * Fetches the authenticated patient's profile from the cloud health vault
   */
  async fetchMyProfile(): Promise<any | null> {
    try {
      const res = await apiClient.get<ProfileResponse>('/profile/me');
      return res?.profile || null;
    } catch {
      return null;
    }
  },

  /**
   * Updates patient demographic and medical profile fields
   */
  async updateProfile(draft: Partial<FamilyMember>): Promise<ProfileResponse> {
    return apiClient.patch<ProfileResponse>('/profile/update', {
      fullName: draft.name,
      name: draft.name,
      dob: draft.dob,
      dateOfBirth: draft.dob,
      gender: draft.gender,
      bloodType: draft.bloodType,
      genotype: draft.genotype,
      email: draft.email,
      phone: draft.phone,
      phoneNumber: draft.phone,
      hmoProvider: draft.insuranceProvider,
      insuranceProvider: draft.insuranceProvider,
      hmoPolicyNumber: draft.insuranceId,
      insuranceId: draft.insuranceId,
      wrId: draft.wrId,
      allergies: draft.allergies,
      conditions: draft.conditions,
      address: draft.address,
      contact: draft.contact,
    });
  },
};
