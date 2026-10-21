// What a saved allergy entry means. "Not recorded" and "no known allergies" are different:
// the first is unknown and prompts the person to answer, the second is an answer.

export type AllergyStatus = 'recorded' | 'none' | 'unknown';

/** The text saved when the person confirms they have no allergy history. */
export const NO_KNOWN_ALLERGIES = 'No known allergies';

const NONE_ANSWER = /^(none|nil|nka|nkda|no allergies|no allergy|no known( drug)? allergies|no known allergy)\.?$/i;
const UNKNOWN_TEXT = /^(none on file|none recorded|none reported|not recorded|not provided|unknown|n\/a|-)\.?$/i;

export function allergyStatus(raw: unknown): AllergyStatus {
  const text = Array.isArray(raw) ? raw.filter(Boolean).join(', ') : typeof raw === 'string' ? raw : '';
  const t = text.trim();
  if (!t || UNKNOWN_TEXT.test(t)) return 'unknown';
  if (NONE_ANSWER.test(t)) return 'none';
  return 'recorded';
}

/** True when the person has answered, either by listing allergies or by saying there are none. */
export function allergiesAnswered(raw: unknown): boolean {
  return allergyStatus(raw) !== 'unknown';
}
