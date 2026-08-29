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
   * Tracks real-time delivery status for an active dispatch
   */
  async getDeliveryStatus(orderId: string): Promise<{ step: number; statusText: string; eta: string }> {
    if (CONFIG.demoMode) {
      return {
        step: 2,
        statusText: 'Rider en route via Lekki-Ikoyi Link Bridge',
        eta: '35 mins away',
      };
    }

    return apiClient.get<{ step: number; statusText: string; eta: string }>(`/pharmacy/orders/${orderId}/status`);
  },
};
