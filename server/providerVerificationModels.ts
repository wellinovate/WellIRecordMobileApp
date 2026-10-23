// Collections for provider verification. Every name starts with pv_ so nothing here can collide with the
// main backend's collections in the shared database.
//
// pv_audit is append-only. The model refuses updates and deletes. For a guarantee at the database level, set
// AUDIT_MONGO_URI to a connection string for a database user that can only insert and find on pv_audit; the
// audit writer then uses that connection, so even a bug or a stolen application credential cannot change history.

import mongoose, { Schema, Document, Model, Connection } from 'mongoose';

const base = { timestamps: true } as const;

// ----- providers -----

export interface IPvProvider extends Document {
  /** The staff account (role clinician) this verification belongs to. */
  staffUserId: string;
  /** The website organisation profile of an independent practitioner, when there is one. Used to gate search results. */
  organizationId?: string;
  displayName: string;
  category: string;
  specialtyTier: string;
  status: string;
  registrationLevel?: string;
  /** YYYY-MM-DD from the governing credential. */
  licenceExpiry?: string;
  governingCredentialId?: string;
  verifiedAt?: Date;
  nextReviewAt?: Date;
  remindersSent: number[];
  termsAcceptedAt?: Date;
  termsVersion?: string;
}
const PvProviderSchema = new Schema<IPvProvider>(
  {
    staffUserId: { type: String, required: true, unique: true, index: true },
    organizationId: { type: String, index: true },
    displayName: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    specialtyTier: { type: String, default: 'none' },
    status: { type: String, required: true, default: 'application_pending', index: true },
    registrationLevel: { type: String },
    licenceExpiry: { type: String },
    governingCredentialId: { type: String },
    verifiedAt: { type: Date },
    nextReviewAt: { type: Date, index: true },
    remindersSent: { type: [Number], default: [] },
    termsAcceptedAt: { type: Date },
    termsVersion: { type: String },
  },
  { ...base, collection: 'pv_providers' },
);

// ----- credentials -----

export interface IPvCredential extends Document {
  providerId: string;
  regulator: string;
  registrationNumber: string;
  registrationLevel: string;
  licenceExpiry: string;
  /** public_register, regulator_letter, provider_document or regulator_feed. */
  sourceType: string;
  /** A reference to the evidence: a register URL, a letter number, a document id. */
  sourceRef?: string;
  checkedAt?: Date;
  checkedBy?: string;
  result?: string;
  note?: string;
}
const PvCredentialSchema = new Schema<IPvCredential>(
  {
    providerId: { type: String, required: true, index: true },
    regulator: { type: String, required: true },
    registrationNumber: { type: String, required: true },
    registrationLevel: { type: String, required: true },
    licenceExpiry: { type: String, required: true },
    sourceType: { type: String, required: true },
    sourceRef: { type: String },
    checkedAt: { type: Date },
    checkedBy: { type: String },
    result: { type: String },
    note: { type: String },
  },
  { ...base, collection: 'pv_credentials' },
);

// ----- documents (metadata only; the files live in encrypted object storage) -----

export interface IPvDocument extends Document {
  providerId: string;
  docType: string;
  objectKey: string;
  originalName: string;
  mime: string;
  declaredSize: number;
  sizeBytes?: number;
  sha256?: string;
  uploadState: 'slot_issued' | 'uploaded';
  scanStatus: 'pending' | 'clean' | 'infected' | 'error';
  uploadedAt?: Date;
  retentionUntil: Date;
  deletedAt?: Date;
}
const PvDocumentSchema = new Schema<IPvDocument>(
  {
    providerId: { type: String, required: true, index: true },
    docType: { type: String, required: true },
    objectKey: { type: String, required: true, unique: true },
    originalName: { type: String, required: true },
    mime: { type: String, required: true },
    declaredSize: { type: Number, required: true },
    sizeBytes: { type: Number },
    sha256: { type: String },
    uploadState: { type: String, default: 'slot_issued' },
    scanStatus: { type: String, default: 'pending' },
    uploadedAt: { type: Date },
    retentionUntil: { type: Date, required: true, index: true },
    deletedAt: { type: Date },
  },
  { ...base, collection: 'pv_documents' },
);

// ----- cases -----

export interface IPvCase extends Document {
  providerId: string;
  kind: 'initial' | 'renewal';
  claimedTier: string;
  state: 'open' | 'closed';
  submittedAt: Date;
  assignedReviewer?: string;
  decision?: 'approved' | 'rejected';
  reason?: string;
  decidedAt?: Date;
  decidedBy?: string;
  evidenceRequests: { requestedBy: string; requestedAt: Date; text: string; answeredAt?: Date; answer?: string }[];
  checks: { credentialId?: string; sourceType: string; sourceRef: string; checkedAt: Date; checkedBy: string; result: string; note?: string }[];
}
const EvidenceRequestSchema = new Schema(
  { requestedBy: String, requestedAt: Date, text: String, answeredAt: Date, answer: String },
  { _id: false },
);
const CheckSchema = new Schema(
  { credentialId: String, sourceType: String, sourceRef: String, checkedAt: Date, checkedBy: String, result: String, note: String },
  { _id: false },
);
const PvCaseSchema = new Schema<IPvCase>(
  {
    providerId: { type: String, required: true, index: true },
    kind: { type: String, default: 'initial' },
    claimedTier: { type: String, default: 'none' },
    state: { type: String, default: 'open', index: true },
    submittedAt: { type: Date, required: true, default: () => new Date(), index: true },
    assignedReviewer: { type: String, index: true },
    decision: { type: String },
    reason: { type: String },
    decidedAt: { type: Date },
    decidedBy: { type: String },
    evidenceRequests: { type: [EvidenceRequestSchema], default: [] },
    checks: { type: [CheckSchema], default: [] },
  },
  { ...base, collection: 'pv_cases' },
);

// ----- permissions -----

export interface IPvPermission extends Document {
  providerId: string;
  function: string;
  grantedBy: string;
  grantedAt: Date;
  revokedAt?: Date;
}
const PvPermissionSchema = new Schema<IPvPermission>(
  {
    providerId: { type: String, required: true, index: true },
    function: { type: String, required: true },
    grantedBy: { type: String, required: true },
    grantedAt: { type: Date, required: true, default: () => new Date() },
    revokedAt: { type: Date },
  },
  { ...base, collection: 'pv_permissions' },
);

// ----- restrictions -----

export interface IPvRestriction extends Document {
  providerId: string;
  scope: string;
  reasonCode: string;
  reason: string;
  evidenceRef: string;
  state: 'proposed' | 'active' | 'rejected' | 'lifted';
  proposedBy: string;
  proposedAt: Date;
  appliedBy?: string;
  appliedAt?: Date;
  emergency: boolean;
  reviewState: 'not_needed' | 'pending' | 'reviewed';
  reviewDueAt?: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  appealState: 'none' | 'requested' | 'upheld' | 'overturned';
  appealNote?: string;
  liftedAt?: Date;
  liftedBy?: string;
  /** When the issue was confirmed (for the time-to-restriction measure). */
  confirmedIssueAt?: Date;
}
const PvRestrictionSchema = new Schema<IPvRestriction>(
  {
    providerId: { type: String, required: true, index: true },
    scope: { type: String, required: true },
    reasonCode: { type: String, required: true },
    reason: { type: String, required: true },
    evidenceRef: { type: String, required: true },
    state: { type: String, default: 'proposed', index: true },
    proposedBy: { type: String, required: true },
    proposedAt: { type: Date, required: true, default: () => new Date() },
    appliedBy: { type: String },
    appliedAt: { type: Date },
    emergency: { type: Boolean, default: false },
    reviewState: { type: String, default: 'not_needed', index: true },
    reviewDueAt: { type: Date },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
    appealState: { type: String, default: 'none' },
    appealNote: { type: String },
    liftedAt: { type: Date },
    liftedBy: { type: String },
    confirmedIssueAt: { type: Date },
  },
  { ...base, collection: 'pv_restrictions' },
);

// ----- complaints -----

export interface IPvComplaint extends Document {
  providerId: string;
  reporterId: string;
  type: string;
  description: string;
  state: 'open' | 'assigned' | 'resolved' | 'escalated';
  assignedTo?: string;
  needsSenior: boolean;
  outcome?: string;
  escalatedTo?: string;
  escalationNote?: string;
  openedAt: Date;
  resolvedAt?: Date;
}
const PvComplaintSchema = new Schema<IPvComplaint>(
  {
    providerId: { type: String, required: true, index: true },
    reporterId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    description: { type: String, required: true },
    state: { type: String, default: 'open', index: true },
    assignedTo: { type: String, index: true },
    needsSenior: { type: Boolean, default: false },
    outcome: { type: String },
    escalatedTo: { type: String },
    escalationNote: { type: String },
    openedAt: { type: Date, required: true, default: () => new Date() },
    resolvedAt: { type: Date },
  },
  { ...base, collection: 'pv_complaints' },
);

// ----- recheck tasks (manual queue) -----

export interface IPvRecheck extends Document {
  providerId: string;
  dueAt: Date;
  doneAt?: Date;
  doneBy?: string;
  alertedAt?: Date;
}
const PvRecheckSchema = new Schema<IPvRecheck>(
  {
    providerId: { type: String, required: true, index: true },
    dueAt: { type: Date, required: true, index: true },
    doneAt: { type: Date },
    doneBy: { type: String },
    alertedAt: { type: Date },
  },
  { ...base, collection: 'pv_rechecks' },
);

// ----- audit (append-only) -----

export interface IPvAudit extends Document {
  actorId: string;
  actorType: string;
  action: string;
  subjectType: string;
  subjectId: string;
  purpose?: string;
  lawfulBasis?: string;
  detail?: Record<string, unknown>;
  timestamp: Date;
}
const PvAuditSchema = new Schema<IPvAudit>(
  {
    actorId: { type: String, required: true, index: true },
    actorType: { type: String, required: true },
    action: { type: String, required: true, index: true },
    subjectType: { type: String, required: true },
    subjectId: { type: String, required: true, index: true },
    purpose: { type: String },
    lawfulBasis: { type: String },
    detail: { type: Schema.Types.Mixed },
    timestamp: { type: Date, required: true, default: () => new Date(), index: true, immutable: true },
  },
  { collection: 'pv_audit', timestamps: false, strict: true },
);

const refuse = () => {
  throw new Error('The audit log is append-only');
};
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete', 'findOneAndRemove'] as const) {
  (PvAuditSchema as any).pre(op, refuse);
}
PvAuditSchema.pre('save', function (next) {
  if (!this.isNew) return next(new Error('The audit log is append-only'));
  next();
});
(PvAuditSchema as any).pre('deleteOne', { document: true, query: false }, refuse);

function model<T>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T>) || mongoose.model<T>(name, schema);
}

export const PvProvider = model<IPvProvider>('PvProvider', PvProviderSchema);
export const PvCredential = model<IPvCredential>('PvCredential', PvCredentialSchema);
export const PvDocument = model<IPvDocument>('PvDocument', PvDocumentSchema);
export const PvCase = model<IPvCase>('PvCase', PvCaseSchema);
export const PvPermission = model<IPvPermission>('PvPermission', PvPermissionSchema);
export const PvRestriction = model<IPvRestriction>('PvRestriction', PvRestrictionSchema);
export const PvComplaint = model<IPvComplaint>('PvComplaint', PvComplaintSchema);
export const PvRecheck = model<IPvRecheck>('PvRecheck', PvRecheckSchema);

let auditModel: Model<IPvAudit> | null = null;
let auditConn: Connection | null = null;

/** True when audit writes use their own restricted connection (AUDIT_MONGO_URI). */
export const auditIsRestricted = () => Boolean(process.env.AUDIT_MONGO_URI);

/**
 * The audit model. With AUDIT_MONGO_URI set it lives on a separate connection whose database user can only insert and find,
 * so history cannot be changed even by code with the main database credential. Without it, the model-level guards above apply.
 */
export function auditModelFor(): Model<IPvAudit> {
  if (auditModel) return auditModel;
  const uri = process.env.AUDIT_MONGO_URI;
  if (uri) {
    // A restricted user cannot create indexes, so an admin creates them once (see CLAUDE.md).
    auditConn = mongoose.createConnection(uri, { autoIndex: false });
    auditModel = auditConn.model<IPvAudit>('PvAudit', PvAuditSchema);
  } else {
    auditModel = model<IPvAudit>('PvAudit', PvAuditSchema);
  }
  return auditModel;
}
