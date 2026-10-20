// Rules for pharmacy orders, with no database or network so they can be tested alone.
//
// Flow: awaiting_review -> quoted -> (checkout) -> awaiting_payment | awaiting_hmo | confirmed
//       -> dispatched | ready_for_pickup -> delivered | collected
// The address is collected at checkout, after the quote, because the delivery fee depends on it.
// Nothing is dispatched until the payment rule for the chosen method is met.

import crypto from 'crypto';

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

export type PayMethod = 'online' | 'on_delivery' | 'at_pickup' | 'hmo';
export type Fulfilment = 'delivery' | 'pickup';

export const QUOTE_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;
export const CODE_LOCK_MS = 15 * 60 * 1000;
export const MAX_ITEMS = 20;

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  awaiting_review: ['quoted', 'rejected', 'cancelled'],
  quoted: ['awaiting_payment', 'awaiting_hmo', 'confirmed', 'cancelled', 'expired', 'rejected'],
  awaiting_payment: ['confirmed', 'cancelled', 'quoted'],
  awaiting_hmo: ['confirmed', 'awaiting_payment', 'quoted', 'cancelled'],
  confirmed: ['dispatched', 'ready_for_pickup', 'cancelled'],
  dispatched: ['delivered'],
  ready_for_pickup: ['collected', 'cancelled'],
  delivered: [],
  collected: [],
  cancelled: [],
  rejected: [],
  expired: [],
};

export const canMove = (from: OrderStatus, to: OrderStatus) => (NEXT[from] || []).includes(to);

/** The patient may cancel until the order leaves the pharmacy. */
export const patientCanCancel = (s: OrderStatus) => ['awaiting_review', 'quoted', 'awaiting_payment', 'awaiting_hmo', 'confirmed', 'ready_for_pickup'].includes(s);

/** The seven steps the patient sees, mapped from the status. -1 means the order ended without delivery. */
export const TIMELINE = [
  'Order submitted',
  'Awaiting pharmacy review',
  'Order confirmed by pharmacy',
  'Payment confirmed',
  'Delivery address selected',
  'Dispatch assigned',
  'Delivered',
] as const;

export function timelineStep(o: { status: OrderStatus; hasAddress?: boolean; fulfilment?: Fulfilment }): number {
  switch (o.status) {
    case 'awaiting_review': return 1;
    case 'quoted': return 2;
    case 'awaiting_payment':
    case 'awaiting_hmo': return o.hasAddress || o.fulfilment === 'pickup' ? 4 : 3;
    case 'confirmed': return 4;
    case 'ready_for_pickup': return 5;
    case 'dispatched': return 5;
    case 'delivered':
    case 'collected': return 6;
    default: return -1;
  }
}

// ----- distance and delivery fee -----

export interface FeeBand { maxKm: number; feeMinor: number }

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function cleanBands(input: unknown): { bands: FeeBand[] } | { error: string } {
  if (!Array.isArray(input)) return { error: 'Delivery fee bands must be a list' };
  if (input.length > 8) return { error: 'At most 8 delivery fee bands' };
  const out: FeeBand[] = [];
  for (const b of input) {
    const maxKm = Number(b?.maxKm);
    const feeMinor = Number(b?.feeMinor);
    if (!Number.isFinite(maxKm) || maxKm <= 0 || maxKm > 200) return { error: 'Each band needs a distance between 0 and 200 km' };
    if (!Number.isInteger(feeMinor) || feeMinor < 0 || feeMinor > 100_000_000) return { error: 'Each band needs a fee in kobo' };
    out.push({ maxKm, feeMinor });
  }
  return { bands: out.sort((a, b) => a.maxKm - b.maxKm) };
}

/**
 * The delivery fee for a distance. With no known distance the largest band applies and the fee is
 * marked as an estimate. Beyond the last band the pharmacy does not deliver.
 */
export function deliveryFee(bands: FeeBand[], distanceKm: number | null): { feeMinor: number; estimated: boolean; outOfRange: boolean } {
  if (!bands.length) return { feeMinor: 0, estimated: false, outOfRange: false };
  const sorted = [...bands].sort((a, b) => a.maxKm - b.maxKm);
  if (distanceKm === null || !Number.isFinite(distanceKm)) {
    return { feeMinor: sorted[sorted.length - 1].feeMinor, estimated: true, outOfRange: false };
  }
  const hit = sorted.find((b) => distanceKm <= b.maxKm);
  if (!hit) return { feeMinor: 0, estimated: false, outOfRange: true };
  return { feeMinor: hit.feeMinor, estimated: false, outOfRange: false };
}

// ----- items and quote -----

export interface RequestItem { name: string; strength: string; quantity: number; notes: string }

export function cleanItems(input: unknown): { items: RequestItem[] } | { error: string } {
  if (!Array.isArray(input) || input.length === 0) return { error: 'Add at least one medication' };
  if (input.length > MAX_ITEMS) return { error: `At most ${MAX_ITEMS} medications per order` };
  const items: RequestItem[] = [];
  for (const i of input) {
    const name = String(i?.name ?? '').trim().slice(0, 120);
    const quantity = Number(i?.quantity ?? 1);
    if (!name) return { error: 'Each medication needs a name' };
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return { error: 'Quantity must be a whole number from 1 to 999' };
    items.push({ name, strength: String(i?.strength ?? '').trim().slice(0, 60), quantity, notes: String(i?.notes ?? '').trim().slice(0, 200) });
  }
  return { items };
}

export interface QuoteLine {
  name: string;
  strength: string;
  quantity: number;
  unitPriceMinor: number;
  available: boolean;
  /** The pharmacist suggests this instead of something requested. The patient can leave it out. */
  alternative: boolean;
  note: string;
}

export function cleanQuoteLines(input: unknown): { lines: QuoteLine[] } | { error: string } {
  if (!Array.isArray(input) || input.length === 0) return { error: 'Add at least one line to the quote' };
  if (input.length > MAX_ITEMS * 2) return { error: 'Too many quote lines' };
  const lines: QuoteLine[] = [];
  for (const l of input) {
    const name = String(l?.name ?? '').trim().slice(0, 120);
    const quantity = Number(l?.quantity ?? 1);
    const available = l?.available !== false;
    const unit = Number(l?.unitPriceMinor ?? 0);
    if (!name) return { error: 'Each quote line needs a name' };
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return { error: 'Quantity must be a whole number from 1 to 999' };
    if (available && (!Number.isInteger(unit) || unit < 0 || unit > 100_000_000)) return { error: 'Each available line needs a price in kobo' };
    lines.push({
      name,
      strength: String(l?.strength ?? '').trim().slice(0, 60),
      quantity,
      unitPriceMinor: available ? unit : 0,
      available,
      alternative: l?.alternative === true,
      note: String(l?.note ?? '').trim().slice(0, 200),
    });
  }
  if (!lines.some((l) => l.available)) return { error: 'Nothing in the quote is available. Reject the order instead.' };
  return { lines };
}

/** Medication total for the lines the patient keeps. Only alternatives can be left out. */
export function medicationSubtotal(lines: QuoteLine[], excluded: number[] = []): number {
  const skip = new Set(excluded.filter((i) => Number.isInteger(i) && lines[i]?.alternative));
  return lines.reduce((sum, l, i) => (l.available && !skip.has(i) ? sum + l.unitPriceMinor * l.quantity : sum), 0);
}

// ----- payment -----

export interface PharmacyTerms {
  onlinePayment: boolean;
  payOnDelivery: boolean;
  payAtPickup: boolean;
  acceptsHmo: string[];
}

export type PaymentDecision =
  | { ok: true; status: 'awaiting_payment' | 'awaiting_hmo' | 'confirmed'; paymentStatus: 'pending' | 'awaiting_hmo' | 'pay_on_delivery' | 'pay_at_pickup' }
  | { ok: false; code: string; message: string };

export function decidePayment(input: { method: PayMethod; fulfilment: Fulfilment; svc: PharmacyTerms; gatewayConfigured: boolean; hmoProvider?: string }): PaymentDecision {
  const { method, fulfilment, svc } = input;
  if (method === 'online') {
    if (!svc.onlinePayment || !input.gatewayConfigured) return { ok: false, code: 'online_unavailable', message: 'Online payment is not available for this pharmacy yet.' };
    return { ok: true, status: 'awaiting_payment', paymentStatus: 'pending' };
  }
  if (method === 'on_delivery') {
    if (fulfilment !== 'delivery' || !svc.payOnDelivery) return { ok: false, code: 'on_delivery_unavailable', message: 'This pharmacy does not take payment on delivery.' };
    return { ok: true, status: 'confirmed', paymentStatus: 'pay_on_delivery' };
  }
  if (method === 'at_pickup') {
    if (fulfilment !== 'pickup' || !svc.payAtPickup) return { ok: false, code: 'at_pickup_unavailable', message: 'This pharmacy does not take payment at pickup.' };
    return { ok: true, status: 'confirmed', paymentStatus: 'pay_at_pickup' };
  }
  if (method === 'hmo') {
    const p = (input.hmoProvider || '').trim().toLowerCase();
    if (!svc.acceptsHmo.length || !p || !svc.acceptsHmo.some((a) => a.trim().toLowerCase() === p)) {
      return { ok: false, code: 'hmo_not_accepted', message: 'This pharmacy does not accept that HMO.' };
    }
    return { ok: true, status: 'awaiting_hmo', paymentStatus: 'awaiting_hmo' };
  }
  return { ok: false, code: 'bad_method', message: 'Choose a payment method.' };
}

/** After staff approve HMO cover: what is left to pay, and how the order moves on. */
export function afterHmoApproval(input: { totalMinor: number; coveredMinor: number; fulfilment: Fulfilment; svc: PharmacyTerms; gatewayConfigured: boolean }):
  { dueMinor: number; status: 'confirmed' | 'awaiting_payment'; paymentStatus: 'hmo_approved' | 'pay_on_delivery' | 'pay_at_pickup' | 'pending' } {
  const covered = Math.max(0, Math.min(input.totalMinor, Math.round(input.coveredMinor)));
  const due = input.totalMinor - covered;
  if (due === 0) return { dueMinor: 0, status: 'confirmed', paymentStatus: 'hmo_approved' };
  if (input.svc.onlinePayment && input.gatewayConfigured) return { dueMinor: due, status: 'awaiting_payment', paymentStatus: 'pending' };
  if (input.fulfilment === 'delivery' && input.svc.payOnDelivery) return { dueMinor: due, status: 'confirmed', paymentStatus: 'pay_on_delivery' };
  if (input.fulfilment === 'pickup' && input.svc.payAtPickup) return { dueMinor: due, status: 'confirmed', paymentStatus: 'pay_at_pickup' };
  // The pharmacy takes no way to pay the balance, so it is settled with the pharmacy at handover.
  return { dueMinor: due, status: 'confirmed', paymentStatus: input.fulfilment === 'delivery' ? 'pay_on_delivery' : 'pay_at_pickup' };
}

// ----- handover code -----

export const newHandoverCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

export function codeMatches(expected: string | null, given: unknown): boolean {
  if (!expected || typeof given !== 'string' || !/^\d{6}$/.test(given.trim())) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given.trim());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export interface CodeState { attempts: number; lockedUntil?: Date | null }

/** Counts a wrong code. Five wrong codes lock handover for 15 minutes. */
export function afterWrongCode(s: CodeState, now: number): CodeState {
  const attempts = (s.attempts || 0) + 1;
  if (attempts >= MAX_CODE_ATTEMPTS) return { attempts: 0, lockedUntil: new Date(now + CODE_LOCK_MS) };
  return { attempts, lockedUntil: s.lockedUntil ?? null };
}

export const codeLocked = (s: CodeState, now: number) => Boolean(s.lockedUntil && s.lockedUntil.getTime() > now);

export const orderRef = (id: unknown) => String(id).slice(-6).toUpperCase();

// ----- attachments -----

export const ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
export const ATTACHMENT_MAX_BYTES = 2_500_000;

/** Checks the first bytes so a file cannot claim to be something it is not. */
export function sniffType(bytes: Buffer): string | null {
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.length > 5 && bytes.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  return null;
}
