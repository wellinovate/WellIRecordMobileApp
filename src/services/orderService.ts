import { apiClient } from './apiClient';

export interface MedicationOrderPayload {
  familyMemberId?: string;
  medicationName: string;
  dosage?: string;
  quantity?: number;
  deliveryAddress: string;
  deliveryType: 'home' | 'hospital' | 'office' | 'pharmacy_pickup' | 'custom';
  notes?: string;
}

export const orderService = {
  async createOrder(payload: MedicationOrderPayload): Promise<any> {
    const res = await apiClient.post<{ success: boolean; order: any; message: string }>(
      '/pharmacy/orders',
      payload
    );
    return res;
  },
};
