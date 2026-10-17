// Milestone checklist helpers. The catalogue comes from the server.

export type MilestoneDomain = 'social' | 'language' | 'cognitive' | 'movement';
export type MilestoneStatus = 'achieved' | 'not_yet' | 'unsure';

export interface MilestoneItem {
  code: string;
  ageMonths: number;
  domain: MilestoneDomain;
  text: string;
}

export interface MilestoneCatalogue {
  version: string;
  reviewStatus: 'pending_clinical_review' | 'reviewed';
  reviewedBy: string | null;
  reviewedOn: string | null;
  source: string;
  domains: Record<MilestoneDomain, string>;
  milestones: MilestoneItem[];
}

export interface MilestoneRecord {
  code: string;
  status: MilestoneStatus;
  notes: string;
}

export type ScreeningKind = 'developmental' | 'vision' | 'hearing' | 'dental';
export type ScreeningResult = 'no_concerns' | 'follow_up_advised' | 'unsure';

export interface Screening {
  id: string;
  kind: ScreeningKind;
  date: string;
  result: ScreeningResult;
  facility: string;
  notes: string;
}

export interface ScreeningInput {
  kind: ScreeningKind;
  date: string;
  result: ScreeningResult;
  facility?: string;
  notes?: string;
}

export const SCREENING_LABEL: Record<ScreeningKind, string> = {
  developmental: 'Developmental screening',
  vision: 'Vision',
  hearing: 'Hearing',
  dental: 'Dental and oral health',
};

export const RESULT_LABEL: Record<ScreeningResult, string> = {
  no_concerns: 'No concerns',
  follow_up_advised: 'Follow-up advised',
  unsure: 'Not sure',
};

export function ageInMonths(dob: string, today = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const d = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  let months = (today.getFullYear() - d.getUTCFullYear()) * 12 + (today.getMonth() - d.getUTCMonth());
  if (today.getDate() < d.getUTCDate()) months -= 1;
  return Math.max(months, 0);
}

export function bandAges(catalogue: MilestoneCatalogue): number[] {
  return [...new Set(catalogue.milestones.map((m) => m.ageMonths))].sort((a, b) => a - b);
}

export function bandLabel(months: number): string {
  if (months < 24) return `${months} months`;
  if (months % 12 === 0) return `${months / 12} years`;
  return `${months} months`;
}

/** The band the child is in now, the one coming up, and the earlier ones. */
export function splitBands(ages: number[], childMonths: number) {
  const earlier = ages.filter((a) => a <= childMonths);
  const current = earlier.length ? earlier[earlier.length - 1] : null;
  return {
    current,
    earlier: earlier.filter((a) => a !== current).reverse(),
    next: ages.find((a) => a > childMonths) ?? null,
  };
}

/**
 * Milestones the guardian marked "not yet" that the child's age says most
 * children have reached. This is a prompt to talk to a clinician, not a result.
 */
export function discussWithClinician(catalogue: MilestoneCatalogue, records: MilestoneRecord[], childMonths: number): MilestoneItem[] {
  const notYet = new Set(records.filter((r) => r.status === 'not_yet').map((r) => r.code));
  return catalogue.milestones.filter((m) => notYet.has(m.code) && m.ageMonths <= childMonths);
}
