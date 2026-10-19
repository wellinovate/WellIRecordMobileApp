/**
 * WelliRecord E-Pharmacy & Prescription Refill Service
 * Manages chronic medication refills, HMO tariff co-pay calculations, and Lagos delivery dispatch.
 */

import { apiClient } from './apiClient';
import type { PrescriptionItem } from '../data/types';

export const pharmacyService = {
  /**
   * Fetches active prescriptions for a family member vault
   */
  async fetchPrescriptions(ownerId: string = 'me'): Promise<PrescriptionItem[]> {

    return apiClient.get<PrescriptionItem[]>('/pharmacy/prescriptions', {
      params: { ownerId },
    });
  },

  /**
   * Sends a refill request for a prescription. A pharmacist reviews it.
   */
  async requestRefill(payload: { prescriptionId: string; deliveryAddress: string; notes?: string }): Promise<{ orderId: string }> {
    return apiClient.post<{ orderId: string }>(
      `/pharmacy/prescriptions/${encodeURIComponent(payload.prescriptionId)}/refill`,
      { deliveryAddress: payload.deliveryAddress, notes: payload.notes }
    );
  },

  /**
   * Lists the caller's own patient-initiated medication orders, newest first.
   */
  async fetchOrders(): Promise<PharmacyOrder[]> {
    const res = await apiClient.get<{ success: boolean; orders: PharmacyOrder[] }>('/pharmacy/orders');
    return Array.isArray(res?.orders) ? res.orders : [];
  },

  /**
   * Tracks delivery status for one order.
   */
  async getDeliveryStatus(orderId: string): Promise<PharmacyOrder> {

    return apiClient.get<PharmacyOrder>(`/pharmacy/orders/${orderId}/status`);
  },

  /**
   * Fetches locator-only pharmacies (e.g. Abuja districts) from Google Places
   */
  async fetchPharmacies(pos?: { lat: number; lng: number }): Promise<FetchPharmaciesResult> {
    try {
      const res = await apiClient.get<{
        success: boolean;
        pharmacies: PharmacyDirectoryItem[];
        usedFallback?: boolean;
        radiusKm?: number;
      }>(pos ? `/care/pharmacies?lat=${pos.lat}&lng=${pos.lng}` : '/care/pharmacies');
      if (res && Array.isArray(res.pharmacies)) {
        return {
          pharmacies: res.pharmacies,
          usedFallback: Boolean(res.usedFallback),
          radiusKm: res.radiusKm,
        };
      }
      return { pharmacies: [], usedFallback: false };
    } catch (err) {
      console.error('[PharmacyService] fetchPharmacies error:', err);
      return { pharmacies: [], usedFallback: false };
    }
  },
};

export interface PharmacyOrder {
  id: string;
  medicationName: string;
  dosage: string;
  quantity: number;
  status: string;
  /** 0 review, 1 verified, 2 dispensed, 3 en route, 4 delivered, -1 rejected */
  step: number;
  statusText: string;
  eta: string;
  deliveryAddress: string;
  deliveryType: string;
  familyMemberId: string;
  rejectionReason?: string;
  rider?: { name: string; phone: string };
  createdAt: string;
  updatedAt: string;
}

export interface FetchPharmaciesResult {
  pharmacies: PharmacyDirectoryItem[];
  usedFallback: boolean;
  radiusKm?: number;
}

export interface PharmacyDirectoryItem {
  placeId: string;
  name: string;
  address: string;
  district: string;
  lat: number;
  lng: number;
  rating: number | null;
  openNow: boolean | null;
  distanceKm?: number;
  welliRecord?: boolean;
  facilityId?: string;
}

