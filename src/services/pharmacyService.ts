/**
 * WelliRecord E-Pharmacy & Prescription Refill Service
 * Manages chronic medication refills, HMO tariff co-pay calculations, and Lagos delivery dispatch.
 */

import { CONFIG } from './config';
import { apiClient } from './apiClient';
import { INITIAL_PRESCRIPTIONS } from '../data/mockData';
import type { PrescriptionItem } from '../data/types';

export interface RefillOrderRequest {
  prescriptionId: string;
  deliveryAddress: string;
  hmoProvider: string;
  notes?: string;
}

export interface RefillOrderResponse {
  orderId: string;
  prescriptionId: string;
  medicationName: string;
  totalPriceNaira: number;
  hmoCoveredNaira: number;
  patientCoPayNaira: number;
  status: 'refill_requested' | 'in_transit' | 'delivered';
  eta: string;
  trackingNumber: string;
}

export const pharmacyService = {
  /**
   * Fetches active prescriptions for a family member vault
   */
  async fetchPrescriptions(ownerId: string = 'me'): Promise<PrescriptionItem[]> {
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 300));
      return INITIAL_PRESCRIPTIONS.filter((p) => p.ownerId === ownerId);
    }

    return apiClient.get<PrescriptionItem[]>('/pharmacy/prescriptions', {
      params: { ownerId },
    });
  },

  /**
   * Requests a medication refill with automatic HMO tariff co-pay resolution
   */
  async requestRefill(payload: RefillOrderRequest): Promise<RefillOrderResponse> {
    if (CONFIG.demoMode) {
      await new Promise((res) => setTimeout(res, 600));
      return {
        orderId: `ord_${Date.now()}`,
        prescriptionId: payload.prescriptionId,
        medicationName: 'Amlodipine 5mg Daily',
        totalPriceNaira: 6500,
        hmoCoveredNaira: 5200,
        patientCoPayNaira: 1300,
        status: 'refill_requested',
        eta: 'Today, by 4:30 PM via Express Courier',
        trackingNumber: `WL-LAG-${Math.floor(100000 + Math.random() * 900000)}`,
      };
    }

    return apiClient.post<RefillOrderResponse>('/pharmacy/refills', payload);
  },

  /**
   * Lists the caller's own patient-initiated medication orders, newest first.
   */
  async fetchOrders(): Promise<PharmacyOrder[]> {
    if (CONFIG.demoMode) return [];
    const res = await apiClient.get<{ success: boolean; orders: PharmacyOrder[] }>('/pharmacy/orders');
    return Array.isArray(res?.orders) ? res.orders : [];
  },

  /**
   * Tracks delivery status for one order.
   */
  async getDeliveryStatus(orderId: string): Promise<PharmacyOrder> {
    if (CONFIG.demoMode) {
      return {
        id: orderId,
        medicationName: 'Demo order',
        dosage: '',
        quantity: 1,
        status: 'in_transit',
        step: 3,
        statusText: 'Rider en route',
        eta: '35 mins away',
        deliveryAddress: '',
        deliveryType: 'home',
        familyMemberId: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    return apiClient.get<PharmacyOrder>(`/pharmacy/orders/${orderId}/status`);
  },

  /**
   * Fetches locator-only pharmacies (e.g. Abuja districts) from Google Places
   */
  async fetchPharmacies(): Promise<FetchPharmaciesResult> {
    try {
      const res = await apiClient.get<{
        success: boolean;
        pharmacies: PharmacyDirectoryItem[];
        usedFallback?: boolean;
      }>('/care/pharmacies');
      if (res && Array.isArray(res.pharmacies)) {
        return {
          pharmacies: res.pharmacies,
          usedFallback: Boolean(res.usedFallback),
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
}

