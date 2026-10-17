// Nigerian childhood immunization catalogue.
//
// This is data, not logic. Change it here (or replace it with a database
// collection) and bump `version`. The app never hard-codes dose timing.
//
// REVIEW STATUS: the entries below were compiled from public sources that
// disagree with each other in places, and none of them is the current
// NPHCDA schedule document. `reviewStatus` stays 'pending_clinical_review'
// until a clinician checks every row against the official schedule and sets
// `reviewedBy` and `reviewedOn`. The app shows that status to guardians.

export type ScheduleTrack = 'routine' | 'programme';

export interface ScheduleDose {
  /** Stable code, unique per dose. Stored on each vaccination record. */
  code: string;
  vaccine: string;
  antigen: string;
  doseNumber: number;
  /** Days after birth when the dose is first due. */
  dueDays: number;
  /** Days after dueDays before the dose counts as overdue. */
  graceDays: number;
  route?: string;
  /**
   * 'routine' doses are tracked as due and overdue.
   * 'programme' doses depend on region, age group or programme rollout.
   * They can be recorded but are never flagged overdue automatically.
   */
  track: ScheduleTrack;
  note?: string;
}

const W = 7;
const M = 30;
const Y = 365;

export const IMMUNIZATION_SCHEDULE = {
  country: 'NG',
  version: '2026-10-draft-1',
  reviewStatus: 'pending_clinical_review' as 'pending_clinical_review' | 'reviewed',
  reviewedBy: null as string | null,
  reviewedOn: null as string | null,
  sources: [
    'NPHCDA routine immunization schedule as published by NPHCDA on X (2019)',
    'Paediatric Association of Nigeria, immunisation schedule page (updated June 2025)',
    'Health Guide NG, Nigerian child vaccination schedule (February 2026)',
  ],
  notes: [
    'Sources differ on IPV doses, rotavirus dose count, measles-containing vaccine and meningococcal timing. Rows below follow what all sources agree on.',
    'Programme doses vary by state and rollout. Ask the clinic what applies to your child.',
  ],
  doses: [
    // Birth
    { code: 'BCG-1', vaccine: 'BCG', antigen: 'Tuberculosis', doseNumber: 1, dueDays: 0, graceDays: 4 * W, route: 'Intradermal', track: 'routine' },
    { code: 'OPV-0', vaccine: 'OPV birth dose', antigen: 'Polio (oral)', doseNumber: 0, dueDays: 0, graceDays: 2 * W, route: 'Oral', track: 'routine', note: 'Normally given in the first 2 weeks of life.' },
    { code: 'HEPB-0', vaccine: 'Hepatitis B birth dose', antigen: 'Hepatitis B', doseNumber: 0, dueDays: 0, graceDays: 1 * W, route: 'Intramuscular', track: 'routine', note: 'Best given within 24 hours of birth.' },

    // 6 weeks
    { code: 'PENTA-1', vaccine: 'Pentavalent', antigen: 'Diphtheria, tetanus, pertussis, hepatitis B, Hib', doseNumber: 1, dueDays: 6 * W, graceDays: 4 * W, route: 'Intramuscular', track: 'routine' },
    { code: 'OPV-1', vaccine: 'OPV', antigen: 'Polio (oral)', doseNumber: 1, dueDays: 6 * W, graceDays: 4 * W, route: 'Oral', track: 'routine' },
    { code: 'PCV-1', vaccine: 'PCV', antigen: 'Pneumococcal disease', doseNumber: 1, dueDays: 6 * W, graceDays: 4 * W, route: 'Intramuscular', track: 'routine' },
    { code: 'ROTA-1', vaccine: 'Rotavirus', antigen: 'Rotavirus', doseNumber: 1, dueDays: 6 * W, graceDays: 4 * W, route: 'Oral', track: 'routine' },

    // 10 weeks
    { code: 'PENTA-2', vaccine: 'Pentavalent', antigen: 'Diphtheria, tetanus, pertussis, hepatitis B, Hib', doseNumber: 2, dueDays: 10 * W, graceDays: 4 * W, route: 'Intramuscular', track: 'routine' },
    { code: 'OPV-2', vaccine: 'OPV', antigen: 'Polio (oral)', doseNumber: 2, dueDays: 10 * W, graceDays: 4 * W, route: 'Oral', track: 'routine' },
    { code: 'PCV-2', vaccine: 'PCV', antigen: 'Pneumococcal disease', doseNumber: 2, dueDays: 10 * W, graceDays: 4 * W, route: 'Intramuscular', track: 'routine' },
    { code: 'ROTA-2', vaccine: 'Rotavirus', antigen: 'Rotavirus', doseNumber: 2, dueDays: 10 * W, graceDays: 4 * W, route: 'Oral', track: 'routine' },

    // 14 weeks
    { code: 'PENTA-3', vaccine: 'Pentavalent', antigen: 'Diphtheria, tetanus, pertussis, hepatitis B, Hib', doseNumber: 3, dueDays: 14 * W, graceDays: 4 * W, route: 'Intramuscular', track: 'routine' },
    { code: 'OPV-3', vaccine: 'OPV', antigen: 'Polio (oral)', doseNumber: 3, dueDays: 14 * W, graceDays: 4 * W, route: 'Oral', track: 'routine' },
    { code: 'PCV-3', vaccine: 'PCV', antigen: 'Pneumococcal disease', doseNumber: 3, dueDays: 14 * W, graceDays: 4 * W, route: 'Intramuscular', track: 'routine' },
    { code: 'IPV-1', vaccine: 'IPV', antigen: 'Polio (injected)', doseNumber: 1, dueDays: 14 * W, graceDays: 4 * W, route: 'Intramuscular', track: 'routine' },

    // 9 months
    { code: 'MCV-1', vaccine: 'Measles-containing vaccine', antigen: 'Measles (MR or measles)', doseNumber: 1, dueDays: 9 * M, graceDays: 8 * W, route: 'Subcutaneous', track: 'routine' },
    { code: 'YF-1', vaccine: 'Yellow fever', antigen: 'Yellow fever', doseNumber: 1, dueDays: 9 * M, graceDays: 8 * W, route: 'Subcutaneous', track: 'routine' },

    // Programme and region dependent
    { code: 'VITA-1', vaccine: 'Vitamin A', antigen: 'Vitamin A supplement', doseNumber: 1, dueDays: 6 * M, graceDays: 8 * W, route: 'Oral', track: 'programme', note: 'Supplement, repeated every 6 months in some programmes.' },
    { code: 'MENA-1', vaccine: 'Meningococcal conjugate', antigen: 'Meningococcal disease', doseNumber: 1, dueDays: 9 * M, graceDays: 12 * W, route: 'Intramuscular', track: 'programme', note: 'Meningitis belt states and campaigns. Timing differs between sources.' },
    { code: 'MALARIA-1', vaccine: 'Malaria vaccine (R21)', antigen: 'Malaria', doseNumber: 1, dueDays: 5 * M, graceDays: 8 * W, route: 'Intramuscular', track: 'programme', note: 'Selected states only.' },
    { code: 'MALARIA-2', vaccine: 'Malaria vaccine (R21)', antigen: 'Malaria', doseNumber: 2, dueDays: 6 * M, graceDays: 8 * W, route: 'Intramuscular', track: 'programme', note: 'Selected states only.' },
    { code: 'MALARIA-3', vaccine: 'Malaria vaccine (R21)', antigen: 'Malaria', doseNumber: 3, dueDays: 7 * M, graceDays: 8 * W, route: 'Intramuscular', track: 'programme', note: 'Selected states only.' },
    { code: 'MALARIA-4', vaccine: 'Malaria vaccine (R21)', antigen: 'Malaria', doseNumber: 4, dueDays: 15 * M, graceDays: 12 * W, route: 'Intramuscular', track: 'programme', note: 'Selected states only.' },
    { code: 'MCV-2', vaccine: 'Measles-containing vaccine, second dose', antigen: 'Measles (MR or MMR)', doseNumber: 2, dueDays: 15 * M, graceDays: 12 * W, route: 'Subcutaneous', track: 'programme', note: 'Timing differs between sources.' },
    { code: 'HPV-1', vaccine: 'HPV', antigen: 'Human papillomavirus', doseNumber: 1, dueDays: 9 * Y, graceDays: 5 * Y, route: 'Intramuscular', track: 'programme', note: 'Ages 9 to 14. Follow the current national guidance on who is eligible.' },
  ] as ScheduleDose[],
};

export const SCHEDULE_CODES = new Set(IMMUNIZATION_SCHEDULE.doses.map((d) => d.code));
export const scheduleDoseByCode = (code: string) => IMMUNIZATION_SCHEDULE.doses.find((d) => d.code === code);
