import { useEffect, useRef, useState } from 'react';
import {
  ACTIVITY_LOG,
  CONSENT_SCOPES,
  DOCTORS,
  FAMILY,
  INITIAL_ACTIVE_SHARES,
  INITIAL_LINKED_ACCOUNTS,
  INITIAL_NOTIFICATIONS,
  LINKED_ACCOUNTS,
  ONBOARDING,
  PROXY_LOG,
  RECORDS,
} from '../data/mockData';
import type {
  ActiveShare,
  ConsentGranteeType,
  FamilyMember,
  Notification,
  RecordType,
  ShareExpiry,
  ShareMethod,
  Tab,
} from '../data/types';
import { bridgeLinkFor, generateBridgeCode } from '../utils/bridgeCode';
import { EXPIRY_SHORT_LABEL_MAP } from '../utils/expiry';

export interface AppState {
  tab: Tab;
  activeFamilyId: string;
  familyMembers: FamilyMember[];
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
  consentScope: string | null;
  consentAllowWrite: boolean;
  consentExpiry: ShareExpiry;
  consentPurpose: string;
  showFamilyAccess: boolean;
  showAddFamilyMember: boolean;
  newMemberName: string;
  newMemberRelationship: string;
  newMemberDob: string;
  newMemberBloodType: string;
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
  careCategory: string;
  careQuery: string;
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
  loggedOut: boolean;
  toast: string | null;
}

const initialState: AppState = {
  tab: 'home',
  activeFamilyId: 'me',
  familyMembers: FAMILY,
  recordFilter: 'All',
  recordQuery: '',
  recordDetailId: null,
  showUpload: false,
  uploadStep: 0,
  showShareFlow: false,
  shareStep: 0,
  shareSelected: {},
  shareMethod: 'search',
  shareDoctorQuery: '',
  shareSelectedDoctorId: null,
  bridgeCode: null,
  shareExpiry: '24h',
  activeShares: INITIAL_ACTIVE_SHARES,
  showSmartConsent: false,
  consentGranteeType: 'individual',
  consentProviderId: '',
  consentScope: null,
  consentAllowWrite: false,
  consentExpiry: '24h',
  consentPurpose: '',
  showFamilyAccess: false,
  showAddFamilyMember: false,
  newMemberName: '',
  newMemberRelationship: '',
  newMemberDob: '',
  newMemberBloodType: '',
  showProxyLog: false,
  showPersonalInfo: false,
  personalInfoEditMode: false,
  personalInfoDraft: null,
  showPrivacyPolicy: false,
  showPrivacySecurity: false,
  twoFactorEnabled: false,
  showLinkedAccounts: false,
  linkedAccounts: INITIAL_LINKED_ACCOUNTS,
  showNotificationSettings: false,
  notifyAccessExpiring: true,
  notifyAppointments: true,
  notifyNewRecords: true,
  notifyFamilyActivity: true,
  notifyEmailUpdates: false,
  showEmergency: false,
  careCategory: 'All',
  careQuery: '',
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
  loggedOut: false,
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
    try {
      const saved = JSON.parse(localStorage.getItem('welli_active_shares') || 'null');
      if (saved && Array.isArray(saved)) patch({ activeShares: saved });
      const dm = localStorage.getItem('welli_dark_mode');
      if (dm !== null) patch({ darkMode: dm === '1' });
    } catch {
      // ignore corrupt local storage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!state.inCall) return;
    const id = setInterval(() => {
      patch((s) => ({ callDurationSec: s.callDurationSec + 1 }));
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.inCall]);

  const persistShares = (shares: ActiveShare[]) => {
    try {
      localStorage.setItem('welli_active_shares', JSON.stringify(shares));
    } catch {
      // ignore write failures
    }
  };

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    patch({ toast: msg });
    toastTimer.current = setTimeout(() => patch({ toast: null }), 2200);
  };

  const actions = {
    setTab: (tab: Tab) => patch({ tab }),
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
          const doc =
            s.shareSelectedDoctorId === 'bridge'
              ? { id: 'bridge', name: `WelliBridge Link · ${s.bridgeCode}`, initials: 'WB' }
              : DOCTORS.find((d) => d.id === s.shareSelectedDoctorId)!;
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
    copyBridgeLink: () => {
      const code = state.bridgeCode;
      if (!code) return;
      const link = `https://${bridgeLinkFor(code)}`;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(link).catch(() => {});
      }
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
        consentScope: null,
        consentAllowWrite: false,
        consentExpiry: '24h',
        consentPurpose: '',
      }),
    closeSmartConsent: () => patch({ showSmartConsent: false }),
    setConsentGranteeType: (t: ConsentGranteeType) => patch({ consentGranteeType: t }),
    setConsentProviderId: (v: string) => patch({ consentProviderId: v }),
    setConsentScope: (v: string) => patch({ consentScope: v }),
    toggleConsentWrite: () => patch((s) => ({ consentAllowWrite: !s.consentAllowWrite })),
    setConsentExpiry: (v: ShareExpiry) => patch({ consentExpiry: v }),
    setConsentPurpose: (v: string) => patch({ consentPurpose: v }),
    grantSmartAccess: () => {
      const providerId = state.consentProviderId.trim();
      if (!providerId || !state.consentScope) {
        showToast('Enter a provider ID and choose an access scope');
        return;
      }
      const newShare: ActiveShare = {
        id: 's' + Date.now(),
        doctorId: 'consent-' + Date.now(),
        doctorName: providerId,
        initials: providerId.slice(0, 2).toUpperCase(),
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
    },

    openEmergency: () => patch({ showEmergency: true }),
    closeEmergency: () => patch({ showEmergency: false }),
    openFamilyAccess: () => patch({ showFamilyAccess: true }),
    closeFamilyAccess: () => patch({ showFamilyAccess: false }),
    openAddFamilyMember: () =>
      patch({ showAddFamilyMember: true, newMemberName: '', newMemberRelationship: '', newMemberDob: '', newMemberBloodType: '' }),
    closeAddFamilyMember: () => patch({ showAddFamilyMember: false }),
    setNewMemberName: (v: string) => patch({ newMemberName: v }),
    setNewMemberRelationship: (v: string) => patch({ newMemberRelationship: v }),
    setNewMemberDob: (v: string) => patch({ newMemberDob: v }),
    setNewMemberBloodType: (v: string) => patch({ newMemberBloodType: v }),
    addFamilyMember: () => {
      const name = state.newMemberName.trim();
      if (!name) {
        showToast('Enter a name for the family member');
        return;
      }
      const owner = state.familyMembers.find((f) => f.role === 'owner') ?? state.familyMembers[0];
      const initials = name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase();
      const dependentCount = state.familyMembers.filter((f) => f.role === 'dependent').length;
      const newMember: FamilyMember = {
        id: 'fam-' + Date.now(),
        name,
        initials: initials || '?',
        role: 'dependent',
        dob: state.newMemberDob.trim() || 'Not set',
        gender: '—',
        bloodType: state.newMemberBloodType.trim() || 'Unknown',
        height: '—',
        weight: '—',
        allergies: 'None on file',
        conditions: 'None on file',
        contact: `${owner.name} (${state.newMemberRelationship || 'Guardian'})`,
        email: '—',
        phone: '—',
        address: owner.address,
        insuranceProvider: `${owner.insuranceProvider} (dependent)`,
        insuranceId: `${owner.insuranceId}-D${dependentCount + 1}`,
      };
      patch((s) => ({
        familyMembers: [...s.familyMembers, newMember],
        activeFamilyId: newMember.id,
        showAddFamilyMember: false,
      }));
      showToast(`${name} added to your family`);
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
    savePersonalInfo: () => {
      const draft = state.personalInfoDraft;
      if (!draft) return;
      patch((s) => ({
        familyMembers: s.familyMembers.map((f) => (f.id === draft.id ? draft : f)),
        personalInfoEditMode: false,
        personalInfoDraft: null,
      }));
      showToast('Personal info updated');
    },
    openPrivacyPolicy: () => patch({ showPrivacyPolicy: true }),
    closePrivacyPolicy: () => patch({ showPrivacyPolicy: false }),
    openPrivacySecurity: () => patch({ showPrivacySecurity: true }),
    closePrivacySecurity: () => patch({ showPrivacySecurity: false }),
    toggleTwoFactor: () => {
      setState((s) => {
        const twoFactorEnabled = !s.twoFactorEnabled;
        if (twoFactorEnabled) showToast('Two-factor authentication enabled');
        return { ...s, twoFactorEnabled };
      });
    },
    downloadMyData: () => showToast("We'll email you a download link shortly"),
    requestAccountDeletion: () => showToast('Contact WelliRecord support to delete your account'),

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

    setCareCategory: (c: string) => patch({ careCategory: c }),
    setCareQuery: (value: string) => patch({ careQuery: value }),
    joinCall: () => patch({ inCall: true, callMuted: false, callCameraOff: false, callDurationSec: 0 }),
    endCall: () => {
      patch({ inCall: false });
      showToast('Call ended');
    },
    toggleCallMute: () => patch((s) => ({ callMuted: !s.callMuted })),
    toggleCallCamera: () => patch((s) => ({ callCameraOff: !s.callCameraOff })),
    bookProvider: (name: string) => showToast(`Booking request sent to ${name}`),

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

    toggleNotifications: () => patch((s) => ({ showNotifications: !s.showNotifications })),
    closeNotifications: () => patch({ showNotifications: false }),
    dismissNotification: (id: string) =>
      patch((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

    toggleDarkMode: () => {
      setState((s) => {
        const darkMode = !s.darkMode;
        try {
          localStorage.setItem('welli_dark_mode', darkMode ? '1' : '0');
        } catch {
          // ignore
        }
        return { ...s, darkMode };
      });
    },

    toggleFaceId: () => {
      setState((s) => {
        const faceIdEnabled = !s.faceIdEnabled;
        if (faceIdEnabled) showToast('Face ID Lock enabled — optional, off by default');
        return { ...s, faceIdEnabled, showLockScreen: faceIdEnabled };
      });
    },
    unlockWithFaceId: () => patch({ showLockScreen: false }),

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
    downloadRecord: () => showToast('Record saved to Files'),

    logOut: () => patch({ loggedOut: true }),
    logBackIn: () => patch({ loggedOut: false, tab: 'home' }),
  };

  return {
    state,
    actions,
    records: RECORDS,
    family: state.familyMembers,
    doctors: DOCTORS,
    proxyLog: PROXY_LOG,
    activityLog: ACTIVITY_LOG,
    onboardingSlides: ONBOARDING,
    linkedAccountDefs: LINKED_ACCOUNTS,
    consentScopes: CONSENT_SCOPES,
  };
}

export type WelliApp = ReturnType<typeof useWelliApp>;
