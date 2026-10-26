import { apiClient } from './apiClient';

export type MeasurementKind = 'blood_sugar' | 'ldl_cholesterol' | 'waist' | 'uric_acid' | 'thyroid_tsh';
export interface MeasurementInput { kind: MeasurementKind; value: string; unit: string; context?: string }
export interface LatestMeasurement { value: number; unit: string; context?: string | null; measuredAt?: string }
export interface UnitInfo { default: string; options: string[] }
export interface FrequencyOption { id: string; label: string; perDay: number }
export interface Medication {
  id: string; name: string; dose: string; frequency: string; time: string | null;
  startDate: string; endDate: string | null; notes: string | null;
}
export interface MedicationInput { name: string; dose: string; frequency: string; time?: string; startDate: string; endDate?: string; notes?: string }
export interface FamilyEntry { id: string; relative: string; conditions: string[]; otherText: string | null; ageAtDiagnosis: number | null; living: boolean | null }
export interface FamilyInput { relative: string; conditions: string[]; otherText?: string; ageAtDiagnosis?: string; living?: boolean }

const q = (ownerId: string) => `ownerId=${encodeURIComponent(ownerId)}`;

export const selfReportedService = {
  async loadMeasurements(ownerId: string) {
    const r = await apiClient.get<{ latest: Partial<Record<MeasurementKind, LatestMeasurement>>; units: Record<string, UnitInfo> }>(`/health/measurements?${q(ownerId)}`);
    return r;
  },
  async saveMeasurements(ownerId: string, measurements: MeasurementInput[]) {
    return apiClient.post<{ saved: number }>('/health/measurements', { ownerId, measurements });
  },
  async listMedications(ownerId: string) {
    return apiClient.get<{ medications: Medication[]; frequencies: FrequencyOption[] }>(`/health/medications?${q(ownerId)}`);
  },
  async addMedication(ownerId: string, input: MedicationInput) {
    return apiClient.post<{ medication: Medication }>('/health/medications', { ownerId, ...input });
  },
  async removeMedication(ownerId: string, id: string) {
    return apiClient.delete<{ success: boolean }>(`/health/medications/${encodeURIComponent(id)}?${q(ownerId)}`);
  },
  async familyOptions() {
    return apiClient.get<{ relatives: string[]; conditions: string[] }>('/health/family-history/options');
  },
  async listFamily(ownerId: string) {
    return apiClient.get<{ entries: FamilyEntry[] }>(`/health/family-history?${q(ownerId)}`);
  },
  async addFamily(ownerId: string, input: FamilyInput) {
    return apiClient.post<{ entry: FamilyEntry }>('/health/family-history', { ownerId, ...input });
  },
  async removeFamily(ownerId: string, id: string) {
    return apiClient.delete<{ success: boolean }>(`/health/family-history/${encodeURIComponent(id)}?${q(ownerId)}`);
  },
};
