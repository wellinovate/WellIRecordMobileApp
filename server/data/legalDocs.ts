// The legal documents a new person must accept before an account is created. The text shown in
// the app lives in src/data/legalDocs.ts; the ids and versions here must match it. Change a
// version when the text changes, so each acceptance records exactly what was agreed to.
//
// The Terms and Conditions are a plain-language draft that has not had a legal review.

export const LEGAL_DOCS = {
  privacy: { title: 'Privacy & Data Protection Policy', version: 'privacy-2026-10', required: true },
  terms: { title: 'Terms and Conditions', version: 'terms-draft-2', required: true },
} as const;

export type LegalDocId = keyof typeof LEGAL_DOCS;
export const REQUIRED_LEGAL: LegalDocId[] = (Object.keys(LEGAL_DOCS) as LegalDocId[]).filter((k) => LEGAL_DOCS[k].required);
