/**
 * WelliRecord MongoDB / Mongoose Data Models
 * Standard: Nigeria Data Protection Regulation (NDPR) & HIPAA Compliance
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// 1. User Model
export interface IUser extends Document {
  phoneNumber: string;
  email?: string;
  fullName: string;
  password?: string;
  bloodType: string;
  genotype: string;
  hmoProvider: string;
  hmoPolicyNumber?: string;
  isPhoneVerified: boolean;
  twoFactorEnabled: boolean;
  biometricKeyHash?: string;
  sessionsRevokedAt?: Date;
  pushTokens?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    phoneNumber: { type: String, required: true, unique: true, index: true },
    email: { type: String, lowercase: true, trim: true },
    fullName: { type: String, required: true },
    password: { type: String },
    bloodType: { type: String },
    genotype: { type: String },
    hmoProvider: { type: String },
    hmoPolicyNumber: { type: String },
    isPhoneVerified: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: true },
    biometricKeyHash: { type: String },
    sessionsRevokedAt: { type: Date },
    pushTokens: { type: [String], default: [] },
  },
  { timestamps: true }
);

// 2. Family Member Model (Dependents, Spouse, Senior Parents)
export interface IFamilyMember extends Document {
  accountId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  fullName: string;
  name?: string;
  initials: string;
  relationship: string;
  role: 'owner' | 'dependent';
  dateOfBirth?: string;
  dob?: string | Date;
  gender?: string;
  bloodType?: string;
  genotype?: string;
  height?: string;
  avatarUrl?: string;
  heightCm?: number;
  weight?: string;
  weightKg?: number;
  allergies?: string;
  phone?: string;
  linkedAccountId?: mongoose.Types.ObjectId | null;
  wrId?: string;
  childProfile?: Record<string, any>;
  custodyLock?: Record<string, any>;
  pendingTransfer?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const FamilyMemberSchema = new Schema<IFamilyMember>(
  {
    accountId: { type: Schema.Types.ObjectId, index: true },
    userId: { type: Schema.Types.ObjectId, index: true },
    fullName: { type: String, required: true },
    name: { type: String },
    initials: { type: String, required: true },
    relationship: { type: String, required: true },
    role: { type: String, default: 'dependent' },
    dateOfBirth: { type: String },
    dob: { type: Schema.Types.Mixed },
    gender: { type: String },
    bloodType: { type: String },
    genotype: { type: String },
    height: { type: String },
    avatarUrl: { type: String },
    heightCm: { type: Number },
    weight: { type: String },
    weightKg: { type: Number },
    allergies: { type: String },
    phone: { type: String },
    linkedAccountId: { type: Schema.Types.ObjectId, default: null },
    wrId: { type: String, index: true, sparse: true },
    // Child identity, birth and emergency details. Whitelisted in the route.
    childProfile: { type: Schema.Types.Mixed },
    // Set only through the admin-secret route. Blocks guardian management and transfer.
    custodyLock: { type: Schema.Types.Mixed },
    // { toAccountId, guardianId, codeHash, expiresAt, attempts, requestedBy }
    pendingTransfer: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Another adult who helps manage a child. The primary guardian is the
// FamilyMember's accountId; everyone else is a row here.
export interface IChildGuardian extends Document {
  childId: mongoose.Types.ObjectId;
  accountId?: string;
  displayName: string;
  relationship: string;
  inviteEmail?: string;
  invitePhone?: string;
  inviteCodeHash?: string;
  inviteExpiresAt?: Date;
  status: 'pending' | 'active' | 'revoked';
  permissions: {
    viewRecords: boolean;
    addRecords: boolean;
    bookAppointments: boolean;
    receiveReminders: boolean;
    manageGuardians: boolean;
  };
  restriction?: {
    active: boolean;
    level: 'blocked' | 'view_only';
    reason?: string;
    orderReference?: string;
    setBy?: string;
    setAt?: Date;
  };
  identityVerified: boolean;
  invitedBy: string;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChildGuardianSchema = new Schema<IChildGuardian>(
  {
    childId: { type: Schema.Types.ObjectId, required: true, index: true },
    accountId: { type: String, index: true },
    displayName: { type: String, required: true },
    relationship: { type: String, required: true },
    inviteEmail: { type: String, lowercase: true, trim: true },
    invitePhone: { type: String },
    inviteCodeHash: { type: String, index: true },
    inviteExpiresAt: { type: Date },
    status: { type: String, enum: ['pending', 'active', 'revoked'], default: 'pending' },
    permissions: {
      viewRecords: { type: Boolean, default: true },
      addRecords: { type: Boolean, default: false },
      bookAppointments: { type: Boolean, default: false },
      receiveReminders: { type: Boolean, default: true },
      manageGuardians: { type: Boolean, default: false },
    },
    restriction: {
      active: { type: Boolean, default: false },
      level: { type: String, enum: ['blocked', 'view_only'] },
      reason: { type: String },
      orderReference: { type: String },
      setBy: { type: String },
      setAt: { type: Date },
    },
    // Set by a staff check (admin route), never by the guardian.
    identityVerified: { type: Boolean, default: false },
    invitedBy: { type: String, required: true },
    acceptedAt: { type: Date },
  },
  { timestamps: true }
);

// Who did what to a child's profile.
export interface IChildAuditLog extends Document {
  childId: mongoose.Types.ObjectId;
  actorId: string;
  actorName: string;
  actorRole: 'primary' | 'guardian' | 'admin' | 'system';
  action: string;
  detail?: string;
  createdAt: Date;
}

const ChildAuditLogSchema = new Schema<IChildAuditLog>(
  {
    childId: { type: Schema.Types.ObjectId, required: true, index: true },
    actorId: { type: String, required: true },
    actorName: { type: String, required: true },
    actorRole: { type: String, enum: ['primary', 'guardian', 'admin', 'system'], required: true },
    action: { type: String, required: true },
    detail: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
ChildAuditLogSchema.index({ childId: 1, createdAt: -1 });

// Child vaccination records. A guardian can add a dose, but only a provider
// (admin-secret route) can mark it verified.
export interface IChildVaccination extends Document {
  memberId: mongoose.Types.ObjectId;
  ownerId: string;
  vaccineCode: string;
  vaccineName: string;
  administeredDate: string;
  facility?: string;
  provider?: string;
  lotNumber?: string;
  manufacturer?: string;
  expiryDate?: string;
  site?: string;
  route?: string;
  reaction?: string;
  notes?: string;
  verification: 'caregiver_reported' | 'provider_verified';
  verifiedBy?: string;
  verifiedAt?: Date;
  verificationSource?: string;
  scheduleVersion?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChildVaccinationSchema = new Schema<IChildVaccination>(
  {
    memberId: { type: Schema.Types.ObjectId, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    vaccineCode: { type: String, required: true },
    vaccineName: { type: String, required: true },
    administeredDate: { type: String, required: true },
    facility: { type: String },
    provider: { type: String },
    lotNumber: { type: String },
    manufacturer: { type: String },
    expiryDate: { type: String },
    site: { type: String },
    route: { type: String },
    reaction: { type: String },
    notes: { type: String },
    verification: { type: String, enum: ['caregiver_reported', 'provider_verified'], default: 'caregiver_reported' },
    verifiedBy: { type: String },
    verifiedAt: { type: Date },
    verificationSource: { type: String },
    scheduleVersion: { type: String },
  },
  { timestamps: true }
);
ChildVaccinationSchema.index({ memberId: 1, vaccineCode: 1 }, { unique: true });

// How one adult wants to hear about one child's vaccines. SMS and WhatsApp
// need an explicit opt-in, stored with the time it was given.
export interface IReminderPreference extends Document {
  childId: mongoose.Types.ObjectId;
  accountId: string;
  push: boolean;
  sms: boolean;
  whatsapp: boolean;
  phone?: string;
  smsConsentAt?: Date | null;
  whatsappConsentAt?: Date | null;
}

const ReminderPreferenceSchema = new Schema<IReminderPreference>(
  {
    childId: { type: Schema.Types.ObjectId, required: true },
    accountId: { type: String, required: true },
    push: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    whatsapp: { type: Boolean, default: false },
    phone: { type: String },
    smsConsentAt: { type: Date, default: null },
    whatsappConsentAt: { type: Date, default: null },
  },
  { timestamps: true }
);
ReminderPreferenceSchema.index({ childId: 1, accountId: 1 }, { unique: true });

// One row per reminder attempt, so a reminder is never sent twice.
export interface IReminderLog extends Document {
  childId: mongoose.Types.ObjectId;
  accountId: string;
  channel: 'push' | 'sms' | 'whatsapp';
  key: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  attempts: number;
  error?: string;
}

const ReminderLogSchema = new Schema<IReminderLog>(
  {
    childId: { type: Schema.Types.ObjectId, required: true },
    accountId: { type: String, required: true },
    channel: { type: String, enum: ['push', 'sms', 'whatsapp'], required: true },
    key: { type: String, required: true },
    status: { type: String, enum: ['pending', 'sent', 'failed', 'skipped'], default: 'pending' },
    attempts: { type: Number, default: 0 },
    error: { type: String },
  },
  { timestamps: true }
);
ReminderLogSchema.index({ childId: 1, accountId: 1, channel: 1, key: 1 }, { unique: true });
// Keep a year of history.
ReminderLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export interface IChildMilestone extends Document {
  childId: mongoose.Types.ObjectId;
  code: string;
  status: 'achieved' | 'not_yet' | 'unsure';
  notes?: string;
  recordedBy: string;
  catalogueVersion: string;
}

const ChildMilestoneSchema = new Schema<IChildMilestone>(
  {
    childId: { type: Schema.Types.ObjectId, required: true, index: true },
    code: { type: String, required: true },
    status: { type: String, enum: ['achieved', 'not_yet', 'unsure'], required: true },
    notes: { type: String },
    recordedBy: { type: String, required: true },
    catalogueVersion: { type: String },
  },
  { timestamps: true }
);
ChildMilestoneSchema.index({ childId: 1, code: 1 }, { unique: true });

// Vision, hearing, dental and developmental screening visits.
export interface IChildScreening extends Document {
  childId: mongoose.Types.ObjectId;
  kind: 'developmental' | 'vision' | 'hearing' | 'dental';
  date: string;
  result: 'no_concerns' | 'follow_up_advised' | 'unsure';
  facility?: string;
  notes?: string;
  recordedBy: string;
}

const ChildScreeningSchema = new Schema<IChildScreening>(
  {
    childId: { type: Schema.Types.ObjectId, required: true, index: true },
    kind: { type: String, enum: ['developmental', 'vision', 'hearing', 'dental'], required: true },
    date: { type: String, required: true },
    result: { type: String, enum: ['no_concerns', 'follow_up_advised', 'unsure'], required: true },
    facility: { type: String },
    notes: { type: String },
    recordedBy: { type: String, required: true },
  },
  { timestamps: true }
);

export interface IChildGrowth extends Document {
  memberId: mongoose.Types.ObjectId;
  ownerId: string;
  measuredOn: string;
  clientId?: string;
  weightKg?: number;
  lengthCm?: number;
  headCircumferenceCm?: number;
  source: 'caregiver' | 'clinic';
  notes?: string;
  createdAt: Date;
}

const ChildGrowthSchema = new Schema<IChildGrowth>(
  {
    memberId: { type: Schema.Types.ObjectId, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    measuredOn: { type: String, required: true },
    // Set by the app so a retry after a lost response does not add the entry twice.
    clientId: { type: String },
    weightKg: { type: Number },
    lengthCm: { type: Number },
    headCircumferenceCm: { type: Number },
    source: { type: String, enum: ['caregiver', 'clinic'], default: 'caregiver' },
    notes: { type: String },
  },
  { timestamps: true }
);
ChildGrowthSchema.index({ memberId: 1, clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } });

// 3. Health Record Model & Subdocuments
export interface ILabBiomarker {
  analyte: string;
  result: string;
  unit?: string;
  referenceInterval: string;
  status: 'normal' | 'optimal' | 'high' | 'low';
}

const LabBiomarkerSchema = new Schema<ILabBiomarker>({
  analyte: { type: String, required: true },
  result: { type: String, required: true },
  unit: { type: String },
  referenceInterval: { type: String, required: true },
  status: { type: String, required: true, enum: ['normal', 'optimal', 'high', 'low'] },
});

export interface IHealthRecord extends Document {
  userId: mongoose.Types.ObjectId;
  familyMemberId: mongoose.Types.ObjectId;
  title: string;
  recordType: 'Lab Result' | 'Prescription' | 'Imaging' | 'Clinical Note' | 'Immunization' | 'Receipt';
  date: string;
  provider: string;
  summary: string;
  fileS3Key?: string;
  encryptedFileHash?: string;
  ocrData?: Record<string, unknown>;
  labReportDetails?: {
    specimenType: string;
    collectedDate: string;
    reportedDate: string;
    pathologist: string;
    labLicenseNo: string;
    specimenId?: string;
    clinicalInterpretation?: string;
    biomarkers: ILabBiomarker[];
  };
}

const HealthRecordSchema = new Schema<IHealthRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    familyMemberId: { type: Schema.Types.ObjectId, ref: 'FamilyMember', required: true, index: true },
    title: { type: String, required: true },
    recordType: {
      type: String,
      required: true,
      enum: ['Lab Result', 'Prescription', 'Imaging', 'Clinical Note', 'Immunization', 'Receipt'],
    },
    date: { type: String, required: true },
    provider: { type: String, required: true },
    summary: { type: String },
    fileS3Key: { type: String },
    encryptedFileHash: { type: String },
    ocrData: { type: Schema.Types.Mixed },
    labReportDetails: {
      specimenType: { type: String },
      collectedDate: { type: String },
      reportedDate: { type: String },
      pathologist: { type: String },
      labLicenseNo: { type: String },
      specimenId: { type: String },
      clinicalInterpretation: { type: String },
      biomarkers: [LabBiomarkerSchema],
    },
  },
  { timestamps: true }
);

// 4. Prescription & E-Pharmacy Model
export interface IPrescription extends Document {
  userId?: mongoose.Types.ObjectId;
  accountId?: mongoose.Types.ObjectId;
  familyMemberId: mongoose.Types.ObjectId | string;
  medicationName: string;
  dosage: string;
  quantity?: number;
  frequency?: string;
  prescriber: string;
  prescribedDate?: string;
  pharmacyProvider: string;
  totalPriceNaira: number;
  hmoCoveredNaira: number;
  patientCoPayNaira: number;
  refillsTotal: number;
  refillsRemaining: number;
  status: 'active' | 'refill_requested' | 'dispensed' | 'in_transit' | 'delivered' | 'pending_review' | 'rejected' | string;
  deliveryAddress: string;
  deliveryType?: string;
  notes?: string;
  orderType?: string;
  eta?: string;
  hmoProvider?: string;
}

const PrescriptionSchema = new Schema<IPrescription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', index: true },
    familyMemberId: { type: Schema.Types.Mixed, required: true, index: true },
    medicationName: { type: String, required: true },
    dosage: { type: String, default: '' },
    quantity: { type: Number, default: 1 },
    frequency: { type: String, default: '' },
    prescriber: { type: String, required: true },
    prescribedDate: { type: String },
    pharmacyProvider: { type: String, required: true },
    totalPriceNaira: { type: Number, default: 0 },
    hmoCoveredNaira: { type: Number, default: 0 },
    patientCoPayNaira: { type: Number, default: 0 },
    refillsTotal: { type: Number, default: 0 },
    refillsRemaining: { type: Number, default: 0 },
    status: {
      type: String,
      default: 'active',
      enum: ['active', 'refill_requested', 'dispensed', 'in_transit', 'delivered', 'pending_review', 'rejected'],
    },
    deliveryAddress: { type: String },
    deliveryType: { type: String, default: 'home' },
    notes: { type: String },
    orderType: { type: String },
    eta: { type: String },
    hmoProvider: { type: String },
  },
  { timestamps: true, strict: false }
);

// 5. Healthcare Facilities Model
export interface IFacility extends Document {
  name: string;
  typeLabel: string;
  specialty: string;
  address: string;
  city: string;
  state: string;
  acceptedHmos: string[];
  emoji?: string;
  isVerified: boolean;
}

const FacilitySchema = new Schema<IFacility>(
  {
    name: { type: String, required: true },
    typeLabel: { type: String, required: true },
    specialty: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, default: 'Lagos' },
    state: { type: String, default: 'Lagos State' },
    acceptedHmos: [{ type: String }],
    emoji: { type: String },
    isVerified: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// 6. Share Grants Model (WelliBridge, Doctor & Hospital Org Access)
export interface IShareGrant extends Document {
  grantorUserId: mongoose.Types.ObjectId;
  recipientType: 'doctor' | 'facility' | 'bridge';
  recipientId?: string;
  recipientName: string;
  recordIds: mongoose.Types.ObjectId[];
  // Only set for recipientType 'bridge' (public QR / share-link grants, e.g.
  // the Emergency Medical ID card): identifies which family member's
  // emergency summary the token unlocks, mirroring the web backend's
  // WelliBridge access-grant pattern rather than a HealthRecord list.
  familyMemberId?: mongoose.Types.ObjectId;
  // Opaque, unguessable public lookup key for 'bridge' grants —
  // crypto.randomBytes(24).toString('base64url'). Never a predictable ID.
  shareToken?: string;
  expiryCode: '24h' | '7d' | '30d' | 'custom';
  expiresAt: Date;
  isOtpVerified: boolean;
  status: 'active' | 'revoked' | 'expired';
}

const ShareGrantSchema = new Schema<IShareGrant>(
  {
    grantorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipientType: { type: String, required: true, enum: ['doctor', 'facility', 'bridge'] },
    recipientId: { type: String },
    recipientName: { type: String, required: true },
    recordIds: [{ type: Schema.Types.ObjectId, ref: 'HealthRecord' }],
    familyMemberId: { type: Schema.Types.ObjectId },
    shareToken: { type: String, unique: true, sparse: true, index: true },
    expiryCode: { type: String, required: true, enum: ['24h', '7d', '30d', 'custom'] },
    expiresAt: { type: Date, required: true, index: true },
    isOtpVerified: { type: Boolean, default: true },
    status: { type: String, default: 'active', enum: ['active', 'revoked', 'expired'] },
  },
  { timestamps: true }
);

// 7. NDPR Access Audit Log Model
export interface IAccessAuditLog extends Document {
  grantId?: mongoose.Types.ObjectId;
  accessedByName: string;
  accessorRole: string;
  facilityName: string;
  action: 'view' | 'download' | 'print' | 'revoke' | 'emergency_scan';
  recordsCount: number;
  ipAddress: string;
  metadata?: any;
}

const AccessAuditLogSchema = new Schema<IAccessAuditLog>(
  {
    grantId: { type: Schema.Types.ObjectId, ref: 'ShareGrant' },
    accessedByName: { type: String, required: true },
    accessorRole: { type: String, required: true },
    facilityName: { type: String, required: true },
    action: { type: String, required: true, enum: ['view', 'download', 'print', 'revoke', 'emergency_scan'] },
    recordsCount: { type: Number, default: 1 },
    ipAddress: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// 8. Vitals Logs Model
export interface IVitalLog extends Document {
  userId: mongoose.Types.ObjectId;
  familyMemberId: mongoose.Types.ObjectId;
  type: 'bp' | 'glucose' | 'pulse' | 'weight';
  primaryValue: string;
  secondaryValue?: string;
  unit: string;
  tag?: string;
  tagColor?: string;
  note?: string;
  timestamp: Date;
}

const VitalLogSchema = new Schema<IVitalLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    familyMemberId: { type: Schema.Types.ObjectId, ref: 'FamilyMember', required: true, index: true },
    type: { type: String, required: true, enum: ['bp', 'glucose', 'pulse', 'weight'] },
    primaryValue: { type: String, required: true },
    secondaryValue: { type: String },
    unit: { type: String, required: true },
    tag: { type: String },
    tagColor: { type: String },
    note: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Lab Results (provider-submitted) — reads from the same collection the
// web backend writes to. patientId here is the UserProfile._id, not the
// Account id from the JWT — see the accountId lookup in the route below.
export interface ILabResult extends Document {
  patientId: mongoose.Types.ObjectId;
  recordedBy?: mongoose.Types.ObjectId;
  providerId?: mongoose.Types.ObjectId;
  organizationId?: mongoose.Types.ObjectId;
  testName: string;
  category?: string;
  specimen?: string;
  resultValue?: string;
  unit?: string;
  referenceRange?: { text?: string; min?: number; max?: number };
  interpretation?: string;
  collectedAt?: Date;
  resultedAt?: Date;
  verificationStatus?: string;
  recordStatus: string;
  patientVisible: boolean;
  attachments?: any[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
const LabResultSchema = new Schema<ILabResult>(
  {
    patientId: { type: Schema.Types.ObjectId, required: true, index: true },
    recordedBy: { type: Schema.Types.ObjectId },
    providerId: { type: Schema.Types.ObjectId },
    organizationId: { type: Schema.Types.ObjectId },
    testName: { type: String, required: true },
    category: { type: String },
    specimen: { type: String },
    resultValue: { type: String },
    unit: { type: String },
    referenceRange: { text: String, min: Number, max: Number },
    interpretation: { type: String },
    collectedAt: { type: Date },
    resultedAt: { type: Date },
    verificationStatus: { type: String },
    recordStatus: { type: String, default: 'active' },
    patientVisible: { type: Boolean, default: true },
    attachments: { type: [Schema.Types.Mixed] as any, default: [] },
    notes: { type: String },
  },
  { timestamps: true, strict: false } // strict: false — don't drop fields this schema hasn't declared yet
);
export const LabResult: Model<ILabResult> = mongoose.models.LabResult || mongoose.model<ILabResult>('LabResult', LabResultSchema, 'labresults');

// 8b/8c. Read-only mirrors of the web backend's Vital and Medication models
// (modules/vitals/vitals_model.js, modules/medications/medications_model.js
// in wellinovate/WelliRecord) — same shared MongoDB cluster, same
// `patientId`/`patientVisible`/`recordStatus` clinical-metadata fields as
// LabResult above. Declared loosely (strict: false) since this app never
// writes to these collections, only reads provider-submitted data the web
// backend already wrote; mobile's own HealthRecord model is unaffected and
// keeps handling patient-uploaded/OCR documents as before.
export interface IVitalEntry extends Document {
  patientId: mongoose.Types.ObjectId;
  recordStatus: string;
  patientVisible: boolean;
  measuredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const VitalEntrySchema = new Schema<IVitalEntry>(
  {
    patientId: { type: Schema.Types.ObjectId, required: true, index: true },
    recordStatus: { type: String, default: 'active' },
    patientVisible: { type: Boolean, default: true },
    measuredAt: { type: Date },
  },
  { timestamps: true, strict: false }
);
export const VitalEntry: Model<IVitalEntry> = mongoose.models.Vital || mongoose.model<IVitalEntry>('Vital', VitalEntrySchema, 'vitals');

export interface IMedicationEntry extends Document {
  patientId: mongoose.Types.ObjectId;
  recordStatus: string;
  patientVisible: boolean;
  medicationName: string;
  createdAt: Date;
  updatedAt: Date;
}
const MedicationEntrySchema = new Schema<IMedicationEntry>(
  {
    patientId: { type: Schema.Types.ObjectId, required: true, index: true },
    recordStatus: { type: String, default: 'active' },
    patientVisible: { type: Boolean, default: true },
    medicationName: { type: String, required: true },
  },
  { timestamps: true, strict: false }
);
export const MedicationEntry: Model<IMedicationEntry> = mongoose.models.Medication || mongoose.model<IMedicationEntry>('Medication', MedicationEntrySchema, 'medications');

// 9. Account Model (Matching 'accounts' collection with phone e.g. 07030144923)
export interface IAccount extends Document {
  sessionsRevokedAt?: Date;
  phone?: string;
  phoneNumber?: string;
  email?: string;
  fullName?: string;
  name?: string;
  bloodType?: string;
  genotype?: string;
  hmoProvider?: string;
  hmoPolicyNumber?: string;
  isPhoneVerified?: boolean;
  pushTokens?: string[];
}

const AccountSchema = new Schema<IAccount>(
  {
    sessionsRevokedAt: { type: Date },
    phone: { type: String, index: true },
    phoneNumber: { type: String, index: true },
    email: { type: String },
    fullName: { type: String },
    name: { type: String },
    bloodType: { type: String },
    genotype: { type: String },
    hmoProvider: { type: String },
    hmoPolicyNumber: { type: String },
    isPhoneVerified: { type: Boolean, default: false },
    pushTokens: { type: [String], default: [] },
  },
  { timestamps: true, strict: false }
);

// 10. Profile Model (Matching 'profiles' collection)
export interface IProfile extends Document {
  accountId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  patientIdentityId?: string;
  email?: string;
  phone?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  dateOfBirth?: Date | string;
  dob?: Date | string;
  memberId?: string;
  gender?: string;
  bloodType?: string;
  genotype?: string;
  hmoProvider?: string;
  insuranceProvider?: string;
  hmoPolicyNumber?: string;
  policyNumber?: string;
  insuranceId?: string;
  allergies?: string;
}

const ProfileSchema = new Schema<IProfile>(
  {
    accountId: { type: Schema.Types.ObjectId, index: true },
    userId: { type: Schema.Types.ObjectId, index: true },
    patientIdentityId: { type: String, index: true },
    email: { type: String, index: true },
    phone: { type: String, index: true },
    fullName: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    name: { type: String },
    dateOfBirth: { type: Schema.Types.Mixed },
    dob: { type: Schema.Types.Mixed },
    memberId: { type: String },
    gender: { type: String },
    bloodType: { type: String },
    genotype: { type: String },
    hmoProvider: { type: String },
    insuranceProvider: { type: String },
    hmoPolicyNumber: { type: String },
    policyNumber: { type: String },
    insuranceId: { type: String },
    allergies: { type: String },
  },
  { timestamps: true, strict: false }
);

// 11. UserProfile Model (Matching shared 'userprofiles' collection in Atlas)
export interface IUserProfile extends Document {
  accountId: mongoose.Types.ObjectId;
  fullName?: string;
  username?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: Date | string;
  dob?: Date | string;
  homeAddress?: string;
  address?: string;
  avatar?: string;
  avatarUrl?: string;
  wrId?: string;
  memberId?: string;
  bloodType?: string;
  genotype?: string;
  allergies?: string;
  conditions?: string;
  contact?: string;
  emergencyContact?: any;
  emergencyContacts?: any[];
  hmoProvider?: string;
  insuranceProvider?: string;
  hmoPolicyNumber?: string;
  policyNumber?: string;
  insuranceId?: string;
  authProvider?: string;
  isEmailVerified?: boolean;
  pushTokens?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const UserProfileSchema = new Schema<IUserProfile>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    fullName: { type: String },
    username: { type: String },
    firstName: { type: String },
    middleName: { type: String },
    lastName: { type: String },
    name: { type: String },
    email: { type: String, index: true },
    phone: { type: String, index: true },
    gender: { type: String },
    dateOfBirth: { type: Schema.Types.Mixed },
    dob: { type: Schema.Types.Mixed },
    homeAddress: { type: String },
    address: { type: String },
    avatar: { type: String },
    avatarUrl: { type: String },
    wrId: { type: String, index: true },
    memberId: { type: String },
    bloodType: { type: String },
    genotype: { type: String },
    allergies: { type: String },
    conditions: { type: String },
    contact: { type: String },
    hmoProvider: { type: String },
    insuranceProvider: { type: String },
    hmoPolicyNumber: { type: String },
    policyNumber: { type: String },
    insuranceId: { type: String },
    authProvider: { type: String },
    isEmailVerified: { type: Boolean },
    pushTokens: { type: [String], default: [] },
  },
  { timestamps: true, strict: false }
);

// 12. Chat Intent Model (Dynamic Healthcare Assistant Intent Trees)
export interface IChatOption {
  label: string;
  nextIntentKey: string;
}

export interface IChatIntent extends Document {
  intentKey: string;
  audience: 'patient' | 'provider';
  message: string;
  options: IChatOption[];
  isRoot?: boolean;
}

const ChatIntentSchema = new Schema<IChatIntent>(
  {
    intentKey: { type: String, required: true, unique: true },
    audience: { type: String, enum: ['patient', 'provider'], required: true, default: 'patient' },
    message: { type: String, required: true },
    options: [
      {
        label: { type: String, required: true },
        nextIntentKey: { type: String, required: true },
      },
    ],
    isRoot: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ChatIntentSchema.index({ audience: 1, isRoot: 1 });

// 13. In-App & Push Notification Record Model
export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'critical_alert' | 'referral' | 'lab_result' | 'consent' | 'claim' | 'immunization' | 'prescription' | 'system';
  emoji: string;
  tint: string;
  categoryLabel: string;
  title: string;
  desc: string;
  time: string;
  read: boolean;
  actionLabel?: string;
  targetTab?: string;
  targetModal?: string;
  targetId?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ['critical_alert', 'referral', 'lab_result', 'consent', 'claim', 'immunization', 'prescription', 'system'],
    },
    emoji: { type: String, default: '🔔' },
    tint: { type: String, default: '#e0e7ff' },
    categoryLabel: { type: String, default: 'Notification' },
    title: { type: String, required: true },
    desc: { type: String, required: true },
    time: { type: String, default: 'Just now' },
    read: { type: Boolean, default: false, index: true },
    actionLabel: { type: String },
    targetTab: { type: String },
    targetModal: { type: String },
    targetId: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Mobile appointment requests. Mobile facilities are a separate collection
// from the web backend's OrganizationProfile, so requests live here and
// facility staff confirm them. Confirmed web bookings are read from the
// shared `appointments` collection (see AppointmentRead below).
export interface IAppointmentRequest extends Document {
  accountId: mongoose.Types.ObjectId;
  familyMemberId?: string;
  facilityId?: string;
  facilityName: string;
  facilityAddress?: string;
  scheduledFor: Date;
  timeSlot: string;
  reason?: string;
  visitType?: 'in_person' | 'video';
  externalFacility?: boolean;
  providerRemark?: string;
  /** What was actually delivered when the request was made. */
  notified?: any;
  status: 'requested' | 'awaiting_payment' | 'awaiting_hmo' | 'confirmed' | 'cancelled' | 'completed';
  /** Set when the visit was booked from a provider's published hours (the consultation booking flow). */
  startsAt?: Date;
  durationMin?: number;
  bookingRef?: string;
  feeMinor?: number;
  currency?: string;
  paymentMethod?: 'online' | 'in_person' | 'hmo';
  paymentStatus?: 'pending' | 'paid' | 'pay_at_visit' | 'awaiting_hmo' | 'hmo_approved' | 'hmo_declined' | 'refund_due';
  paymentRef?: string;
  hmo?: { policyId?: string; policyLabel?: string; preAuthId?: string; clientStatus?: string; decidedBy?: string; decidedAt?: Date; approvalCode?: string };
  termsAcceptedAt?: Date;
  visitSummary?: { diagnosis?: string; notes?: string; authoredBy?: string; authoredAt?: Date };
  notifiedStatus?: string;
}

const AppointmentRequestSchema = new Schema<IAppointmentRequest>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    familyMemberId: { type: String },
    facilityId: { type: String },
    facilityName: { type: String, required: true },
    facilityAddress: { type: String },
    scheduledFor: { type: Date, required: true, index: true },
    timeSlot: { type: String, required: true },
    reason: { type: String, default: '' },
    visitType: { type: String, enum: ['in_person', 'video'], default: 'in_person' },
    externalFacility: { type: Boolean, default: false },
    providerRemark: { type: String, default: '' },
    notified: { type: Schema.Types.Mixed },
    status: { type: String, enum: ['requested', 'awaiting_payment', 'awaiting_hmo', 'confirmed', 'cancelled', 'completed'], default: 'requested' },
    startsAt: { type: Date, index: true },
    durationMin: { type: Number },
    bookingRef: { type: String, index: true },
    feeMinor: { type: Number },
    currency: { type: String },
    paymentMethod: { type: String, enum: ['online', 'in_person', 'hmo'] },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'pay_at_visit', 'awaiting_hmo', 'hmo_approved', 'hmo_declined', 'refund_due'] },
    paymentRef: { type: String, index: true },
    hmo: {
      policyId: String,
      policyLabel: String,
      preAuthId: String,
      clientStatus: String,
      decidedBy: String,
      decidedAt: Date,
      approvalCode: String,
    },
    termsAcceptedAt: { type: Date },
    visitSummary: {
      diagnosis: { type: String },
      notes: { type: String },
      authoredBy: { type: String },
      authoredAt: { type: Date },
    },
    // Last status the patient was notified about. Written by the notification sweep.
    notifiedStatus: { type: String },
  },
  { timestamps: true }
);

// What a provider offers for consultation booking: fees per mode and weekly hours.
// Keyed by the same facilityId the app books with (a mobile Facility id or an organisation id).
export interface IProviderService extends Document {
  facilityId: string;
  facilityName: string;
  facilityAddress?: string;
  specialty?: string;
  offersInPerson: boolean;
  offersVirtual: boolean;
  feeInPersonMinor?: number;
  feeVirtualMinor?: number;
  currency: string;
  acceptsHmo: string[];
  payAtVisit: boolean;
  onlinePayment: boolean;
  slotMinutes: number;
  /** day 0 = Sunday. start and end are Lagos local time, HH:MM. */
  weekly: { day: number; start: string; end: string }[];
  active: boolean;
  /** Staff accounts allowed to manage this provider's fees, hours and HMO decisions. Admin always can. */
  staffIds: string[];
  paystackSubaccount?: string;
  updatedBy?: string;
}
const ProviderServiceSchema = new Schema<IProviderService>(
  {
    facilityId: { type: String, required: true, unique: true },
    facilityName: { type: String, required: true },
    facilityAddress: { type: String, default: '' },
    specialty: { type: String, default: '' },
    offersInPerson: { type: Boolean, default: true },
    offersVirtual: { type: Boolean, default: false },
    feeInPersonMinor: { type: Number },
    feeVirtualMinor: { type: Number },
    currency: { type: String, default: 'NGN' },
    acceptsHmo: { type: [String], default: [] },
    payAtVisit: { type: Boolean, default: false },
    onlinePayment: { type: Boolean, default: true },
    slotMinutes: { type: Number, default: 30 },
    weekly: { type: [{ _id: false, day: Number, start: String, end: String }], default: [] },
    active: { type: Boolean, default: true },
    staffIds: { type: [String], default: [] },
    /** Paystack subaccount (ACCT_...) that receives online payments for this provider. */
    paystackSubaccount: { type: String, default: '' },
    updatedBy: { type: String },
  },
  { timestamps: true }
);

// One row per taken or held slot. The unique index is what stops two people booking the same time.
// A held row has holdExpiresAt and is removed by the TTL index; booking removes that field.
export interface IBookingSlot extends Document {
  facilityId: string;
  startsAt: Date;
  state: 'held' | 'booked';
  accountId: mongoose.Types.ObjectId;
  mode: 'in_person' | 'video';
  holdExpiresAt?: Date;
  appointmentId?: mongoose.Types.ObjectId;
}
const BookingSlotSchema = new Schema<IBookingSlot>(
  {
    facilityId: { type: String, required: true },
    startsAt: { type: Date, required: true },
    state: { type: String, enum: ['held', 'booked'], required: true },
    accountId: { type: Schema.Types.ObjectId, required: true, index: true },
    mode: { type: String, enum: ['in_person', 'video'], required: true },
    holdExpiresAt: { type: Date },
    appointmentId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true }
);
BookingSlotSchema.index({ facilityId: 1, startsAt: 1 }, { unique: true });
BookingSlotSchema.index({ holdExpiresAt: 1 }, { expireAfterSeconds: 0 });

export const ProviderService: Model<IProviderService> =
  mongoose.models.ProviderService || mongoose.model<IProviderService>('ProviderService', ProviderServiceSchema, 'providerservices');
export const BookingSlot: Model<IBookingSlot> =
  mongoose.models.BookingSlot || mongoose.model<IBookingSlot>('BookingSlot', BookingSlotSchema, 'bookingslots');

// What a pharmacy offers for ordering: its own delivery fee bands, payment options and location.
// Keyed by the same facilityId the app uses (a mobile Facility id or an organisation id).
export interface IPharmacyService extends Document {
  facilityId: string;
  name: string;
  address?: string;
  phone?: string;
  lat?: number;
  lng?: number;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  /** Distance bands, each with its own fee in kobo. Beyond the last band the pharmacy does not deliver. */
  feeBands: { maxKm: number; feeMinor: number }[];
  deliveryEta: string;
  onlinePayment: boolean;
  payOnDelivery: boolean;
  payAtPickup: boolean;
  acceptsHmo: string[];
  /** Staff accounts that may see this pharmacy's orders. Admin sees all. */
  staffIds: string[];
  paystackSubaccount?: string;
  active: boolean;
  updatedBy?: string;
}
const PharmacyServiceSchema = new Schema<IPharmacyService>(
  {
    facilityId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    lat: { type: Number },
    lng: { type: Number },
    deliveryEnabled: { type: Boolean, default: true },
    pickupEnabled: { type: Boolean, default: true },
    feeBands: { type: [{ _id: false, maxKm: Number, feeMinor: Number }], default: [] },
    deliveryEta: { type: String, default: 'Within 2 to 4 hours' },
    onlinePayment: { type: Boolean, default: true },
    payOnDelivery: { type: Boolean, default: false },
    payAtPickup: { type: Boolean, default: true },
    acceptsHmo: { type: [String], default: [] },
    staffIds: { type: [String], default: [], index: true },
    paystackSubaccount: { type: String, default: '' },
    active: { type: Boolean, default: true },
    updatedBy: { type: String },
  },
  { timestamps: true }
);

// A prescription or report photo sent with an order. Stored sealed (AES-256-GCM) in our own database,
// never passed to a third party. Deleted 30 days after the order ends.
export interface IPharmacyAttachment extends Document {
  accountId: mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId;
  contentType: string;
  bytes: number;
  sealed: string;
  expiresAt?: Date;
}
const PharmacyAttachmentSchema = new Schema<IPharmacyAttachment>(
  {
    accountId: { type: Schema.Types.ObjectId, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, index: true },
    contentType: { type: String, required: true },
    bytes: { type: Number, required: true },
    sealed: { type: String, required: true },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);
PharmacyAttachmentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export interface IPharmacyOrder extends Document {
  accountId: mongoose.Types.ObjectId;
  subjectName: string;
  patientPhone?: string;
  pharmacyId: string;
  pharmacyName: string;
  pharmacyAddress?: string;
  items: { name: string; strength: string; quantity: number; notes: string }[];
  attachmentIds: mongoose.Types.ObjectId[];
  /** The patient agreed to link the prescription to their health record. */
  linkToRecord: boolean;
  consentAt?: Date;
  status: string;
  quote?: {
    lines: { name: string; strength: string; quantity: number; unitPriceMinor: number; available: boolean; alternative: boolean; note: string }[];
    note?: string;
    quotedBy?: string;
    quotedAt?: Date;
    expiresAt?: Date;
  };
  excluded: number[];
  fulfilment?: 'delivery' | 'pickup';
  address?: { text: string; landmark?: string; lat?: number; lng?: number; recipientName?: string; recipientPhone?: string };
  distanceKm?: number | null;
  medsMinor: number;
  deliveryFeeMinor: number;
  feeEstimated: boolean;
  totalMinor: number;
  dueMinor: number;
  currency: string;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentRef?: string;
  paymentStartedAt?: Date;
  hmo?: { provider: string; memberId?: string; coveredMinor?: number; status?: string; decidedBy?: string; reason?: string };
  handoverSealed?: string;
  codeAttempts: number;
  codeLockedUntil?: Date | null;
  dispatch?: { riderName?: string; riderPhone?: string; assignedAt?: Date; etaNote?: string };
  events: { at: Date; status: string; by: string; note?: string }[];
  notifiedStatus?: string;
  closedAt?: Date;
  cancelReason?: string;
}
const PharmacyOrderSchema = new Schema<IPharmacyOrder>(
  {
    accountId: { type: Schema.Types.ObjectId, required: true, index: true },
    subjectName: { type: String, required: true },
    patientPhone: { type: String },
    pharmacyId: { type: String, required: true, index: true },
    pharmacyName: { type: String, required: true },
    pharmacyAddress: { type: String },
    items: { type: [{ _id: false, name: String, strength: String, quantity: Number, notes: String }], default: [] },
    attachmentIds: { type: [Schema.Types.ObjectId], default: [] },
    linkToRecord: { type: Boolean, default: false },
    consentAt: { type: Date },
    status: { type: String, default: 'awaiting_review', index: true },
    quote: {
      type: new Schema(
        {
          lines: { type: [{ _id: false, name: String, strength: String, quantity: Number, unitPriceMinor: Number, available: Boolean, alternative: Boolean, note: String }], default: [] },
          note: String,
          quotedBy: String,
          quotedAt: Date,
          expiresAt: Date,
        },
        { _id: false }
      ),
    },
    excluded: { type: [Number], default: [] },
    fulfilment: { type: String, enum: ['delivery', 'pickup'] },
    address: {
      type: new Schema({ text: String, landmark: String, lat: Number, lng: Number, recipientName: String, recipientPhone: String }, { _id: false }),
    },
    distanceKm: { type: Number },
    medsMinor: { type: Number, default: 0 },
    deliveryFeeMinor: { type: Number, default: 0 },
    feeEstimated: { type: Boolean, default: false },
    totalMinor: { type: Number, default: 0 },
    dueMinor: { type: Number, default: 0 },
    currency: { type: String, default: 'NGN' },
    paymentMethod: { type: String },
    paymentStatus: { type: String },
    paymentRef: { type: String, index: true },
    paymentStartedAt: { type: Date },
    hmo: {
      type: new Schema({ provider: String, memberId: String, coveredMinor: Number, status: String, decidedBy: String, reason: String }, { _id: false }),
    },
    handoverSealed: { type: String },
    codeAttempts: { type: Number, default: 0 },
    codeLockedUntil: { type: Date },
    dispatch: { type: new Schema({ riderName: String, riderPhone: String, assignedAt: Date, etaNote: String }, { _id: false }) },
    events: { type: [{ _id: false, at: Date, status: String, by: String, note: String }], default: [] },
    notifiedStatus: { type: String },
    closedAt: { type: Date },
    cancelReason: { type: String },
  },
  { timestamps: true }
);
PharmacyOrderSchema.index({ pharmacyId: 1, status: 1, createdAt: -1 });

export const PharmacyService: Model<IPharmacyService> =
  mongoose.models.PharmacyService || mongoose.model<IPharmacyService>('PharmacyService', PharmacyServiceSchema, 'pharmacyservices');
export const PharmacyAttachment: Model<IPharmacyAttachment> =
  mongoose.models.PharmacyAttachment || mongoose.model<IPharmacyAttachment>('PharmacyAttachment', PharmacyAttachmentSchema, 'pharmacyattachments');
export const PharmacyOrder: Model<IPharmacyOrder> =
  mongoose.models.PharmacyOrder || mongoose.model<IPharmacyOrder>('PharmacyOrder', PharmacyOrderSchema, 'pharmacyorders');

// Export Mongoose Models
export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export const Account: Model<IAccount> = mongoose.models.Account || mongoose.model<IAccount>('Account', AccountSchema, 'accounts');
export const Profile: Model<IProfile> = mongoose.models.Profile || mongoose.model<IProfile>('Profile', ProfileSchema, 'profiles');
export const UserProfile: Model<IUserProfile> = mongoose.models.UserProfile || mongoose.model<IUserProfile>('UserProfile', UserProfileSchema, 'userprofiles');
export const FamilyMember: Model<IFamilyMember> = mongoose.models.FamilyMember || mongoose.model<IFamilyMember>('FamilyMember', FamilyMemberSchema);
export const HealthRecord: Model<IHealthRecord> = mongoose.models.HealthRecord || mongoose.model<IHealthRecord>('HealthRecord', HealthRecordSchema);
export const Prescription: Model<IPrescription> = mongoose.models.Prescription || mongoose.model<IPrescription>('Prescription', PrescriptionSchema);
export const Facility: Model<IFacility> = mongoose.models.Facility || mongoose.model<IFacility>('Facility', FacilitySchema);
export const ShareGrant: Model<IShareGrant> = mongoose.models.ShareGrant || mongoose.model<IShareGrant>('ShareGrant', ShareGrantSchema);
export const AccessAuditLog: Model<IAccessAuditLog> = mongoose.models.AccessAuditLog || mongoose.model<IAccessAuditLog>('AccessAuditLog', AccessAuditLogSchema);
export const VitalLog: Model<IVitalLog> = mongoose.models.VitalLog || mongoose.model<IVitalLog>('VitalLog', VitalLogSchema);
export const ChatIntent: Model<IChatIntent> = mongoose.models.ChatIntent || mongoose.model<IChatIntent>('ChatIntent', ChatIntentSchema);
export const NotificationRecord: Model<INotification> =
  mongoose.models.NotificationRecord || mongoose.model<INotification>('NotificationRecord', NotificationSchema, 'notifications');

export const AppointmentRequest: Model<IAppointmentRequest> =
  mongoose.models.AppointmentRequest ||
  mongoose.model<IAppointmentRequest>('AppointmentRequest', AppointmentRequestSchema, 'appointmentrequests');

// Loose read/cancel mirror of the web backend's `appointments` collection.
const AppointmentReadSchema = new Schema({}, { strict: false, collection: 'appointments' });
export const AppointmentRead: Model<any> =
  mongoose.models.AppointmentRead || mongoose.model('AppointmentRead', AppointmentReadSchema, 'appointments');

// Patient consent grants. Same `accessgrants` collection the web backend
// (modules/access/access_grant_model.js in wellinovate/WelliRecord) enforces
// when providers read a patient's record, so a grant made, approved or
// revoked from the app takes effect there immediately. patientId is the
// UserProfile._id; grantedBy is the patient's Account id.
const AccessGrantSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, required: true, index: true },
    grantedBy: { type: Schema.Types.ObjectId, required: true, index: true },
    requestedBy: { type: Schema.Types.ObjectId, default: null },
    granteeType: { type: String, required: true },
    // No default: the web collection has a unique sparse index on shareToken,
    // and an explicit null is indexed, so a second grant would collide.
    shareToken: { type: String },
    granteeUserId: { type: Schema.Types.ObjectId, default: null },
    granteeOrganizationId: { type: Schema.Types.ObjectId, default: null },
    accessScope: { type: String, required: true },
    category: { type: String, default: null },
    recordId: { type: Schema.Types.ObjectId, default: null },
    encounterId: { type: Schema.Types.ObjectId, default: null },
    recordFrom: { type: Date, default: null },
    recordTo: { type: Date, default: null },
    startsAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    permissions: {
      view: { type: Boolean, default: true },
      download: { type: Boolean, default: false },
      reshare: { type: Boolean, default: false },
      write: { type: Boolean, default: false },
    },
    purpose: { type: String, default: null },
    status: { type: String, default: 'active', index: true },
    reviewedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: Schema.Types.ObjectId, default: null },
    rejectionReason: { type: String, default: null },
    notes: { type: String, default: null },
  },
  { timestamps: true, strict: false }
);
export const AccessGrant: Model<any> =
  mongoose.models.AccessGrant || mongoose.model('AccessGrant', AccessGrantSchema, 'accessgrants');

export const ChildVaccination: Model<IChildVaccination> =
  mongoose.models.ChildVaccination || mongoose.model<IChildVaccination>('ChildVaccination', ChildVaccinationSchema);
export const ChildGrowth: Model<IChildGrowth> =
  mongoose.models.ChildGrowth || mongoose.model<IChildGrowth>('ChildGrowth', ChildGrowthSchema);

export const ChildGuardian: Model<IChildGuardian> =
  mongoose.models.ChildGuardian || mongoose.model<IChildGuardian>('ChildGuardian', ChildGuardianSchema);
export const ChildAuditLog: Model<IChildAuditLog> =
  mongoose.models.ChildAuditLog || mongoose.model<IChildAuditLog>('ChildAuditLog', ChildAuditLogSchema);

// ----- Patient second sign-in step (TOTP) -----
export interface IPatientMfa extends Document {
  accountId: string;
  enabled: boolean;
  secretEnc?: string;
  recovery: string[];
  lastStep: number;
  failCount: number;
  lockedUntil?: Date;
  enabledAt?: Date;
}
const PatientMfaSchema = new Schema<IPatientMfa>(
  {
    accountId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    secretEnc: { type: String },
    recovery: { type: [String], default: [] },
    lastStep: { type: Number, default: -1 },
    failCount: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    enabledAt: { type: Date },
  },
  { timestamps: true }
);
export const PatientMfa: Model<IPatientMfa> =
  mongoose.models.PatientMfa || mongoose.model<IPatientMfa>('PatientMfa', PatientMfaSchema);

// ----- Access and security log for an adult's own account -----
export interface IAccountAuditLog extends Document {
  accountId: string;
  kind: 'security' | 'access';
  action: string;
  actorLabel: string;
  detail?: string;
  ip?: string;
  device?: string;
  createdAt: Date;
}
const AccountAuditLogSchema = new Schema<IAccountAuditLog>(
  {
    accountId: { type: String, required: true },
    kind: { type: String, enum: ['security', 'access'], required: true },
    action: { type: String, required: true },
    actorLabel: { type: String, required: true },
    detail: { type: String },
    ip: { type: String },
    device: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
AccountAuditLogSchema.index({ accountId: 1, createdAt: -1 });
// Two years, then the database removes the row.
AccountAuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 730 });
export const AccountAuditLog: Model<IAccountAuditLog> =
  mongoose.models.AccountAuditLog || mongoose.model<IAccountAuditLog>('AccountAuditLog', AccountAuditLogSchema);

export const ChildMilestone: Model<IChildMilestone> =
  mongoose.models.ChildMilestone || mongoose.model<IChildMilestone>('ChildMilestone', ChildMilestoneSchema);
export const ChildScreening: Model<IChildScreening> =
  mongoose.models.ChildScreening || mongoose.model<IChildScreening>('ChildScreening', ChildScreeningSchema);
export const ReminderPreference: Model<IReminderPreference> =
  mongoose.models.ReminderPreference || mongoose.model<IReminderPreference>('ReminderPreference', ReminderPreferenceSchema);
export const ReminderLog: Model<IReminderLog> =
  mongoose.models.ReminderLog || mongoose.model<IReminderLog>('ReminderLog', ReminderLogSchema);

// Staff accounts for the provider and operations side. Patients never use these.
export type StaffRole = 'admin' | 'clinician' | 'pharmacist' | 'records_officer';
export interface IStaffUser extends Document {
  email: string;
  name: string;
  role: StaffRole;
  organization?: string;
  passwordHash: string;
  status: 'active' | 'disabled';
  mustChangePassword: boolean;
  tokenVersion: number;
  mfaEnabled: boolean;
  mfaSecretEnc?: string;
  mfaRecovery: string[];
  mfaLastStep: number;
  failedAttempts: number;
  lockedUntil?: Date;
  lastLoginAt?: Date;
  createdBy?: string;
}

const StaffUserSchema = new Schema<IStaffUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['admin', 'clinician', 'pharmacist', 'records_officer'], required: true },
    organization: { type: String, trim: true },
    passwordHash: { type: String, required: true },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    mustChangePassword: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecretEnc: { type: String },
    mfaRecovery: { type: [String], default: [] },
    mfaLastStep: { type: Number, default: -1 },
    failedAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    lastLoginAt: { type: Date },
    createdBy: { type: String },
  },
  { timestamps: true }
);

// Who did what on the staff side. Kept; it is the record of clinical and custody actions.
export interface IStaffActionLog extends Document {
  staffId: string;
  staffName: string;
  role: string;
  action: string;
  target?: string;
  detail?: string;
  legacy: boolean;
}

const StaffActionLogSchema = new Schema<IStaffActionLog>(
  {
    staffId: { type: String, required: true, index: true },
    staffName: { type: String, required: true },
    role: { type: String, required: true },
    action: { type: String, required: true },
    target: { type: String },
    detail: { type: String },
    legacy: { type: Boolean, default: false },
  },
  { timestamps: true }
);
StaffActionLogSchema.index({ createdAt: -1 });

// A guardian's consent for a clinic to see and add to one child's record, for a short time.
export interface IChildFacilityGrant extends Document {
  childId: mongoose.Types.ObjectId;
  codeHash: string;
  createdBy: string;
  createdByName: string;
  expiresAt: Date;
  revokedAt?: Date;
  uses: { staffId: string; staffName: string; organization?: string; action: string; at: Date }[];
}

const ChildFacilityGrantSchema = new Schema<IChildFacilityGrant>(
  {
    childId: { type: Schema.Types.ObjectId, required: true, index: true },
    codeHash: { type: String, required: true, index: true },
    createdBy: { type: String, required: true },
    createdByName: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    uses: [
      {
        _id: false,
        staffId: String,
        staffName: String,
        organization: String,
        action: String,
        at: Date,
      },
    ],
  },
  { timestamps: true }
);
// Remove a week after it expires.
ChildFacilityGrantSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

// App crash and error reports. No user id or token is stored. Kept for 30 days.
export interface IClientError extends Document {
  name: string;
  message: string;
  stack: string;
  where: string;
  fatal: boolean;
  appVersion: string;
  platform: string;
  osVersion: string;
}
const ClientErrorSchema = new Schema<IClientError>(
  {
    name: { type: String, default: 'Error' },
    message: { type: String, default: '' },
    stack: { type: String, default: '' },
    where: { type: String, default: '' },
    fatal: { type: Boolean, default: false },
    appVersion: { type: String, default: '' },
    platform: { type: String, default: '' },
    osVersion: { type: String, default: '' },
  },
  { timestamps: true }
);
ClientErrorSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
export const ClientError: Model<IClientError> =
  mongoose.models.ClientError || mongoose.model<IClientError>('ClientError', ClientErrorSchema);

export const StaffUser: Model<IStaffUser> =
  mongoose.models.StaffUser || mongoose.model<IStaffUser>('StaffUser', StaffUserSchema);
export const StaffActionLog: Model<IStaffActionLog> =
  mongoose.models.StaffActionLog || mongoose.model<IStaffActionLog>('StaffActionLog', StaffActionLogSchema);
export const ChildFacilityGrant: Model<IChildFacilityGrant> =
  mongoose.models.ChildFacilityGrant || mongoose.model<IChildFacilityGrant>('ChildFacilityGrant', ChildFacilityGrantSchema);

// A patient's link or QR code for a provider who has no WelliRecord account (WelliBridge).
// The link token and every code are stored only as keyed hashes. Opening it needs a one-time code,
// either sent to the provider's own email or phone, or read out by the patient (passcode).
export interface IProviderShare extends Document {
  ownerId: mongoose.Types.ObjectId;
  subjectId: string;
  subjectIsSelf: boolean;
  recipientName: string;
  purpose?: string;
  sections: string[];
  /** True when the record was encrypted on the patient's phone; the server holds only ciphertext. */
  encrypted?: boolean;
  sealed?: { ciphertext: string; iv: string };
  expiresAt: Date;
  revokedAt?: Date;
  lockedAt?: Date;
  tokenHash: string;
  mode: 'contact' | 'passcode';
  contactChannel?: 'email' | 'sms';
  contact?: string;
  passcodeHash?: string;
  otpHash?: string;
  otpExpiresAt?: Date;
  otpSendCount: number;
  otpWindowStart?: Date;
  failures: number;
  lifetimeFailures: number;
  cooldownUntil?: Date;
  views: { at: Date; ip?: string; userAgent?: string }[];
}

const ProviderShareSchema = new Schema<IProviderShare>(
  {
    ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
    subjectId: { type: String, required: true },
    subjectIsSelf: { type: Boolean, default: false },
    recipientName: { type: String, required: true },
    purpose: { type: String },
    sections: { type: [String], default: [] },
    encrypted: { type: Boolean, default: false },
    sealed: { ciphertext: { type: String }, iv: { type: String } },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    lockedAt: { type: Date },
    tokenHash: { type: String, required: true, unique: true },
    mode: { type: String, enum: ['contact', 'passcode'], required: true },
    contactChannel: { type: String, enum: ['email', 'sms'] },
    contact: { type: String },
    passcodeHash: { type: String },
    otpHash: { type: String },
    otpExpiresAt: { type: Date },
    otpSendCount: { type: Number, default: 0 },
    otpWindowStart: { type: Date },
    failures: { type: Number, default: 0 },
    lifetimeFailures: { type: Number, default: 0 },
    cooldownUntil: { type: Date },
    views: [{ _id: false, at: Date, ip: String, userAgent: String }],
  },
  { timestamps: true }
);
// Remove a month after it expires.
ProviderShareSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const ProviderShare: Model<IProviderShare> =
  mongoose.models.ProviderShare || mongoose.model<IProviderShare>('ProviderShare', ProviderShareSchema);
