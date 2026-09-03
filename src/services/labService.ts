/**
 * WelliRecord Lab/Diagnostic Center Directory Service
 * Locator-only — separate from verified WelliRecord partner facilities.
 */
import { apiClient } from './apiClient';

export interface LabDirectoryItem {
  placeId: string;
  name: string;
  address: string;
  district: string;
  lat: number;
  lng: number;
  rating: number | null;
  openNow: boolean | null;
}

export interface FetchLabsResult {
  labs: LabDirectoryItem[];
  usedFallback: boolean;
}

export const labService = {
  async fetchLabs(): Promise<FetchLabsResult> {
    try {
      const res = await apiClient.get<{
        success: boolean;
        labs: LabDirectoryItem[];
        usedFallback?: boolean;
      }>('/care/labs');
      if (res && Array.isArray(res.labs)) {
        return { labs: res.labs, usedFallback: Boolean(res.usedFallback) };
      }
      return { labs: [], usedFallback: false };
    } catch (err) {
      console.error('[LabService] fetchLabs error:', err);
      return { labs: [], usedFallback: false };
    }
  },
};
