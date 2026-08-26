import type {
  HealthRecord,
  FamilyMember,
  Doctor,
  Provider,
  LogEntry,
  LinkedAccountDef,
  OnboardingSlide,
  Theme,
  RecordType,
  ActiveShare,
  Notification,
} from './types';

export const RECORD_META: Record<RecordType, { tint: string; emoji: string }> = {
  'Lab Result': { tint: '#e0f2fe', emoji: '🧪' },
  'Prescription': { tint: '#dcfce7', emoji: '💊' },
  'Imaging': { tint: '#f3e8ff', emoji: '🩻' },
  'Clinical Note': { tint: '#fdf4ec', emoji: '📋' },
};

export const RECORDS: HealthRecord[] = [
  { id: 'r1', ownerId: 'me', title: 'Comprehensive Metabolic Panel', date: 'May 12, 2024', type: 'Lab Result', provider: 'Central City Lab', summary: 'Glucose slightly elevated. Other metrics within normal range.' },
  { id: 'r2', ownerId: 'me', title: 'Amoxicillin 500mg', date: 'May 10, 2024', type: 'Prescription', provider: 'Dr. Sarah Chen', summary: 'Prescribed for acute sinusitis. Take 3 times daily for 10 days.' },
  { id: 'r3', ownerId: 'me', title: 'Chest X-Ray (PA/Lat)', date: 'Apr 22, 2024', type: 'Imaging', provider: 'Valley Imaging Center', summary: 'No acute cardiopulmonary process. Normal heart size.' },
  { id: 'r4', ownerId: 'me', title: 'Annual Wellness Visit', date: 'Apr 20, 2024', type: 'Clinical Note', provider: 'Dr. Sarah Chen', summary: 'Patient in good health. Recommended increase in Vitamin D intake.' },
  { id: 'r5', ownerId: 'kwame', title: 'Pediatric Wellness Check', date: 'Jun 3, 2024', type: 'Clinical Note', provider: 'Dr. Priya Anand', summary: 'Growth on track. Booster vaccine scheduled for next visit.' },
  { id: 'r6', ownerId: 'kwame', title: 'Amoxicillin 250mg', date: 'Jan 18, 2024', type: 'Prescription', provider: 'Dr. Sarah Chen', summary: 'Prescribed for ear infection. Take twice daily for 7 days.' },
];

export const FAMILY: FamilyMember[] = [
  { id: 'me', name: 'Amara Nwosu', initials: 'AN', role: 'owner', dob: '1990-03-14', gender: 'Female', bloodType: 'O+', genotype: 'AA', height: '168 cm', weight: '70.5 kg', allergies: 'Penicillin, Shellfish', conditions: 'Type 2 Diabetes', contact: 'Chidi Nwosu (Spouse) · +1 (415) 555-0142', email: 'amara.nwosu@email.com', phone: '+1 (415) 555-0198', address: '412 Baywood Ave, San Francisco, CA 94110', insuranceProvider: 'Pacific Horizon Health', insuranceId: 'PHH-88213045' },
  { id: 'kwame', name: 'Kwame Nwosu', initials: 'KN', role: 'dependent', dob: '2016-09-02', gender: 'Male', bloodType: 'A+', genotype: 'AS', height: '128 cm', weight: '26 kg', allergies: 'None on file', conditions: 'None on file', contact: 'Amara Nwosu (Mother) · +1 (415) 555-0142', email: '—', phone: '—', address: '412 Baywood Ave, San Francisco, CA 94110', insuranceProvider: 'Pacific Horizon Health (dependent)', insuranceId: 'PHH-88213045-D1' },
];

export const GENDER_OPTIONS = ['Male', 'Female', 'Transgender', 'Other'];
export const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'Unknown'];
export const GENOTYPES = ['AA', 'AS', 'SS', 'AC', 'SC', 'CC', 'Unknown'];

export const PROXY_LOG: LogEntry[] = [
  { emoji: '📤', title: "Shared Kwame's Pediatric Wellness Check with Dr. Priya Anand", time: '5 days ago' },
  { emoji: '➕', title: 'Added "Amoxicillin 250mg" to Kwame’s records', time: 'Jan 18, 2024' },
  { emoji: '🛡️', title: 'Confirmed guardianship of Kwame Nwosu', time: 'Jan 3, 2024' },
];

export const VITALS = [
  { label: 'Heart Rate', value: '72', unit: 'bpm' },
  { label: 'Blood Pressure', value: '118/78', unit: 'mmHg' },
  { label: 'Weight', value: '70.5', unit: 'kg' },
  { label: 'Sleep Avg', value: '7.2', unit: 'hrs' },
];

export const DOCTORS: Doctor[] = [
  { id: 'd1', name: 'Dr. Sarah Chen', specialty: 'Primary Care', org: 'Riverside Clinic', initials: 'SC' },
  { id: 'd2', name: 'Dr. Marcus Webb', specialty: 'Cardiology', org: 'Heart & Vascular Institute', initials: 'MW' },
  { id: 'd3', name: 'Dr. Priya Anand', specialty: 'Dermatology', org: 'ClearSkin Dermatology', initials: 'PA' },
];

export const PROVIDERS: Provider[] = [
  { name: 'Dr. Sarah Chen', specialty: 'Primary Care', distance: '0.8 mi', category: 'Primary Care', emoji: '🩺' },
  { name: 'Dr. Marcus Webb', specialty: 'Cardiology', distance: '1.4 mi', category: 'Cardiology', emoji: '❤️' },
  { name: 'Dr. Priya Anand', specialty: 'Dermatology', distance: '2.1 mi', category: 'Dermatology', emoji: '🩹' },
  { name: 'Central City Lab', specialty: 'Diagnostics', distance: '0.5 mi', category: 'Lab', emoji: '🧪' },
];

export const CONSENT_SCOPES = ['Full History', 'Labs Only', 'Radiology', 'Medications', 'Vitals', 'Diagnoses', 'Allergies', 'Vision'];

export const CATEGORIES = ['All', 'Primary Care', 'Cardiology', 'Dermatology', 'Lab'];
export const RECORD_TYPES: (RecordType | 'All')[] = ['All', 'Lab Result', 'Prescription', 'Imaging', 'Clinical Note'];

export const ONBOARDING: OnboardingSlide[] = [
  { emoji: '👋', tint: '#eef4ff', title: 'Welcome to WelliRecord', desc: 'Your medical history, always with you — no matter which doctor, lab, or pharmacy you visit.' },
  { emoji: '🌍', tint: '#e0f2fe', title: 'Universal Access', desc: 'Every record you have lives in one place, readable by any provider, anywhere.' },
  { emoji: '🔒', tint: '#dcfce7', title: 'You Control Access', desc: 'Share specific records for a set time, then access expires automatically. No faxing, no guesswork.' },
  { emoji: '⌚', tint: '#f3e8ff', title: 'Wearable Sync', desc: 'Connect Apple Health or Fitbit to keep your vitals alongside your clinical records.' },
  { emoji: '🔔', tint: '#fef3c7', title: 'Stay Informed', desc: 'Get notified when access is about to expire or a visit is coming up. Entirely optional — you can change this later in Settings.', permission: true },
];

export const ACTIVITY_LOG: LogEntry[] = [
  { emoji: '📤', title: 'Shared 2 records with Dr. Marcus Webb', time: '3 days ago' },
  { emoji: '🚨', title: 'Emergency ID viewed by a first responder profile', time: '1 week ago' },
  { emoji: '📱', title: 'Signed in from a new device (iPhone)', time: '2 weeks ago' },
  { emoji: '➕', title: '"Chest X-Ray (PA/Lat)" added to records', time: 'Apr 22, 2024' },
];

export const LANGUAGES = ['English', 'Hausa', 'Igbo', 'Yorùbá', 'Nigerian Pidgin'];

export const LIGHT_THEME: Theme = { bg: '#f8fafc', surface: '#ffffff', surface2: '#f1f5f9', border: '#e2e8f0', text: '#0f172a', muted: '#64748b', mutedLight: '#94a3b8' };
export const DARK_THEME: Theme = { bg: '#0b1220', surface: '#141d2e', surface2: '#1b2740', border: 'rgba(255,255,255,.08)', text: '#e6edf3', muted: '#9fb3c8', mutedLight: '#7488a6' };

export const INITIAL_ACTIVE_SHARES: ActiveShare[] = [
  { id: 's1', doctorId: 'd2', doctorName: 'Dr. Marcus Webb', initials: 'MW', recordCount: 2, expiresLabel: 'in 6 days', ownerId: 'me' },
];

export const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: 'n1', emoji: '⏳', tint: '#fef3c7', title: 'Access expiring soon', desc: "Dr. Marcus Webb's access expires in 6 days.", time: '2h ago' },
  { id: 'n2', emoji: '📹', tint: '#dbeafe', title: 'Telehealth reminder', desc: 'Video visit with Dr. Chen today at 3:00 PM.', time: '5h ago' },
];

export const LINKED_ACCOUNTS: LinkedAccountDef[] = [
  { id: 'insurance', category: 'healthcare', emoji: '🏥', name: 'Pacific Horizon Health', sub: 'Insurance provider' },
  { id: 'portal', category: 'healthcare', emoji: '🩺', name: 'Riverside Clinic Portal', sub: 'Primary care patient portal' },
  { id: 'pharmacy', category: 'healthcare', emoji: '💊', name: 'CVS Pharmacy', sub: 'Prescription refills & pickup' },
  { id: 'google', category: 'signin', emoji: '🔍', name: 'Google', sub: 'Sign in & calendar sync' },
  { id: 'apple', category: 'signin', emoji: '🍎', name: 'Apple', sub: 'Sign in with Apple' },
];

export const INITIAL_LINKED_ACCOUNTS: Record<string, boolean> = {
  insurance: true,
  portal: true,
  pharmacy: false,
  google: true,
  apple: false,
};
