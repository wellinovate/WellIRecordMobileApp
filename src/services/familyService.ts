/**
 * WelliRecord Family & Dependents Service
 * Manages dependents, family member linkages, guardian permissions, and cloud vault sync.
 */

import { apiClient } from './apiClient';
import type { FamilyMember } from '../data/types';

export interface FamilyListResponse {
  success: boolean;
  familyMembers: FamilyMember[];
  message?: string;
}

export interface AddFamilyMemberData {
  fullName: string;
  name?: string;
  relationship: string;
  dateOfBirth?: string;
  dob?: string;
  gender?: string;
  bloodType?: string;
  genotype?: string;
  allergies?: string;
  phone?: string;
  linkedAccountId?: string | null;
}

export interface FamilyMemberResponse {
  success: boolean;
  member?: FamilyMember;
  message?: string;
}

export const familyService = {
  /**
   * Fetches all dependents and family members managed by the authenticated account
   */
  async fetchFamilyMembers(): Promise<FamilyMember[]> {
    try {
      const res = await apiClient.get<FamilyListResponse>('/family/list');
      return res?.familyMembers || [];
    } catch {
      return [];
    }
  },

  /**
   * Adds a new dependent family member document under the authenticated account
   */
  async addFamilyMember(data: AddFamilyMemberData): Promise<FamilyMember | null> {
    try {
      const res = await apiClient.post<FamilyMemberResponse>('/family/add', {
        ...data,
        fullName: data.fullName || data.name,
      });
      return res?.member || null;
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to add family member');
    }
  },

  /**
   * Updates an existing dependent's information
   */
  async updateFamilyMember(
    id: string,
    data: Partial<AddFamilyMemberData>
  ): Promise<FamilyMember | null> {
    try {
      const res = await apiClient.patch<FamilyMemberResponse>(`/family/${id}`, data);
      return res?.member || null;
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to update family member');
    }
  },

  /**
   * Removes a dependent family member
   */
  async deleteFamilyMember(id: string): Promise<boolean> {
    try {
      const res = await apiClient.delete<{ success: boolean; message?: string }>(`/family/${id}`);
      return res?.success ?? true;
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to remove family member');
    }
  },
};
