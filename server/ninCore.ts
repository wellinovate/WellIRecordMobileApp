// Rules for the NIN check. No database and no network, so it can be tested on its own.
// Same rules as the website backend (modules/nin-verification/nin_core.js). The NIN is used for one lookup and is never stored or logged.

export const NIN_LENGTH = 11;
export const MAX_COUNTED_ATTEMPTS = 3; // per account, per 24 hours (provider outages do not count)
export const COUNTED_OUTCOMES = ['verified', 'mismatch', 'not_found'];
export const NIN_METHOD = 'nin_2am'; // identityVerifiedMethod, identical on the website so both read the same value

/** Returns the 11 digits, or null if the input is not an NIN. Spaces and dashes are ignored. */
export function cleanNin(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const s = String(value).replace(/[\s-]/g, '');
  return /^\d{11}$/.test(s) ? s : null;
}

/** Lower case, accents removed, anything that is not a letter becomes a space. */
export function normalizeName(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

function tokens(...parts: unknown[]): Set<string> {
  const out = new Set<string>();
  for (const p of parts) for (const t of normalizeName(p).split(' ')) if (t) out.add(t);
  return out;
}

export interface NinProfile {
  fullName?: string; firstName?: string; middleName?: string; lastName?: string; name?: string;
  dateOfBirth?: unknown; dob?: unknown; identityVerifiedAt?: unknown;
}
export interface NinRecord { firstName: string; lastName: string; middleName: string; dateOfBirth: string; requestId: string }

/** The profile's date of birth. The mobile profile may hold it as dateOfBirth or dob, as a Date or text. */
export const profileDob = (p: NinProfile | null | undefined): unknown => p?.dateOfBirth || p?.dob;

/** The first and last name on the NIN record must both appear in the profile's names, in any order. */
export function namesMatch(profile: NinProfile | null | undefined, record: Partial<NinRecord> | null | undefined): boolean {
  const have = tokens(profile?.fullName, profile?.name, profile?.firstName, profile?.middleName, profile?.lastName);
  const first = normalizeName(record?.firstName);
  const last = normalizeName(record?.lastName);
  if (!first || !last) return false;
  const all = (s: string) => s.split(' ').every((t) => have.has(t));
  return all(first) && all(last);
}

/**
 * Calendar date as YYYY-MM-DD in Lagos time (UTC+1).
 * A Date is read in Lagos time. Text is read as written: YYYY-MM-DD..., or DD/MM/YYYY and DD-MM-YYYY (day first, as in Nigeria).
 */
export function lagosDate(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getTime() + 3_600_000).toISOString().slice(0, 10);
  }
  if (typeof value !== 'string') return null;
  const v = value.trim();
  let iso: string | null = null;
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) iso = `${m[1]}-${m[2]}-${m[3]}`;
  else if ((m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(v))) iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

export function dobMatches(profileValue: unknown, recordValue: unknown): boolean {
  const a = lagosDate(profileValue);
  const b = lagosDate(recordValue);
  return Boolean(a && b && a === b);
}

/** True when the profile has what is needed to compare. Checked before any paid lookup. */
export function profileComplete(profile: NinProfile | null | undefined): boolean {
  const full = profile?.fullName || profile?.name || `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`;
  const hasName = normalizeName(full).split(' ').filter(Boolean).length >= 2;
  return hasName && Boolean(lagosDate(profileDob(profile)));
}

export function matchIdentity(profile: NinProfile | null | undefined, record: Partial<NinRecord> | null | undefined) {
  const name = namesMatch(profile, record);
  const dob = dobMatches(profileDob(profile), record?.dateOfBirth);
  return { name, dob, ok: name && dob };
}
