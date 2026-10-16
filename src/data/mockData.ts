import type {
  LinkedAccountDef,
  OnboardingSlide,
  Theme,
  RecordType,
} from './types';

export const RECORD_META: Record<RecordType, { tint: string; emoji: string }> = {
  'Lab Result': { tint: '#e0f2fe', emoji: '🧪' },
  'Prescription': { tint: '#dcfce7', emoji: '💊' },
  'Imaging': { tint: '#f3e8ff', emoji: '🩻' },
  'Clinical Note': { tint: '#fdf4ec', emoji: '📋' },
  'Immunization': { tint: '#ede9fe', emoji: '💉' },
  'Receipt': { tint: '#fef3c7', emoji: '🧾' },
  'Vitals': { tint: '#fee2e2', emoji: '❤️' },
  'Medication': { tint: '#dbeafe', emoji: '💊' },
};

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
export const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'Unknown'];
export const GENOTYPES = ['AA', 'AS', 'SS', 'AC', 'SC', 'CC', 'Unknown'];

export const CONSENT_SCOPES = [
  'Full History',
  'Labs & Blood Tests',
  'Prescriptions & Medications',
  'Radiology & Scans',
  'Vitals & Biometrics',
  'Immunization Cards',
  'Clinical Diagnoses',
  'Allergies & Medical ID',
];

export const ONBOARDING: OnboardingSlide[] = [
  { emoji: '👋', tint: '#eef4ff', title: 'Welcome to WelliRecord', desc: 'Your medical history, always with you — no matter which doctor, lab, or pharmacy you visit in Nigeria.' },
  { emoji: '🌍', tint: '#e0f2fe', title: 'Universal Patient-Owned Vault', desc: 'Every health record lives securely in your pocket, accessible anytime, anywhere.' },
  { emoji: '🔒', tint: '#dcfce7', title: 'Smart Consent Sharing', desc: 'Share specific records for a set time with 6-digit WelliBridge PINs or timed QR codes.' },
  { emoji: '👨‍👩‍👧‍👦', tint: '#ede9fe', title: 'Family & Dependent Vaults', desc: 'Manage your children’s vaccine milestones and elderly parents’ vitals in one account.' },
  { emoji: '🔔', tint: '#fef3c7', title: 'Stay Informed', desc: 'Get automated alerts when sharing access expires or upcoming appointments are due.', permission: true },
  { emoji: '🔐', tint: '#e0f2fe', title: 'Secure Your Health Vault', desc: 'Authenticate with Google or Apple to encrypt and sync your family records across devices.', authStep: true },
];

export const LANGUAGES = ['English', 'Hausa', 'Igbo', 'Yorùbá', 'Nigerian Pidgin'];

export const LIGHT_THEME: Theme = {
  bg: '#F5F2EA',
  surface: '#FFFFFF',
  surface2: '#EAF1F9',
  border: '#E4DFD1',
  text: '#1B1F27',
  muted: '#6B7280',
  mutedLight: '#9AA3AF',
};
export const DARK_THEME: Theme = { bg: '#0b1220', surface: '#141d2e', surface2: '#1b2740', border: 'rgba(255,255,255,.08)', text: '#e6edf3', muted: '#9fb3c8', mutedLight: '#7488a6' };

export const LINKED_ACCOUNTS: LinkedAccountDef[] = [
  { id: 'insurance', category: 'healthcare', emoji: '🛡️', name: 'Hygeia HMO Portal', sub: 'Link your HMO policy' },
  { id: 'portal', category: 'healthcare', emoji: '🏥', name: 'Wellicare Hospital EMR', sub: 'Link a hospital record' },
  { id: 'pharmacy', category: 'healthcare', emoji: '💊', name: 'MediTrust Pharmacy Refill', sub: 'Direct e-prescription link' },
  { id: 'google', category: 'signin', emoji: '🔍', name: 'Google Account', sub: 'Backup & multi-factor verification' },
  { id: 'apple', category: 'signin', emoji: '🍎', name: 'Apple ID', sub: 'Face ID & iCloud Keychain' },
];
