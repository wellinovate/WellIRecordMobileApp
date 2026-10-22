// Canonical LGA / area council catalogue. Codes are `<REGION>-<SLUG>`, for example ABJ-AMAC.
// Only entries a person has checked against an official list belong here. A state with no entries
// takes free text and its LGAs stay unmapped; nothing is guessed.
// Status: the six FCT area councils below are a seed and still need a check against the official list.
export const LGA_CATALOGUE_REVIEW = 'seed_pending_review' as const;

export interface LgaEntry {
  code: string;
  region: string;
  name: string;
  aliases?: string[];
}

export const LGAS: LgaEntry[] = [
  { code: 'ABJ-AMAC', region: 'ABJ', name: 'Abuja Municipal (AMAC)', aliases: ['AMAC', 'Abuja Municipal', 'Abuja Municipal Area Council', 'Municipal'] },
  { code: 'ABJ-ABAJI', region: 'ABJ', name: 'Abaji' },
  { code: 'ABJ-BWARI', region: 'ABJ', name: 'Bwari' },
  { code: 'ABJ-GWAGWALADA', region: 'ABJ', name: 'Gwagwalada' },
  { code: 'ABJ-KUJE', region: 'ABJ', name: 'Kuje' },
  { code: 'ABJ-KWALI', region: 'ABJ', name: 'Kwali' },
];
