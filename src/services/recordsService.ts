/**
 * WelliRecord Medical Records Service
 * Handles health vault CRUD, encrypted document upload to cloud storage, and AI OCR extraction.
 */

import { CONFIG } from './config';
import { apiClient } from './apiClient';
import { RECORDS } from '../data/mockData';
import type { HealthRecord, RecordType } from '../data/types';

export interface PresignedUploadUrlResponse {
  uploadUrl: string;
  fileKey: string;
  expiresInSeconds: number;
}

export const recordsService = {
  /**
   * Fetches all health records for a specific family member vault
   */
  async fetchRecords(ownerId: string = 'me'): Promise<HealthRecord[]> {
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 300));
      return RECORDS.filter((r) => r.ownerId === ownerId);
    }

    return apiClient.get<HealthRecord[]>('/records', {
      params: { ownerId },
    });
  },

  /**
   * Generates a pre-signed S3/GCS URL for client-side encrypted medical document upload
   */
  async getPresignedUploadUrl(
    fileName: string,
    contentType: string
  ): Promise<PresignedUploadUrlResponse> {
    if (CONFIG.demoMode) {
      return {
        uploadUrl: `https://storage.wellirecord.com/vault-uploads/${Date.now()}_${fileName}`,
        fileKey: `vault/${Date.now()}_${fileName}`,
        expiresInSeconds: 900,
      };
    }

    return apiClient.post<PresignedUploadUrlResponse>('/records/upload-url', {
      fileName,
      contentType,
    });
  },

  /**
   * Saves a newly parsed or uploaded health record to the patient's vault
   */
  async createRecord(record: Omit<HealthRecord, 'id'>): Promise<HealthRecord> {
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 400));
      return {
        ...record,
        id: `r_${Date.now()}`,
      };
    }

    return apiClient.post<HealthRecord>('/records', record);
  },

  /**
   * Triggers OCR and clinical biomarker extraction on an uploaded document
   */
  async extractOcrBiomarkers(fileKey: string, type: RecordType): Promise<HealthRecord['extractedOcr']> {
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 800));
      return {
        keyValues: [
          { label: 'Patient Name', value: 'Amara Nwosu' },
          { label: 'Laboratory / Facility', value: 'SYNLAB Diagnostic Laboratories Lekki' },
          { label: 'Encounter Date', value: 'Today' },
          { label: 'Test Type', value: type },
        ],
        statusBadge: 'Doctor Certified',
      };
    }

    return apiClient.post<HealthRecord['extractedOcr']>('/records/extract-ocr', {
      fileKey,
      type,
    });
  },

  /**
   * Deletes a health record from the vault
   */
  async deleteRecord(recordId: string): Promise<{ success: boolean }> {
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 300));
      return { success: true };
    }

    return apiClient.delete<{ success: boolean }>(`/records/${recordId}`);
  },
};
