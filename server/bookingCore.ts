// Rules for consultation booking, with no database or network so they can be tested alone.
// Times are Lagos local time (UTC+1, no daylight saving) in provider hours and UTC in storage.

import crypto from 'crypto';

export const LAGOS_OFFSET_MS = 60 * 60 * 1000;
export const HOLD_MS = 10 * 60 * 1000;
export const ONLINE_HOLD_MS = 15 * 60 * 1000;
export const MIN_LEAD_MS = 30 * 60 * 1000;
export const MAX_DAYS_AHEAD = 60;

export type Mode = 'in_person' | 'video';
export type Method = 'online' | 'in_person' | 'hmo';

export interface ServiceLike {
  offersInPerson: boolean;
  offersVirtual: boolean;
  feeInPersonMinor?: number | null;
  feeVirtualMinor?: number | null;
  acceptsHmo: string[];
  payAtVisit: boolean;
  onlinePayment: boolean;
  slotMinutes: number;
  weekly: { day: number; start: string; end: string }[];
  active?: boolean;
}

export const isYmd = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

const hm = /^([01]\d|2[0-3]):([0-5]\d)$/;
const toMin = (s: string) => {
  const m = hm.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Checks weekly hours from a provider. Returns the cleaned list or a message. */
export function cleanWeekly(input: unknown): { weekly: { day: number; start: string; end: string }[] } | { error: string } {
  if (!Array.isArray(input)) return { error: 'Weekly hours must be a list' };
  if (input.length > 21) return { error: 'Too many time windows' };
  const out: { day: number; start: string; end: string }[] = [];
  for (const w of input) {
    const day = Number(w?.day);
    const a = toMin(String(w?.start ?? ''));
    const b = toMin(String(w?.end ?? ''));
    if (!Number.isInteger(day) || day < 0 || day > 6) return { error: 'Day must be 0 (Sunday) to 6 (Saturday)' };
    if (a === null || b === null) return { error: 'Times must look like 09:00' };
    if (b <= a) return { error: 'A window must end after it starts' };
    out.push({ day, start: String(w.start), end: String(w.end) });
  }
  return { weekly: out };
}

export function feeFor(svc: Pick<ServiceLike, 'feeInPersonMinor' | 'feeVirtualMinor'>, mode: Mode): number | null {
  const v = mode === 'video' ? svc.feeVirtualMinor : svc.feeInPersonMinor;
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
}

export function offersMode(svc: Pick<ServiceLike, 'offersInPerson' | 'offersVirtual'>, mode: Mode): boolean {
  return mode === 'video' ? svc.offersVirtual : svc.offersInPerson;
}

/** A provider is bookable for a mode only if it is active, offers the mode, has a fee and has hours. */
export function bookableFor(svc: ServiceLike, mode: Mode): boolean {
  return svc.active !== false && offersMode(svc, mode) && feeFor(svc, mode) !== null && svc.weekly.length > 0;
}

export function lagosYmd(d: Date): string {
  return new Date(d.getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
}

export function slotLabel(d: Date): string {
  const l = new Date(d.getTime() + LAGOS_OFFSET_MS);
  const h = l.getUTCHours();
  const m = String(l.getUTCMinutes()).padStart(2, '0');
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Every start time a provider offers on one Lagos calendar day, after the lead time. */
export function slotsForDate(
  svc: Pick<ServiceLike, 'weekly' | 'slotMinutes'>,
  ymd: string,
  nowMs: number,
  leadMs = MIN_LEAD_MS
): Date[] {
  if (!isYmd(ymd)) return [];
  const step = Math.max(10, Math.min(240, Math.round(svc.slotMinutes || 30)));
  const base = Date.parse(`${ymd}T00:00:00Z`);
  const dow = new Date(base).getUTCDay();
  const seen = new Set<number>();
  const out: Date[] = [];
  for (const w of svc.weekly) {
    if (w.day !== dow) continue;
    const a = toMin(w.start);
    const b = toMin(w.end);
    if (a === null || b === null) continue;
    for (let t = a; t + step <= b; t += step) {
      const startMs = base + t * 60_000 - LAGOS_OFFSET_MS;
      if (startMs < nowMs + leadMs || seen.has(startMs)) continue;
      seen.add(startMs);
      out.push(new Date(startMs));
    }
  }
  return out.sort((x, y) => x.getTime() - y.getTime());
}

/** The Lagos calendar days from today for the next `days` days. */
export function nextDays(nowMs: number, days: number): string[] {
  const n = Math.max(1, Math.min(MAX_DAYS_AHEAD, Math.floor(days)));
  const start = Date.parse(`${lagosYmd(new Date(nowMs))}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => new Date(start + i * 86_400_000).toISOString().slice(0, 10));
}

export const hmoMatches = (accepted: string[], provider: string): boolean => {
  const p = provider.trim().toLowerCase();
  return p.length > 0 && accepted.some((a) => a.trim().toLowerCase() === p);
};

export type Decision =
  | { ok: true; status: 'confirmed' | 'awaiting_payment' | 'awaiting_hmo'; paymentStatus: 'pending' | 'pay_at_visit' | 'awaiting_hmo'; holdMs: number }
  | { ok: false; code: string; message: string };

/**
 * The status a booking gets from the payment method. Money and insurance cases never come out
 * as "confirmed" on the word of the app: online waits for the payment provider, HMO waits for staff.
 */
export function decideBooking(input: {
  method: Method;
  svc: ServiceLike;
  gatewayConfigured: boolean;
  hmoProvider?: string;
}): Decision {
  const { method, svc } = input;
  if (method === 'in_person') {
    if (!svc.payAtVisit) return { ok: false, code: 'pay_at_visit_unavailable', message: 'This provider does not take payment at the visit.' };
    return { ok: true, status: 'confirmed', paymentStatus: 'pay_at_visit', holdMs: HOLD_MS };
  }
  if (method === 'online') {
    if (!svc.onlinePayment || !input.gatewayConfigured) {
      return { ok: false, code: 'online_unavailable', message: 'Online payment is not available for this provider yet.' };
    }
    return { ok: true, status: 'awaiting_payment', paymentStatus: 'pending', holdMs: ONLINE_HOLD_MS };
  }
  if (method === 'hmo') {
    if (!svc.acceptsHmo.length) return { ok: false, code: 'hmo_unavailable', message: 'This provider does not accept HMO cover for consultations.' };
    if (!hmoMatches(svc.acceptsHmo, input.hmoProvider || '')) {
      return { ok: false, code: 'hmo_not_accepted', message: 'This provider does not accept that HMO.' };
    }
    return { ok: true, status: 'awaiting_hmo', paymentStatus: 'awaiting_hmo', holdMs: HOLD_MS };
  }
  return { ok: false, code: 'bad_method', message: 'Choose a payment method.' };
}

/** A virtual visit can be joined from 10 minutes before the start until an hour after it ends. */
export function joinWindow(startsAt: Date, durationMin: number, nowMs: number): { open: boolean; opensAt: Date; closesAt: Date } {
  const opensAt = new Date(startsAt.getTime() - 10 * 60_000);
  const closesAt = new Date(startsAt.getTime() + (durationMin + 60) * 60_000);
  return { open: nowMs >= opensAt.getTime() && nowMs <= closesAt.getTime(), opensAt, closesAt };
}

export function paystackSignatureOk(secret: string, rawBody: string | Buffer, header: unknown): boolean {
  if (!secret || typeof header !== 'string' || !/^[a-f0-9]{128}$/i.test(header)) return false;
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(header.toLowerCase(), 'hex'));
}

export const formatNaira = (minor: number) =>
  `₦${(minor / 100).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
