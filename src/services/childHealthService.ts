/**
 * Child health profile API: immunization schedule, vaccinations, growth and
 * birth/emergency details for a dependent the signed-in guardian manages.
 */

import { apiClient } from './apiClient';
import type { ChildProfileDetails } from '../data/types';
import type { ImmunizationSchedule, Vaccination } from '../utils/immunization';

export interface GrowthEntry {
  id: string;
  measuredOn: string;
  weightKg: number | null;
  lengthCm: number | null;
  headCircumferenceCm: number | null;
  source: 'caregiver' | 'clinic';
  notes: string;
}

export interface ChildProfileBundle {
  profile: {
    id: string;
    wrId: string | null;
    fullName: string;
    dateOfBirth: string | null;
    gender: string;
    bloodType: string;
    genotype: string;
    allergies: string;
    childProfile: ChildProfileDetails;
  };
  vaccinations: Vaccination[];
  growth: GrowthEntry[];
}

export interface VaccinationInput {
  vaccineCode: string;
  administeredDate: string;
  facility?: string;
  provider?: string;
  lotNumber?: string;
  manufacturer?: string;
  expiryDate?: string;
  site?: string;
  reaction?: string;
  notes?: string;
}

export interface GrowthInput {
  measuredOn: string;
  weightKg?: string;
  lengthCm?: string;
  headCircumferenceCm?: string;
  notes?: string;
}

export type ChildProfileUpdate = ChildProfileDetails & {
  bloodType?: string;
  genotype?: string;
  allergies?: string;
  gender?: string;
};

export const childHealthService = {
  async fetchSchedule(): Promise<ImmunizationSchedule> {
    const res = await apiClient.get<{ schedule: ImmunizationSchedule }>('/immunization/schedule');
    return res.schedule;
  },

  async fetchBundle(memberId: string): Promise<ChildProfileBundle> {
    return apiClient.get<ChildProfileBundle>(`/family/${memberId}/child-profile`);
  },

  async updateProfile(memberId: string, data: ChildProfileUpdate): Promise<ChildProfileBundle['profile']> {
    const res = await apiClient.patch<{ profile: ChildProfileBundle['profile'] }>(`/family/${memberId}/child-profile`, data);
    return res.profile;
  },

  async addVaccination(memberId: string, data: VaccinationInput): Promise<Vaccination> {
    const res = await apiClient.post<{ vaccination: Vaccination }>(`/family/${memberId}/vaccinations`, data);
    return res.vaccination;
  },

  async removeVaccination(memberId: string, vaccinationId: string): Promise<void> {
    await apiClient.delete(`/family/${memberId}/vaccinations/${vaccinationId}`);
  },

  async addGrowth(memberId: string, data: GrowthInput): Promise<GrowthEntry> {
    const res = await apiClient.post<{ entry: GrowthEntry }>(`/family/${memberId}/growth`, data);
    return res.entry;
  },

  async removeGrowth(memberId: string, growthId: string): Promise<void> {
    await apiClient.delete(`/family/${memberId}/growth/${growthId}`);
  },
};
