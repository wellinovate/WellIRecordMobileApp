/**
 * Pharmacy orders: send a prescription and medication request to a pharmacy, review its quote,
 * check out with delivery or pickup and a payment method, and follow the order to handover.
 * The server sets every price, fee and status. The app only displays them.
 */

import { apiClient } from './apiClient';

export type OrderStatus =
  | 'awaiting_review'
  | 'quoted'
  | 'awaiting_payment'
  | 'awaiting_hmo'
  | 'confirmed'
  | 'dispatched'
  | 'ready_for_pickup'
  | 'delivered'
  | 'collected'
  | 'cancelled'
  | 'rejected'
  | 'expired';

export type OrderPayMethod = 'online' | 'on_delivery' | 'at_pickup' | 'hmo';
export type Fulfilment = 'delivery' | 'pickup';

export interface OrderPharmacy {
  facilityId: string;
  name: string;
  address: string;
  phone: string;
  distanceKm: number | null;
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  deliveryEta: string;
  deliveryFromMinor: number | null;
  onlinePayment: boolean;
  payOnDelivery: boolean;
  payAtPickup: boolean;
  acceptsHmo: string[];
  verified: boolean;
}

export interface OrderConfig {
  onlinePayment: boolean;
  termsVersion: string;
  terms: string[];
  maxAttachments: number;
  maxAttachmentBytes: number;
}

export interface OrderItemInput {
  name: string;
  strength: string;
  quantity: number;
  notes: string;
}

export interface QuoteLineView {
  index: number;
  name: string;
  strength: string;
  quantity: number;
  unitPriceMinor: number;
  available: boolean;
  alternative: boolean;
  note: string;
}

export interface PharmacyOrder {
  id: string;
  ref: string;
  status: OrderStatus;
  /** Index into `timeline` of the step reached, or -1 when the order ended without delivery. */
  step: number;
  timeline: string[];
  pharmacy: { id: string; name: string; address: string };
  subjectName: string;
  items: OrderItemInput[];
  attachmentCount: number;
  linkToRecord: boolean;
  quote: { lines: QuoteLineView[]; note: string; expiresAt?: string } | null;
  excluded: number[];
  fulfilment: Fulfilment | null;
  address: { text: string; landmark?: string; recipientName?: string; recipientPhone?: string } | null;
  distanceKm: number | null;
  medsMinor: number;
  deliveryFeeMinor: number;
  feeEstimated: boolean;
  totalMinor: number;
  dueMinor: number;
  currency: string;
  paymentMethod: OrderPayMethod | null;
  paymentStatus: string | null;
  hmo: { provider: string; status?: string; coveredMinor: number | null; reason: string } | null;
  handoverCode: string | null;
  dispatch: { riderName?: string; riderPhone?: string; etaNote?: string; assignedAt?: string } | null;
  events: { at: string; status: string; note: string }[];
  cancelReason: string;
  createdAt: string;
  closedAt: string | null;
}

export interface CheckoutInput {
  fulfilment: Fulfilment;
  paymentMethod: OrderPayMethod;
  excluded: number[];
  address?: { text: string; landmark?: string; recipientName?: string; recipientPhone: string; lat?: number; lng?: number };
  hmo?: { provider: string; memberId?: string };
}

export interface CheckoutPreview {
  medsMinor: number;
  deliveryFeeMinor: number;
  feeEstimated: boolean;
  distanceKm: number | null;
  totalMinor: number;
  methods: OrderPayMethod[];
  hmo: string[];
  eta: string;
}

export const ORDER_OPEN: OrderStatus[] = ['awaiting_review', 'quoted', 'awaiting_payment', 'awaiting_hmo', 'confirmed', 'dispatched', 'ready_for_pickup'];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_review: 'Awaiting pharmacy review',
  quoted: 'Quote ready',
  awaiting_payment: 'Awaiting payment',
  awaiting_hmo: 'Awaiting HMO confirmation',
  confirmed: 'Confirmed',
  dispatched: 'On the way',
  ready_for_pickup: 'Ready for pickup',
  delivered: 'Delivered',
  collected: 'Collected',
  cancelled: 'Cancelled',
  rejected: 'Not accepted',
  expired: 'Quote expired',
};

export const pharmacyOrderService = {
  async config(): Promise<OrderConfig> {
    const r = await apiClient.get<OrderConfig & { success: boolean }>('/pharmacy-orders/config');
    return {
      onlinePayment: !!r.onlinePayment,
      termsVersion: r.termsVersion,
      terms: r.terms || [],
      maxAttachments: r.maxAttachments || 3,
      maxAttachmentBytes: r.maxAttachmentBytes || 2_500_000,
    };
  },

  async pharmacies(pos?: { lat: number; lng: number } | null): Promise<OrderPharmacy[]> {
    const r = await apiClient.get<{ pharmacies: OrderPharmacy[] }>('/pharmacy-orders/pharmacies', {
      params: pos ? { lat: pos.lat, lng: pos.lng } : undefined,
    });
    return r.pharmacies || [];
  },

  /** Sends a prescription photo or PDF. The server checks the file type and stores it sealed. */
  async uploadFile(dataBase64: string): Promise<{ id: string; contentType: string }> {
    const r = await apiClient.post<{ attachment: { id: string; contentType: string } }>(
      '/pharmacy-orders/attachments',
      { dataBase64 },
      { timeoutMs: 60_000 }
    );
    return r.attachment;
  },

  async file(id: string): Promise<{ contentType: string; dataBase64: string }> {
    const r = await apiClient.get<{ contentType: string; dataBase64: string }>(`/pharmacy-orders/attachments/${encodeURIComponent(id)}`, { timeoutMs: 60_000 });
    return { contentType: r.contentType, dataBase64: r.dataBase64 };
  },

  async place(body: {
    pharmacyId: string;
    items: OrderItemInput[];
    attachmentIds: string[];
    consentShare: boolean;
    linkToRecord: boolean;
    subjectName?: string;
  }): Promise<PharmacyOrder> {
    const r = await apiClient.post<{ order: PharmacyOrder }>('/pharmacy-orders', { ...body, acceptTerms: true });
    return r.order;
  },

  async list(): Promise<PharmacyOrder[]> {
    const r = await apiClient.get<{ orders: PharmacyOrder[] }>('/pharmacy-orders');
    return r.orders || [];
  },

  async get(id: string): Promise<PharmacyOrder> {
    const r = await apiClient.get<{ order: PharmacyOrder }>(`/pharmacy-orders/${encodeURIComponent(id)}`);
    return r.order;
  },

  /** The total and payment options for the person's choices. Nothing is saved. */
  async preview(id: string, body: Pick<CheckoutInput, 'fulfilment' | 'excluded' | 'address'>): Promise<CheckoutPreview> {
    const r = await apiClient.post<CheckoutPreview & { success: boolean }>(`/pharmacy-orders/${encodeURIComponent(id)}/preview`, body);
    return {
      medsMinor: r.medsMinor,
      deliveryFeeMinor: r.deliveryFeeMinor,
      feeEstimated: !!r.feeEstimated,
      distanceKm: r.distanceKm ?? null,
      totalMinor: r.totalMinor,
      methods: r.methods || [],
      hmo: r.hmo || [],
      eta: r.eta || '',
    };
  },

  async checkout(id: string, body: CheckoutInput): Promise<{ order: PharmacyOrder; authorizationUrl?: string; notice: string }> {
    const r = await apiClient.post<{ order: PharmacyOrder; authorizationUrl?: string; notice?: string }>(`/pharmacy-orders/${encodeURIComponent(id)}/checkout`, { ...body, acceptTerms: true });
    return { order: r.order, authorizationUrl: r.authorizationUrl, notice: r.notice || '' };
  },

  async pay(id: string): Promise<{ order: PharmacyOrder; authorizationUrl: string }> {
    const r = await apiClient.post<{ order: PharmacyOrder; authorizationUrl: string }>(`/pharmacy-orders/${encodeURIComponent(id)}/pay`, {});
    return { order: r.order, authorizationUrl: r.authorizationUrl };
  },

  async cancel(id: string, reason?: string): Promise<PharmacyOrder> {
    const r = await apiClient.post<{ order: PharmacyOrder }>(`/pharmacy-orders/${encodeURIComponent(id)}/cancel`, { reason });
    return r.order;
  },
};
