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
    const payload = {
      ...data,
      fullName: (data.fullName || data.name || '').trim(),
      dateOfBirth: data.dateOfBirth || data.dob,
      dob: data.dateOfBirth || data.dob,
    };
    console.log('[FAMILY ADD PAYLOAD]', JSON.stringify(payload));
    try {
      const res = await apiClient.post<FamilyMemberResponse>('/family/add', payload);
      console.log('[FAMILY ADD RESPONSE]', JSON.stringify(res));
      if (!res || !res.success) {
        throw new Error(res?.message || 'Server rejected family member creation');
      }
      return res.member || null;
    } catch (err: any) {
      console.error('[FAMILY ADD ERROR]', err);
      throw new Error(err?.message || 'Failed to add family member to server');
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
      console.log(`[FAMILY UPDATE PAYLOAD] ${id}`, JSON.stringify(data));
      const res = await apiClient.patch<FamilyMemberResponse>(`/family/${id}`, data);
      console.log('[FAMILY UPDATE RESPONSE]', JSON.stringify(res));
      return res?.member || null;
    } catch (err: any) {
      console.error('[FAMILY UPDATE ERROR]', err);
      throw new Error(err?.message || 'Failed to update family member');
    }
  },

  /**
   * Removes a dependent family member
   */
  async deleteFamilyMember(id: string): Promise<boolean> {
    try {
      console.log(`[FAMILY DELETE] Requesting DELETE /family/${id}`);
      const res = await apiClient.delete<{ success: boolean; message?: string }>(`/family/${id}`);
      console.log('[FAMILY DELETE RESPONSE]', JSON.stringify(res));
      return res?.success ?? true;
    } catch (err: any) {
      console.error('[FAMILY DELETE ERROR]', err);
      throw new Error(err?.message || 'Failed to remove family member');
    }
  },
};
