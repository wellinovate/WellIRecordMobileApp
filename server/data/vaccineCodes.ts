// Mapping from our schedule codes to CDC CVX codes, used as an extra coding in the FHIR export.
//
// Status: pending_clinical_review. Codes were read from the CDC CVX table
// (www2a.cdc.gov/vaccines/iis/iisstandards/vaccines.asp?rpt=cvx) in October 2026.
// A dose with `cvx: null` has no CVX code that fits, or the right one was not found. It is
// exported with our local code only. SNOMED CT is not mapped: it needs a licensed terminology
// server to check the concept IDs, so none are guessed here.

export const CVX_SYSTEM = 'http://hl7.org/fhir/sid/cvx';

export const VACCINE_CODES_REVIEW = {
  reviewStatus: 'pending_clinical_review' as 'pending_clinical_review' | 'reviewed',
  reviewedBy: null as string | null,
  reviewedOn: null as string | null,
  source: 'CDC CVX code set, read October 2026',
};

export interface CvxEntry {
  cvx: string | null;
  display?: string;
  /** What the reviewer should look at. */
  note?: string;
}

export const CVX_BY_SCHEDULE_CODE: Record<string, CvxEntry> = {
  'BCG-1': { cvx: '19', display: 'Bacillus Calmette-Guerin vaccine' },
  'OPV-0': { cvx: '178', display: 'Non-US bivalent oral polio vaccine (types 1 and 3)', note: 'Assumes bivalent OPV, as used in Nigeria. 02 is trivalent and inactive.' },
  'OPV-1': { cvx: '178', display: 'Non-US bivalent oral polio vaccine (types 1 and 3)', note: 'Same as OPV-0.' },
  'OPV-2': { cvx: '178', display: 'Non-US bivalent oral polio vaccine (types 1 and 3)', note: 'Same as OPV-0.' },
  'OPV-3': { cvx: '178', display: 'Non-US bivalent oral polio vaccine (types 1 and 3)', note: 'Same as OPV-0.' },
  'HEPB-0': { cvx: '08', display: 'Hepatitis B vaccine, pediatric or pediatric/adolescent dosage' },
  'PENTA-1': { cvx: '102', display: 'DTP-Haemophilus influenzae type b conjugate and hepatitis B vaccine', note: 'CVX lists 102 as Non-US and withdrawn in 2007, but it is the only DTP-Hib-HepB code.' },
  'PENTA-2': { cvx: '102', display: 'DTP-Haemophilus influenzae type b conjugate and hepatitis B vaccine', note: 'Same as PENTA-1.' },
  'PENTA-3': { cvx: '102', display: 'DTP-Haemophilus influenzae type b conjugate and hepatitis B vaccine', note: 'Same as PENTA-1.' },
  'PCV-1': { cvx: '133', display: 'Pneumococcal conjugate vaccine, 13 valent', note: 'Assumes PCV13. PCV10 is 177. Confirm which product the programme uses.' },
  'PCV-2': { cvx: '133', display: 'Pneumococcal conjugate vaccine, 13 valent', note: 'Same as PCV-1.' },
  'PCV-3': { cvx: '133', display: 'Pneumococcal conjugate vaccine, 13 valent', note: 'Same as PCV-1.' },
  'ROTA-1': { cvx: '119', display: 'Rotavirus, live, monovalent vaccine', note: 'Assumes monovalent. A pentavalent product would need another code.' },
  'ROTA-2': { cvx: '119', display: 'Rotavirus, live, monovalent vaccine', note: 'Same as ROTA-1.' },
  'IPV-1': { cvx: '10', display: 'Poliovirus vaccine, inactivated' },
  'MCV-1': { cvx: '04', display: 'Measles and rubella virus vaccine', note: 'Assumes measles-rubella (MR). CVX marks 04 inactive. Measles-only is 05.' },
  'MCV-2': { cvx: '04', display: 'Measles and rubella virus vaccine', note: 'Same as MCV-1. Use 03 if the product is MMR.' },
  'YF-1': { cvx: '37', display: 'Yellow fever vaccine live' },
  'HPV-1': { cvx: '165', display: 'HPV9', note: 'Assumes the 9-valent product. 62 is quadrivalent. Confirm the product in use.' },
  // No fitting CVX code found:
  'VITA-1': { cvx: null, note: 'Vitamin A is a supplement, not a vaccine.' },
  'MENA-1': { cvx: null, note: 'No code found for meningococcal A conjugate (MenAfriVac). The CVX meningococcal entries found were ACWY or unspecified.' },
  'MALARIA-1': { cvx: null, note: 'CVX 67 is a generic malaria entry marked never active. No R21 code found.' },
  'MALARIA-2': { cvx: null, note: 'Same as MALARIA-1.' },
  'MALARIA-3': { cvx: null, note: 'Same as MALARIA-1.' },
  'MALARIA-4': { cvx: null, note: 'Same as MALARIA-1.' },
};

export const cvxFor = (scheduleCode: string): CvxEntry | null => {
  const e = CVX_BY_SCHEDULE_CODE[scheduleCode];
  return e && e.cvx ? e : null;
};
