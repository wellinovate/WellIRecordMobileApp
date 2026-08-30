export type RecordType =
  | 'Lab Result'
  | 'Prescription'
  | 'Imaging'
  | 'Clinical Note'
  | 'Immunization'
  | 'Receipt';

export interface LabBiomarker {
  analyte: string;
  result: string;
  unit?: string;
  referenceInterval: string;
  status: 'normal' | 'optimal' | 'high' | 'low';
}

export interface LabReportDetail {
  specimenType: string;
  collectedDate: string;
  reportedDate: string;
  pathologist: string;
  labLicenseNo: string;
  biomarkers: LabBiomarker[];
  clinicalInterpretation?: string;
  specimenId?: string;
}

export interface HealthRecord {
  id: string;
  ownerId: string;
  title: string;
  date: string;
  type: RecordType;
  provider: string;
  summary: string;
  extractedOcr?: {
    keyValues: Array<{ label: string; value: string }>;
    statusBadge?: string;
  };
  labReportDetails?: LabReportDetail;
}

export interface PrescriptionItem {
  id: string;
  ownerId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  prescriber: string;
  prescribedDate: string;
  pharmacyProvider: string;
  totalPriceNaira: number;
  hmoCoveredNaira: number;
  patientCoPayNaira: number;
  refillsTotal: number;
  refillsRemaining: number;
  status: 'active' | 'refill_requested' | 'dispensed' | 'in_transit' | 'delivered';
  deliveryAddress: string;
  eta: string;
  hmoProvider?: string;
  notes?: string;
}

export interface ImmunizationMilestone {
  id: string;
  vaccine: string;
  targetAge: string;
  diseaseTarget: string;
  status: 'completed' | 'due' | 'upcoming';
  completedDate?: string;
  administeredBy?: string;
  batchNo?: string;
}

export interface VitalLogEntry {
  id: string;
  ownerId: string;
  type: 'bp' | 'glucose' | 'pulse' | 'weight';
  timestamp: string;
  primaryValue: string;
  secondaryValue?: string;
  unit: string;
  tag: string;
  tagColor: string;
  note?: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  initials: string;
  role: 'owner' | 'dependent';
  relationship?: 'Self' | 'Spouse' | 'Child' | 'Parent';
  dob: string;
  gender: string;
  bloodType: string;
  genotype: string;
  height: string;
  weight: string;
  allergies: string;
  conditions: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  insuranceProvider: string;
  insuranceId: string;
  wrId?: string;
  memberId?: string;
  avatarUrl?: string;
  isChild?: boolean;
  isElderly?: boolean;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  org: string;
  initials: string;
}

export type FacilityType = 'Hospital' | 'Pharmacy' | 'Laboratory' | 'Private Practice';

export interface CareFacility {
  id: string;
  name: string;
  type: FacilityType;
  typeLabel: string;
  leadName: string;
  leadTitle: string;
  address: string;
  specialty: string;
  acceptingPatients: boolean;
  accredited: boolean;
  verified: boolean;
  instantBooking: boolean;
  emoji: string;
  gradient: string;
  acceptedHmos?: string[];
  consultationFeeNaira?: number;
}

export interface InvoiceLineItem {
  label: string;
  amount: number;
}

export interface HmoClaimStep {
  title: string;
  subtitle?: string;
  timestamp: string;
  status: 'completed' | 'in-progress' | 'pending' | 'in_progress';
  note?: string;
}

export interface Invoice {
  id: string;
  provider: string;
  date: string;
  items: InvoiceLineItem[];
  hmoCovered: number;
  status: 'unpaid' | 'paid';
  hmoProvider?: string;
  claimNumber?: string;
  preAuthCode?: string;
  patientCoPay?: number;
  claimSteps?: HmoClaimStep[];
}

export interface ActiveShare {
  id: string;
  doctorId: string;
  doctorName: string;
  initials: string;
  recordCount: number;
  expiresLabel: string;
  ownerId: string;
  scopeLabel?: string;
  writeAccess?: boolean;
  purpose?: string;
  sharedRecordIds?: string[];
  createdAt?: string;
}

export type ConsentGranteeType = 'individual' | 'organization';

export interface Notification {
  id: string;
  emoji: string;
  tint: string;
  title: string;
  desc: string;
  time: string;
}

export interface LogEntry {
  emoji: string;
  title: string;
  time: string;
}

export interface LinkedAccountDef {
  id: string;
  category: 'healthcare' | 'signin';
  emoji: string;
  name: string;
  sub: string;
}

export interface OnboardingSlide {
  emoji: string;
  tint: string;
  title: string;
  desc: string;
  permission?: boolean;
}

export interface Theme {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  muted: string;
  mutedLight: string;
  darkMode?: boolean;
}

export type Tab = 'home' | 'records' | 'share' | 'care' | 'profile';
export type ShareMethod = 'search' | 'bridge';
export type ShareExpiry = '1h' | '24h' | '7d' | '30d' | 'custom';
export type WelcomeTab = 'about' | 'signin' | 'signup' | 'faq';

export interface SignUpFormData {
  name: string;
  email: string;
  phone: string;
  dob: string;
  password?: string;
  insuranceProvider: string;
  insuranceId?: string;
  bloodType?: string;
  genotype?: string;
}

