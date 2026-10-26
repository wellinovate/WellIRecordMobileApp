// Rules for the three things a person can enter themselves: other measurements, medications and family history.
// No database here. Values are the person's own and are stored as entered. Nothing is interpreted: no "high" or "low".

export const MEASUREMENT_KINDS = ['blood_sugar', 'ldl_cholesterol', 'waist', 'uric_acid', 'thyroid_tsh'] as const;
export type MeasurementKind = (typeof MEASUREMENT_KINDS)[number];

interface UnitRule { min: number; max: number }
interface KindRule { units: Record<string, UnitRule>; defaultUnit: string; decimals: number }

// Ranges only catch typing mistakes (an extra zero, the wrong unit). They are not clinical ranges.
export const MEASUREMENT_RULES: Record<MeasurementKind, KindRule> = {
  blood_sugar: { defaultUnit: 'mg/dL', decimals: 1, units: { 'mg/dL': { min: 20, max: 800 }, 'mmol/L': { min: 1.1, max: 44 } } },
  ldl_cholesterol: { defaultUnit: 'mg/dL', decimals: 1, units: { 'mg/dL': { min: 10, max: 500 }, 'mmol/L': { min: 0.3, max: 13 } } },
  waist: { defaultUnit: 'cm', decimals: 1, units: { cm: { min: 30, max: 250 }, in: { min: 12, max: 100 } } },
  uric_acid: { defaultUnit: 'mg/dL', decimals: 1, units: { 'mg/dL': { min: 0.5, max: 25 }, 'umol/L': { min: 30, max: 1500 } } },
  thyroid_tsh: { defaultUnit: 'mIU/L', decimals: 3, units: { 'mIU/L': { min: 0.001, max: 200 } } },
};

export const BLOOD_SUGAR_CONTEXTS = ['fasting', 'after_meal', 'random'] as const;

export type Checked<T> = { ok: true; value: T } | { ok: false; reason: string };
const bad = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });

export function checkMeasurement(input: { kind?: unknown; value?: unknown; unit?: unknown; context?: unknown }): Checked<{ kind: MeasurementKind; value: number; unit: string; context?: string }> {
  const kind = String(input.kind ?? '') as MeasurementKind;
  const rule = MEASUREMENT_RULES[kind];
  if (!rule) return bad('Unknown measurement');
  const unit = String(input.unit ?? rule.defaultUnit);
  const range = rule.units[unit];
  if (!range) return bad(`Use one of: ${Object.keys(rule.units).join(', ')}`);
  const text = typeof input.value === 'string' ? input.value.trim().replace(',', '.') : input.value;
  const n = typeof text === 'number' ? text : Number(text);
  if (text === '' || text === null || text === undefined || !Number.isFinite(n)) return bad('Enter a number');
  if (n < range.min || n > range.max) return bad(`That does not look right for ${unit}. Check the number and the unit.`);
  const f = 10 ** rule.decimals;
  const out: { kind: MeasurementKind; value: number; unit: string; context?: string } = { kind, value: Math.round(n * f) / f, unit };
  if (kind === 'blood_sugar' && input.context !== undefined && input.context !== null && input.context !== '') {
    if (!(BLOOD_SUGAR_CONTEXTS as readonly string[]).includes(String(input.context))) return bad('Choose fasting, after a meal or random');
    out.context = String(input.context);
  }
  return { ok: true, value: out };
}

// ----- medications -----

export const FREQUENCIES = [
  { id: 'once_daily', label: 'Once a day', perDay: 1 },
  { id: 'twice_daily', label: 'Twice a day', perDay: 2 },
  { id: 'three_daily', label: 'Three times a day', perDay: 3 },
  { id: 'four_daily', label: 'Four times a day', perDay: 4 },
  { id: 'every_other_day', label: 'Every other day', perDay: 0 },
  { id: 'weekly', label: 'Once a week', perDay: 0 },
  { id: 'as_needed', label: 'Only when needed', perDay: 0 },
] as const;
export type FrequencyId = (typeof FREQUENCIES)[number]['id'];

export const isYmd = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
export const isClock = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

const text = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export interface MedicationInput { name: string; dose: string; frequency: FrequencyId; time?: string; startDate: string; endDate?: string; notes?: string }

export function checkMedication(b: any, todayYmd: string): Checked<MedicationInput> {
  const name = text(b?.name, 120);
  if (name.length < 2) return bad('Enter the medicine name');
  const dose = text(b?.dose, 80);
  const frequency = String(b?.frequency ?? '') as FrequencyId;
  const f = FREQUENCIES.find((x) => x.id === frequency);
  if (!f) return bad('Choose how often you take it');
  let time: string | undefined;
  if (f.perDay > 0) {
    if (!isClock(b?.time)) return bad('Enter the time of your first dose, for example 08:00');
    time = b.time;
  } else if (b?.time) {
    if (!isClock(b.time)) return bad('Enter the time as HH:MM');
    time = b.time;
  }
  if (!isYmd(b?.startDate)) return bad('Choose a start date');
  const oneYear = new Date(`${todayYmd}T00:00:00Z`);
  oneYear.setUTCFullYear(oneYear.getUTCFullYear() + 1);
  if (b.startDate > oneYear.toISOString().slice(0, 10)) return bad('The start date is too far ahead');
  let endDate: string | undefined;
  if (b?.endDate) {
    if (!isYmd(b.endDate)) return bad('Choose a valid end date');
    if (b.endDate < b.startDate) return bad('The end date cannot be before the start date');
    endDate = b.endDate;
  }
  return { ok: true, value: { name, dose, frequency, time, startDate: b.startDate, endDate, notes: text(b?.notes, 300) || undefined } };
}

// ----- family history -----

export const RELATIVES = ['Mother', 'Father', 'Sister', 'Brother', 'Grandmother', 'Grandfather', 'Aunt', 'Uncle', 'Daughter', 'Son', 'Other relative'] as const;

// Names people recognise. This is a picker, not a diagnosis list.
export const FAMILY_CONDITIONS = [
  'Diabetes', 'High blood pressure', 'Heart disease', 'Stroke', 'High cholesterol', 'Sickle cell disorder', 'Asthma', 'Kidney disease',
  'Thyroid disorder', 'Epilepsy or seizures', 'Chronic liver disease or hepatitis', 'Breast cancer', 'Prostate cancer', 'Cervical cancer',
  'Colon cancer', 'Other cancer', 'Mental health condition', 'Dementia', 'Arthritis', 'Glaucoma', 'Obesity', 'Tuberculosis', 'Bleeding or clotting disorder',
  'Birth defect', 'Other',
] as const;

export interface FamilyHistoryInput { relative: string; conditions: string[]; otherText?: string; ageAtDiagnosis?: number; living?: boolean }

export function checkFamilyHistory(b: any): Checked<FamilyHistoryInput> {
  const relative = String(b?.relative ?? '');
  if (!(RELATIVES as readonly string[]).includes(relative)) return bad('Choose the relative');
  const raw: unknown[] = Array.isArray(b?.conditions) ? b.conditions : [];
  const conditions = Array.from(new Set(raw.map((c) => String(c))));
  if (!conditions.length) return bad('Choose at least one condition');
  if (conditions.length > 15) return bad('Choose up to 15 conditions');
  if (conditions.some((c) => !(FAMILY_CONDITIONS as readonly string[]).includes(c))) return bad('One of the conditions is not in the list');
  const otherText = text(b?.otherText, 80) || undefined;
  if (conditions.includes('Other') && !otherText) return bad('Say what the other condition is');
  let ageAtDiagnosis: number | undefined;
  if (b?.ageAtDiagnosis !== undefined && b.ageAtDiagnosis !== null && b.ageAtDiagnosis !== '') {
    const n = Number(b.ageAtDiagnosis);
    if (!Number.isInteger(n) || n < 0 || n > 110) return bad('Enter an age between 0 and 110');
    ageAtDiagnosis = n;
  }
  const living = typeof b?.living === 'boolean' ? b.living : undefined;
  return { ok: true, value: { relative, conditions, otherText: conditions.includes('Other') ? otherText : undefined, ageAtDiagnosis, living } };
}

/** Times of day for a first dose and a frequency: evenly spaced through the waking day, starting at `first`. */
export function doseTimes(first: string, perDay: number): string[] {
  if (perDay <= 1) return [first];
  const step = Math.floor(24 / perDay);
  const [h, m] = first.split(':').map(Number);
  return Array.from({ length: perDay }, (_, i) => `${String((h + i * step) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
}
