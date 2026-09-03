import React, { useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, BackHandler, Platform } from 'react-native';
import { useWelliApp } from './state/useWelliApp';
import { themeFor, ThemeContext } from './theme/ThemeContext';
import { PhoneShell } from './components/PhoneShell';
import { TabBar } from './components/TabBar';
import { Toast } from './components/Toast';

import { HomeScreen } from './screens/HomeScreen';
import { RecordsScreen } from './screens/RecordsScreen';
import { ShareScreen } from './screens/ShareScreen';
import { CareScreen } from './screens/CareScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { WelcomeHomeScreen } from './screens/WelcomeHomeScreen';

import { NotificationsPanel } from './modals/NotificationsPanel';
import { RecordDetailSheet } from './modals/RecordDetailSheet';
import { UploadModal } from './modals/UploadModal';
import { ShareFlowModal } from './modals/ShareFlowModal';
import { SmartConsentModal } from './modals/SmartConsentModal';
import { EmergencyModal } from './modals/EmergencyModal';
import { InCallModal } from './modals/InCallModal';
import { OnboardingModal } from './modals/OnboardingModal';
import { PersonalInfoModal } from './modals/PersonalInfoModal';
import { PrivacySecurityModal } from './modals/PrivacySecurityModal';
import { PrivacyPolicyModal } from './modals/PrivacyPolicyModal';
import { LinkedAccountsModal } from './modals/LinkedAccountsModal';
import { NotificationSettingsModal } from './modals/NotificationSettingsModal';
import { FamilyAccessModal } from './modals/FamilyAccessModal';
import { AddFamilyMemberModal } from './modals/AddFamilyMemberModal';
import { ProxyLogModal } from './modals/ProxyLogModal';
import { ActivityLogModal } from './modals/ActivityLogModal';
import { LanguageModal } from './modals/LanguageModal';
import { FaceIdLockScreen } from './modals/FaceIdLockScreen';
import { LoggedOutScreen } from './modals/LoggedOutScreen';
import { BookAppointmentModal } from './modals/BookAppointmentModal';
import { BillingModal } from './modals/BillingModal';
import { InvoiceDetailModal } from './modals/InvoiceDetailModal';
import { PrintLabResultModal } from './modals/PrintLabResultModal';
import { EmailReportModal } from './modals/EmailReportModal';
import { PrescriptionRefillModal } from './modals/PrescriptionRefillModal';
import { OrderMedicationModal } from './modals/OrderMedicationModal';
import { PharmacyDirectoryModal } from './modals/PharmacyDirectoryModal';
import { LabDirectoryModal } from './modals/LabDirectoryModal';
import { VaultExportModal } from './modals/VaultExportModal';

import { ClerkProvider, ClerkLoaded } from '@clerk/expo';
import { tokenCache } from './utils/tokenCache';

const publishableKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  'pk_test_aW1wcm92ZWQtaGVuLTQ3MTAuY2xlcmsuYWNjb3VudHMuZGV2JA';

function MainWelliApp() {
  const app = useWelliApp();
  const { state } = app;
  const theme = themeFor(state.darkMode);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const onBackPress = () => {
      if (state.showVaultExport) {
        app.actions.closeVaultExport();
        return true;
      }
      if (state.showOrderMedication) {
        app.actions.closeOrderMedication();
        return true;
      }
      if (state.showRefillModal) {
        app.actions.closeRefillModal();
        return true;
      }
      if (state.showPrintLabResult) {
        app.actions.closePrintLabResult();
        return true;
      }
      if (state.showEmailLabResult) {
        app.actions.closeEmailLabResult();
        return true;
      }
      if (state.showWelcomeHome && !state.loggedOut) {
        app.actions.closeWelcomeHome();
        return true;
      }
      if (state.showInvoiceDetail) {
        app.actions.closeInvoiceDetail();
        return true;
      }
      if (state.showAddFamilyMember) {
        app.actions.closeAddFamilyMember();
        return true;
      }
      if (state.showPrivacyPolicy) {
        app.actions.closePrivacyPolicy();
        return true;
      }
      if (state.personalInfoEditMode) {
        app.actions.cancelEditPersonalInfo();
        return true;
      }
      if (state.showShareFlow) {
        app.actions.shareBack();
        return true;
      }
      if (state.showUpload) {
        if (state.uploadStep > 0) {
          app.actions.openUpload();
        } else {
          app.actions.closeUpload();
        }
        return true;
      }
      if (state.showSmartConsent) {
        app.actions.closeSmartConsent();
        return true;
      }
      if (state.showEmergency) {
        app.actions.closeEmergency();
        return true;
      }
      if (state.showBookAppointment) {
        app.actions.closeBookAppointment();
        return true;
      }
      if (state.showBilling) {
        app.actions.closeBilling();
        return true;
      }
      if (state.showPersonalInfo) {
        app.actions.closePersonalInfo();
        return true;
      }
      if (state.showFamilyAccess) {
        app.actions.closeFamilyAccess();
        return true;
      }
      if (state.showPrivacySecurity) {
        app.actions.closePrivacySecurity();
        return true;
      }
      if (state.showLinkedAccounts) {
        app.actions.closeLinkedAccounts();
        return true;
      }
      if (state.showNotificationSettings) {
        app.actions.closeNotificationSettings();
        return true;
      }
      if (state.showProxyLog) {
        app.actions.closeProxyLog();
        return true;
      }
      if (state.showActivity) {
        app.actions.closeActivity();
        return true;
      }
      if (state.showLanguage) {
        app.actions.closeLanguage();
        return true;
      }
      if (state.showNotifications) {
        app.actions.closeNotifications();
        return true;
      }
      if (state.recordDetailId) {
        app.actions.closeRecord();
        return true;
      }
      if (state.inCall) {
        app.actions.endCall();
        return true;
      }
      // Tab navigation history
      if (state.tabHistory.length > 0) {
        app.actions.goBackTab();
        return true;
      }

      return false;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );
    return () => subscription.remove();
  }, [state, app.actions]);

  const renderScreen = () => {
    switch (state.tab) {
      case 'home':
        return <HomeScreen app={app} />;
      case 'records':
        return <RecordsScreen app={app} />;
      case 'share':
        return <ShareScreen app={app} />;
      case 'care':
        return <CareScreen app={app} />;
      case 'profile':
        return <ProfileScreen app={app} />;
      default:
        return <HomeScreen app={app} />;
    }
  };

  // 1. Explicit Logged Out State -> Show LoggedOutScreen
  if (state.loggedOut) {
    return (
      <ThemeContext.Provider value={theme}>
        <PhoneShell>
          <LoggedOutScreen app={app} />
          <Toast message={state.toast} />
        </PhoneShell>
      </ThemeContext.Provider>
    );
  }

  // 2. Unauthenticated / Sign-In State -> Show WelcomeHomeScreen
  if (!state.isAuthenticated || state.showWelcomeHome) {
    return (
      <ThemeContext.Provider value={theme}>
        <PhoneShell>
          <SafeAreaView style={[styles.safeArea, { backgroundColor: '#ffffff' }]}>
            <WelcomeHomeScreen app={app} />
            {Boolean(state.showOnboarding) && <OnboardingModal app={app} />}
            <Toast message={state.toast} />
          </SafeAreaView>
        </PhoneShell>
      </ThemeContext.Provider>
    );
  }

  // 3. Authenticated Active Session -> Show MainApp Dashboard
  return (
    <ThemeContext.Provider value={theme}>
      <PhoneShell>
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
          <View style={styles.screenContainer}>
            {renderScreen()}
          </View>

          <TabBar active={state.tab} onSelect={app.actions.setTab} />

          {/* Overlays & Modals - Lazy mounted only when open for maximum performance */}
          {Boolean(state.showNotifications) && <NotificationsPanel app={app} />}
          {Boolean(state.recordDetailId) && <RecordDetailSheet app={app} />}
          {Boolean(state.showUpload) && <UploadModal app={app} />}
          {Boolean(state.showShareFlow) && <ShareFlowModal app={app} />}
          {Boolean(state.showSmartConsent) && <SmartConsentModal app={app} />}
          {Boolean(state.showEmergency) && <EmergencyModal app={app} />}
          {Boolean(state.inCall) && <InCallModal app={app} />}
          {Boolean(state.showOnboarding) && <OnboardingModal app={app} />}
          {Boolean(state.showPersonalInfo) && <PersonalInfoModal app={app} />}
          {Boolean(state.showPrivacySecurity) && <PrivacySecurityModal app={app} />}
          {Boolean(state.showPrivacyPolicy) && <PrivacyPolicyModal app={app} />}
          {Boolean(state.showLinkedAccounts) && <LinkedAccountsModal app={app} />}
          {Boolean(state.showNotificationSettings) && <NotificationSettingsModal app={app} />}
          {Boolean(state.showFamilyAccess) && <FamilyAccessModal app={app} />}
          {Boolean(state.showAddFamilyMember) && <AddFamilyMemberModal app={app} />}
          {Boolean(state.showProxyLog) && <ProxyLogModal app={app} />}
          {Boolean(state.showActivity) && <ActivityLogModal app={app} />}
          {Boolean(state.showLanguage) && <LanguageModal app={app} />}
          {Boolean(state.showLockScreen) && <FaceIdLockScreen app={app} />}
          {Boolean(state.showBookAppointment) && <BookAppointmentModal app={app} />}
          {Boolean(state.showBilling) && <BillingModal app={app} />}
          {Boolean(state.showInvoiceDetail) && <InvoiceDetailModal app={app} />}
          {Boolean(state.showPrintLabResult) && <PrintLabResultModal app={app} />}
          {Boolean(state.showEmailLabResult) && <EmailReportModal app={app} />}
          {Boolean(state.showRefillModal) && <PrescriptionRefillModal app={app} />}
          {Boolean(state.showOrderMedication) && <OrderMedicationModal app={app} />}
          {Boolean(state.showPharmacyDirectory) && <PharmacyDirectoryModal app={app} />}
          {Boolean(state.showLabDirectory) && <LabDirectoryModal app={app} />}
          {Boolean(state.showVaultExport) && <VaultExportModal app={app} />}

          <Toast message={state.toast} />
        </SafeAreaView>
      </PhoneShell>
    </ThemeContext.Provider>
  );
}

export default function App() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <MainWelliApp />
      </ClerkLoaded>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    position: 'relative',
  },
  screenContainer: {
    flex: 1,
    position: 'relative',
  },
});
