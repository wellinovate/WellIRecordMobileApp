// Counting registrations by region. No database here, so the rules can be tested.
import { REGIONS, UNSPECIFIED_REGION } from './data/nigeriaRegions';

export interface RawGroup {
  _id: string | null; // registrationRegion; null for profiles made before regions existed
  registered: number;
  contactVerified: number;
  identityVerified: number;
  active30: number;
  withRecord: number;
}

export interface RegionRow {
  code: string;
  name: string;
  registered: number;
  contactVerified: number;
  identityVerified: number;
  active30: number;
  withRecord: number;
  /** Share of this region's registered people who are contact verified, 0 to 100, or null when nobody is registered. */
  contactVerifiedPct: number | null;
  residing: number;
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

export const LEGACY_ROW = { code: 'LEGACY', name: 'Registered before regions (state not known)' };

/**
 * One row per region (all 37, including empty ones), then "not stated" and "before regions" when they have people.
 * `residing` comes from the residence state, which can differ from the registration region.
 */
export function buildRegionRows(groups: RawGroup[], residingByName: Record<string, number> = {}): { rows: RegionRow[]; totals: Omit<RegionRow, 'code' | 'name'> } {
  const byCode = new Map<string, RawGroup>();
  for (const g of groups) byCode.set(g._id ?? LEGACY_ROW.code, g);
  const mk = (code: string, name: string): RegionRow => {
    const g = byCode.get(code);
    const registered = g?.registered ?? 0;
    const contactVerified = g?.contactVerified ?? 0;
    return {
      code,
      name,
      registered,
      contactVerified,
      identityVerified: g?.identityVerified ?? 0,
      active30: g?.active30 ?? 0,
      withRecord: g?.withRecord ?? 0,
      contactVerifiedPct: pct(contactVerified, registered),
      residing: residingByName[name] ?? 0,
    };
  };
  const rows = REGIONS.map((r) => mk(r.code, r.name)).sort((a, b) => b.registered - a.registered || a.name.localeCompare(b.name));
  for (const extra of [UNSPECIFIED_REGION, LEGACY_ROW]) {
    const row = mk(extra.code, extra.name);
    if (row.registered > 0) rows.push(row);
  }
  const sum = (k: 'registered' | 'contactVerified' | 'identityVerified' | 'active30' | 'withRecord' | 'residing') => rows.reduce((t, r) => t + r[k], 0);
  const registered = sum('registered');
  const contactVerified = sum('contactVerified');
  return {
    rows,
    totals: {
      registered,
      contactVerified,
      identityVerified: sum('identityVerified'),
      active30: sum('active30'),
      withRecord: sum('withRecord'),
      contactVerifiedPct: pct(contactVerified, registered),
      residing: sum('residing'),
    },
  };
}

export const IDENTITY_METHODS = ['national_id', 'passport', 'drivers_licence', 'voters_card', 'nin_slip', 'in_person_check'] as const;
export type IdentityMethod = (typeof IDENTITY_METHODS)[number];
export const isIdentityMethod = (v: unknown): v is IdentityMethod => (IDENTITY_METHODS as readonly string[]).includes(String(v));

/** Active means the person used the app or website in the last 30 days. */
export const ACTIVE_DAYS = 30;
/** lastActiveAt is written at most this often per person. */
export const ACTIVE_WRITE_EVERY_MS = 6 * 60 * 60 * 1000;
export const shouldWriteActive = (lastWrite: number | undefined, now: number) => lastWrite === undefined || now - lastWrite >= ACTIVE_WRITE_EVERY_MS;
