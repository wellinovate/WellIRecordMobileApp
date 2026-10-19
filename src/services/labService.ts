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
  distanceKm?: number;
}

export interface FetchLabsResult {
  labs: LabDirectoryItem[];
  usedFallback: boolean;
  radiusKm?: number;
}

export const labService = {
  async fetchLabs(pos?: { lat: number; lng: number }): Promise<FetchLabsResult> {
    try {
      const res = await apiClient.get<{
        success: boolean;
        labs: LabDirectoryItem[];
        usedFallback?: boolean;
        radiusKm?: number;
      }>(pos ? `/care/labs?lat=${pos.lat}&lng=${pos.lng}` : '/care/labs');
      if (res && Array.isArray(res.labs)) {
        return { labs: res.labs, usedFallback: Boolean(res.usedFallback), radiusKm: res.radiusKm };
      }
      return { labs: [], usedFallback: false };
    } catch (err) {
      console.error('[LabService] fetchLabs error:', err);
      return { labs: [], usedFallback: false };
    }
  },
};
