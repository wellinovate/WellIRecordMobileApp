/**
 * WelliRecord Medical Records Service
 * Handles health vault CRUD, encrypted document upload to cloud storage, and AI OCR extraction.
 */

import { apiClient } from './apiClient';
import { offlineSyncService } from './offlineSyncService';
import { File as ExpoFile } from 'expo-file-system';
import type { HealthRecord, RecordType } from '../data/types';
import type { PickedMediaResult } from '../utils/mediaPicker';

export const RECORD_FILE_MAX_BYTES = 6_000_000;

export interface UploadedRecordFile {
  id: string;
  name: string;
  contentType: string;
  bytes: number;
}

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
   * Uploads one file (photo, PDF, Word, Excel, text) to be attached to a record. The server checks the real
   * type and size and keeps it sealed in our own database. File the record afterwards with the returned id.
   */
  async uploadFile(media: PickedMediaResult, ownerId: string = 'me'): Promise<UploadedRecordFile> {
    if (media.size && media.size > RECORD_FILE_MAX_BYTES) {
      throw new Error('That file is larger than 6 MB. Choose a smaller file or a lower-resolution photo.');
    }
    let dataBase64 = media.base64?.trim() || '';
    if (!dataBase64) {
      try {
        dataBase64 = await new ExpoFile(media.uri).base64();
      } catch {
        throw new Error('The file could not be read. Choose it again.');
      }
    }
    if (!dataBase64) throw new Error('The file is empty. Choose another one.');
    const res = await apiClient.post<{ success: boolean; file: UploadedRecordFile }>(
      '/records/files',
      { name: media.name || 'document', dataBase64, ownerId },
      { timeoutMs: 90000 },
    );
    return res.file;
  },

  /**
   * Saves a newly parsed or uploaded health record to the patient's vault.
   * If offline, enqueues the mutation and stores it in the local cache with optimistic status.
   */
  async createRecord(record: Omit<HealthRecord, 'id'> & { fileIds?: string[] }): Promise<HealthRecord> {
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
