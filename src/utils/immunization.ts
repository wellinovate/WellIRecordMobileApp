// Pure helpers that turn the server's schedule, a child's date of birth and
// their recorded doses into a status for each dose. No schedule is hard-coded.

export interface ScheduleDose {
  code: string;
  vaccine: string;
  antigen: string;
  doseNumber: number;
  dueDays: number;
  graceDays: number;
  route?: string;
  track: 'routine' | 'programme';
  note?: string;
}

export interface ImmunizationSchedule {
  country: string;
  version: string;
  reviewStatus: 'pending_clinical_review' | 'reviewed';
  reviewedBy: string | null;
  reviewedOn: string | null;
  sources: string[];
  notes: string[];
  doses: ScheduleDose[];
}

export interface Vaccination {
  id: string;
  vaccineCode: string;
  vaccineName: string;
  administeredDate: string;
  facility: string;
  provider: string;
  lotNumber: string;
  manufacturer: string;
  expiryDate: string;
  site: string;
  route: string;
  reaction: string;
  notes: string;
  verification: 'caregiver_reported' | 'provider_verified';
  verifiedBy: string;
  verifiedAt: string | null;
  verificationSource: string;
}

export type DoseStatus = 'verified' | 'unverified' | 'notRecorded' | 'due' | 'upcoming' | 'programme';

export interface DoseRow {
  dose: ScheduleDose;
  status: DoseStatus;
  dueDate: string;
  record?: Vaccination;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseIsoDate(value: string | undefined | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}

export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysIso(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  return new Date(d.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function ageInDays(dob: string, today = todayIso()): number | null {
  const a = parseIsoDate(dob);
  const b = parseIsoDate(today);
  if (!a || !b) return null;
  return Math.floor((b.getTime() - a.getTime()) / DAY_MS);
}

export function ageLabel(dob: string, today = todayIso()): string {
  const days = ageInDays(dob, today);
  if (days === null || days < 0) return '';
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`;
  if (days < 70) return `${Math.floor(days / 7)} weeks`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} months`;
  const years = Math.floor(days / 365.25);
  const rem = Math.floor((days - years * 365.25) / 30.44);
  return rem > 0 && years < 6 ? `${years} yr ${rem} mo` : `${years} years`;
}

export function buildDoseRows(
  schedule: ImmunizationSchedule,
  dob: string,
  vaccinations: Vaccination[],
  today = todayIso(),
): DoseRow[] {
  if (!parseIsoDate(dob)) return [];
  const byCode = new Map(vaccinations.map((v) => [v.vaccineCode, v]));
  return schedule.doses.map((dose) => {
    const dueDate = addDaysIso(dob, dose.dueDays);
    const record = byCode.get(dose.code);
    if (record) {
      return { dose, dueDate, record, status: record.verification === 'provider_verified' ? 'verified' : 'unverified' };
    }
    if (dose.track === 'programme') return { dose, dueDate, status: 'programme' };
    const overdueFrom = addDaysIso(dueDate, dose.graceDays);
    if (today > overdueFrom) return { dose, dueDate, status: 'notRecorded' };
    if (today >= dueDate) return { dose, dueDate, status: 'due' };
    return { dose, dueDate, status: 'upcoming' };
  });
}

export interface ImmunizationSummary {
  completed: number;
  upcoming: number;
  notRecorded: number;
  unverified: number;
}

export function summarize(rows: DoseRow[]): ImmunizationSummary {
  const out = { completed: 0, upcoming: 0, notRecorded: 0, unverified: 0 };
  for (const row of rows) {
    if (row.status === 'verified') out.completed += 1;
    else if (row.status === 'unverified') out.unverified += 1;
    else if (row.status === 'notRecorded') out.notRecorded += 1;
    else if (row.status === 'due' || row.status === 'upcoming') out.upcoming += 1;
  }
  return out;
}

export const STATUS_LABEL: Record<DoseStatus, string> = {
  verified: 'Verified',
  unverified: 'Reported by you',
  notRecorded: 'Not recorded',
  due: 'Due now',
  upcoming: 'Upcoming',
  programme: 'Programme dose',
};

export const STATUS_COLOR: Record<DoseStatus, string> = {
  verified: '#15803d',
  unverified: '#b45309',
  notRecorded: '#b45309',
  due: '#1d4ed8',
  upcoming: '#64748b',
  programme: '#64748b',
};

export function formatDisplayDate(iso: string): string {
  const d = parseIsoDate(iso);
  return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : iso;
}
