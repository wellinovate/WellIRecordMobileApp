import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  CONSENT_SCOPES,
  DOCTORS,
  FACILITIES,
  INITIAL_NOTIFICATIONS,
  LINKED_ACCOUNTS,
  ONBOARDING,
} from '../data/mockData';
import type {
  ActiveShare,
  ConsentGranteeType,
  FamilyMember,
  HealthRecord,
  ImmunizationMilestone,
  Invoice,
  Notification,
  PrescriptionItem,
  RecordType,
  ShareExpiry,
  ShareMethod,
  SignUpFormData,
  Tab,
  VitalLogEntry,
  WelcomeTab,
} from '../data/types';
import { bridgeLinkFor, generateBridgeCode } from '../utils/bridgeCode';
import { EXPIRY_SHORT_LABEL_MAP } from '../utils/expiry';
import { hapticFeedback } from '../utils/haptics';
import { storage } from '../utils/storage';
import { authenticateWithBiometrics, getBiometricStatus } from '../utils/biometrics';
import { authService, type AuthSession } from '../services/authService';
import { apiClient, setAuthToken } from '../services/apiClient';
import { recordsService } from '../services/recordsService';
import { profileService } from '../services/profileService';
import { familyService } from '../services/familyService';
import { facilityService } from '../services/facilityService';
import { sharingService } from '../services/sharingService';
import type { CareFacility } from '../data/types';

export interface AppState {
  tab: Tab;
  tabHistory: Tab[];
  activeFamilyId: string;
  familyMembers: FamilyMember[];
  recordsList: HealthRecord[];
  immunizationSchedule: ImmunizationMilestone[];
  vitalsLogs: VitalLogEntry[];
  recordFilter: RecordType | 'All';
  recordQuery: string;
  recordDetailId: string | null;
  showUpload: boolean;
  uploadStep: 0 | 1 | 2;
  showShareFlow: boolean;
  shareStep: 0 | 1 | 2 | 3 | 4;
  shareSelected: Record<string, boolean>;
  shareMethod: ShareMethod;
  shareDoctorQuery: string;
  shareSelectedDoctorId: string | null;
  bridgeCode: string | null;
  shareExpiry: ShareExpiry;
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
  bookingDate: string;
  bookingTimeSlot: string;
  showBilling: boolean;
  invoices: Invoice[];
  showInvoiceDetail: string | null;
  showPrintLabResult: string | null;
  showEmailLabResult: string | null;
  prescriptions: PrescriptionItem[];
  showRefillModal: string | null;
  showOrderMedication: boolean;
  inCall: boolean;
  callMuted: boolean;
  callCameraOff: boolean;
  callDurationSec: number;
  showOnboarding: boolean;
  onboardingStep: number;
  showNotifications: boolean;
  notifications: Notification[];
  darkMode: boolean;
  faceIdEnabled: boolean;
  showLockScreen: boolean;
  showActivity: boolean;
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

const DEFAULT_PRIMARY_USER: FamilyMember = {
  id: 'me',
  name: 'You',
  initials: 'U',
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
  wrId: '',
  memberId: '',
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
  recordFilter: 'All',
  recordQuery: '',
  recordDetailId: null,
  showUpload: false,
  uploadStep: 0,
  showVaultExport: false,
  showShareFlow: false,
  shareStep: 0,
  shareSelected: {},
  shareMethod: 'search',
  shareDoctorQuery: '',
  shareSelectedDoctorId: null,
  bridgeCode: null,
  shareExpiry: '24h',
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
  bookingDate: '',
  bookingTimeSlot: '',
  showBilling: false,
  invoices: [],
  showInvoiceDetail: null,
  showPrintLabResult: null,
  showEmailLabResult: null,
  prescriptions: [],
  showRefillModal: null,
  showOrderMedication: false,
  inCall: false,
  callMuted: false,
  callCameraOff: false,
  callDurationSec: 0,
  showOnboarding: false,
  onboardingStep: 0,
  showNotifications: false,
  notifications: INITIAL_NOTIFICATIONS,
  darkMode: false,
  faceIdEnabled: false,
  showLockScreen: false,
  showActivity: false,
  showLanguage: false,
  language: 'English',
  notifPermission: null,
  facilitiesList: FACILITIES,
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

  const patch = (updater: Updater) => {
    setState((prev) => ({ ...prev, ...(typeof updater === 'function' ? updater(prev) : updater) }));
  };

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

          // Fetch genuine health records for active user
          try {
            const remoteRecords = await recordsService.fetchRecords('me');
            if (Array.isArray(remoteRecords) && remoteRecords.length > 0) {
              patch({ recordsList: remoteRecords });
            }
          } catch {
            // Keep clean empty state
          }

          // Fetch genuine dependents & family members from cloud
          try {
            const remoteFamily = await familyService.fetchFamilyMembers();
            if (Array.isArray(remoteFamily) && remoteFamily.length > 0) {
              patch((s) => ({
                familyMembers: [
                  s.familyMembers[0], // primary user
                  ...remoteFamily.map((m: any) => ({
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
                    address: m.address || '',
                    insuranceProvider: m.insuranceProvider || '',
                    insuranceId: m.insuranceId || '',
                  })),
                ],
              }));
            }
          } catch {
            // Keep local primary user
          }
        } else {
          // No valid session: ensure logged out state and show sign-in screen
          patch({
            isAuthenticated: false,
            user: null,
            loggedOut: false,
            showWelcomeHome: true,
            welcomeTab: 'signin',
            familyMembers: [DEFAULT_PRIMARY_USER],
            recordsList: [],
            vitalsLogs: [],
          });
        }

        // Fetch healthcare provider & facilities directory from backend
        facilityService.fetchFacilities().then((remoteFacilities) => {
          if (Array.isArray(remoteFacilities) && remoteFacilities.length > 0) {
            patch({ facilitiesList: remoteFacilities });
          }
        }).catch(() => {});
      } catch {
        // ignore corrupt local storage
      }
    })();
  }, []);

  useEffect(() => {
    if (!state.inCall) return;
    const id = setInterval(() => {
      patch((s) => ({ callDurationSec: s.callDurationSec + 1 }));
    }, 1000);
    return () => clearInterval(id);
  }, [state.inCall]);

  const persistShares = (shares: ActiveShare[]) => {
    storage.setItem('welli_active_shares', JSON.stringify(shares)).catch(() => {});
  };

  const showToast = (msg: string) => {
    hapticFeedback.light();
    if (toastTimer.current) clearTimeout(toastTimer.current);
    patch({ toast: msg });
    toastTimer.current = setTimeout(() => patch({ toast: null }), 2200);
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
    startScan: () => {
      patch({ uploadStep: 1 });
      setTimeout(() => {
        patch({ uploadStep: 2 });
        uploadedToastPending.current = true;
      }, 1800);
    },

    openShareFlow: (prefillId?: string) => {
      const sel: Record<string, boolean> = {};
      if (prefillId) sel[prefillId] = true;
      patch({
        showShareFlow: true,
        shareStep: 0,
        shareSelected: sel,
        shareMethod: 'search',
        shareDoctorQuery: '',
        shareSelectedDoctorId: null,
        bridgeCode: null,
        shareExpiry: '24h',
      });
    },
    closeShareFlow: () => patch({ showShareFlow: false }),
    shareBack: () => {
      setState((s) => {
        if (s.shareStep === 0) {
          return { ...s, showShareFlow: false };
        }
        return { ...s, shareStep: Math.max(0, s.shareStep - 1) as AppState['shareStep'] };
      });
    },
    shareNext: () => {
      setState((s) => {
        const valid = [
          Object.values(s.shareSelected).filter(Boolean).length > 0,
          !!s.shareSelectedDoctorId,
          true,
          true,
          true,
        ][s.shareStep];
        if (!valid) return s;
        if (s.shareStep === 3) {
          let doc: { id: string; name: string; initials: string };
          if (s.shareSelectedDoctorId === 'bridge') {
            doc = { id: 'bridge', name: `WelliBridge Link · ${s.bridgeCode}`, initials: 'WB' };
          } else {
            const foundDoc = DOCTORS.find((d) => d.id === s.shareSelectedDoctorId);
            const foundFac = FACILITIES.find((f) => f.id === s.shareSelectedDoctorId);
            if (foundDoc) {
              doc = foundDoc;
            } else if (foundFac) {
              const inits = foundFac.name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'HC';
              doc = { id: foundFac.id, name: foundFac.name, initials: inits };
            } else {
              doc = { id: s.shareSelectedDoctorId || 'org', name: 'Healthcare Provider', initials: 'HP' };
            }
          }
          const count = Object.values(s.shareSelected).filter(Boolean).length;
          const newShare: ActiveShare = {
            id: 's' + Date.now(),
            doctorId: doc.id,
            doctorName: doc.name,
            initials: doc.initials,
            recordCount: count,
            expiresLabel: EXPIRY_SHORT_LABEL_MAP[s.shareExpiry],
            ownerId: s.activeFamilyId,
          };
          const activeShares = [newShare, ...s.activeShares];
          persistShares(activeShares);
          return { ...s, activeShares, shareStep: 4 };
        }
        if (s.shareStep === 4) {
          return { ...s, showShareFlow: false };
        }
        return { ...s, shareStep: Math.min(4, s.shareStep + 1) as AppState['shareStep'] };
      });
    },
    toggleShareRecord: (id: string) =>
      patch((s) => ({ shareSelected: { ...s.shareSelected, [id]: !s.shareSelected[id] } })),
    setMethod: (m: ShareMethod) => {
      setState((s) => {
        if (m !== 'bridge') return { ...s, shareMethod: m };
        const bridgeCode = s.bridgeCode ?? generateBridgeCode();
        return { ...s, shareMethod: m, bridgeCode, shareSelectedDoctorId: 'bridge' };
      });
    },
    setDoctorQuery: (value: string) => patch({ shareDoctorQuery: value }),
    selectDoctor: (id: string) => patch({ shareSelectedDoctorId: id }),
    shareWithFacility: (facilityId: string) => {
      hapticFeedback.light();
      const owned = state.recordsList.filter((r) => r.ownerId === state.activeFamilyId);
      const selected: Record<string, boolean> = {};
      owned.forEach((r) => {
        selected[r.id] = true;
      });
      patch({
        showShareFlow: true,
        shareStep: 1,
        shareSelected: selected,
        shareMethod: 'search',
        shareSelectedDoctorId: facilityId,
      });
      showToast('Facility pre-selected for clinical vault share');
    },
    copyBridgeLink: () => {
      const code = state.bridgeCode;
      if (!code) return;
      const link = `https://${bridgeLinkFor(code)}`;
      Clipboard.setStringAsync(link).catch(() => {});
      showToast('Link copied');
    },
    setExpiry: (v: ShareExpiry) => patch({ shareExpiry: v }),
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
        showToast("Enter the provider's WelliRecord ID (e.g. WR-1234-ABCD)");
        return;
      }
      const isIndividual = state.consentGranteeType === 'individual';
      if (isIndividual && !/^WR-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(providerWrId)) {
        showToast('WelliRecord ID must be in the format WR-XXXX-XXXX');
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
                ...remoteFamily.map((m: any) => ({
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
                  address: m.address || '',
                  insuranceProvider: m.insuranceProvider || '',
                  insuranceId: m.insuranceId || '',
                })),
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
    setAvatar: (memberId: string, dataUrl: string, sizeBytes: number) => {
      if (sizeBytes > 5 * 1024 * 1024) {
        showToast('Photo is too large — choose one under 5MB');
        return;
      }
      patch((s) => ({
        familyMembers: s.familyMembers.map((f) => (f.id === memberId ? { ...f, avatarUrl: dataUrl } : f)),
        personalInfoDraft: s.personalInfoDraft && s.personalInfoDraft.id === memberId ? { ...s.personalInfoDraft, avatarUrl: dataUrl } : s.personalInfoDraft,
      }));
      showToast('Profile photo updated');
    },
    removeAvatar: (memberId: string) => {
      patch((s) => ({
        familyMembers: s.familyMembers.map((f) => (f.id === memberId ? { ...f, avatarUrl: undefined } : f)),
        personalInfoDraft:
          s.personalInfoDraft && s.personalInfoDraft.id === memberId ? { ...s.personalInfoDraft, avatarUrl: undefined } : s.personalInfoDraft,
      }));
      showToast('Profile photo removed');
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
        'Delete Account & Erasure Request',
        'In compliance with Nigeria Data Protection Regulation (NDPR) Right to Erasure, deleting your account permanently purges all health records, family vault data, and cryptographic keys.\n\nTo request permanent erasure, you can email our Data Protection Officer or wipe this device session now.',
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
            text: 'Wipe & Sign Out',
            style: 'destructive',
            onPress: async () => {
              try {
                await authService.deleteAccount();
              } catch {}
              patch({
                isAuthenticated: false,
                user: null,
                loggedOut: true,
                showPrivacySecurity: false,
                familyMembers: [DEFAULT_PRIMARY_USER],
                recordsList: [],
                vitalsLogs: [],
                twoFactorEnabled: false,
                faceIdEnabled: false,
              });
              showToast('Account session and cached vault data cleared');
            },
          },
        ]
      );
    },
    deleteAccount: async () => {
      try {
        await authService.deleteAccount();
      } catch {}
      patch({
        isAuthenticated: false,
        user: null,
        loggedOut: true,
        showPrivacySecurity: false,
        familyMembers: [DEFAULT_PRIMARY_USER],
        recordsList: [],
        vitalsLogs: [],
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
    joinCall: () => {
      // No real video/telehealth backend exists yet on mobile either. This
      // used to flip into a fake call screen with a hardcoded doctor and
      // patient name. Match the web app's approach: don't enter a call
      // screen that looks live when nothing real is happening.
      showToast('Video telehealth is coming soon — not yet available');
    },
    endCall: () => {
      patch({ inCall: false });
      showToast('Call ended');
    },
    syncTelehealthVisit: (data: {
      doctorName: string;
      diagnosis: string;
      notes: string;
      prescriptionName?: string;
      dosage?: string;
    }) => {
      hapticFeedback.success();
      const newRecordId = `r_${Date.now()}`;
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

      const newRecord: HealthRecord = {
        id: newRecordId,
        ownerId: state.activeFamilyId,
        title: `Telehealth Summary · ${data.doctorName}`,
        date: dateStr,
        type: 'Clinical Note',
        provider: `${data.doctorName} · WelliCare Virtual Care`,
        summary: `Diagnosis: ${data.diagnosis}. ${data.notes}`,
        extractedOcr: {
          keyValues: [
            { label: 'Consultant', value: data.doctorName },
            { label: 'Diagnosis', value: data.diagnosis },
            { label: 'Encounter Type', value: 'Telehealth Video Encounter' },
          ],
          statusBadge: 'Doctor Certified',
        },
      };

      let updatedRxList = state.prescriptions;
      if (data.prescriptionName) {
        const newRx: PrescriptionItem = {
          id: `rx_${Date.now()}`,
          ownerId: state.activeFamilyId,
          medicationName: data.prescriptionName,
          dosage: data.dosage || '1 tablet daily as prescribed',
          frequency: 'Daily · 10-Day Supply',
          prescriber: `${data.doctorName} · WelliCare Telehealth`,
          prescribedDate: dateStr,
          pharmacyProvider: 'MediTrust Pharmacy & Diagnostics · Lekki Phase 1',
          totalPriceNaira: 3500,
          hmoCoveredNaira: 2800,
          patientCoPayNaira: 700,
          refillsTotal: 2,
          refillsRemaining: 2,
          status: 'active',
          deliveryAddress: 'Block 12, Admiralty Way, Lekki Phase 1, Lagos',
          eta: 'Today via Express Dispatch',
          hmoProvider: 'Hygeia HMO (80% Tariff Co-Pay)',
          notes: `Prescribed during telehealth follow-up for ${data.diagnosis}.`,
        };
        updatedRxList = [newRx, ...state.prescriptions];
      }

      patch((s) => ({
        inCall: false,
        recordsList: [newRecord, ...s.recordsList],
        prescriptions: updatedRxList,
      }));

      showToast(
        data.prescriptionName
          ? 'Consultation note & new prescription saved to your vault'
          : 'Consultation note saved to your vault'
      );
    },
    toggleCallMute: () => patch((s) => ({ callMuted: !s.callMuted })),
    toggleCallCamera: () => patch((s) => ({ callCameraOff: !s.callCameraOff })),

    openBookAppointment: (facilityId: string) =>
      patch({ showBookAppointment: true, bookingFacilityId: facilityId, bookingDate: '', bookingTimeSlot: '' }),
    closeBookAppointment: () => patch({ showBookAppointment: false }),
    setBookingDate: (v: string) => patch({ bookingDate: v }),
    setBookingTimeSlot: (v: string) => patch({ bookingTimeSlot: v }),
    confirmBooking: () => {
      const facility = FACILITIES.find((f) => f.id === state.bookingFacilityId);
      if (!facility || !state.bookingDate || !state.bookingTimeSlot) {
        showToast('Choose a date and time to continue');
        return;
      }
      patch({ showBookAppointment: false });
      showToast(`Appointment requested with ${facility.name} — ${state.bookingTimeSlot}`);
    },

    openBilling: () => patch({ showBilling: true }),
    closeBilling: () => patch({ showBilling: false }),
    openInvoiceDetail: (id: string) => patch({ showInvoiceDetail: id }),
    closeInvoiceDetail: () => patch({ showInvoiceDetail: null }),
    markInvoicePaid: (id: string) => {
      patch((s) => ({ invoices: s.invoices.map((inv) => (inv.id === id ? { ...inv, status: 'paid' as const } : inv)) }));
      showToast('Invoice marked as paid');
    },

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
    closeNotifications: () => patch({ showNotifications: false }),
    dismissNotification: (id: string) => {
      hapticFeedback.selection();
      patch((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }));
    },
    markNotificationAsRead: (id: string) => {
      patch((s) => ({
        notifications: s.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
      }));
    },
    markAllNotificationsAsRead: () => {
      hapticFeedback.selection();
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
      patch({ showLockScreen: false });
    },

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
    downloadRecord: () => {
      hapticFeedback.success();
      showToast('Record saved to Files as PDF');
    },

    openPrintLabResult: (recordId: string) => {
      hapticFeedback.light();
      patch({ showPrintLabResult: recordId });
    },
    closePrintLabResult: () => patch({ showPrintLabResult: null }),

    openEmailLabResult: (recordId: string) => {
      hapticFeedback.light();
      patch({ showEmailLabResult: recordId });
    },
    closeEmailLabResult: () => patch({ showEmailLabResult: null }),

    sendEmailReport: (recordId: string, recipientEmail: string, _note?: string) => {
      hapticFeedback.success();
      patch({ showEmailLabResult: null });
      showToast(`Encrypted lab result PDF sent to ${recipientEmail}`);
    },

    shareViaWhatsApp: async (recordId: string) => {
      hapticFeedback.success();
      const record = state.recordsList.find((r) => r.id === recordId);
      if (!record) return;
      const owner = state.familyMembers.find((f) => f.id === record.ownerId) || state.familyMembers[0];
      const bridgeCode = state.bridgeCode || generateBridgeCode();

      let keyValuesText = '';
      if (record.extractedOcr?.keyValues) {
        keyValuesText = record.extractedOcr.keyValues
          .map((kv) => `• ${kv.label}: ${kv.value}`)
          .join('\n');
      }

      const message =
        `🏥 *WelliRecord Verified Health Result*\n\n` +
        `👤 *Patient:* ${owner.name}\n` +
        `📄 *Report:* ${record.title}\n` +
        `🏥 *Provider:* ${record.provider}\n` +
        `📅 *Date:* ${record.date}\n\n` +
        (keyValuesText ? `📊 *Key Biomarkers:*\n${keyValuesText}\n\n` : '') +
        `🔒 *Encrypted Patient-Authorized Access (Valid for 24h):*\n` +
        `https://${bridgeLinkFor(bridgeCode)}\n\n` +
        `_Encrypted with zero-knowledge keys · NDPR Compliant_`;

      try {
        await Clipboard.setStringAsync(message);
        const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
        const canOpen = await Linking.canOpenURL(whatsappUrl);
        if (canOpen) {
          await Linking.openURL(whatsappUrl);
          showToast('Opening WhatsApp & link copied');
        } else {
          await Share.share({
            message,
            title: record.title,
          });
          showToast('Result summary copied & shared');
        }
      } catch {
        showToast('Result link & summary copied to clipboard');
      }
    },

    openWelcomeHome: (tab: WelcomeTab = 'about') =>
      patch({ showWelcomeHome: true, welcomeTab: tab }),
    closeWelcomeHome: () => patch({ showWelcomeHome: false }),
    setWelcomeTab: (tab: WelcomeTab) => patch({ welcomeTab: tab }),

    signInWithDemo: (memberId = 'me') => {
      hapticFeedback.success();
      patch({
        loggedOut: false,
        showWelcomeHome: false,
        activeFamilyId: memberId,
        tab: 'home',
      });
      showToast('Welcome back to WelliRecord');
    },

    sendAuthOtp: async (
      identifier: string,
      explicitChannel?: 'phone' | 'email',
      fullName?: string,
      mode: 'login' | 'signup' = 'signup'
    ) => {
      hapticFeedback.light();
      const res = await authService.sendAuthOtp(identifier, explicitChannel, fullName, mode);
      
      // Dispatch in-app security notification (confirms dispatch without revealing code)
      const securityNotif: Notification = {
        id: `sec_${Date.now()}`,
        emoji: '🔐',
        tint: '#0284c7',
        title: 'WelliRecord Security Alert',
        desc: `A 6-digit authorization code was dispatched to ${identifier}. Valid for 5 minutes.`,
        time: 'Just now',
      };

      patch((s) => ({
        notifications: [securityNotif, ...s.notifications],
      }));
      showToast(`Verification code dispatched to ${identifier}`);
      return res;
    },

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
      hapticFeedback.success();
      const session = await authService.verifyAuthOtp(identifier, code, userData ? {
        fullName: userData.name,
        email: userData.email,
        phoneNumber: userData.phone,
        bloodType: userData.bloodType,
        genotype: userData.genotype,
        hmoProvider: userData.insuranceProvider,
        hmoPolicyNumber: userData.insuranceId,
      } : undefined);

      const rawName = session.user.fullName || userData?.name || '';
      const displayName = rawName || session.user.email || session.user.phoneNumber || 'User';
      const initials = rawName
        ? rawName
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0])
            .join('')
            .toUpperCase()
        : 'U';

      const needsProfileCompletion = !session.user.fullName || !session.user.dateOfBirth;

      const newOwner: FamilyMember = {
        id: 'me',
        name: rawName,
        initials,
        role: 'owner',
        dob: session.user.dateOfBirth || userData?.dob || '',
        gender: '',
        bloodType: session.user.bloodType || userData?.bloodType || '',
        genotype: session.user.genotype || userData?.genotype || '',
        height: '',
        weight: '',
        allergies: '',
        conditions: '',
        contact: formatEmergencyContact(session.user) || userData?.phone || '',
        emergencyContacts: (session.user as any).emergencyContacts || [],
        email: session.user.email || userData?.email || '',
        phone: session.user.phoneNumber || userData?.phone || '',
        address: '',
        insuranceProvider: session.user.hmoProvider || userData?.insuranceProvider || '',
        insuranceId: session.user.hmoPolicyNumber || userData?.insuranceId || '',
        wrId: session.user.wrId || session.user.memberId || '',
        memberId: session.user.wrId || session.user.memberId || '',
      };

      patch((s) => ({
        familyMembers: [newOwner, ...s.familyMembers.filter((f) => f.id !== 'me')],
        activeFamilyId: 'me',
        isAuthenticated: true,
        user: session.user,
        loggedOut: false,
        showWelcomeHome: false,
        tab: 'home',
        ...(needsProfileCompletion
          ? {
              showPersonalInfo: true,
              personalInfoEditMode: true,
              personalInfoDraft: { ...newOwner },
            }
          : {}),
      }));

      if (needsProfileCompletion) {
        showToast('Please complete your profile details');
      } else {
        showToast(`Welcome back, ${displayName.split(' ')[0]}!`);
      }

      // Fetch dependents in background
      familyService.fetchFamilyMembers().then((remoteFamily) => {
        if (Array.isArray(remoteFamily) && remoteFamily.length > 0) {
          patch((s) => ({
            familyMembers: [
              s.familyMembers[0],
              ...remoteFamily.map((m: any) => ({
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
                address: m.address || '',
                insuranceProvider: m.insuranceProvider || '',
                insuranceId: m.insuranceId || '',
              })),
            ],
          }));
        }
      }).catch(() => {});

      return session;
    },

    signInWithClerk: async (details?: { provider: 'google' | 'apple'; fullName?: string; email?: string; avatar?: string }) => {
      if (!details?.email) {
        showToast('Could not complete sign-in — no email returned. Please try again.');
        return;
      }
      hapticFeedback.success();
      try {
        const session = await authService.verifySocialAuth({
          provider: details.provider,
          email: details.email,
          fullName: details.fullName,
        });

        const rawName = session.user.fullName || details.fullName || '';
        const initials = rawName
          ? rawName.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
          : 'U';
        const needsProfileCompletion = !session.user.dateOfBirth;

        const newOwner: FamilyMember = {
          id: 'me',
          name: rawName,
          initials,
          role: 'owner',
          dob: session.user.dateOfBirth || '',
          gender: '',
          bloodType: session.user.bloodType || '',
          genotype: session.user.genotype || '',
          height: '',
          weight: '',
          allergies: '',
          conditions: '',
          contact: '',
          emergencyContacts: [],
          email: session.user.email || details.email,
          phone: session.user.phoneNumber || '',
          address: '',
          insuranceProvider: session.user.hmoProvider || '',
          insuranceId: session.user.hmoPolicyNumber || '',
          wrId: session.user.wrId || session.user.memberId || '',
          memberId: session.user.wrId || session.user.memberId || '',
          avatarUrl: details.avatar,
        };

        const providerLabel = details.provider === 'google' ? 'Google' : 'Apple';
        const securityNotif: Notification = {
          id: `clerk_auth_${Date.now()}`,
          emoji: '🔐',
          tint: '#0284c7',
          title: `Authenticated with ${providerLabel}`,
          desc: `Signed in to WelliRecord vault via verified ${providerLabel} account.`,
          time: 'Just now',
        };

        patch((s) => ({
          isAuthenticated: true,
          user: session.user,
          loggedOut: false,
          showWelcomeHome: false,
          showOnboarding: false,
          tab: 'home',
          activeFamilyId: 'me',
          familyMembers: [newOwner, ...s.familyMembers.filter((f) => f.id !== 'me')],
          notifications: [securityNotif, ...s.notifications],
          ...(needsProfileCompletion
            ? { showPersonalInfo: true, personalInfoEditMode: true, personalInfoDraft: { ...newOwner } }
            : {}),
        }));

        showToast(needsProfileCompletion
          ? `Welcome to WelliRecord, ${rawName.split(' ')[0] || 'there'}! Please complete your profile.`
          : `Welcome back, ${rawName.split(' ')[0] || 'there'}!`);

        // Fetch dependents in background, same as every other sign-in path
        familyService.fetchFamilyMembers().then((remoteFamily) => {
          if (Array.isArray(remoteFamily) && remoteFamily.length > 0) {
            patch((s) => ({
              familyMembers: [s.familyMembers[0], ...remoteFamily.map((m: any) => ({
                id: m.id || m._id, name: m.fullName || m.name, initials: m.initials,
                role: 'dependent' as const, relationship: m.relationship || 'Dependent',
                dob: m.dateOfBirth || m.dob || '', gender: m.gender || '', bloodType: m.bloodType || '',
                genotype: m.genotype || '', height: m.height || '', weight: m.weight || '',
                allergies: m.allergies || '', conditions: m.conditions || '',
                contact: formatEmergencyContact(m) || m.contact || '', emergencyContacts: m.emergencyContacts || [],
                email: m.email || '', phone: m.phone || '', address: m.address || '',
                insuranceProvider: m.insuranceProvider || '', insuranceId: m.insuranceId || '',
              }))],
            }));
          }
        }).catch(() => {});
      } catch (err: any) {
        showToast(err?.message || 'Sign-in failed. Please try again.');
      }
    },

    signInWithCredentials: async (identifier: string, password?: string) => {
      hapticFeedback.success();
      const trimmed = identifier.trim();
      const session = await authService.loginWithPassword(trimmed, password);
      
      patch((s) => ({
        isAuthenticated: true,
        user: session.user,
        loggedOut: false,
        showWelcomeHome: false,
        activeFamilyId: 'me',
        tab: 'home',
        familyMembers: s.familyMembers.map((f) =>
          f.id === 'me'
            ? {
                ...f,
                name: session.user.fullName || f.name,
                email: session.user.email || f.email,
                phone: session.user.phoneNumber || f.phone,
                bloodType: session.user.bloodType || f.bloodType,
                genotype: session.user.genotype || f.genotype,
                insuranceProvider: session.user.hmoProvider || f.insuranceProvider || '',
                insuranceId: session.user.hmoPolicyNumber || '',
                wrId: session.user.wrId || session.user.memberId || f.wrId || '',
                memberId: session.user.wrId || session.user.memberId || f.memberId || '',
                contact: formatEmergencyContact(session.user) || f.contact,
                emergencyContacts: (session.user as any).emergencyContacts || f.emergencyContacts || [],
              }
            : f
        ),
      }));

      // Fetch dependents in background
      familyService.fetchFamilyMembers().then((remoteFamily) => {
        if (Array.isArray(remoteFamily) && remoteFamily.length > 0) {
          patch((s) => ({
            familyMembers: [
              s.familyMembers[0],
              ...remoteFamily.map((m: any) => ({
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
                address: m.address || '',
                insuranceProvider: m.insuranceProvider || '',
                insuranceId: m.insuranceId || '',
              })),
            ],
          }));
        }
      }).catch(() => {});

      const userFirst = (session.user.fullName || 'User').split(' ')[0];
      showToast(`Welcome back, ${userFirst}!`);
    },

    signUpWithData: async (data: SignUpFormData) => {
      hapticFeedback.success();
      const session = await authService.registerUser(data);
      const initials = (session.user.fullName || data.name)
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase() || 'U';

      const newOwner: FamilyMember = {
        id: 'me',
        name: session.user.fullName || data.name.trim() || 'New User',
        initials,
        role: 'owner',
        dob: data.dob || '1990-01-01',
        gender: '—',
        bloodType: session.user.bloodType || data.bloodType || 'O+',
        genotype: session.user.genotype || data.genotype || 'AA',
        height: '—',
        weight: '—',
        allergies: 'None reported',
        conditions: 'None reported',
        contact: session.user.phoneNumber || data.phone || '+234 800 000 0000',
        email: session.user.email || data.email || 'user@example.com',
        phone: session.user.phoneNumber || data.phone || '+234 800 000 0000',
        address: 'Lagos, Nigeria',
        insuranceProvider: session.user.hmoProvider || data.insuranceProvider || 'Private Self-Pay',
        insuranceId: session.user.hmoPolicyNumber || data.insuranceId || `WELLI-${Math.floor(100000 + Math.random() * 900000)}`,
      };

      patch((s) => ({
        familyMembers: [newOwner, ...s.familyMembers.filter((f) => f.id !== 'me')],
        activeFamilyId: 'me',
        loggedOut: false,
        showWelcomeHome: false,
        tab: 'home',
      }));
      showToast(`Welcome to WelliRecord, ${newOwner.name.split(' ')[0]}!`);
    },

    addRecord: (rec: Omit<HealthRecord, 'id'>) => {
      hapticFeedback.success();
      const newRec: HealthRecord = {
        id: `r_${Date.now()}`,
        ...rec,
      };
      patch((s) => ({
        recordsList: [newRec, ...s.recordsList],
        uploadStep: 2,
      }));
      showToast(`Added "${rec.title}" to ${rec.ownerId === 'me' ? 'your vault' : 'family vault'}`);
    },

    deleteRecord: (id: string) => {
      hapticFeedback.light();
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

    payInvoice: (id: string) => {
      hapticFeedback.success();
      patch((s) => ({
        invoices: s.invoices.map((inv) =>
          inv.id === id ? { ...inv, status: 'paid' } : inv
        ),
      }));
      showToast('Invoice marked as reconciled and settled');
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

    requestRefill: (data: { prescriptionId: string; deliveryAddress: string; notes?: string }) => {
      hapticFeedback.success();
      patch((s) => ({
        prescriptions: s.prescriptions.map((rx) => {
          if (rx.id === data.prescriptionId) {
            return {
              ...rx,
              refillsRemaining: Math.max(0, rx.refillsRemaining - 1),
              status: 'refill_requested',
              deliveryAddress: data.deliveryAddress,
              notes: data.notes || rx.notes,
            };
          }
          return rx;
        }),
        showRefillModal: null,
      }));
      showToast('Prescription refill dispatched via HMO E-Pharmacy');
    },

    logOut: async () => {
      hapticFeedback.light();
      await authService.logout();
      setAuthToken(null);
      patch({
        isAuthenticated: false,
        user: null,
        loggedOut: true,
        showWelcomeHome: false,
        familyMembers: [DEFAULT_PRIMARY_USER],
        recordsList: [],
        vitalsLogs: [],
      });
      showToast('Logged out of vault');
    },
    logBackIn: () => {
      hapticFeedback.selection();
      patch({
        isAuthenticated: false,
        user: null,
        loggedOut: false,
        showWelcomeHome: true,
        welcomeTab: 'signin',
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
    doctors: DOCTORS,
    proxyLog: [],
    activityLog: [],
    onboardingSlides: ONBOARDING,
    linkedAccountDefs: LINKED_ACCOUNTS,
    consentScopes: CONSENT_SCOPES,
    facilities: state.facilitiesList && state.facilitiesList.length > 0 ? state.facilitiesList : FACILITIES,
  };
}

export type WelliApp = ReturnType<typeof useWelliApp>;
