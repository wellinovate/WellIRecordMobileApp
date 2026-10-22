// Maps what a person typed or picked as their LGA to a canonical code. No database.
// Rules: an exact match (after normalising) to a catalogue name or alias in the person's state is `verified`.
// Anything else keeps the typed text and gets no code: `needs_review` when the state has a catalogue, `unverified` when it does not.
// The LGA is never written into the WelliID.
import { LGAS, LgaEntry } from './data/nigeriaLgas';

export const LGA_STATUSES = ['verified', 'unverified', 'needs_review'] as const;
export type LgaStatus = (typeof LGA_STATUSES)[number];

export interface LgaMapping {
  lgaText: string;
  lgaCode: string;
  lgaMappingStatus: LgaStatus;
}

export const cleanLgaText = (v: unknown) => String(v ?? '').replace(/[^\p{L}\p{N} .,'()/-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 60);

export function normalizeLga(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\blocal government area\b|\blocal government\b|\bl\.?g\.?a\.?\b|\barea council\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export const lgasForRegion = (region: string): LgaEntry[] => LGAS.filter((l) => l.region === region);

export function mapLga(regionCode: string, text: unknown, code?: unknown): LgaMapping {
  const lgaText = cleanLgaText(text);
  const entries = lgasForRegion(regionCode);
  const picked = typeof code === 'string' ? entries.find((e) => e.code === code) : undefined;
  if (picked) return { lgaText: lgaText || picked.name, lgaCode: picked.code, lgaMappingStatus: 'verified' };
  if (!lgaText) return { lgaText: '', lgaCode: '', lgaMappingStatus: 'unverified' };
  const key = normalizeLga(lgaText);
  const hit = key ? entries.find((e) => [e.name, ...(e.aliases ?? [])].some((n) => normalizeLga(n) === key)) : undefined;
  if (hit) return { lgaText, lgaCode: hit.code, lgaMappingStatus: 'verified' };
  return { lgaText, lgaCode: '', lgaMappingStatus: entries.length > 0 ? 'needs_review' : 'unverified' };
}
