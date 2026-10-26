// Height and weight are stored as text such as "169 cm" or "79 kg". These helpers read and write that text
// and convert between units for the wheel picker.

export type HeightUnit = 'cm' | 'in';
export type WeightUnit = 'kg' | 'lbs';

export const HEIGHT_RANGE: Record<HeightUnit, { min: number; max: number }> = { cm: { min: 30, max: 250 }, in: { min: 12, max: 99 } };
export const WEIGHT_RANGE: Record<WeightUnit, { min: number; max: number }> = { kg: { min: 2, max: 300 }, lbs: { min: 4, max: 660 } };

const CM_PER_IN = 2.54;
const LB_PER_KG = 2.2046226218;

export const cmToIn = (cm: number) => Math.round(cm / CM_PER_IN);
export const inToCm = (inch: number) => Math.round(inch * CM_PER_IN);
export const kgToLbs = (kg: number) => Math.round(kg * LB_PER_KG);
export const lbsToKg = (lb: number) => Math.round(lb / LB_PER_KG);

export interface Measure<U extends string> { value: number; unit: U }

/** Reads "169 cm", "169", "5.5 ft" is not supported. Returns null when it cannot be read as a plain number and unit. */
export function parseHeight(raw: unknown): Measure<HeightUnit> | null {
  const m = /^\s*(\d{1,3}(?:[.,]\d+)?)\s*(cm|in|inch|inches)?\s*$/i.exec(String(raw ?? ''));
  if (!m) return null;
  const unit: HeightUnit = m[2] && m[2].toLowerCase() !== 'cm' ? 'in' : 'cm';
  const value = Math.round(Number(m[1].replace(',', '.')));
  const r = HEIGHT_RANGE[unit];
  return value >= r.min && value <= r.max ? { value, unit } : null;
}

export function parseWeight(raw: unknown): Measure<WeightUnit> | null {
  const m = /^\s*(\d{1,3}(?:[.,]\d+)?)\s*(kg|kgs|lb|lbs|pounds?)?\s*$/i.exec(String(raw ?? ''));
  if (!m) return null;
  const unit: WeightUnit = m[2] && !/^kg/i.test(m[2]) ? 'lbs' : 'kg';
  const value = Math.round(Number(m[1].replace(',', '.')));
  const r = WEIGHT_RANGE[unit];
  return value >= r.min && value <= r.max ? { value, unit } : null;
}

export const formatMeasure = (m: Measure<string>) => `${m.value} ${m.unit}`;
