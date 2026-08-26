export type RecordType = 'Lab Result' | 'Prescription' | 'Imaging' | 'Clinical Note';

export interface HealthRecord {
  id: string;
  ownerId: string;
  title: string;
  date: string;
  type: RecordType;
  provider: string;
  summary: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  initials: string;
  role: 'owner' | 'dependent';
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
  avatarUrl?: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  org: string;
  initials: string;
}

export interface Provider {
  name: string;
  specialty: string;
  distance: string;
  category: string;
  emoji: string;
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
}

export type Tab = 'home' | 'records' | 'share' | 'care' | 'profile';
export type ShareMethod = 'search' | 'bridge';
export type ShareExpiry = '24h' | '7d' | '30d' | 'custom';
