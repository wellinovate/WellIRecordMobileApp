import { useEffect, useRef, useState } from 'react';
import { checkDeviceIntegrity, DEVICE_WARNING } from '../utils/deviceIntegrity';
import { Alert, AppState as RNAppState, Linking, Share } from 'react-native';
import {
  CONSENT_SCOPES,
  LINKED_ACCOUNTS,
  ONBOARDING,
} from '../data/mockData';
import type {
  ActiveShare,
  ConsentGranteeType,
  FamilyMember,
  HealthRecord,
  ImmunizationMilestone,
  ChildProfileDetails,
  Notification,
  PrescriptionItem,
  RecordType,
  ShareExpiry,
  SignUpFormData,
  Tab,
  VitalLogEntry,
  WelcomeTab,
} from '../data/types';
import { EXPIRY_SHORT_LABEL_MAP } from '../utils/expiry';
import { hapticFeedback } from '../utils/haptics';
import { buildShareMessage } from '../utils/providerRemark';
import { storage } from '../utils/storage';
import { reportError } from '../utils/errorReporting';
import { authenticateWithBiometrics, getBiometricStatus } from '../utils/biometrics';
import { markActivity } from '../utils/inactivityCore';
import { authService, type AuthSession } from '../services/authService';
import { apiClient, setAuthToken } from '../services/apiClient';
import { recordsService } from '../services/recordsService';
import { pharmacyService } from '../services/pharmacyService';
import { profileService } from '../services/profileService';
import { familyService } from '../services/familyService';
import { childHealthService } from '../services/childHealthService';
import { childOfflineQueue, clearChildOfflineData } from '../utils/childOfflineQueue';
import { facilityService } from '../services/facilityService';
import { pointsFromProvider, latestProviderLogs, type VitalPoint } from '../utils/vitalsSeries';
import { careService, type AppointmentItem } from '../services/careService';
import { webLinkService } from '../services/webLinkService';
import { bookingService } from '../services/bookingService';
import { sharingService } from '../services/sharingService';
import { notificationService } from '../services/notificationService';
import type { CareFacility } from '../data/types';

export interface SocialDetails {
  provider: 'google' | 'apple';
  fullName?: string;
  email?: string;
  avatar?: string;
  /** Clerk session token, checked by the server. */
  clerkToken?: string;
}

export interface AppState {
  tab: Tab;
  tabHistory: Tab[];
  activeFamilyId: string;
  familyMembers: FamilyMember[];
  recordsList: HealthRecord[];
  immunizationSchedule: ImmunizationMilestone[];
  vitalsLogs: VitalLogEntry[];
  vitalsSeries: VitalPoint[];
  showVitalsTrends: boolean;
  recordFilter: RecordType | 'All';
  recordQuery: string;
  recordDetailId: string | null;
  showUpload: boolean;
  uploadStep: 0 | 1 | 2;
  activeShares: ActiveShare[];
  showSmartConsent: boolean;
  consentGranteeType: ConsentGranteeType;
  consentProviderId: string;
  consentProviderWrId: string;
  consentScope: string | null;
  consentAllowWrite: boolean;
  consentExpiry: ShareExpiry;
  consentPurpose: string;
  showFamilyAccess: boolean;
  showProviderShare: boolean;
  /** Second sign-in step: set while the app waits for an authenticator code. */
  mfaPrompt: { busy: boolean; error: string | null } | null;
  /** Google or Apple sign-up that still needs a state of residence (it sets the WelliID). */
  socialState: { details: SocialDetails; busy: boolean; error: string | null } | null;
  showTwoStep: boolean;
  showRecordLink: boolean;
  showWebLink: boolean;
  deviceCompromised: boolean;
  showAccountLog: boolean;
  showConsultBooking: boolean;
  /** Set when the booking flow was opened for one facility. */
  consultFacilityId: string | null;
  showPharmacyOrders: boolean;
  /** Pharmacy to start a new order with, when opened from the directory. */
  pharmacyOrderFacilityId: string | null;
  /** Order to open on the detail view, when opened from a notification. */
  pharmacyOrderOpenId: string | null;
  providerShareDraft: { subjectId?: string; sections?: ('allergies' | 'conditions' | 'medications' | 'records' | 'vaccinations' | 'growth')[]; recordIds?: string[]; label?: string } | null;
  /** Set when the family list could not be loaded. Null when it loaded or has not been tried. */
  familyLoadError: string | null;
  showChildProfile: boolean;
  childProfileMemberId: string | null;
  showAddFamilyMember: boolean;
  newMemberName: string;
  newMemberRelationship: string;
  newMemberDob: string;
  newMemberGender: string;
  newMemberBloodType: string;
  newMemberGenotype: string;
  showProxyLog: boolean;
  showPersonalInfo: boolean;
  personalInfoEditMode: boolean;
  personalInfoDraft: FamilyMember | null;
  showPrivacyPolicy: boolean;
  showPrivacySecurity: boolean;
  twoFactorEnabled: boolean;
  showLinkedAccounts: boolean;
  linkedAccounts: Record<string, boolean>;
  showNotificationSettings: boolean;
  notifyAccessExpiring: boolean;
  notifyAppointments: boolean;
  notifyNewRecords: boolean;
  notifyFamilyActivity: boolean;
  notifyEmailUpdates: boolean;
  showEmergency: boolean;
  careFacilityType: string;
  careSpecialty: string;
  careQuery: string;
  showBookAppointment: boolean;
  bookingFacilityId: string | null;
  externalBookingFacility: { name: string; address: string; placeId?: string } | null;
  bookingDate: string;
  bookingTimeSlot: string;
  showBilling: boolean;
  showCoverage: boolean;
  prescriptions: PrescriptionItem[];
  showRefillModal: string | null;
  showOrderMedication: boolean;
  showMedicationReminder: boolean;
  showPharmacyDirectory: boolean;
  showOrderTracking: boolean;
  showUpcomingVisits: boolean;
  appointments: AppointmentItem[];
  bookingSubmitting: boolean;
  showLabDirectory: boolean;
  showCareLocator: boolean;
  inCall: boolean;
  telehealthSession: { url: string; token: string; room: string; facilityName: string } | null;
  joiningVisitId: string | null;
  showOnboarding: boolean;
  onboardingStep: number;
  showNotifications: boolean;
  notifications: Notification[];
  darkMode: boolean;
  faceIdEnabled: boolean;
  showLockScreen: boolean;
  showActivity: boolean;
  showHealthHistory: boolean;
  showLanguage: boolean;
  language: string;
  notifPermission: 'granted' | 'skipped' | null;
  isAuthenticated: boolean;
  user: AuthSession['user'] | null;
  loggedOut: boolean;
  showWelcomeHome: boolean;
  welcomeTab: WelcomeTab;
  showVaultExport: boolean;
  facilitiesList: CareFacility[];
  toast: string | null;
}

// The server stores a photo only as a small data URL. A local file path means the picker gave no
// data, so send nothing rather than a path the server cannot read. No photo sends '' to remove it.
function avatarForServer(url?: string): string | undefined {
  if (!url) return '';
  return url.startsWith('data:image/') ? url : undefined;
}

// Turns a family member returned by the API into the app's FamilyMember shape.
export function mapRemoteFamilyMember(m: any): FamilyMember {
  return {
    id: m.id || m._id,
    name: m.fullName || m.name,
    initials: m.initials,
    role: 'dependent' as const,
    relationship: m.relationship || 'Dependent',
    dob: m.dateOfBirth || m.dob || '',
    gender: m.gender || '',
    bloodType: m.bloodType || '',
    genotype: m.genotype || '',
    height: m.height || '',
    weight: m.weight || '',
    allergies: m.allergies || '',
    conditions: m.conditions || '',
    contact: formatEmergencyContact(m) || m.contact || '',
    emergencyContacts: m.emergencyContacts || [],
    email: m.email || '',
    phone: m.phone || '',
    address: m.address || m.childProfile?.address || '',
    insuranceProvider: m.insuranceProvider || '',
    insuranceId: m.insuranceId || '',
    wrId: m.wrId || undefined,
    memberId: m.wrId || undefined,
    avatarUrl: m.avatarUrl || undefined,
    childProfile: m.childProfile || undefined,
    sharedWithMe: Boolean(m.sharedWithMe),
    myPermissions: m.myPermissions || undefined,
  };
}

// Helper to format emergency contact array/object from Atlas userprofiles into display string
export function formatEmergencyContact(profile: any): string {
  if (!profile) return '';
  // 1. Check emergencyContacts array
  if (Array.isArray(profile.emergencyContacts) && profile.emergencyContacts.length > 0) {
    const primary = profile.emergencyContacts[0];
    if (typeof primary === 'string' && primary.trim()) return primary.trim();
    if (typeof primary === 'object' && primary !== null) {
      const name = (primary.name || primary.fullName || '').trim();
      const rel = (primary.relationship || primary.relation || '').trim();
      const phone = (primary.phone || primary.phoneNumber || '').trim();
      if (name && rel && phone) return `${name} (${rel}) · ${phone}`;
      if (name && phone) return `${name} · ${phone}`;
      if (name && rel) return `${name} (${rel})`;
      if (phone) return phone;
      if (name) return name;
    }
  }
  // 2. Check emergencyContact field (object or string)
  if (profile.emergencyContact) {
    if (typeof profile.emergencyContact === 'string' && profile.emergencyContact.trim()) {
      return profile.emergencyContact.trim();
    }
    if (typeof profile.emergencyContact === 'object') {
      const name = (profile.emergencyContact.name || profile.emergencyContact.fullName || '').trim();
      const rel = (profile.emergencyContact.relationship || profile.emergencyContact.relation || '').trim();
      const phone = (profile.emergencyContact.phone || profile.emergencyContact.phoneNumber || '').trim();
      if (name && rel && phone) return `${name} (${rel}) · ${phone}`;
      if (name && phone) return `${name} · ${phone}`;
      if (name && rel) return `${name} (${rel})`;
      if (phone) return phone;
      if (name) return name;
    }
  }
  // 3. Check profile.contact
  if (profile.contact) {
    if (typeof profile.contact === 'string' && profile.contact.trim()) return profile.contact.trim();
    if (typeof profile.contact === 'object') {
      const name = (profile.contact.name || '').trim();
      const phone = (profile.contact.phone || '').trim();
      if (name && phone) return `${name} · ${phone}`;
      if (name) return name;
      if (phone) return phone;
    }
  }
  return '';
}

// Empty placeholder profile. Real values come from the signed-in user's
// account; nothing here should describe an actual person.
const DEFAULT_PRIMARY_USER: FamilyMember = {
  id: 'me',
  name: '',
  initials: '',
  role: 'owner',
  dob: '',
  gender: '',
  bloodType: '',
  genotype: '',
  height: '',
  weight: '',
  allergies: '',
  conditions: '',
  contact: '',
  emergencyContacts: [],
  email: '',
  phone: '',
  address: '',
  insuranceProvider: '',
  insuranceId: '',
};

const initialState: AppState = {
  tab: 'home',
  tabHistory: [],
  activeFamilyId: 'me',
  familyMembers: [DEFAULT_PRIMARY_USER],
  isAuthenticated: false,
  user: null,
  loggedOut: false,
  showWelcomeHome: false,
  welcomeTab: 'signin',
  recordsList: [],
  immunizationSchedule: [],
  vitalsLogs: [],
  vitalsSeries: [],
  showVitalsTrends: false,
  recordFilter: 'All',
  recordQuery: '',
  recordDetailId: null,
  showUpload: false,
  uploadStep: 0,
  showVaultExport: false,
  activeShares: [],
  showSmartConsent: false,
  consentGranteeType: 'individual',
  consentProviderId: '',
  consentProviderWrId: '',
  consentScope: null,
  consentAllowWrite: false,
  consentExpiry: '24h',
  consentPurpose: '',
  showFamilyAccess: false,
  showProviderShare: false,
  mfaPrompt: null,
  socialState: null,
  showTwoStep: false,
  showRecordLink: false,
  showWebLink: false,
  deviceCompromised: false,
  showAccountLog: false,
  showConsultBooking: false,
  consultFacilityId: null,
  showPharmacyOrders: false,
  pharmacyOrderFacilityId: null,
  pharmacyOrderOpenId: null,
  providerShareDraft: null,
  familyLoadError: null,
  showChildProfile: false,
  childProfileMemberId: null,
  showAddFamilyMember: false,
  newMemberName: '',
  newMemberRelationship: '',
  newMemberDob: '',
  newMemberGender: '',
  newMemberBloodType: '',
  newMemberGenotype: '',
  showProxyLog: false,
  showPersonalInfo: false,
  personalInfoEditMode: false,
  personalInfoDraft: null,
  showPrivacyPolicy: false,
  showPrivacySecurity: false,
  twoFactorEnabled: false,
  showLinkedAccounts: false,
  linkedAccounts: {},
  showNotificationSettings: false,
  notifyAccessExpiring: true,
  notifyAppointments: true,
  notifyNewRecords: true,
  notifyFamilyActivity: true,
  notifyEmailUpdates: false,
  showEmergency: false,
  careFacilityType: 'All',
  careSpecialty: 'All Specialties',
  careQuery: '',
  showBookAppointment: false,
  bookingFacilityId: null,
  externalBookingFacility: null,
  bookingDate: '',
  bookingTimeSlot: '',
  showBilling: false,
  showCoverage: false,
  prescriptions: [],
  showRefillModal: null,
  showOrderMedication: false,
  showMedicationReminder: false,
  showPharmacyDirectory: false,
  showOrderTracking: false,
  showUpcomingVisits: false,
  appointments: [],
  bookingSubmitting: false,
  showLabDirectory: false,
  showCareLocator: false,
  inCall: false,
  telehealthSession: null,
  joiningVisitId: null,
  showOnboarding: false,
  onboardingStep: 0,
  showNotifications: false,
  notifications: [],
  darkMode: false,
  faceIdEnabled: false,
  showLockScreen: false,
  showActivity: false,
  showHealthHistory: false,
  showLanguage: false,
  language: 'English',
  notifPermission: null,
  facilitiesList: [],
  toast: null,
};

type Updater = Partial<AppState> | ((s: AppState) => Partial<AppState>);

type NotifyPrefKey =
  | 'notifyAccessExpiring'
  | 'notifyAppointments'
  | 'notifyNewRecords'
  | 'notifyFamilyActivity'
  | 'notifyEmailUpdates';

export function useWelliApp() {
  const [state, setState] = useState<AppState>(initialState);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uploadedToastPending = useRef(false);
  // The sign-in that is waiting for an authenticator code.
  const mfaWaiter = useRef<{
    pending: AuthSession;
    resolve: (s: AuthSession) => void;
    reject: (e: Error) => void;
  } | null>(null);

  const patch = (updater: Updater) => {
    setState((prev) => ({ ...prev, ...(typeof updater === 'function' ? updater(prev) : updater) }));
  };

  // Warn once per launch if the OS says the phone is rooted or jailbroken. A warning, not a lock.
  useEffect(() => {
    checkDeviceIntegrity()
      .then((r) => {
        if (!r.compromised) return;
        setState((prev) => ({ ...prev, deviceCompromised: true }));
        showToast(DEVICE_WARNING);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Send child entries saved while offline when the user signs in and whenever the app returns to the foreground.
  useEffect(() => {
    if (!state.isAuthenticated) return;
    childOfflineQueue.flush().catch(() => {});
    const sub = RNAppState.addEventListener('change', (next) => {
      if (next === 'active') childOfflineQueue.flush().catch(() => {});
    });
    return () => sub.remove();
  }, [state.isAuthenticated]);

  useEffect(() => {
    (async () => {
      try {
        const saved = await storage.getItem('welli_active_shares');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) patch({ activeShares: parsed });
        }
        const dm = await storage.getItem('welli_dark_mode');
        if (dm !== null) patch({ darkMode: dm === '1' });

        const bio = await storage.getItem('welli_face_id');
        if (bio !== null) patch({ faceIdEnabled: bio === '1' });

        const tfa = await storage.getItem('welli_2fa_enabled');
        if (tfa !== null) patch({ twoFactorEnabled: tfa === '1' });
        
        // Restore active user session from secure storage
        const savedSession = await authService.getSavedSession();
        if (savedSession?.user && savedSession?.token) {
          setAuthToken(savedSession.token);

          patch((s) => ({
            isAuthenticated: true,
            user: savedSession.user,
            loggedOut: false,
            showWelcomeHome: false,
            familyMembers: s.familyMembers.map((f) =>
              f.id === 'me'
                ? {
                    ...f,
                    name: savedSession.user.fullName || f.name,
                    email: savedSession.user.email || f.email,
                    phone: savedSession.user.phoneNumber || f.phone,
                    bloodType: savedSession.user.bloodType || f.bloodType,
                    genotype: savedSession.user.genotype || f.genotype,
                    insuranceProvider: savedSession.user.hmoProvider || f.insuranceProvider || '',
                    insuranceId: savedSession.user.hmoPolicyNumber || '',
                    wrId: savedSession.user.wrId || savedSession.user.memberId || f.wrId || '',
                    memberId: savedSession.user.wrId || savedSession.user.memberId || f.memberId || '',
                    contact: formatEmergencyContact(savedSession.user) || f.contact,
                    emergencyContacts: (savedSession.user as any).emergencyContacts || f.emergencyContacts || [],
                  }
                : f
            ),
          }));

          // Fetch live cloud profile from backend /profile/me
          try {
            const liveProfile = await profileService.fetchMyProfile();
            if (liveProfile) {
              const serverName = liveProfile.fullName || liveProfile.name;
              const serverDob = liveProfile.dateOfBirth
                ? String(liveProfile.dateOfBirth).split('T')[0]
                : liveProfile.dob;
              const dynamicInitials = serverName
                ? serverName
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p: string) => p[0])
                    .join('')
                    .toUpperCase()
                : 'U';

              patch((s) => ({
                familyMembers: s.familyMembers.map((f) =>
                  f.id === 'me'
                    ? {
                        ...f,
                        name: serverName || f.name,
                        initials: dynamicInitials || f.initials,
                        dob: serverDob || f.dob,
                        gender: liveProfile.gender || f.gender,
                        bloodType: liveProfile.bloodType || f.bloodType,
                        genotype: liveProfile.genotype || f.genotype,
                        email: liveProfile.email || f.email,
                        phone: liveProfile.phone || liveProfile.phoneNumber || f.phone,
                        insuranceProvider:
                          liveProfile.hmoProvider ||
                          liveProfile.insuranceProvider ||
                          '',
                        insuranceId:
                          liveProfile.hmoPolicyNumber ||
                          liveProfile.policyNumber ||
                          '',
                        wrId:
                          liveProfile.wrId ||
                          liveProfile.memberId ||
                          f.wrId ||
                          '',
                        memberId:
                          liveProfile.wrId ||
                          liveProfile.memberId ||
                          f.memberId ||
                          '',
                        allergies:
                          liveProfile.allergies !== undefined
                            ? liveProfile.allergies
                            : f.allergies,
                        conditions:
                          liveProfile.conditions !== undefined
                            ? liveProfile.conditions
                            : f.conditions,
                        address: liveProfile.address || f.address,
                        contact: formatEmergencyContact(liveProfile) || f.contact,
                        emergencyContacts: liveProfile.emergencyContacts || f.emergencyContacts || [],
                      }
                    : f
                ),
              }));
            }
          } catch {
            // Keep local cached session
          }

          // Fetch genuine health records and provider lab results in parallel
          try {
            console.log('[Records] Starting fetch...');
            const [remoteRecordsResult, labResultsResult, vitalsResult, providerMedicationsResult] = await Promise.allSettled([
              recordsService.fetchRecords('me'),
              recordsService.fetchLabResults(),
              recordsService.fetchVitals(),
              recordsService.fetchProviderMedications(),
            ]);
            console.log('[Records] remoteRecords status:', remoteRecordsResult.status, remoteRecordsResult.status === 'rejected' ? remoteRecordsResult.reason : remoteRecordsResult.value?.length);
            console.log('[Records] labResults status:', labResultsResult.status, labResultsResult.status === 'rejected' ? labResultsResult.reason : labResultsResult.value?.length);
            console.log('[Records] vitals status:', vitalsResult.status, vitalsResult.status === 'rejected' ? vitalsResult.reason : vitalsResult.value?.length);
            console.log('[Records] providerMedications status:', providerMedicationsResult.status, providerMedicationsResult.status === 'rejected' ? providerMedicationsResult.reason : providerMedicationsResult.value?.length);

            const remoteRecords = remoteRecordsResult.status === 'fulfilled' ? remoteRecordsResult.value : [];
            const labResults = labResultsResult.status === 'fulfilled' ? labResultsResult.value : [];
            const vitals = vitalsResult.status === 'fulfilled' ? vitalsResult.value : [];
            const providerMedications = providerMedicationsResult.status === 'fulfilled' ? providerMedicationsResult.value : [];
            pharmacyService
              .fetchPrescriptions('me')
              .then((list) => patch({ prescriptions: Array.isArray(list) ? list : [] }))
              .catch(() => {});

            const formatDate = (value?: string | Date) =>
              value
                ? new Date(value).toLocaleDateString('en-US', {
                    month: 'short',
                    day: '2-digit',
                    year: 'numeric',
                  })
                : '';

            const mappedLabRecords: HealthRecord[] = (labResults || []).map((lab: any) => ({
              id: String(lab._id || lab.id),
              ownerId: 'me',
              type: 'Lab Result' as const,
              source: 'facility' as const,
              title: lab.testName || 'Lab Result',
              provider: lab.providerName || lab.organizationName || 'Laboratory Services',
              date: formatDate(lab.resultedAt || lab.createdAt),
              summary:
                lab.resultValue && lab.unit
                  ? `${lab.testName}: ${lab.resultValue} ${lab.unit} (${lab.interpretation || 'result'})`
                  : lab.interpretation || '',
              attachments: lab.attachments || [],
            }));

            patch((prev) => ({
              vitalsSeries: pointsFromProvider(vitals),
              vitalsLogs: [
                ...latestProviderLogs(vitals),
                ...prev.vitalsLogs.filter((l) => !l.id.startsWith('srv_')),
              ],
            }));

            const mappedVitalRecords: HealthRecord[] = (vitals || []).map((v: any) => {
              const parts: string[] = [];
              if (v.bloodPressure?.systolic && v.bloodPressure?.diastolic) {
                parts.push(`BP ${v.bloodPressure.systolic}/${v.bloodPressure.diastolic}`);
              }
              if (v.heartRate) parts.push(`HR ${v.heartRate}bpm`);
              if (v.temperature?.value) parts.push(`Temp ${v.temperature.value}°${v.temperature.unit || 'C'}`);
              if (v.oxygenSaturation) parts.push(`SpO2 ${v.oxygenSaturation}%`);
              return {
                id: String(v._id || v.id),
                ownerId: 'me',
                type: 'Vitals' as const,
                source: 'facility' as const,
                title: 'Vitals Check',
                provider: v.providerName || v.organizationName || 'Clinical Visit',
                date: formatDate(v.measuredAt || v.createdAt),
                summary: parts.join(' · ') || 'Vitals recorded',
                attachments: [],
              };
            });

            const mappedMedicationRecords: HealthRecord[] = (providerMedications || []).map((m: any) => ({
              id: String(m._id || m.id),
              ownerId: 'me',
              type: 'Medication' as const,
              source: 'facility' as const,
              title: m.medicationName || m.brandName || m.genericName || 'Medication',
              provider: m.providerName || m.organizationName || 'Prescribing Provider',
              date: formatDate(m.createdAt),
              summary: m.dosage?.value && m.dosage?.unit ? `${m.dosage.value}${m.dosage.unit}${m.form ? ` ${m.form}` : ''}` : m.form || '',
              attachments: [],
            }));

            const merged = [
              ...(Array.isArray(remoteRecords) ? remoteRecords : []),
              ...mappedLabRecords,
              ...mappedVitalRecords,
              ...mappedMedicationRecords,
            ];

            if (merged.length > 0) {
              patch({ recordsList: merged });
            }
          } catch (err) {
            reportError(err, { where: 'records.initialLoad' });
          }

          // Fetch genuine dependents & family members from cloud
          try {
            const remoteFamily = await familyService.fetchFamilyMembers();
            if (Array.isArray(remoteFamily) && remoteFamily.length > 0) {
              patch((s) => ({
                familyLoadError: null,
                familyMembers: [
                  s.familyMembers[0], // primary user
                  ...remoteFamily.map(mapRemoteFamilyMember),
                ],
              }));
            } else {
              patch({ familyLoadError: null });
            }
          } catch (err: any) {
            // Keep the local primary user, and say that the list is not current.
            reportError(err, { where: 'family.initialLoad' });
            patch({ familyLoadError: err?.message || 'Could not load your family list.' });
          }
        } else {
          // No saved session: remain unauthenticated.
          // App.expo.tsx will render the new AuthFlow.
          setAuthToken(null);

          patch({
            isAuthenticated: false,
            user: null,
            loggedOut: false,
            showWelcomeHome: false,
            familyMembers: [DEFAULT_PRIMARY_USER],
            recordsList: [],
            vitalsLogs: [],
            vitalsSeries: [],
            tab: 'home',
            tabHistory: [],
          });
        }

        // Fetch healthcare provider & facilities directory from backend
        facilityService.fetchFacilities().then((remoteFacilities) => {
          if (Array.isArray(remoteFacilities) && remoteFacilities.length > 0) {
            patch({ facilitiesList: remoteFacilities });
          }
        }).catch(() => {});

        careService.fetchAppointments().then((appointments) => {
          patch({ appointments });
        }).catch(() => {});

        // Initialize notification engine (Push token registration, SSE stream, persistent alerts)
        notificationService.init().catch(() => {});
        notificationService.subscribeToNotifications((notifs) => {
          if (Array.isArray(notifs) && notifs.length > 0) {
            patch({ notifications: notifs });
          }
        });
      } catch {
        // ignore corrupt local storage
      }
    })();
  }, []);

  const persistShares = (shares: ActiveShare[]) => {
    storage.setItem('welli_active_shares', JSON.stringify(shares)).catch(() => {});
  };

  const showToast = (msg: string) => {
    hapticFeedback.light();
    if (toastTimer.current) clearTimeout(toastTimer.current);
    patch({ toast: msg });
    toastTimer.current = setTimeout(() => patch({ toast: null }), 2200);
  };

  type AuthProfileSeed = {
    name?: string;
    email?: string;
    phone?: string;
    dob?: string;
    gender?: string;
    bloodType?: string;
    genotype?: string;
    insuranceProvider?: string;
    insuranceId?: string;
    allergies?: string;
    conditions?: string;
    address?: string;
    avatarUrl?: string;
  };

  const ownerFromAuthSession = (
    session: AuthSession,
    profile?: AuthProfileSeed,
  ): FamilyMember => {
    const rawName = (session.user.fullName || profile?.name || '').trim();
    const displayName =
      rawName ||
      session.user.email ||
      profile?.email ||
      session.user.phoneNumber ||
      profile?.phone ||
      'User';

    const initials = rawName
      ? rawName
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0])
          .join('')
          .toUpperCase()
      : displayName.slice(0, 2).toUpperCase();

    return {
      id: 'me',
      name: displayName,
      initials: initials || 'U',
      role: 'owner',
      dob: session.user.dateOfBirth || profile?.dob || '',
      gender: profile?.gender || '',
      bloodType: session.user.bloodType || profile?.bloodType || '',
      genotype: session.user.genotype || profile?.genotype || '',
      height: '',
      weight: '',
      allergies: profile?.allergies || '',
      conditions: profile?.conditions || '',
      contact:
        formatEmergencyContact(session.user) ||
        session.user.phoneNumber ||
        profile?.phone ||
        '',
      emergencyContacts: (session.user as any).emergencyContacts || [],
      email: session.user.email || profile?.email || '',
      phone: session.user.phoneNumber || profile?.phone || '',
      address: profile?.address || '',
      insuranceProvider:
        session.user.hmoProvider || profile?.insuranceProvider || '',
      insuranceId:
        session.user.hmoPolicyNumber || profile?.insuranceId || '',
      wrId: session.user.wrId || session.user.memberId || '',
      memberId: session.user.wrId || session.user.memberId || '',
      avatarUrl: profile?.avatarUrl,
    };
  };

  const refreshAuthenticatedProfile = () => {
    profileService.fetchMyProfile().then((liveProfile) => {
      if (!liveProfile) return;

      const serverName = liveProfile.fullName || liveProfile.name || '';
      const serverDob = liveProfile.dateOfBirth
        ? String(liveProfile.dateOfBirth).split('T')[0]
        : liveProfile.dob || '';
      const dynamicInitials = serverName
        ? serverName
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((part: string) => part[0])
            .join('')
            .toUpperCase()
        : '';

      patch((s) => ({
        familyMembers: s.familyMembers.map((member) =>
          member.id === 'me'
            ? {
                ...member,
                name: serverName || member.name,
                initials: dynamicInitials || member.initials,
                dob: serverDob || member.dob,
                gender: liveProfile.gender || member.gender,
                bloodType: liveProfile.bloodType || member.bloodType,
                genotype: liveProfile.genotype || member.genotype,
                email: liveProfile.email || member.email,
                phone:
                  liveProfile.phone ||
                  liveProfile.phoneNumber ||
                  member.phone,
                insuranceProvider:
                  liveProfile.hmoProvider ||
                  liveProfile.insuranceProvider ||
                  member.insuranceProvider ||
                  '',
                insuranceId:
                  liveProfile.hmoPolicyNumber ||
                  liveProfile.policyNumber ||
                  member.insuranceId ||
                  '',
                wrId:
                  liveProfile.wrId ||
                  liveProfile.memberId ||
                  member.wrId ||
                  '',
                memberId:
                  liveProfile.wrId ||
                  liveProfile.memberId ||
                  member.memberId ||
                  '',
                allergies:
                  liveProfile.allergies !== undefined
                    ? liveProfile.allergies
                    : member.allergies,
                conditions:
                  liveProfile.conditions !== undefined
                    ? liveProfile.conditions
                    : member.conditions,
                address: liveProfile.address || member.address,
                avatarUrl: liveProfile.avatarUrl || liveProfile.avatar || member.avatarUrl,
                contact:
                  formatEmergencyContact(liveProfile) || member.contact,
                emergencyContacts:
                  liveProfile.emergencyContacts ||
                  member.emergencyContacts ||
                  [],
              }
            : member,
        ),
      }));
    }).catch(() => {});
  };

  // Re-reads the family list, including children other guardians shared with me.
  const reloadFamilyNow = async () => {
    let remote;
    try {
      remote = await familyService.fetchFamilyMembers();
    } catch (err: any) {
      reportError(err, { where: 'family.reload' });
      patch({ familyLoadError: err?.message || 'Could not load your family list.' });
      return;
    }
    patch((s) => ({
      familyLoadError: null,
      familyMembers: [
        s.familyMembers.find((member) => member.id === 'me') || s.familyMembers[0],
        ...remote.map(mapRemoteFamilyMember),
      ],
    }));
  };

  const refreshAuthenticatedFamily = () => {
    familyService.fetchFamilyMembers().then((remoteFamily) => {
      if (!Array.isArray(remoteFamily) || remoteFamily.length === 0) {
        patch({ familyLoadError: null });
        return;
      }

      patch((s) => ({
        familyLoadError: null,
        familyMembers: [
          s.familyMembers.find((member) => member.id === 'me') || s.familyMembers[0],
          ...remoteFamily.map(mapRemoteFamilyMember),
        ],
      }));
    }).catch((err: any) => {
      reportError(err, { where: 'family.refresh' });
      patch({ familyLoadError: err?.message || 'Could not load your family list.' });
    });
  };

  /**
   * If the account has the second step on, the sign-in came back without a token. Show the code
   * prompt and wait. Resolves with the real session, or rejects if the person cancels.
   */
  const resolveMfa = (session: AuthSession): Promise<AuthSession> => {
    if (!session?.mfaRequired || !session.mfaToken) return Promise.resolve(session);
    mfaWaiter.current?.reject(new Error('Sign-in was replaced by a new attempt.'));
    return new Promise<AuthSession>((resolve, reject) => {
      mfaWaiter.current = { pending: session, resolve, reject };
      patch({ mfaPrompt: { busy: false, error: null } });
    });
  };

  const commitAuthenticatedSession = async (
    session: AuthSession,
    profile?: AuthProfileSeed,
    mode: 'login' | 'signup' = 'login',
  ) => {
    if (!session?.token) {
      throw new Error('Authentication completed without a valid session token.');
    }

    await authService.saveSession(session);

    const owner = ownerFromAuthSession(session, profile);

    patch((s) => ({
      familyMembers: [owner, ...s.familyMembers.filter((member) => member.id !== 'me')],
      activeFamilyId: 'me',
      isAuthenticated: true,
      user: session.user,
      loggedOut: false,
      showWelcomeHome: false,
      showPersonalInfo: false,
      showHealthHistory: false,
      personalInfoEditMode: false,
      personalInfoDraft: null,
      tab: 'home',
      tabHistory: [],
    }));

    refreshAuthenticatedProfile();
    refreshAuthenticatedFamily();

    const firstName = owner.name.split(' ')[0] || 'there';
    showToast(
      mode === 'signup'
        ? `Welcome to WelliRecord, ${firstName}!`
        : `Welcome back, ${firstName}!`,
    );

    return session;
  };

  // Shows the new photo straight away, saves it, and puts the old one back with a message if the save fails.
  const saveAvatar = async (memberId: string, next: string | undefined, okMsg: string) => {
    const previous = state.familyMembers.find((f) => f.id === memberId)?.avatarUrl;
    const apply = (url: string | undefined) =>
      patch((s) => ({
        familyMembers: s.familyMembers.map((f) => (f.id === memberId ? { ...f, avatarUrl: url } : f)),
        personalInfoDraft: s.personalInfoDraft && s.personalInfoDraft.id === memberId ? { ...s.personalInfoDraft, avatarUrl: url } : s.personalInfoDraft,
      }));
    apply(next);
    try {
      if (memberId === 'me') await apiClient.patch('/profile/update', { avatarUrl: next ?? '' });
      else await familyService.updateFamilyMember(memberId, { avatarUrl: next ?? '' });
      showToast(okMsg);
    } catch (e: any) {
      apply(previous);
      showToast(e?.message || 'Could not save the photo. Check your connection and try again.');
    }
  };

  const actions = {
    showToast: (msg: string) => showToast(msg),
    setTab: (tab: Tab) => {
      patch((s) => {
        if (s.tab === tab) return {};
        return {
          tabHistory: [...s.tabHistory, s.tab],
          tab,
        };
      });
    },
    goBackTab: () => {
      hapticFeedback.light();
      patch((s) => {
        if (s.tabHistory.length === 0) return {};
        const newHistory = [...s.tabHistory];
        const prevTab = newHistory.pop()!;
        return {
          tabHistory: newHistory,
          tab: prevTab,
        };
      });
    },
    setFamily: (id: string) => patch({ activeFamilyId: id }),
    openRecord: (id: string) => patch({ recordDetailId: id }),
    closeRecord: () => patch({ recordDetailId: null }),
    setFilter: (type: RecordType | 'All') => patch({ recordFilter: type }),
    setRecordQuery: (value: string) => patch({ recordQuery: value }),

    openUpload: () => patch({ showUpload: true, uploadStep: 0 }),
    closeUpload: () => {
      patch({ showUpload: false, uploadStep: 0 });
      if (uploadedToastPending.current) {
        showToast('Added to your records');
        uploadedToastPending.current = false;
      }
    },
    setUploadStepScanning: () => patch({ uploadStep: 1 }),
    setUploadStepReview: () => patch({ uploadStep: 2 }),

    // Sharing goes through the consent flow, which creates a real grant on the server.
    openShareFlow: (_prefillId?: string) => actions.openSmartConsent(),
    shareWithFacility: (facilityId: string) => {
      hapticFeedback.light();
      const facility = (state.facilitiesList ?? []).find((f) => f.id === facilityId);
      patch({
        showLabDirectory: false,
        showCareLocator: false,
        showPharmacyDirectory: false,
        showSmartConsent: true,
        consentGranteeType: 'organization',
        consentProviderId: facility?.name || '',
        consentProviderWrId: '',
        consentScope: null,
        consentAllowWrite: false,
        consentExpiry: '24h',
        consentPurpose: '',
      });
    },
    revokeShare: (id: string) => {
      setState((s) => {
        const activeShares = s.activeShares.filter((x) => x.id !== id);
        persistShares(activeShares);
        return { ...s, activeShares };
      });
      showToast('Access revoked');
    },

    openSmartConsent: () =>
      patch({
        showSmartConsent: true,
        consentGranteeType: 'individual',
        consentProviderId: '',
        consentProviderWrId: '',
        consentScope: null,
        consentAllowWrite: false,
        consentExpiry: '24h',
        consentPurpose: '',
      }),
    closeSmartConsent: () => patch({ showSmartConsent: false }),
    setConsentGranteeType: (t: ConsentGranteeType) => patch({ consentGranteeType: t }),
    setConsentProviderId: (v: string) => patch({ consentProviderId: v }),
    setConsentProviderWrId: (v: string) => patch({ consentProviderWrId: v.toUpperCase() }),
    setConsentScope: (v: string) => patch({ consentScope: v }),
    toggleConsentWrite: () => patch((s) => ({ consentAllowWrite: !s.consentAllowWrite })),
    setConsentExpiry: (v: ShareExpiry) => patch({ consentExpiry: v }),
    setConsentPurpose: (v: string) => patch({ consentPurpose: v }),
    grantSmartAccess: async () => {
      const providerName = state.consentProviderId.trim();
      const providerWrId = state.consentProviderWrId.trim();
      if (!providerName || !state.consentScope) {
        showToast('Enter a provider and choose an access scope');
        return;
      }
      if (!providerWrId) {
        showToast("Enter the provider's WelliID (e.g. WR-1234-ABCD)");
        return;
      }
      const isIndividual = state.consentGranteeType === 'individual';
      if (isIndividual && !/^WR-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(providerWrId)) {
        showToast('WelliID must be in the format WR-XXXX-XXXX');
        return;
      }
      try {
        const grant = await sharingService.createShareGrant({
          recipientId: providerWrId,
          recipientType: state.consentGranteeType === 'organization' ? 'facility' : 'doctor',
          recipientName: providerName,
          recordIds: [],
          expiry: state.consentExpiry,
          otpCode: '',
        });
        const newShare: ActiveShare = {
          id: grant.id,
          doctorId: providerWrId,
          doctorName: providerName,
          initials: providerName.slice(0, 2).toUpperCase(),
          recordCount: 0,
          scopeLabel: state.consentScope,
          writeAccess: state.consentAllowWrite,
          purpose: state.consentPurpose.trim() || undefined,
          expiresLabel: EXPIRY_SHORT_LABEL_MAP[state.consentExpiry],
          ownerId: state.activeFamilyId,
        };
        setState((s) => {
          const activeShares = [newShare, ...s.activeShares];
          persistShares(activeShares);
          return { ...s, activeShares, showSmartConsent: false };
        });
        showToast('Access granted');
      } catch (err: any) {
        showToast(err?.message || 'Failed to grant access. Please try again.');
      }
    },

    openEmergency: () => patch({ showEmergency: true }),
    closeEmergency: () => patch({ showEmergency: false }),
    openFamilyAccess: () => patch({ showFamilyAccess: true }),
    closeFamilyAccess: () => patch({ showFamilyAccess: false }),
    openProviderShare: (draft?: AppState['providerShareDraft']) =>
      patch({ showProviderShare: true, providerShareDraft: draft ?? null, showSmartConsent: false }),
    closeProviderShare: () => patch({ showProviderShare: false, providerShareDraft: null }),
    openTwoStep: () => patch({ showTwoStep: true }),
    closeTwoStep: () => patch({ showTwoStep: false }),
    openRecordLink: () => patch({ showRecordLink: true }),
    closeRecordLink: () => patch({ showRecordLink: false }),
    openWebLink: () => patch({ showWebLink: true }),
    closeWebLink: () => patch({ showWebLink: false }),
    openConsultBooking: (facilityId?: string) =>
      patch({
        showConsultBooking: true,
        consultFacilityId: facilityId || null,
        showBookAppointment: false,
        showLabDirectory: false,
        showCareLocator: false,
        showPharmacyDirectory: false,
      }),
    closeConsultBooking: () => patch({ showConsultBooking: false, consultFacilityId: null }),
    openPharmacyOrders: (opts?: { facilityId?: string; orderId?: string }) =>
      patch({
        showPharmacyOrders: true,
        pharmacyOrderFacilityId: opts?.facilityId || null,
        pharmacyOrderOpenId: opts?.orderId || null,
        showPharmacyDirectory: false,
        showOrderMedication: false,
      }),
    closePharmacyOrders: () => patch({ showPharmacyOrders: false, pharmacyOrderFacilityId: null, pharmacyOrderOpenId: null }),
    /** Adds or replaces a booking the server just created or updated. */
    upsertAppointment: (a: AppointmentItem) =>
      patch((s) => ({
        appointments: [...s.appointments.filter((x) => x.id !== a.id), a].sort(
          (x, y) => new Date(x.scheduledFor).getTime() - new Date(y.scheduledFor).getTime()
        ),
      })),
    openAccountLog: () => patch({ showAccountLog: true }),
    closeAccountLog: () => patch({ showAccountLog: false }),
    submitMfaCode: async (proof: { code: string } | { recoveryCode: string }) => {
      const waiter = mfaWaiter.current;
      if (!waiter) return;
      patch({ mfaPrompt: { busy: true, error: null } });
      try {
        const done = await authService.verifyMfa(waiter.pending, proof);
        mfaWaiter.current = null;
        patch({ mfaPrompt: null });
        waiter.resolve(done);
      } catch (err: any) {
        hapticFeedback.error();
        if (err?.statusCode === 401) {
          // The five minutes ran out. The person has to start sign-in again.
          mfaWaiter.current = null;
          patch({ mfaPrompt: null });
          waiter.reject(new Error('That sign-in took too long. Please start again.'));
          return;
        }
        patch({ mfaPrompt: { busy: false, error: err?.message || 'That code did not match.' } });
      }
    },
    cancelMfa: () => {
      const waiter = mfaWaiter.current;
      mfaWaiter.current = null;
      patch({ mfaPrompt: null });
      waiter?.reject(new Error('Sign-in cancelled.'));
    },
    // From a record: share just that record as an encrypted link or QR, for a provider that is not on WelliRecord.
    shareRecordEncrypted: (recordId: string) => {
      const r = (state.recordsList ?? []).find((x) => x.id === recordId);
      patch({ recordDetailId: null });
      actions.openProviderShare({ subjectId: r?.ownerId || 'me', sections: ['records'], recordIds: [recordId], label: r?.title });
    },
    reloadFamily: reloadFamilyNow,
    acceptGuardianInvite: async (code: string): Promise<boolean> => {
      try {
        await childHealthService.acceptInvite(code);
        await reloadFamilyNow();
        showToast('You now have access to this child');
        return true;
      } catch (err: any) {
        showToast(err?.message || 'Could not use that code');
        return false;
      }
    },
    openChildProfile: (memberId: string) => patch({ showChildProfile: true, childProfileMemberId: memberId }),
    closeChildProfile: () => patch({ showChildProfile: false, childProfileMemberId: null }),
    // Copies saved child details back into the family list so other screens agree.
    applyChildProfile: (
      memberId: string,
      profile: { wrId?: string | null; gender?: string; bloodType?: string; genotype?: string; allergies?: string; childProfile?: ChildProfileDetails },
    ) =>
      patch((s) => ({
        familyMembers: s.familyMembers.map((f) =>
          f.id === memberId
            ? {
                ...f,
                wrId: profile.wrId || f.wrId,
                memberId: profile.wrId || f.memberId,
                gender: profile.gender ?? f.gender,
                bloodType: profile.bloodType ?? f.bloodType,
                genotype: profile.genotype ?? f.genotype,
                allergies: profile.allergies ?? f.allergies,
                address: profile.childProfile?.address || f.address,
                childProfile: profile.childProfile ?? f.childProfile,
              }
            : f,
        ),
      })),
    openAddFamilyMember: () =>
      patch({
        showAddFamilyMember: true,
        newMemberName: '',
        newMemberRelationship: '',
        newMemberDob: '',
        newMemberGender: '',
        newMemberBloodType: '',
        newMemberGenotype: '',
      }),
    closeAddFamilyMember: () => patch({ showAddFamilyMember: false }),
    setNewMemberName: (v: string) => patch({ newMemberName: v }),
    setNewMemberRelationship: (v: string) => patch({ newMemberRelationship: v }),
    setNewMemberDob: (v: string) => patch({ newMemberDob: v }),
    setNewMemberGender: (v: string) => patch({ newMemberGender: v }),
    setNewMemberBloodType: (v: string) => patch({ newMemberBloodType: v }),
    setNewMemberGenotype: (v: string) => patch({ newMemberGenotype: v }),
    addFamilyMember: async (customDraft?: {
      fullName?: string;
      name?: string;
      relationship?: string;
      dateOfBirth?: string;
      dob?: string;
      gender?: string;
      bloodType?: string;
      genotype?: string;
    }): Promise<boolean> => {
      const name = (customDraft?.fullName || customDraft?.name || state.newMemberName || '').trim();
      if (!name) {
        showToast('Enter a name for the family member');
        return false;
      }
      const relationship = customDraft?.relationship || state.newMemberRelationship || 'Child';
      const dateOfBirth = customDraft?.dateOfBirth || customDraft?.dob || state.newMemberDob;
      const gender = customDraft?.gender || state.newMemberGender;
      const bloodType = customDraft?.bloodType || state.newMemberBloodType;
      const genotype = customDraft?.genotype || state.newMemberGenotype;

      try {
        const saved = await familyService.addFamilyMember({
          fullName: name,
          relationship,
          dateOfBirth,
          gender,
          bloodType,
          genotype,
        });

        // Re-fetch all dependents directly from Atlas backend
        try {
          const remoteFamily = await familyService.fetchFamilyMembers();
          if (Array.isArray(remoteFamily) && remoteFamily.length > 0) {
            patch((s) => ({
              familyMembers: [
                s.familyMembers[0], // primary user
                ...remoteFamily.map(mapRemoteFamilyMember),
              ],
              showAddFamilyMember: false,
              newMemberName: '',
              newMemberRelationship: '',
              newMemberDob: '',
              newMemberGender: '',
              newMemberBloodType: '',
              newMemberGenotype: '',
            }));
          }
        } catch {
          // Fallback appending saved member
          const initials = name
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0])
            .join('')
            .toUpperCase() || 'FM';

          const memberToAdd: FamilyMember = {
            id: saved?.id || (saved as any)?._id || 'fm_' + Date.now(),
            name: saved?.name || name,
            initials: saved?.initials || initials,
            role: 'dependent',
            dob: saved?.dob || dateOfBirth,
            gender: saved?.gender || gender || '—',
            bloodType: saved?.bloodType || bloodType || 'Unknown',
            genotype: saved?.genotype || genotype || 'Unknown',
            height: '—',
            weight: '—',
            allergies: 'None on file',
            conditions: 'None on file',
            contact: `${state.familyMembers[0].name} (${relationship || 'Guardian'})`,
            email: '—',
            phone: '—',
            address: state.familyMembers[0].address,
            insuranceProvider: `${state.familyMembers[0].insuranceProvider} (dependent)`,
            insuranceId: `${state.familyMembers[0].insuranceId}-DEP`,
          };

          patch((s) => ({
            familyMembers: [...s.familyMembers, memberToAdd],
            showAddFamilyMember: false,
            newMemberName: '',
            newMemberRelationship: '',
            newMemberDob: '',
            newMemberGender: '',
            newMemberBloodType: '',
            newMemberGenotype: '',
          }));
        }

        showToast(`${name} added to your family vault`);
        return true;
      } catch (err: any) {
        showToast(err?.message || 'Failed to add family member');
        return false;
      }
    },
    removeFamilyMember: async (id: string) => {
      hapticFeedback.warning();
      try {
        await familyService.deleteFamilyMember(id);
        patch((s) => ({
          familyMembers: s.familyMembers.filter((f) => f.id !== id),
          activeFamilyId: s.activeFamilyId === id ? 'me' : s.activeFamilyId,
        }));
        showToast('Family member removed');
      } catch (err: any) {
        showToast(err?.message || 'Failed to remove family member');
      }
    },
    openProxyLog: () => patch({ showProxyLog: true }),
    closeProxyLog: () => patch({ showProxyLog: false }),
    openPersonalInfo: () => patch({ showPersonalInfo: true, personalInfoEditMode: false, personalInfoDraft: null }),
    closePersonalInfo: () => patch({ showPersonalInfo: false, personalInfoEditMode: false, personalInfoDraft: null }),
    startEditPersonalInfo: () => {
      const activeMember = state.familyMembers.find((f) => f.id === state.activeFamilyId) ?? state.familyMembers[0];
      patch({ personalInfoEditMode: true, personalInfoDraft: { ...activeMember } });
    },
    cancelEditPersonalInfo: () => patch({ personalInfoEditMode: false, personalInfoDraft: null }),
    updatePersonalInfoDraft: (field: keyof FamilyMember, value: string) =>
      patch((s) => (s.personalInfoDraft ? { personalInfoDraft: { ...s.personalInfoDraft, [field]: value } } : {})),
    savePersonalInfo: async (customDraft?: FamilyMember): Promise<boolean> => {
      const draft = customDraft || state.personalInfoDraft;
      if (!draft) return false;

      // If editing primary user ('me'), sync with live backend
      if (draft.id === 'me') {
        try {
          const res = await apiClient.patch<{ success: boolean; profile?: any; message?: string }>('/profile/update', {
            fullName: draft.name,
            name: draft.name,
            dob: draft.dob,
            dateOfBirth: draft.dob,
            gender: draft.gender,
            bloodType: draft.bloodType,
            genotype: draft.genotype,
            email: draft.email,
            phone: draft.phone,
            phoneNumber: draft.phone,
            hmoProvider: draft.insuranceProvider,
            insuranceProvider: draft.insuranceProvider,
            hmoPolicyNumber: draft.insuranceId,
            insuranceId: draft.insuranceId,
            allergies: draft.allergies,
            conditions: draft.conditions,
            address: draft.address,
            contact: draft.contact,
            avatarUrl: avatarForServer(draft.avatarUrl),
          });

          const serverProfile = res?.profile;
          const updatedMember: FamilyMember = {
            ...draft,
            name: serverProfile?.fullName || serverProfile?.name || draft.name,
            dob: serverProfile?.dateOfBirth ? String(serverProfile.dateOfBirth).split('T')[0] : (serverProfile?.dob || draft.dob),
            gender: serverProfile?.gender || draft.gender,
            bloodType: serverProfile?.bloodType || draft.bloodType,
            genotype: serverProfile?.genotype || draft.genotype,
            email: serverProfile?.email || draft.email,
            phone: serverProfile?.phone || serverProfile?.phoneNumber || draft.phone,
            avatarUrl: serverProfile ? serverProfile.avatarUrl || undefined : draft.avatarUrl,
            insuranceProvider: serverProfile?.hmoProvider || serverProfile?.insuranceProvider || draft.insuranceProvider || '',
            insuranceId: serverProfile?.hmoPolicyNumber || serverProfile?.policyNumber || draft.insuranceId || '',
            wrId: serverProfile?.wrId || serverProfile?.memberId || draft.wrId || '',
            memberId: serverProfile?.wrId || serverProfile?.memberId || draft.memberId || '',
            allergies: serverProfile?.allergies !== undefined ? serverProfile.allergies : draft.allergies,
            contact: formatEmergencyContact(serverProfile) || draft.contact,
            emergencyContacts: serverProfile?.emergencyContacts || draft.emergencyContacts || [],
          };

          patch((s) => ({
            familyMembers: s.familyMembers.map((f) => (f.id === draft.id ? updatedMember : f)),
            personalInfoEditMode: false,
            personalInfoDraft: null,
          }));
          showToast('Personal info saved & verified');
          return true;
        } catch (syncErr: any) {
          console.error('[Profile Sync Error]', syncErr);
          const errorMsg = syncErr?.message || 'Failed to save changes to server. Please try again.';
          showToast(errorMsg);
          throw new Error(errorMsg);
        }
      } else {
        // Dependent member update
        try {
          await familyService.updateFamilyMember(draft.id, {
            fullName: draft.name,
            dateOfBirth: draft.dob,
            gender: draft.gender,
            bloodType: draft.bloodType,
            genotype: draft.genotype,
            allergies: draft.allergies,
            phone: draft.phone,
            avatarUrl: avatarForServer(draft.avatarUrl),
          });

          patch((s) => ({
            familyMembers: s.familyMembers.map((f) => (f.id === draft.id ? draft : f)),
            personalInfoEditMode: false,
            personalInfoDraft: null,
          }));
          showToast(`${draft.name}'s profile updated`);
          return true;
        } catch (err: any) {
          const errorMsg = err?.message || 'Failed to update dependent on server';
          showToast(errorMsg);
          throw new Error(errorMsg);
        }
      }
    },
    // A new or removed photo is saved to the server at once, not only when the form is saved.
    setAvatar: async (memberId: string, dataUrl: string, sizeBytes: number) => {
      if (sizeBytes > 700 * 1024) {
        showToast('Photo is too large. Choose a smaller picture.');
        return;
      }
      if (!dataUrl.startsWith('data:image/')) {
        showToast('Could not read that photo. Try another one.');
        return;
      }
      await saveAvatar(memberId, dataUrl, 'Profile photo saved');
    },
    removeAvatar: async (memberId: string) => {
      await saveAvatar(memberId, undefined, 'Profile photo removed');
    },
    openPrivacyPolicy: () => patch({ showPrivacyPolicy: true }),
    closePrivacyPolicy: () => patch({ showPrivacyPolicy: false }),
    openPrivacySecurity: () => patch({ showPrivacySecurity: true }),
    closePrivacySecurity: () => patch({ showPrivacySecurity: false }),
    toggleTwoFactor: async () => {
      hapticFeedback.selection();
      const nextVal = !state.twoFactorEnabled;
      patch({ twoFactorEnabled: nextVal });
      try {
        await authService.toggleTwoFactor(nextVal);
        showToast(
          nextVal
            ? 'Two-factor authentication enabled (SMS/Email OTP required on sign-in)'
            : 'Two-factor authentication disabled'
        );
      } catch {
        showToast(`2FA ${nextVal ? 'enabled' : 'disabled'}`);
      }
    },
    downloadMyData: () => {
      hapticFeedback.selection();
      patch({ showVaultExport: true, showPrivacySecurity: false });
    },
    openVaultExport: () => {
      hapticFeedback.selection();
      patch({ showVaultExport: true });
    },
    closeVaultExport: () => patch({ showVaultExport: false }),
    requestAccountDeletion: () => {
      hapticFeedback.warning();
      Alert.alert(
        'Delete your account?',
        'This permanently deletes your account and the health data stored on our servers, including family members and children. It cannot be undone.\n\nTo ask the Data Protection Officer a question first, email us.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Email Privacy Officer',
            onPress: () => {
              Linking.openURL(
                'mailto:privacy@wellirecord.com?subject=NDPR%20Account%20Deletion%20Request%20-%20WelliRecord'
              ).catch(() => {});
            },
          },
          {
            text: 'Delete my account',
            style: 'destructive',
            onPress: async () => {
              try {
                await authService.deleteAccount();
              } catch {
                showToast('Could not delete your account. Check your connection and try again.');
                return;
              }
              await clearChildOfflineData();
              patch({
                isAuthenticated: false,
                user: null,
                loggedOut: false,
                showPrivacySecurity: false,
                familyMembers: [DEFAULT_PRIMARY_USER],
                recordsList: [],
                vitalsLogs: [],
                vitalsSeries: [],
                twoFactorEnabled: false,
                faceIdEnabled: false,
              });
              showToast('Your account has been deleted');
            },
          },
        ]
      );
    },
    deleteAccount: async () => {
      try {
        await authService.deleteAccount();
      } catch {
        showToast('Could not delete your account. Check your connection and try again.');
        return;
      }
      await clearChildOfflineData();
      patch({
        isAuthenticated: false,
        user: null,
        loggedOut: false,
        showPrivacySecurity: false,
        familyMembers: [DEFAULT_PRIMARY_USER],
        recordsList: [],
        vitalsLogs: [],
        vitalsSeries: [],
        twoFactorEnabled: false,
        faceIdEnabled: false,
      });
      showToast('Account session and cached vault data cleared');
    },

    openLinkedAccounts: () => patch({ showLinkedAccounts: true }),
    closeLinkedAccounts: () => patch({ showLinkedAccounts: false }),
    connectAccount: (id: string, label: string) => {
      patch((s) => ({ linkedAccounts: { ...s.linkedAccounts, [id]: true } }));
      showToast(`Connected to ${label}`);
    },

    openNotificationSettings: () => patch({ showNotificationSettings: true }),
    closeNotificationSettings: () => patch({ showNotificationSettings: false }),
    toggleNotifyPref: (key: NotifyPrefKey) => patch((s) => ({ [key]: !s[key] }) as Partial<AppState>),
    enablePushNotifications: () => {
      patch({ notifPermission: 'granted' });
      showToast('Push notifications enabled');
    },

    setCareFacilityType: (t: string) => patch({ careFacilityType: t }),
    setCareSpecialty: (s: string) => patch({ careSpecialty: s }),
    setCareQuery: (value: string) => patch({ careQuery: value }),
    joinVideoVisit: async (appointment: { id: string; facilityName: string }) => {
      if (state.joiningVisitId) return;
      patch({ joiningVisitId: appointment.id });
      try {
        const session = await careService.fetchTelehealthToken(appointment.id);
        patch({
          telehealthSession: { ...session, facilityName: appointment.facilityName },
          inCall: true,
          showUpcomingVisits: false,
          joiningVisitId: null,
        });
      } catch (err: any) {
        patch({ joiningVisitId: null });
        showToast(err?.message || 'Could not start the video visit. Try again.');
      }
    },
    // A video visit booked on the website, joined with the account link. Same call screen as an app visit.
    joinWebVisit: async (visit: { id: string; facilityName: string }) => {
      if (state.joiningVisitId) return;
      patch({ joiningVisitId: visit.id });
      try {
        const session = await webLinkService.visitToken(visit.id);
        patch({
          telehealthSession: { url: session.url, token: session.token, room: session.room, facilityName: visit.facilityName },
          inCall: true,
          showUpcomingVisits: false,
          joiningVisitId: null,
        });
      } catch (err: any) {
        patch({ joiningVisitId: null });
        showToast(err?.message || 'Could not start the video visit. Try again.');
      }
    },
    endCall: () => {
      patch({ inCall: false, telehealthSession: null });
    },
    reportCallError: (message: string) => {
      patch({ inCall: false, telehealthSession: null });
      showToast(message);
    },

    openBookAppointment: (
      facilityId: string,
      externalFacility?: { name: string; address: string; placeId?: string }
    ) => {
      const legacy = () =>
        patch({
          showBookAppointment: true,
          showLabDirectory: false,
          showCareLocator: false,
          showPharmacyDirectory: false,
          bookingFacilityId: externalFacility ? null : facilityId,
          externalBookingFacility: externalFacility || null,
          bookingDate: '',
          bookingTimeSlot: '',
        });
      if (externalFacility || !facilityId) return legacy();
      // A facility that has published fees and hours uses the consultation booking flow.
      bookingService
        .offers(facilityId)
        .then((o) =>
          o.inPerson || o.virtual
            ? patch({
                showConsultBooking: true,
                consultFacilityId: facilityId,
                showLabDirectory: false,
                showCareLocator: false,
                showPharmacyDirectory: false,
              })
            : legacy()
        )
        .catch(legacy);
    },
    closeBookAppointment: () =>
      patch({ showBookAppointment: false, externalBookingFacility: null }),
    setBookingDate: (v: string) => patch({ bookingDate: v }),
    setBookingTimeSlot: (v: string) => patch({ bookingTimeSlot: v }),
    confirmBooking: async (extra?: { familyMemberId?: string; reason?: string; visitType?: 'in_person' | 'video'; providerRemark?: string; patientName?: string }) => {
      if (state.bookingSubmitting) return;
      const externalFacility = state.externalBookingFacility;
      const allFacilities = state.facilitiesList ?? [];
      const facility = externalFacility ? null : allFacilities.find((f) => f.id === state.bookingFacilityId);
      if ((!externalFacility && !facility) || !state.bookingDate || !state.bookingTimeSlot) {
        showToast('Choose a date and time to continue');
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(state.bookingDate) || Number.isNaN(new Date(state.bookingDate).getTime())) {
        showToast('Enter the date as YYYY-MM-DD');
        return;
      }
      const name = externalFacility?.name || facility!.name;
      patch({ bookingSubmitting: true });
      try {
        const { appointment: created, notice } = await careService.requestAppointment({
          facilityId: facility?.id,
          facilityName: name,
          facilityAddress: externalFacility?.address || facility?.address,
          familyMemberId: extra?.familyMemberId && extra.familyMemberId !== 'me' ? extra.familyMemberId : undefined,
          date: state.bookingDate,
          timeSlot: state.bookingTimeSlot,
          reason: extra?.reason?.trim() || undefined,
          visitType: extra?.visitType === 'video' ? 'video' : 'in_person',
          externalFacility: externalFacility ? true : undefined,
          providerRemark: externalFacility ? extra?.providerRemark?.trim() || undefined : undefined,
        });
        patch((s) => ({
          showBookAppointment: false,
          externalBookingFacility: null,
          bookingSubmitting: false,
          appointments: [...s.appointments, created].sort(
            (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
          ),
        }));
        if (externalFacility) {
          // Google listings are not on WelliRecord, so nobody is notified. Hand the request to the person to send.
          showToast(`Request saved. ${notice || `Send it to ${name} so they can confirm.`}`);
          Share.share({
            message: buildShareMessage({
              facility: name,
              patient: extra?.patientName || 'Patient',
              date: state.bookingDate,
              timeSlot: state.bookingTimeSlot,
              reason: extra?.reason?.trim(),
              remark: extra?.providerRemark?.trim(),
            }),
          }).catch(() => {});
        } else {
          showToast(`Request sent to ${name}. ${notice || 'They will confirm your visit.'}`);
        }
      } catch (err: any) {
        patch({ bookingSubmitting: false });
        showToast(err?.message || 'Could not send the request. Try again.');
      }
    },
    openUpcomingVisits: () => {
      hapticFeedback.light();
      patch({ showUpcomingVisits: true });
      careService.fetchAppointments().then((appointments) => patch({ appointments })).catch(() => {});
    },
    closeUpcomingVisits: () => patch({ showUpcomingVisits: false }),
    cancelAppointment: async (id: string) => {
      try {
        const updated = await careService.cancelAppointment(id);
        patch((s) => ({
          appointments: s.appointments.map((a) =>
            a.id === id ? updated ?? { ...a, status: 'cancelled' } : a
          ),
        }));
        showToast('Appointment cancelled');
      } catch (err: any) {
        showToast(err?.message || 'Could not cancel. Try again.');
      }
    },

    openBilling: () => patch({ showBilling: true }),
    closeBilling: () => patch({ showBilling: false }),
    openCoverage: () => patch({ showCoverage: true }),
    closeCoverage: () => patch({ showCoverage: false }),

    openOnboarding: () => patch({ showOnboarding: true, onboardingStep: 0 }),
    closeOnboarding: () => patch({ showOnboarding: false }),
    onboardingNext: () => {
      setState((s) => {
        if (s.onboardingStep >= ONBOARDING.length - 1) {
          return { ...s, showOnboarding: false };
        }
        return { ...s, onboardingStep: s.onboardingStep + 1 };
      });
    },
    allowNotifications: () => {
      patch({ notifPermission: 'granted' });
      actions.onboardingNext();
    },
    skipNotifications: () => {
      patch({ notifPermission: 'skipped' });
      actions.onboardingNext();
    },

    toggleNotifications: () => {
      hapticFeedback.selection();
      patch((s) => ({ showNotifications: !s.showNotifications }));
    },
    // Closing the panel counts as having seen what was in it, so the home prompt goes away.
    closeNotifications: () => {
      notificationService.markAllAsRead();
      patch((s) => ({
        showNotifications: false,
        notifications: s.notifications.map((n) => (n.read ? n : { ...n, read: true })),
      }));
    },
    dismissNotification: (id: string) => {
      hapticFeedback.selection();
      patch((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }));
    },
    markNotificationAsRead: (id: string) => {
      notificationService.markAsRead(id);
      patch((s) => ({
        notifications: s.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
      }));
    },
    markAllNotificationsAsRead: () => {
      hapticFeedback.selection();
      notificationService.markAllAsRead();
      patch((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, read: true })),
      }));
      showToast('All notifications marked as read');
    },
    clearAllNotifications: () => {
      hapticFeedback.selection();
      patch({ notifications: [] });
      showToast('Notifications cleared');
    },
    addNotification: (notif: Partial<Notification>) => {
      const newNotif: Notification = {
        id: notif.id || `notif-${Date.now()}`,
        type: notif.type || 'system',
        emoji: notif.emoji || '🔔',
        tint: notif.tint || '#e0f2fe',
        categoryLabel: notif.categoryLabel || 'System Notification',
        title: notif.title || 'Notification',
        desc: notif.desc || '',
        time: notif.time || 'Just now',
        read: false,
        actionLabel: notif.actionLabel,
        targetTab: notif.targetTab,
        targetModal: notif.targetModal,
        targetId: notif.targetId,
      };
      hapticFeedback.success();
      patch((s) => ({
        notifications: [newNotif, ...s.notifications],
      }));
    },
    handleNotificationAction: (notif: Notification) => {
      hapticFeedback.selection();
      patch((s) => ({
        showNotifications: false,
        notifications: s.notifications.map((n) =>
          n.id === notif.id ? { ...n, read: true } : n
        ),
      }));

      if (notif.targetTab) {
        actions.setTab(notif.targetTab);
      }

      if (notif.targetTab === 'records' && notif.targetId) {
        patch({ recordDetailId: notif.targetId });
      } else if (notif.targetModal === 'proxyLog') {
        patch({ showProxyLog: true });
      } else if (notif.targetModal === 'activity') {
        patch({ showActivity: true });
      } else if (notif.targetModal === 'billing') {
        patch({ showBilling: true });
      } else if (notif.targetModal === 'emergency') {
        patch({ showEmergency: true });
      } else if (notif.targetModal === 'linkedAccounts') {
        patch({ showLinkedAccounts: true });
      } else if (notif.targetModal === 'family') {
        patch({ showFamilyAccess: true });
      } else if (notif.targetModal === 'visits') {
        actions.openUpcomingVisits();
      } else if (notif.targetModal === 'pharmacyOrders') {
        actions.openPharmacyOrders({ orderId: notif.targetId });
      }
    },

    toggleDarkMode: () => {
      hapticFeedback.selection();
      setState((s) => {
        const darkMode = !s.darkMode;
        storage.setItem('welli_dark_mode', darkMode ? '1' : '0').catch(() => {});
        return { ...s, darkMode };
      });
    },

    toggleFaceId: async () => {
      hapticFeedback.selection();
      const current = state.faceIdEnabled;
      if (!current) {
        const status = await getBiometricStatus();
        if (!status.isAvailable && status.biometryType === 'none') {
          showToast(`${status.label || 'Biometric authentication'} is not available on this device`);
          return;
        }
        const auth = await authenticateWithBiometrics('Enable Biometric Lock for WelliRecord');
        if (auth.success) {
          await storage.setItem('welli_face_id', '1');
          patch({ faceIdEnabled: true });
          showToast(`${status.label || 'Biometric Lock'} enabled`);
        } else {
          showToast('Biometric authentication cancelled');
        }
      } else {
        await storage.setItem('welli_face_id', '0');
        patch({ faceIdEnabled: false, showLockScreen: false });
        showToast('Biometric Lock disabled');
      }
    },
    unlockWithFaceId: () => {
      hapticFeedback.success();
      markActivity();
      patch({ showLockScreen: false });
    },

    openHealthHistory: () => patch({ showHealthHistory: true }),
    closeHealthHistory: () => patch({ showHealthHistory: false }),
    // From Health history into the edit form for allergies and conditions.
    editHealthInfo: () => {
      const m = state.familyMembers.find((f) => f.id === state.activeFamilyId) ?? state.familyMembers[0];
      patch({ showHealthHistory: false, showPersonalInfo: true, personalInfoEditMode: true, personalInfoDraft: { ...m } });
    },
    openRecordFromHistory: (id: string) => patch({ showHealthHistory: false, recordDetailId: id }),
    openActivity: () => patch({ showActivity: true }),
    closeActivity: () => patch({ showActivity: false }),
    openLanguage: () => patch({ showLanguage: true }),
    closeLanguage: () => patch({ showLanguage: false }),
    setLanguage: (l: string) => {
      patch({ language: l, showLanguage: false });
      showToast(`Language set to ${l}`);
    },

    shareThisRecord: (recordId: string | null) => {
      patch({ recordDetailId: null });
      actions.openShareFlow(recordId ?? undefined);
    },
    openWelcomeHome: (tab: WelcomeTab = 'about') =>
      patch({ showWelcomeHome: true, welcomeTab: tab }),
    closeWelcomeHome: () => patch({ showWelcomeHome: false }),
    setWelcomeTab: (tab: WelcomeTab) => patch({ welcomeTab: tab }),

    sendAuthOtp: async (
      identifier: string,
      explicitChannel?: 'phone' | 'email',
      fullName?: string,
      mode: 'login' | 'signup' = 'signup'
    ) => {
      hapticFeedback.light();
      const res = await authService.sendAuthOtp(
        identifier,
        explicitChannel,
        fullName,
        mode,
      );

      const minutes = Math.max(
        1,
        Math.ceil((res?.expiresInSeconds || 300) / 60),
      );

      const securityNotif: Notification = {
        id: `sec_${Date.now()}`,
        emoji: '🔐',
        tint: '#0284c7',
        title: 'WelliRecord Security Alert',
        desc: `A 6-digit authorization code was dispatched to ${identifier}. Valid for about ${minutes} minute${minutes === 1 ? '' : 's'}.`,
        time: 'Just now',
      };

      patch((s) => ({
        notifications: [securityNotif, ...s.notifications],
      }));
      showToast(`Verification code dispatched to ${identifier}`);
      return res;
    },

    verifyOtpOnly: async (
      identifier: string,
      code: string,
      challengeToken?: string,
      registration?: { state?: string; lga?: string },
    ) => {
      hapticFeedback.success();
      return authService.verifyOtpOnly(identifier, code, challengeToken, registration);
    },

    preparePasswordSignIn: async (
      identifier: string,
      password?: string,
    ) => {
      hapticFeedback.light();

      const trimmed = identifier.trim();
      const session = await authService.loginWithPassword(
        trimmed,
        password,
        { persist: false },
      );

      const serverChannel = String(session.channel || '').toLowerCase();
      const channel: 'email' | 'phone' =
        serverChannel === 'sms' || serverChannel === 'phone'
          ? 'phone'
          : serverChannel === 'email'
          ? 'email'
          : trimmed.includes('@')
          ? 'email'
          : 'phone';

      const otpIdentifier =
        channel === 'email'
          ? session.user.email || (trimmed.includes('@') ? trimmed : '')
          : session.user.phoneNumber || (!trimmed.includes('@') ? trimmed : '');

      if (!otpIdentifier) {
        throw new Error(
          channel === 'email'
            ? 'No verified email address is available for this account.'
            : 'No verified phone number is available for this account.',
        );
      }

      // Some backends dispatch the second factor during /auth/login and return
      // requiresOtp/challengeToken. If they did not, dispatch the login OTP here.
      if (!session.requiresOtp) {
        await actions.sendAuthOtp(
          otpIdentifier,
          channel,
          session.user.fullName,
          'login',
        );
      } else {
        showToast(`Verification code sent to ${otpIdentifier}`);
      }

      return {
        session,
        identifier: otpIdentifier,
        channel,
      };
    },

    verifyPendingAuthOtp: async (
      identifier: string,
      code: string,
      pendingSession?: AuthSession | null,
    ) => {
      hapticFeedback.success();

      const verified = await resolveMfa(
        await authService.verifyAuthOtp(
          identifier,
          code,
          undefined,
          {
            persist: false,
            challengeToken: pendingSession?.challengeToken,
          },
        ),
      );

      if (verified.token) {
        return {
          ...pendingSession,
          ...verified,
          user: {
            ...(pendingSession?.user || {}),
            ...verified.user,
          },
        } as AuthSession;
      }

      if (pendingSession?.token) {
        return pendingSession;
      }

      throw new Error(
        'The verification code was accepted, but no authenticated session was returned.',
      );
    },

    prepareSignUpWithData: async (data: SignUpFormData) => {
      hapticFeedback.success();
      return authService.registerUser(data, { persist: false });
    },

    completeAuthSession: async (
      session: AuthSession,
      options?: {
        mode?: 'login' | 'signup';
        profile?: AuthProfileSeed;
      },
    ) =>
      commitAuthenticatedSession(
        session,
        options?.profile,
        options?.mode || 'login',
      ),

    // Legacy helper retained for screens that still call it. It now starts the
    // password + OTP flow instead of marking the app authenticated immediately.
    signInWithCredentials: async (
      identifier: string,
      password?: string,
    ) => actions.preparePasswordSignIn(identifier, password),

    // Legacy OTP helper retained for compatibility. New AuthFlow uses
    // verifyPendingAuthOtp so it can show SuccessfulLoginScreen before commit.
    verifyAuthOtp: async (
      identifier: string,
      code: string,
      userData?: {
        name?: string;
        email?: string;
        phone?: string;
        dob?: string;
        bloodType?: string;
        genotype?: string;
        insuranceProvider?: string;
        insuranceId?: string;
      }
    ) => {
      const session = await resolveMfa(await authService.verifyAuthOtp(
        identifier,
        code,
        userData
          ? {
              fullName: userData.name,
              email: userData.email,
              phoneNumber: userData.phone,
              dateOfBirth: userData.dob,
              bloodType: userData.bloodType,
              genotype: userData.genotype,
              hmoProvider: userData.insuranceProvider,
              hmoPolicyNumber: userData.insuranceId,
            }
          : undefined,
        { persist: false },
      ));

      return commitAuthenticatedSession(
        session,
        userData,
        'login',
      );
    },

    signInWithClerk: async (details?: SocialDetails, stateName?: string) => {
      if (!details?.email) {
        showToast(
          'Could not complete sign-in — no email returned. Please try again.',
        );
        return;
      }

      hapticFeedback.success();

      try {
        if (!details.clerkToken) {
          showToast('Could not verify your sign-in. Please try again.');
          return;
        }
        const first = await authService.verifySocialAuth({
          provider: details.provider,
          email: details.email,
          fullName: details.fullName,
          clerkToken: details.clerkToken,
          state: stateName,
        });
        patch({ socialState: null });
        const session = await resolveMfa(first);
        if (session !== first) await authService.saveSession(session);

        await commitAuthenticatedSession(
          session,
          {
            name: details.fullName,
            email: details.email,
            avatarUrl: details.avatar,
          },
          'login',
        );
      } catch (err: any) {
        // A new Google or Apple account needs a state first. Ask for it, then try again.
        if (err?.data?.code === 'state_required') {
          patch({ socialState: { details, busy: false, error: stateName ? 'Select your state to continue.' : null } });
          return;
        }
        patch({ socialState: null });
        showToast(err?.message || 'Sign-in failed. Please try again.');
        throw err;
      }
    },

    submitSocialState: async (stateName: string) => {
      const pending = state.socialState;
      if (!pending || pending.busy || !stateName) return;
      patch({ socialState: { ...pending, busy: true, error: null } });
      try {
        await actions.signInWithClerk(pending.details, stateName);
      } catch {
        /* signInWithClerk already showed the reason */
      }
    },

    cancelSocialState: () => patch({ socialState: null }),

    // Kept for older callers. The active Figma AuthFlow performs email/phone
    // verification before calling prepareSignUpWithData + completeAuthSession.
    signUpWithData: async (data: SignUpFormData) => {
      const session = await authService.registerUser(data, { persist: false });
      return commitAuthenticatedSession(session, data as any, 'signup');
    },

    addRecord: (rec: Omit<HealthRecord, 'id'> & { fileIds?: string[] }) => {
      hapticFeedback.success();
      const { fileIds: _fileIds, ...shown } = rec;
      const newRec: HealthRecord = {
        id: `r_${Date.now()}`,
        ...shown,
      };
      patch((s) => ({
        recordsList: [newRec, ...s.recordsList],
        uploadStep: 2,
      }));
      // Save to the account. If the phone is offline or the call fails, the service keeps it in
      // the sync queue and sends it later, so the record is not lost.
      recordsService
        .createRecord(rec)
        .then((saved) => {
          if (saved?.id && saved.id !== newRec.id) {
            patch((s) => ({ recordsList: s.recordsList.map((r) => (r.id === newRec.id ? { ...r, id: saved.id } : r)) }));
          }
        })
        .catch((err) => reportError(err, { where: 'records.create' }));
      showToast(`Added "${rec.title}" to ${rec.ownerId === 'me' ? 'your vault' : 'family vault'}`);
    },

    deleteRecord: (id: string) => {
      hapticFeedback.light();
      const target = state.recordsList.find((r) => r.id === id);
      // Locally added records have a temporary id until the server confirms them.
      if (/^[a-f0-9]{24}$/i.test(id)) {
        recordsService.deleteRecord(id, target?.ownerId || 'me').catch((err) => reportError(err, { where: 'records.delete' }));
      }
      patch((s) => ({
        recordsList: s.recordsList.filter((r) => r.id !== id),
        recordDetailId: null,
      }));
      showToast('Record removed from vault');
    },

    toggleImmunization: (id: string) => {
      hapticFeedback.selection();
      patch((s) => ({
        immunizationSchedule: s.immunizationSchedule.map((item) => {
          if (item.id === id) {
            const nextStatus = item.status === 'completed' ? 'due' : 'completed';
            return {
              ...item,
              status: nextStatus,
              completedDate: nextStatus === 'completed' ? 'Today' : undefined,
            };
          }
          return item;
        }),
      }));
    },

    addVitalLog: (entry: Omit<VitalLogEntry, 'id'>) => {
      hapticFeedback.success();
      const newVital: VitalLogEntry = {
        id: `v_${Date.now()}`,
        ...entry,
      };
      patch((s) => ({
        vitalsLogs: [newVital, ...s.vitalsLogs],
      }));
      showToast(`Logged vital: ${entry.primaryValue} ${entry.unit}`);
    },

    revokeActiveShare: (id: string) => {
      hapticFeedback.warning();
      patch((s) => ({
        activeShares: s.activeShares.filter((share) => share.id !== id),
      }));
      showToast('Access revoked immediately');
    },


    openRefillModal: (prescriptionId: string) => {
      hapticFeedback.light();
      patch({ showRefillModal: prescriptionId, recordDetailId: null });
    },
    closeRefillModal: () => patch({ showRefillModal: null }),
    openOrderMedication: () => {
      hapticFeedback.light();
      patch({ showOrderMedication: true });
    },
    closeOrderMedication: () => patch({ showOrderMedication: false }),
    openMedicationReminder: () => {
      hapticFeedback.light();
      patch({ showMedicationReminder: true });
    },
    closeMedicationReminder: () => patch({ showMedicationReminder: false }),
    openPharmacyDirectory: () => {
      hapticFeedback.light();
      patch({ showPharmacyDirectory: true });
    },
    closePharmacyDirectory: () => patch({ showPharmacyDirectory: false }),
    openOrderTracking: () => {
      hapticFeedback.light();
      patch({ showOrderTracking: true });
    },
    closeOrderTracking: () => patch({ showOrderTracking: false }),
    openVitalsTrends: () => {
      hapticFeedback.light();
      patch({ showVitalsTrends: true });
    },
    closeVitalsTrends: () => patch({ showVitalsTrends: false }),
    openLabDirectory: () => {
      hapticFeedback.light();
      patch({ showLabDirectory: true });
    },
    closeLabDirectory: () => patch({ showLabDirectory: false }),
    openCareLocator: () => {
      hapticFeedback.light();
      patch({ showCareLocator: true });
    },
    closeCareLocator: () => patch({ showCareLocator: false }),

    requestRefill: async (data: { prescriptionId: string; deliveryAddress: string; notes?: string }) => {
      try {
        await pharmacyService.requestRefill(data);
        hapticFeedback.success();
        patch({ showRefillModal: null });
        showToast('Refill sent for pharmacist review');
        return true;
      } catch (err: any) {
        showToast(err?.message || 'Could not send the refill request. Try again.');
        return false;
      }
    },

    logOut: async () => {
      hapticFeedback.light();
      await authService.logout();
      setAuthToken(null);
      await clearChildOfflineData();
      patch({
        familyLoadError: null,
        isAuthenticated: false,
        user: null,
        loggedOut: false,
        showWelcomeHome: false,
        familyMembers: [DEFAULT_PRIMARY_USER],
        recordsList: [],
        prescriptions: [],
        vitalsLogs: [],
        vitalsSeries: [],
        tab: 'home',
        tabHistory: [],
      });
      showToast('Logged out of vault');
    },
    // Called by the inactivity timer. It never signs the person out: the session lasts until they sign out
    // or the server token expires. With the biometric lock on, the lock screen covers the app; with it off,
    // nothing happens.
    idleLock: () => {
      if (!state.faceIdEnabled) return;
      patch({ showLockScreen: true });
    },
    logBackIn: () => {
      hapticFeedback.selection();
      patch({
        isAuthenticated: false,
        user: null,
        loggedOut: false,
        showWelcomeHome: false,
        welcomeTab: 'signin',
        tab: 'home',
        tabHistory: [],
      });
    },
  };

  return {
    state,
    actions,
    records: state.recordsList,
    prescriptions: state.prescriptions,
    immunizations: state.immunizationSchedule,
    vitalsLogs: state.vitalsLogs,
    family: state.familyMembers,
    doctors: [],
    proxyLog: [],
    activityLog: [],
    onboardingSlides: ONBOARDING,
    linkedAccountDefs: LINKED_ACCOUNTS,
    consentScopes: CONSENT_SCOPES,
    facilities: state.facilitiesList ?? [],
  };
}

export type WelliApp = ReturnType<typeof useWelliApp>;


