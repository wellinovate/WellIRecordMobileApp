// WHO growth standard calculations: age, z-score, percentile and chart curves.
// Pure functions over the tables in ../data/whoGrowth. No diagnosis is made here: a result
// outside the usual range is only ever a prompt to ask a clinician.

import { WHO_GROWTH, type GrowthSex, type GrowthTable } from '../data/whoGrowth';

export type ChartMetric = 'weight' | 'length' | 'head';
export type Band = 'usual' | 'low' | 'high' | 'far_low' | 'far_high' | 'implausible';

export const MAX_MONTHS = 60;
const DAYS_PER_MONTH = 30.4375;
const isoOk = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Age in months (fractional) on the measurement date, or null when a date is missing, invalid or before birth. */
export function ageInMonths(dob: string | undefined | null, on: string): number | null {
  if (!isoOk(dob) || !isoOk(on)) return null;
  const days = (Date.parse(on) - Date.parse(dob)) / 86_400_000;
  return days < 0 ? null : days / DAYS_PER_MONTH;
}

export function sexKey(gender: string | undefined | null): GrowthSex | null {
  const g = String(gender || '').trim().toLowerCase();
  if (g === 'male' || g === 'm' || g === 'boy') return 'boys';
  if (g === 'female' || g === 'f' || g === 'girl') return 'girls';
  return null;
}

/** Length is measured lying down to 24 months; height standing from 24 months. */
export function tableFor(metric: ChartMetric, sex: GrowthSex, ageMonths: number): GrowthTable {
  if (metric === 'length') return WHO_GROWTH[sex][ageMonths < 24 ? 'length' : 'height'];
  return WHO_GROWTH[sex][metric];
}

export type LMS = [number, number, number];

/** L, M and S at a (fractional) age, by linear interpolation between completed months. Null outside 0 to 60 months. */
export function lmsAt(table: GrowthTable, ageMonths: number): LMS | null {
  const last = table.start + table.lms.length - 1;
  if (!(ageMonths >= table.start) || ageMonths > last) return null;
  const lo = Math.floor(ageMonths);
  const hi = Math.min(lo + 1, last);
  const f = ageMonths - lo;
  const a = table.lms[lo - table.start];
  const b = table.lms[hi - table.start];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** The measurement that sits at a given z-score for this L, M, S. */
export function valueAtZ([L, M, S]: LMS, z: number): number {
  return L === 0 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
}

/**
 * z-score by the LMS method. With `adjustTails` (WHO does this for weight-for-age) values beyond
 * +-3 are extended linearly from the +-2 to +-3 SD spacing, so extreme values do not run away.
 */
export function zScore(value: number, lms: LMS, adjustTails = false): number {
  const [L, M, S] = lms;
  const z = L === 0 ? Math.log(value / M) / S : (Math.pow(value / M, L) - 1) / (L * S);
  if (!adjustTails || Math.abs(z) <= 3) return z;
  if (z > 3) {
    const sd3 = valueAtZ(lms, 3);
    const sd23 = sd3 - valueAtZ(lms, 2);
    return 3 + (value - sd3) / sd23;
  }
  const sd3n = valueAtZ(lms, -3);
  const sd23n = valueAtZ(lms, -2) - sd3n;
  return -3 + (value - sd3n) / sd23n;
}

/** Standard normal cumulative distribution, as a percentile 0 to 100 (Abramowitz and Stegun 26.2.17). */
export function percentileOf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return (z > 0 ? 1 - p : p) * 100;
}

/** WHO's own limits for values that are probably a typing mistake. */
const IMPLAUSIBLE: Record<ChartMetric, [number, number]> = { weight: [-6, 5], length: [-6, 6], head: [-5, 5] };

export function bandOf(metric: ChartMetric, z: number): Band {
  const [lo, hi] = IMPLAUSIBLE[metric];
  if (z < lo || z > hi) return 'implausible';
  if (z < -3) return 'far_low';
  if (z < -2) return 'low';
  if (z > 3) return 'far_high';
  if (z > 2) return 'high';
  return 'usual';
}

export const PRETERM_WEEKS = 37;
export const CORRECT_UNTIL_MONTHS = 24;
const WEEKS_PER_MONTH = DAYS_PER_MONTH / 7;

/** True when age should be corrected: born before 37 weeks and still under 24 months from birth. */
export function needsCorrection(ageMonths: number, gestationalAgeWeeks: number | null | undefined): boolean {
  return (
    gestationalAgeWeeks != null &&
    Number.isFinite(gestationalAgeWeeks) &&
    gestationalAgeWeeks >= 20 &&
    gestationalAgeWeeks < PRETERM_WEEKS &&
    ageMonths < CORRECT_UNTIL_MONTHS
  );
}

/** Age counted from the due date (40 weeks) instead of the birth date. Can be negative before the due date. */
export function correctedAge(ageMonths: number, gestationalAgeWeeks: number): number {
  return ageMonths - (40 - gestationalAgeWeeks) / WEEKS_PER_MONTH;
}

export interface GrowthPoint {
  /** The age used to read the chart: corrected when `corrected` is true. */
  ageMonths: number;
  /** Age from birth, always. */
  chronologicalMonths: number;
  corrected: boolean;
  value: number;
  z: number;
  percentile: number;
  band: Band;
}

/** Places one measurement on the WHO standard. Null when age or sex is unknown or the child is over 5. */
export function placeMeasurement(
  metric: ChartMetric,
  gender: string | undefined | null,
  dob: string | undefined | null,
  measuredOn: string,
  value: number | null | undefined,
  options: { gestationalAgeWeeks?: number | null; correct?: boolean } = {},
): GrowthPoint | null {
  const sex = sexKey(gender);
  const chrono = ageInMonths(dob, measuredOn);
  if (!sex || chrono === null || value === null || value === undefined || !Number.isFinite(value) || value <= 0) return null;
  const corrected = options.correct !== false && needsCorrection(chrono, options.gestationalAgeWeeks);
  // Before the due date there is no WHO standard (it starts at term). Those readings are left off.
  const age = corrected ? correctedAge(chrono, options.gestationalAgeWeeks as number) : chrono;
  if (age < 0) return null;
  const lms = lmsAt(tableFor(metric, sex, age), age);
  if (!lms) return null;
  const z = zScore(value, lms, metric === 'weight');
  return { ageMonths: age, chronologicalMonths: chrono, corrected, value, z, percentile: percentileOf(z), band: bandOf(metric, z) };
}

export const CURVE_Z = [-3, -2, 0, 2, 3] as const;

export interface Curve {
  z: number;
  points: { x: number; y: number }[];
}

/** Reference lines (-3, -2, median, +2, +3 SD) at each completed month. */
export function curves(metric: ChartMetric, sex: GrowthSex): Curve[] {
  return CURVE_Z.map((z) => {
    const points: { x: number; y: number }[] = [];
    for (let m = 0; m <= MAX_MONTHS; m++) {
      const lms = lmsAt(tableFor(metric, sex, m), m);
      if (lms) points.push({ x: m, y: valueAtZ(lms, z) });
    }
    return { z, points };
  });
}

export const BAND_TEXT: Record<Band, string> = {
  usual: 'Within the usual range for age.',
  low: 'Below the usual range for age. This is a reason to ask your clinic. It is not a diagnosis.',
  far_low: 'Well below the usual range for age. Ask your clinic about this soon. It is not a diagnosis.',
  high: 'Above the usual range for age. Mention it at the next clinic visit. It is not a diagnosis.',
  far_high: 'Well above the usual range for age. Ask your clinic about this soon. It is not a diagnosis.',
  implausible: 'This number looks unlikely for this age. Check it was typed correctly.',
};

export const METRIC_LABEL: Record<ChartMetric, { title: string; unit: string }> = {
  weight: { title: 'Weight', unit: 'kg' },
  length: { title: 'Length or height', unit: 'cm' },
  head: { title: 'Head size', unit: 'cm' },
};
