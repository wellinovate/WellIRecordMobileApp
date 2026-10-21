// Pure helpers for the website account link, kept apart from React so they can be tested.

/** The same alphabet the website uses for link codes (no 0, 1, O, I or L). */
const CODE_CHARS = /^[A-HJKMNP-Z2-9]{8}$/;

export function cleanLinkCode(input: string): string {
  return String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isLinkCode(input: string): boolean {
  return CODE_CHARS.test(cleanLinkCode(input));
}

/** Shows a typed code as ABCD-2345 while it is entered. */
export function formatLinkCode(input: string): string {
  const c = cleanLinkCode(input).slice(0, 8);
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

export interface JoinableVisit {
  status: string;
  visitType: string;
  joinOpensAt: string;
  joinClosesAt: string;
}

/** A website video visit can be joined from 10 minutes before the start until an hour after it ends. */
export function webVisitState(v: JoinableVisit, now: number = Date.now()): 'early' | 'open' | 'closed' | 'unavailable' {
  if (v.visitType !== 'virtual' || !['booked', 'checked-in'].includes(v.status)) return 'unavailable';
  const a = Date.parse(v.joinOpensAt);
  const b = Date.parse(v.joinClosesAt);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 'unavailable';
  if (now < a) return 'early';
  return now <= b ? 'open' : 'closed';
}

const STATUS_WORDS: Record<string, string> = {
  awaiting_patient_verification: 'Waiting for you to confirm it is you',
  awaiting_consent: 'Waiting for you to choose what to link',
  under_hospital_review: 'Waiting for the hospital to review',
  linking_in_progress: 'Being added to your record',
  linked: 'Linked',
  action_required: 'The hospital needs to check something',
  cancelled: 'Cancelled',
  expired: 'Expired',
};
export const recordLinkStatusText = (s: string) => STATUS_WORDS[s] || s.replace(/_/g, ' ');

export const SCOPE_TEXT: Record<string, { title: string; body: string; fixed?: boolean }> = {
  demographics: { title: 'Basic details', body: 'Your name, date of birth, sex and contact details as the hospital holds them.', fixed: true },
  allergies: { title: 'Allergies', body: 'Allergies the hospital has recorded for you.' },
  medications: { title: 'Medications', body: 'Medications the hospital has recorded for you.' },
};
