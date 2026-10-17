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

export interface GuardianPerms {
  viewRecords: boolean;
  addRecords: boolean;
  bookAppointments: boolean;
  receiveReminders: boolean;
  manageGuardians: boolean;
}

export const PERMISSION_LABELS: { key: keyof GuardianPerms; label: string; hint: string }[] = [
  { key: 'viewRecords', label: 'View records', hint: 'See the profile, vaccines, growth and health records' },
  { key: 'addRecords', label: 'Add and edit records', hint: 'Record doses, measurements and update details' },
  { key: 'bookAppointments', label: 'Book appointments', hint: 'Book and cancel visits for the child' },
  { key: 'receiveReminders', label: 'Get reminders', hint: 'Receive vaccine and visit reminders' },
  { key: 'manageGuardians', label: 'Manage guardians', hint: 'Invite and remove other guardians' },
];

export const GUARDIAN_RELATIONSHIPS = ['Mother', 'Father', 'Legal guardian', 'Caregiver', 'Other'] as const;

export interface Guardian {
  id: string;
  displayName: string;
  relationship: string;
  status: 'pending' | 'active';
  inviteEmail: string;
  invitePhone: string;
  inviteExpiresAt: string | null;
  permissions: GuardianPerms;
  effective: GuardianPerms;
  restriction: { level: 'blocked' | 'view_only'; reason: string; orderReference: string; setAt: string } | null;
  identityVerified: boolean;
  acceptedAt: string | null;
}

export interface GuardiansResponse {
  you: { role: 'primary' | 'guardian'; permissions: GuardianPerms; locked: boolean };
  primary: { name: string };
  custodyLock: { orderReference: string; note: string } | null;
  guardians: Guardian[];
  pendingTransfer: { guardianId: string; expiresAt: string } | null;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorName: string;
  actorRole: 'primary' | 'guardian' | 'admin' | 'system';
  action: string;
  detail: string;
}

export const childHealthService = {
  async listGuardians(memberId: string): Promise<GuardiansResponse> {
    return apiClient.get<GuardiansResponse>(`/family/${memberId}/guardians`);
  },

  async inviteGuardian(
    memberId: string,
    data: { displayName: string; relationship: string; email?: string; phone?: string; permissions: Partial<GuardianPerms> },
  ): Promise<{ guardian: Guardian; inviteCode: string; deliveredBy: string[] }> {
    return apiClient.post(`/family/${memberId}/guardians`, data);
  },

  async updateGuardian(memberId: string, guardianId: string, data: { relationship?: string; permissions?: Partial<GuardianPerms> }): Promise<Guardian> {
    const res = await apiClient.patch<{ guardian: Guardian }>(`/family/${memberId}/guardians/${guardianId}`, data);
    return res.guardian;
  },

  async removeGuardian(memberId: string, guardianId: string): Promise<void> {
    await apiClient.delete(`/family/${memberId}/guardians/${guardianId}`);
  },

  async setRestriction(
    memberId: string,
    guardianId: string,
    data: { level: 'blocked' | 'view_only' | 'none'; reason?: string; orderReference?: string },
  ): Promise<Guardian> {
    const res = await apiClient.put<{ guardian: Guardian }>(`/family/${memberId}/guardians/${guardianId}/restriction`, data);
    return res.guardian;
  },

  async requestTransfer(memberId: string, guardianId: string): Promise<void> {
    await apiClient.post(`/family/${memberId}/transfer`, { guardianId });
  },

  async cancelTransfer(memberId: string): Promise<void> {
    await apiClient.delete(`/family/${memberId}/transfer`);
  },

  async acceptTransfer(memberId: string, code: string): Promise<void> {
    await apiClient.post(`/family/${memberId}/transfer/accept`, { code });
  },

  async acceptInvite(code: string): Promise<{ childId: string }> {
    return apiClient.post('/family/guardians/accept', { code });
  },

  async fetchAudit(memberId: string): Promise<AuditEntry[]> {
    const res = await apiClient.get<{ entries: AuditEntry[] }>(`/family/${memberId}/audit`);
    return res.entries;
  },

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
