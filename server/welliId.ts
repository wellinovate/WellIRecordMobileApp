// WelliID: WR-<REGION><zone>-<suffix>, for example WR-ABJ1-2RWR.
// - REGION is the region where the person registered. It never changes, even if they move.
// - zone is a digit, 1 to 9. A region starts on zone 1 and moves to the next only when the suffixes
//   of the zone it is on are running out.
// - suffix is four random characters with no 0, O, 1, I or L, so an ID read aloud or copied by hand is
//   not confused.
// The ID says nothing about the person's health. Where they live now is a separate field on the profile.
import crypto from 'crypto';
import { Region, UNSPECIFIED_REGION, regionByCode, resolveRegion } from './data/nigeriaRegions';

export const SUFFIX_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const SUFFIX_LENGTH = 4;
const MAX_ZONE = 9;
const TRIES_PER_ZONE = 8;

export type RandomInt = (maxExclusive: number) => number;
const defaultRandom: RandomInt = (n) => crypto.randomInt(n);

export function randomSuffix(random: RandomInt = defaultRandom): string {
  let s = '';
  for (let i = 0; i < SUFFIX_LENGTH; i++) s += SUFFIX_ALPHABET[random(SUFFIX_ALPHABET.length)];
  return s;
}

export const formatWelliId = (regionCode: string, zone: number, suffix: string) => `WR-${regionCode}${zone}-${suffix}`;

export interface IssuedId {
  id: string;
  region: Region;
  /** False when no state was given and the ID carries the "not stated" region. */
  hasRegion: boolean;
}

/**
 * Make an ID that `exists` says is unused. The caller must still save it under a unique index; this
 * check narrows the chance of a clash, the index is what stops one.
 */
export async function issueWelliId(opts: {
  state?: unknown;
  exists: (id: string) => Promise<boolean>;
  random?: RandomInt;
}): Promise<IssuedId> {
  const picked = resolveRegion(opts.state);
  const region = picked ?? UNSPECIFIED_REGION;
  for (let zone = 1; zone <= MAX_ZONE; zone++) {
    for (let i = 0; i < TRIES_PER_ZONE; i++) {
      const id = formatWelliId(region.code, zone, randomSuffix(opts.random));
      if (!(await opts.exists(id))) return { id, region, hasRegion: Boolean(picked) };
    }
  }
  throw new Error('Could not issue a WelliID');
}

export interface ParsedWelliId {
  regionCode: string;
  zone: number;
  suffix: string;
  region: Region | null;
}

const NEW_FORMAT = /^WR-([A-Z]{3})([1-9])-([2-9A-HJKMNP-Z]{4})$/;

/**
 * Reads the parts of an ID in the current format. Older IDs (WR-1234-AB12) return null.
 * This is for display only: reports use the region saved on the profile, because an older random ID
 * can look like the new format by chance.
 */
export function parseWelliId(id: unknown): ParsedWelliId | null {
  const m = NEW_FORMAT.exec(String(id ?? '').trim().toUpperCase());
  if (!m) return null;
  const region = regionByCode(m[1]);
  return { regionCode: m[1], zone: Number(m[2]), suffix: m[3], region };
}

/** Old and new IDs both match this: WR- then two groups of four letters or digits. */
export const isWelliId = (v: unknown) => /^WR-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(String(v ?? '').trim());
