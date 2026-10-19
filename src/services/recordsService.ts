/**
 * WelliRecord Medical Records Service
 * Handles health vault CRUD, encrypted document upload to cloud storage, and AI OCR extraction.
 */

import { apiClient } from './apiClient';
import { offlineSyncService } from './offlineSyncService';
import type { HealthRecord, RecordType } from '../data/types';

export interface PresignedUploadUrlResponse {
  uploadUrl: string;
  fileKey: string;
  expiresInSeconds: number;
}

export const recordsService = {
  /**
   * Fetches all health records for a specific family member vault.
   * Offline-First: Checks local secure cache first, revalidates with cloud when online.
   */
  async fetchRecords(ownerId: string = 'me'): Promise<HealthRecord[]> {
    // Check if device is offline or in simulated offline mode
    if (!offlineSyncService.isOnline()) {
      const cached = await offlineSyncService.getCachedRecords(ownerId);
      if (cached && cached.length > 0) {
        console.log(`[recordsService] Serving ${cached.length} records from offline cache for ${ownerId}`);
        return cached;
      }
      return [];
    }

    try {
      const records = await apiClient.get<HealthRecord[]>('/records', {
        params: { ownerId },
      });
      if (Array.isArray(records)) {
        // Asynchronously update local offline cache for instant access next time
        offlineSyncService.cacheRecords(ownerId, records);
        return records;
      }
      return [];
    } catch (error) {
      console.warn('[recordsService] Cloud fetch failed, attempting offline cache fallback:', error);
      const cached = await offlineSyncService.getCachedRecords(ownerId);
      if (cached && cached.length > 0) {
        return cached;
      }
      return [];
    }
  },

  /**
   * Fetches provider-submitted lab results from shared labresults collection
   */
  async fetchLabResults(): Promise<any[]> {
    const res = await apiClient.get<{ success: boolean; items: any[] }>('/records/labs');
    return res?.items || [];
  },

  /**
   * Fetches provider-submitted vitals from the shared vitals collection
   */
  async fetchVitals(): Promise<any[]> {
    const res = await apiClient.get<{ success: boolean; items: any[] }>('/records/vitals');
    return res?.items || [];
  },

  /**
   * Fetches provider-submitted medications from the shared medications collection
   */
  async fetchProviderMedications(): Promise<any[]> {
    const res = await apiClient.get<{ success: boolean; items: any[] }>('/records/medications');
    return res?.items || [];
  },

  /**
   * Generates a pre-signed S3/GCS URL for client-side encrypted medical document upload
   */
  async getPresignedUploadUrl(
    fileName: string,
    contentType: string
  ): Promise<PresignedUploadUrlResponse> {
    return apiClient.post<PresignedUploadUrlResponse>('/records/upload-url', {
      fileName,
      contentType,
    });
  },

  /**
   * Saves a newly parsed or uploaded health record to the patient's vault.
   * If offline, enqueues the mutation and stores it in the local cache with optimistic status.
   */
  async createRecord(record: Omit<HealthRecord, 'id'>): Promise<HealthRecord> {
    const localId = `r_${Date.now()}`;
    const localRecord: HealthRecord = {
      ...record,
      id: localId,
    };

    if (!offlineSyncService.isOnline()) {
      await offlineSyncService.enqueue('CREATE_RECORD', record);
      const ownerId = record.ownerId || 'me';
      const existing = (await offlineSyncService.getCachedRecords(ownerId)) || [];
      await offlineSyncService.cacheRecords(ownerId, [localRecord, ...existing]);
      return localRecord;
    }

    try {
      const created = await apiClient.post<HealthRecord>('/records', record);
      const ownerId = record.ownerId || 'me';
      const existing = (await offlineSyncService.getCachedRecords(ownerId)) || [];
      await offlineSyncService.cacheRecords(ownerId, [created, ...existing]);
      return created;
    } catch (err) {
      console.warn('[recordsService] Cloud createRecord failed, queuing offline mutation:', err);
      await offlineSyncService.enqueue('CREATE_RECORD', record);
      const ownerId = record.ownerId || 'me';
      const existing = (await offlineSyncService.getCachedRecords(ownerId)) || [];
      await offlineSyncService.cacheRecords(ownerId, [localRecord, ...existing]);
      return localRecord;
    }
  },

  /**
   * Triggers OCR and clinical biomarker extraction on an uploaded document
   */
  async extractOcrBiomarkers(fileKey: string, type: RecordType): Promise<HealthRecord['extractedOcr']> {

    return apiClient.post<HealthRecord['extractedOcr']>('/records/ocr-extract', {
      fileKey,
      type,
    });
  },

  /**
   * Deletes a health record from the vault.
   * If offline, enqueues the delete mutation and updates local cache.
   */
  async deleteRecord(recordId: string, ownerId: string = 'me'): Promise<{ success: boolean }> {
    if (!offlineSyncService.isOnline()) {
      await offlineSyncService.enqueue('DELETE_RECORD', { recordId });
      const existing = (await offlineSyncService.getCachedRecords(ownerId)) || [];
      await offlineSyncService.cacheRecords(ownerId, existing.filter((r) => r.id !== recordId));
      return { success: true };
    }

    try {
      const res = await apiClient.delete<{ success: boolean }>(`/records/${recordId}`);
      const existing = (await offlineSyncService.getCachedRecords(ownerId)) || [];
      await offlineSyncService.cacheRecords(ownerId, existing.filter((r) => r.id !== recordId));
      return res;
    } catch (err) {
      console.warn('[recordsService] Cloud deleteRecord failed, queuing offline mutation:', err);
      await offlineSyncService.enqueue('DELETE_RECORD', { recordId });
      const existing = (await offlineSyncService.getCachedRecords(ownerId)) || [];
      await offlineSyncService.cacheRecords(ownerId, existing.filter((r) => r.id !== recordId));
      return { success: true };
    }
  },
};
