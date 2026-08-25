import { useEffect, useRef, useState } from 'react';
import {
  ACTIVITY_LOG,
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
  Notification,
  RecordType,
  ShareExpiry,
  ShareMethod,
  Tab,
} from '../data/types';

export interface AppState {
  tab: Tab;
  activeFamilyId: string;
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
  shareExpiry: ShareExpiry;
  activeShares: ActiveShare[];
  showFamilyAccess: boolean;
  showProxyLog: boolean;
  showPersonalInfo: boolean;
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
  toast: string | null;
}

const initialState: AppState = {
  tab: 'home',
  activeFamilyId: 'me',
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
  shareExpiry: '24h',
  activeShares: INITIAL_ACTIVE_SHARES,
  showFamilyAccess: false,
  showProxyLog: false,
  showPersonalInfo: false,
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
          const doc = DOCTORS.find((d) => d.id === s.shareSelectedDoctorId)!;
          const count = Object.values(s.shareSelected).filter(Boolean).length;
          const expiryLabels: Record<ShareExpiry, string> = {
            '24h': 'in 24 hours',
            '7d': 'in 7 days',
            '30d': 'in 30 days',
            custom: 'in 90 days',
          };
          const newShare: ActiveShare = {
            id: 's' + Date.now(),
            doctorId: doc.id,
            doctorName: doc.name,
            initials: doc.initials,
            recordCount: count,
            expiresLabel: expiryLabels[s.shareExpiry],
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
    setMethod: (m: ShareMethod) => patch({ shareMethod: m }),
    setDoctorQuery: (value: string) => patch({ shareDoctorQuery: value }),
    selectDoctor: (id: string) => patch({ shareSelectedDoctorId: id }),
    scanQrSuccess: () => {
      patch({ shareSelectedDoctorId: 'd2' });
      actions.shareNext();
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

    openEmergency: () => patch({ showEmergency: true }),
    closeEmergency: () => patch({ showEmergency: false }),
    openFamilyAccess: () => patch({ showFamilyAccess: true }),
    closeFamilyAccess: () => patch({ showFamilyAccess: false }),
    openProxyLog: () => patch({ showProxyLog: true }),
    closeProxyLog: () => patch({ showProxyLog: false }),
    openPersonalInfo: () => patch({ showPersonalInfo: true }),
    closePersonalInfo: () => patch({ showPersonalInfo: false }),
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
    joinCall: () => patch({ inCall: true }),
    endCall: () => {
      patch({ inCall: false });
      showToast('Call ended');
    },
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
    openSettingsStub: (label: string) => showToast(`Opening ${label}`),
  };

  return {
    state,
    actions,
    records: RECORDS,
    family: FAMILY,
    doctors: DOCTORS,
    proxyLog: PROXY_LOG,
    activityLog: ACTIVITY_LOG,
    onboardingSlides: ONBOARDING,
    linkedAccountDefs: LINKED_ACCOUNTS,
  };
}

export type WelliApp = ReturnType<typeof useWelliApp>;
