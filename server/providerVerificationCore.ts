// Provider verification rules. No database, no network: everything here is a pure function so it can be tested.
//
// Three things live here and nowhere else:
//   1. the status state machine (six states, who may move a provider between them),
//   2. the eligibility check (`evaluateEligibility`), which every clinical path reaches through `canPerform`,
//   3. the expiry clock (renewal due, expired, reminder thresholds).
//
// The eligibility check fails closed. Missing or odd data means "not eligible", never "eligible".

// ----- vocabulary -----

export const CATEGORIES = ['doctor', 'dentist', 'nurse', 'lab_scientist', 'pharmacist'] as const;
export type Category = (typeof CATEGORIES)[number];

/** Pilot scope: doctors only. The other categories share the schema but are not switched on until their regulators are engaged. */
export const ACTIVATED_CATEGORIES: readonly Category[] = ['doctor'];

export const SPECIALTY_TIERS = ['none', 'radiologist'] as const;
export type SpecialtyTier = (typeof SPECIALTY_TIERS)[number];

/** Provisional, full and specialist. Confirm the exact MDCN terms before launch. */
export const REGISTRATION_LEVELS = ['provisional', 'full', 'specialist'] as const;
export type RegistrationLevel = (typeof REGISTRATION_LEVELS)[number];

export const STATUSES = ['application_pending', 'further_evidence_required', 'verified_active', 'renewal_due', 'on_hold', 'expired'] as const;
export type ProviderStatus = (typeof STATUSES)[number];

/** Only these two statuses grant clinical functions. */
export const CLINICAL_STATUSES: readonly ProviderStatus[] = ['verified_active', 'renewal_due'];

export const SOURCE_TYPES = ['public_register', 'regulator_letter', 'provider_document', 'regulator_feed'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];
/** Primary-source evidence: checked against the regulator, not supplied by the provider. */
export const PRIMARY_SOURCES: readonly SourceType[] = ['public_register', 'regulator_letter', 'regulator_feed'];

export type FunctionName =
  | 'consult' | 'document' | 'refer' | 'prescribe' | 'access_records' | 'imaging_report'
  | 'result_entry' | 'result_release' | 'dispense' | 'verify_dispense' | 'nursing_documentation' | 'observations';

/** Permissions are defined per category, not per account. */
export const CATEGORY_FUNCTIONS: Record<Category, FunctionName[]> = {
  doctor: ['consult', 'document', 'refer', 'prescribe', 'access_records'],
  dentist: ['consult', 'document', 'refer', 'prescribe', 'access_records'],
  nurse: ['nursing_documentation', 'observations'],
  lab_scientist: ['result_entry', 'result_release'],
  pharmacist: ['dispense', 'verify_dispense'],
};
/** The radiologist tier is a doctor plus imaging reports. */
export const TIER_FUNCTIONS: Record<SpecialtyTier, FunctionName[]> = { none: [], radiologist: ['imaging_report'] };
/** Imaging reports need specialist registration. Confirm with the regulator and the radiology college. */
export const IMAGING_REQUIRES_LEVEL: readonly RegistrationLevel[] = ['specialist'];

export const ACTIONS = [
  'book_consultation', 'start_consultation', 'access_patient_record', 'write_prescription', 'write_referral',
  'write_clinical_note', 'write_imaging_report', 'appear_in_search',
  'enter_result', 'release_result', 'dispense', 'verify_dispense', 'nursing_note', 'record_observation',
] as const;
export type Action = (typeof ACTIONS)[number];

export const ACTION_FUNCTION: Record<Action, FunctionName> = {
  book_consultation: 'consult',
  start_consultation: 'consult',
  appear_in_search: 'consult',
  access_patient_record: 'access_records',
  write_prescription: 'prescribe',
  write_referral: 'refer',
  write_clinical_note: 'document',
  write_imaging_report: 'imaging_report',
  enter_result: 'result_entry',
  release_result: 'result_release',
  dispense: 'dispense',
  verify_dispense: 'verify_dispense',
  nursing_note: 'nursing_documentation',
  record_observation: 'observations',
};

export function functionsFor(category: string, tier: string): FunctionName[] {
  const base = (CATEGORY_FUNCTIONS as Record<string, FunctionName[]>)[category] ?? [];
  const extra = category === 'doctor' ? (TIER_FUNCTIONS as Record<string, FunctionName[]>)[tier] ?? [] : [];
  return [...base, ...extra];
}

// ----- dates -----

/** A licence runs to the end of its expiry day in Lagos (23:59:59.999 at UTC+1). Input is YYYY-MM-DD. */
export function expiryInstant(ymd: unknown): Date | null {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 22, 59, 59, 999));
  return Number.isNaN(dt.getTime()) || dt.getUTCMonth() !== m - 1 ? null : dt;
}

export const DAY_MS = 86_400_000;
export const daysUntil = (instant: Date, now: Date) => Math.ceil((instant.getTime() - now.getTime()) / DAY_MS);

// ----- eligibility -----

export interface ProviderSnapshot {
  id: string;
  category: string;
  specialtyTier: string;
  status: string;
  registrationLevel?: string | null;
  /** YYYY-MM-DD from the credential on record. */
  licenceExpiry?: string | null;
  /** Functions with an active (not revoked) permission row. */
  grantedFunctions: string[];
  /** Restrictions that are active now (applied and not lifted). */
  restrictions: { scope: string }[];
}

export type DenyReason =
  | 'no_provider' | 'unknown_action' | 'category_inactive' | 'status_not_clinical' | 'no_expiry' | 'expired'
  | 'provisional_registration' | 'level_insufficient' | 'function_not_permitted' | 'permission_revoked' | 'restricted' | 'error';

export interface Eligibility {
  eligible: boolean;
  reason: 'ok' | DenyReason;
}

const deny = (reason: DenyReason): Eligibility => ({ eligible: false, reason });

/**
 * Whether this provider may do this at this moment. Checks category activation, status, credential expiry,
 * registration level, category permissions and any active restriction. Any error or missing data is a denial.
 */
export function evaluateEligibility(p: ProviderSnapshot | null | undefined, action: string, now: Date = new Date()): Eligibility {
  try {
    if (!p || !p.id) return deny('no_provider');
    if (!(action in ACTION_FUNCTION)) return deny('unknown_action');
    const act = action as Action;
    const fn = ACTION_FUNCTION[act];

    if (!(ACTIVATED_CATEGORIES as readonly string[]).includes(p.category)) return deny('category_inactive');
    if (!(CLINICAL_STATUSES as readonly string[]).includes(p.status)) return deny('status_not_clinical');

    // Expiry is checked on every call, whatever the status says: a lapsed licence never works, even before the daily job runs.
    const exp = expiryInstant(p.licenceExpiry);
    if (!exp) return deny('no_expiry');
    if (now.getTime() > exp.getTime()) return deny('expired');

    if (p.registrationLevel === 'provisional') return deny('provisional_registration');
    if (!(REGISTRATION_LEVELS as readonly string[]).includes(String(p.registrationLevel))) return deny('level_insufficient');

    if (!functionsFor(p.category, p.specialtyTier).includes(fn)) return deny('function_not_permitted');
    if (fn === 'imaging_report' && !(IMAGING_REQUIRES_LEVEL as readonly string[]).includes(String(p.registrationLevel))) return deny('level_insufficient');
    if (!Array.isArray(p.grantedFunctions) || !p.grantedFunctions.includes(fn)) return deny('permission_revoked');

    if (!Array.isArray(p.restrictions)) return deny('error'); // unknown restriction state is not 'no restrictions'
    for (const r of p.restrictions) {
      if (r.scope === 'all' || r.scope === act || r.scope === fn) return deny('restricted');
    }
    return { eligible: true, reason: 'ok' };
  } catch {
    return deny('error');
  }
}

// ----- state machine -----

export type VerificationEvent =
  | 'request_evidence' | 'submit_evidence' | 'approve' | 'put_on_hold' | 'lift_hold' | 'mark_renewal_due' | 'expire' | 'reapply';

export const REVIEWER_ROLES = ['reviewer', 'senior_reviewer', 'compliance_admin'] as const;
/** Only these may move a case to verified_active. */
export const APPROVER_ROLES = ['senior_reviewer', 'compliance_admin'] as const;

const TRANSITIONS: Record<ProviderStatus, Partial<Record<VerificationEvent, ProviderStatus>>> = {
  application_pending: { request_evidence: 'further_evidence_required', approve: 'verified_active' },
  further_evidence_required: { submit_evidence: 'application_pending' },
  verified_active: { mark_renewal_due: 'renewal_due', put_on_hold: 'on_hold', expire: 'expired' },
  renewal_due: { approve: 'verified_active', put_on_hold: 'on_hold', expire: 'expired' },
  on_hold: { lift_hold: 'verified_active', expire: 'expired' },
  expired: { reapply: 'application_pending' },
};

/** Who may trigger each event. 'provider' is the person being verified; 'system' is a scheduled job. */
const EVENT_ACTORS: Record<VerificationEvent, readonly string[]> = {
  request_evidence: REVIEWER_ROLES,
  submit_evidence: ['provider'],
  approve: APPROVER_ROLES,
  put_on_hold: APPROVER_ROLES,
  lift_hold: APPROVER_ROLES,
  mark_renewal_due: ['system'],
  expire: ['system'],
  reapply: ['provider'],
};

export const HOLD_REASON_CODES = ['licence_check_pending', 'evidence_under_review', 'record_discrepancy', 'regulator_query', 'administrative'] as const;
export type HoldReasonCode = (typeof HOLD_REASON_CODES)[number];

/** Wording that states or implies misconduct. A reason that contains any of these is refused. */
const MISCONDUCT_WORDS = new RegExp(
  '\\b(' +
    [
      'misconduct', 'fraud\\w*', 'negligen\\w*', 'malpractice', 'criminal\\w*', 'illegal\\w*', 'unlawful', 'abus\\w*',
      'disciplin\\w*', 'struck\\s+off', 'erased', 'guilty', 'convict\\w*', 'unethical', 'fak(?:e|ed|ing)', 'forg(?:ed|ery|ing)',
      'impersonat\\w*', 'dishonest\\w*', 'scam\\w*', 'corrupt\\w*', 'incompeten\\w*', 'harm(?:ed|ful)?', 'complain\\w*',
      'investigat\\w*', 'suspect\\w*', 'suspen\\w*', 'sanction\\w*', 'offen[cs]e\\w*', 'violat\\w*', 'breach\\w*', 'unsafe', 'lied', 'lying',
    ].join('|') +
    ')\\b',
  'i',
);

/** Null when the text is acceptable as a hold reason. A guard, not a guarantee: reviewers still write neutral text. */
export function reasonProblem(text: unknown): string | null {
  const t = typeof text === 'string' ? text.trim() : '';
  if (t.length < 5) return 'Give a short reason';
  if (t.length > 300) return 'Keep the reason under 300 characters';
  if (MISCONDUCT_WORDS.test(t)) return 'The reason must not state or imply misconduct. Describe the administrative step instead.';
  return null;
}

export interface HoldInput {
  reasonCode?: string;
  evidenceRef?: string;
  note?: string;
}

export interface TransitionInput {
  from: string;
  event: string;
  /** A staff role, 'provider' or 'system'. */
  actorRole: string;
  actorId?: string;
  /** The staff account of the provider being verified, so nobody approves their own case. */
  subjectStaffId?: string | null;
  assignedReviewerId?: string | null;
  hold?: HoldInput;
}

export type TransitionResult = { ok: true; to: ProviderStatus } | { ok: false; reason: string };

export function nextStatus(i: TransitionInput): TransitionResult {
  if (!(STATUSES as readonly string[]).includes(i.from)) return { ok: false, reason: 'Unknown status' };
  const row = TRANSITIONS[i.from as ProviderStatus];
  const to = row[i.event as VerificationEvent];
  if (!to) return { ok: false, reason: `A provider who is ${i.from.replace(/_/g, ' ')} cannot take that step` };
  const allowed = EVENT_ACTORS[i.event as VerificationEvent];
  if (!allowed.includes(i.actorRole)) return { ok: false, reason: 'That role cannot take this step' };

  if (i.event === 'approve') {
    if (i.actorId && i.subjectStaffId && i.actorId === i.subjectStaffId) return { ok: false, reason: 'Nobody can approve their own case' };
    if (i.actorId && i.assignedReviewerId && i.actorId === i.assignedReviewerId) return { ok: false, reason: 'The assigned reviewer cannot also approve. Another approver must decide.' };
  }
  if (i.event === 'put_on_hold') {
    const h = i.hold;
    if (!h || !(HOLD_REASON_CODES as readonly string[]).includes(String(h.reasonCode))) return { ok: false, reason: 'A hold needs a reason code' };
    if (!h.evidenceRef || !String(h.evidenceRef).trim()) return { ok: false, reason: 'A hold needs an evidence reference' };
    const p = reasonProblem(h.note);
    if (p) return { ok: false, reason: p };
  }
  return { ok: true, to };
}

/** Lifting a hold returns the provider to verified_active, unless the licence ran out meanwhile. */
export function liftTarget(licenceExpiry: string | null | undefined, now: Date): ProviderStatus {
  const exp = expiryInstant(licenceExpiry);
  return !exp || now.getTime() > exp.getTime() ? 'expired' : 'verified_active';
}

// ----- two-person rule for restrictions -----

export type RestrictionDecision = { ok: true } | { ok: false; reason: string };

/** One person proposes, a different approver applies it. An approver acting alone is an emergency override: logged and reviewed afterwards. */
export function checkRestrictionApproval(i: { proposedBy: string; approverId: string; approverRole: string; emergency?: boolean }): RestrictionDecision {
  if (!(APPROVER_ROLES as readonly string[]).includes(i.approverRole)) return { ok: false, reason: 'Only a senior reviewer or compliance admin can apply a restriction' };
  if (i.emergency) return { ok: true };
  if (i.proposedBy === i.approverId) return { ok: false, reason: 'A second person must approve. Use the emergency override only when it cannot wait.' };
  return { ok: true };
}

/** The emergency override must be reviewed by someone other than the person who used it. */
export function checkEmergencyReview(i: { appliedBy: string; reviewerId: string; reviewerRole: string }): RestrictionDecision {
  if (!(APPROVER_ROLES as readonly string[]).includes(i.reviewerRole)) return { ok: false, reason: 'Only a senior reviewer or compliance admin can review an override' };
  if (i.appliedBy === i.reviewerId) return { ok: false, reason: 'Someone else must review an emergency override' };
  return { ok: true };
}

export const RESTRICTION_SCOPES: readonly string[] = ['all', 'consult', 'prescribe', 'refer', 'document', 'access_records', 'imaging_report'];
export const REVIEW_WINDOW_HOURS = 24;

// ----- expiry clock -----

export const REMINDER_DAYS = [60, 30, 7] as const;
export const RENEWAL_WINDOW_DAYS = 60;

export interface ExpiryInput {
  id: string;
  status: string;
  licenceExpiry?: string | null;
  remindersSent?: number[];
}

export type ExpiryAction =
  | { providerId: string; kind: 'expire' }
  | { providerId: string; kind: 'mark_renewal_due' }
  | { providerId: string; kind: 'remind'; days: number; markSent: number[] };

/**
 * What the daily job should do for one provider. Expiry needs no human step: once the licence date has passed the provider is expired.
 * One reminder per run: if the job was down and two thresholds were crossed, the most urgent is sent and both are marked.
 */
export function expiryActions(p: ExpiryInput, now: Date): ExpiryAction[] {
  const out: ExpiryAction[] = [];
  const exp = expiryInstant(p.licenceExpiry);
  if (!exp) return out;
  const live = ['verified_active', 'renewal_due', 'on_hold'].includes(p.status);
  if (!live) return out;
  if (now.getTime() > exp.getTime()) return [{ providerId: p.id, kind: 'expire' }];
  const left = daysUntil(exp, now);
  if (p.status === 'verified_active' && left <= RENEWAL_WINDOW_DAYS) out.push({ providerId: p.id, kind: 'mark_renewal_due' });
  if (p.status !== 'on_hold') {
    const sent = p.remindersSent ?? [];
    const crossed = REMINDER_DAYS.filter((d) => left <= d && !sent.includes(d));
    if (crossed.length) out.push({ providerId: p.id, kind: 'remind', days: Math.min(...crossed), markSent: [...crossed] });
  }
  return out;
}

/** A manual recheck is overdue when its due date has passed and it is not done. */
export const recheckOverdue = (dueAt: Date, doneAt: Date | null | undefined, now: Date) => !doneAt && now.getTime() > dueAt.getTime();
export const RECHECK_INTERVAL_DAYS = 180;

// ----- audit -----

export const LAWFUL_BASES = ['consent', 'contract', 'legal_obligation', 'vital_interests', 'public_interest', 'legitimate_interests'] as const;
export type LawfulBasis = (typeof LAWFUL_BASES)[number];

export interface AuditInput {
  actorId: string;
  action: string;
  subjectType: string;
  subjectId: string;
  purpose?: string;
  lawfulBasis?: string;
  detail?: Record<string, unknown>;
}

/** Record access needs a stated purpose and a lawful basis or consent reference. Returns a problem or null. */
export function auditProblem(a: AuditInput, requiresBasis: boolean): string | null {
  if (!a.actorId || !a.action || !a.subjectType || !a.subjectId) return 'Audit event is missing the actor, action or subject';
  if (requiresBasis) {
    if (!a.purpose || !a.purpose.trim()) return 'Record access needs a purpose';
    if (!a.lawfulBasis || !(LAWFUL_BASES as readonly string[]).includes(a.lawfulBasis)) return 'Record access needs a lawful basis';
  }
  return null;
}

// ----- documents -----

export const DOC_TYPES = ['id_document', 'practising_licence', 'registration_certificate', 'degree_certificate', 'other'] as const;
export type DocType = (typeof DOC_TYPES)[number];
export const PROVIDER_DOC_MAX_BYTES = 10_000_000;
export const PROVIDER_DOC_MIME = ['application/pdf', 'image/jpeg', 'image/png'] as const;
/** Documents per case. */
export const MAX_DOCS_PER_PROVIDER = 12;

// ----- metrics -----

export interface MetricsInput {
  providers: { id: string; status: string }[];
  /** Latest credential per provider. */
  credentials: { providerId: string; sourceType: string }[];
  cases: { submittedAt: Date; decidedAt?: Date | null }[];
  expiredOrInvalidFound: number;
  restrictions: { confirmedIssueAt?: Date | null; appliedAt?: Date | null }[];
  complaints: { openedAt: Date; resolvedAt?: Date | null }[];
  /** Consultations started, and how many of them were by an eligible provider. */
  consultations: { total: number; eligible: number };
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const hours = (a: Date, b: Date) => Math.round(((b.getTime() - a.getTime()) / 3_600_000) * 10) / 10;

export function verificationMetrics(m: MetricsInput) {
  const live = m.providers.filter((p) => ['verified_active', 'renewal_due', 'on_hold'].includes(p.status));
  const withPrimary = live.filter((p) => m.credentials.some((c) => c.providerId === p.id && (PRIMARY_SOURCES as readonly string[]).includes(c.sourceType)));
  return {
    providersLive: live.length,
    primarySourceShare: live.length ? Math.round((withPrimary.length / live.length) * 1000) / 10 : null,
    verificationHoursMedian: median(m.cases.filter((c) => c.decidedAt).map((c) => hours(c.submittedAt, c.decidedAt as Date))),
    expiredOrInvalidFound: m.expiredOrInvalidFound,
    hoursFromConfirmedIssueToRestrictionMedian: median(
      m.restrictions.filter((r) => r.confirmedIssueAt && r.appliedAt).map((r) => hours(r.confirmedIssueAt as Date, r.appliedAt as Date)),
    ),
    complaintsOpened: m.complaints.length,
    complaintResolutionHoursMedian: median(m.complaints.filter((c) => c.resolvedAt).map((c) => hours(c.openedAt, c.resolvedAt as Date))),
    consultationsByEligibleShare: m.consultations.total ? Math.round((m.consultations.eligible / m.consultations.total) * 1000) / 10 : null,
  };
}
