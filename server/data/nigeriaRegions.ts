// The 36 states and the Federal Capital Territory, each with a WelliRecord region code.
// These codes are WelliRecord's own, not government codes. They are kept in one list so two states
// never share a code. The same list is copied in the main backend, the website and the app; each
// repo has a test that checks the same fingerprint (REGIONS_FINGERPRINT), so a change in one place
// must be made in all four.
export interface Region {
  code: string; // three letters; the fourth character of the ID prefix is the zone digit
  name: string;
}

export const REGIONS: readonly Region[] = [
  { code: 'ABI', name: 'Abia' },
  { code: 'ADA', name: 'Adamawa' },
  { code: 'AKW', name: 'Akwa Ibom' },
  { code: 'ANA', name: 'Anambra' },
  { code: 'BAU', name: 'Bauchi' },
  { code: 'BAY', name: 'Bayelsa' },
  { code: 'BEN', name: 'Benue' },
  { code: 'BOR', name: 'Borno' },
  { code: 'CRI', name: 'Cross River' },
  { code: 'DEL', name: 'Delta' },
  { code: 'EBO', name: 'Ebonyi' },
  { code: 'EDO', name: 'Edo' },
  { code: 'EKI', name: 'Ekiti' },
  { code: 'ENU', name: 'Enugu' },
  { code: 'ABJ', name: 'FCT, Abuja' },
  { code: 'GOM', name: 'Gombe' },
  { code: 'IMO', name: 'Imo' },
  { code: 'JIG', name: 'Jigawa' },
  { code: 'KAD', name: 'Kaduna' },
  { code: 'KAN', name: 'Kano' },
  { code: 'KAT', name: 'Katsina' },
  { code: 'KEB', name: 'Kebbi' },
  { code: 'KOG', name: 'Kogi' },
  { code: 'KWA', name: 'Kwara' },
  { code: 'LAG', name: 'Lagos' },
  { code: 'NAS', name: 'Nasarawa' },
  { code: 'NIG', name: 'Niger' },
  { code: 'OGU', name: 'Ogun' },
  { code: 'OND', name: 'Ondo' },
  { code: 'OSU', name: 'Osun' },
  { code: 'OYO', name: 'Oyo' },
  { code: 'PLA', name: 'Plateau' },
  { code: 'RIV', name: 'Rivers' },
  { code: 'SOK', name: 'Sokoto' },
  { code: 'TAR', name: 'Taraba' },
  { code: 'YOB', name: 'Yobe' },
  { code: 'ZAM', name: 'Zamfara' },
];

/** Used when a person registers without choosing a state (old app builds, some social sign-ins). */
export const UNSPECIFIED_REGION: Region = { code: 'UNK', name: 'Not stated' };

/** Other spellings people use. Keys are lower case with spaces and punctuation removed. */
const ALIASES: Record<string, string> = {
  fct: 'ABJ',
  abuja: 'ABJ',
  fctabuja: 'ABJ',
  federalcapitalterritory: 'ABJ',
  federalcapitalterritoryabuja: 'ABJ',
  akwaibom: 'AKW',
  crossriver: 'CRI',
  nassarawa: 'NAS',
};

const squash = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

export function resolveRegion(input: unknown): Region | null {
  const key = squash(String(input ?? ''));
  if (!key) return null;
  const code = ALIASES[key];
  if (code) return REGIONS.find((r) => r.code === code) ?? null;
  return REGIONS.find((r) => squash(r.name) === key || r.code.toLowerCase() === key) ?? null;
}

export const regionByCode = (code: string): Region | null =>
  code === UNSPECIFIED_REGION.code ? UNSPECIFIED_REGION : REGIONS.find((r) => r.code === code) ?? null;

/** A fingerprint of the list, compared in every repo's tests. */
export const REGIONS_FINGERPRINT_SOURCE = REGIONS.map((r) => `${r.code}=${r.name}`).join('|');
