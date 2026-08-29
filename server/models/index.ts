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
  bloodType: string;
  genotype: string;
  hmoProvider: string;
  hmoPolicyNumber?: string;
  isPhoneVerified: boolean;
  twoFactorEnabled: boolean;
  biometricKeyHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    phoneNumber: { type: String, required: true, unique: true, index: true },
    email: { type: String, lowercase: true, trim: true },
    fullName: { type: String, required: true },
    bloodType: { type: String, default: 'O+' },
    genotype: { type: String, default: 'AA' },
    hmoProvider: { type: String, default: 'Hygeia HMO' },
    hmoPolicyNumber: { type: String },
    isPhoneVerified: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: true },
    biometricKeyHash: { type: String },
  },
  { timestamps: true }
);

// 2. Family Member Model (Dependents, Spouse, Senior Parents)
export interface IFamilyMember extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  initials: string;
  relationship: 'Self' | 'Spouse' | 'Child' | 'Parent';
  role: 'owner' | 'dependent';
  dob?: Date;
  gender?: string;
  bloodType?: string;
  genotype?: string;
  heightCm?: number;
  weightKg?: number;
  allergies?: string;
}

const FamilyMemberSchema = new Schema<IFamilyMember>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    initials: { type: String, required: true },
    relationship: { type: String, required: true, enum: ['Self', 'Spouse', 'Child', 'Parent'] },
    role: { type: String, default: 'dependent', enum: ['owner', 'dependent'] },
    dob: { type: Date },
    gender: { type: String },
    bloodType: { type: String },
    genotype: { type: String },
    heightCm: { type: Number },
    weightKg: { type: Number },
    allergies: { type: String },
  },
  { timestamps: true }
);

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
  userId: mongoose.Types.ObjectId;
  familyMemberId: mongoose.Types.ObjectId;
  medicationName: string;
  dosage: string;
  frequency: string;
  prescriber: string;
  pharmacyProvider: string;
  totalPriceNaira: number;
  hmoCoveredNaira: number;
  patientCoPayNaira: number;
  refillsTotal: number;
  refillsRemaining: number;
  status: 'active' | 'refill_requested' | 'dispensed' | 'in_transit' | 'delivered';
  deliveryAddress: string;
  eta?: string;
  hmoProvider?: string;
}

const PrescriptionSchema = new Schema<IPrescription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    familyMemberId: { type: Schema.Types.ObjectId, ref: 'FamilyMember', required: true, index: true },
    medicationName: { type: String, required: true },
    dosage: { type: String, required: true },
    frequency: { type: String, required: true },
    prescriber: { type: String, required: true },
    pharmacyProvider: { type: String, required: true },
    totalPriceNaira: { type: Number, required: true },
    hmoCoveredNaira: { type: Number, required: true },
    patientCoPayNaira: { type: Number, required: true },
    refillsTotal: { type: Number, default: 3 },
    refillsRemaining: { type: Number, default: 3 },
    status: {
      type: String,
      default: 'active',
      enum: ['active', 'refill_requested', 'dispensed', 'in_transit', 'delivered'],
    },
    deliveryAddress: { type: String },
    eta: { type: String },
    hmoProvider: { type: String },
  },
  { timestamps: true }
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
  action: 'view' | 'download' | 'print' | 'revoke';
  recordsCount: number;
  ipAddress: string;
}

const AccessAuditLogSchema = new Schema<IAccessAuditLog>(
  {
    grantId: { type: Schema.Types.ObjectId, ref: 'ShareGrant' },
    accessedByName: { type: String, required: true },
    accessorRole: { type: String, required: true },
    facilityName: { type: String, required: true },
    action: { type: String, required: true, enum: ['view', 'download', 'print', 'revoke'] },
    recordsCount: { type: Number, default: 1 },
    ipAddress: { type: String, required: true },
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

// Export Mongoose Models
export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export const FamilyMember: Model<IFamilyMember> = mongoose.models.FamilyMember || mongoose.model<IFamilyMember>('FamilyMember', FamilyMemberSchema);
export const HealthRecord: Model<IHealthRecord> = mongoose.models.HealthRecord || mongoose.model<IHealthRecord>('HealthRecord', HealthRecordSchema);
export const Prescription: Model<IPrescription> = mongoose.models.Prescription || mongoose.model<IPrescription>('Prescription', PrescriptionSchema);
export const Facility: Model<IFacility> = mongoose.models.Facility || mongoose.model<IFacility>('Facility', FacilitySchema);
export const ShareGrant: Model<IShareGrant> = mongoose.models.ShareGrant || mongoose.model<IShareGrant>('ShareGrant', ShareGrantSchema);
export const AccessAuditLog: Model<IAccessAuditLog> = mongoose.models.AccessAuditLog || mongoose.model<IAccessAuditLog>('AccessAuditLog', AccessAuditLogSchema);
export const VitalLog: Model<IVitalLog> = mongoose.models.VitalLog || mongoose.model<IVitalLog>('VitalLog', VitalLogSchema);
