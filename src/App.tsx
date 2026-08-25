import { useWelliApp } from './state/useWelliApp';
import { themeFor, ThemeContext } from './theme/ThemeContext';
import { TabBar } from './components/TabBar';
import { Toast } from './components/Toast';

import { HomeScreen } from './screens/HomeScreen';
import { RecordsScreen } from './screens/RecordsScreen';
import { ShareScreen } from './screens/ShareScreen';
import { CareScreen } from './screens/CareScreen';
import { ProfileScreen } from './screens/ProfileScreen';

import { NotificationsPanel } from './modals/NotificationsPanel';
import { RecordDetailSheet } from './modals/RecordDetailSheet';
import { UploadModal } from './modals/UploadModal';
import { ShareFlowModal } from './modals/ShareFlowModal';
import { EmergencyModal } from './modals/EmergencyModal';
import { InCallModal } from './modals/InCallModal';
import { OnboardingModal } from './modals/OnboardingModal';
import { PersonalInfoModal } from './modals/PersonalInfoModal';
import { PrivacySecurityModal } from './modals/PrivacySecurityModal';
import { LinkedAccountsModal } from './modals/LinkedAccountsModal';
import { NotificationSettingsModal } from './modals/NotificationSettingsModal';
import { FamilyAccessModal } from './modals/FamilyAccessModal';
import { ProxyLogModal } from './modals/ProxyLogModal';
import { ActivityLogModal } from './modals/ActivityLogModal';
import { LanguageModal } from './modals/LanguageModal';
import { FaceIdLockScreen } from './modals/FaceIdLockScreen';

function App() {
  const app = useWelliApp();
  const { state } = app;
  const theme = themeFor(state.darkMode);

  const screens = {
    home: <HomeScreen app={app} />,
    records: <RecordsScreen app={app} />,
    share: <ShareScreen app={app} />,
    care: <CareScreen app={app} />,
    profile: <ProfileScreen app={app} />,
  };

  return (
    <ThemeContext.Provider value={theme}>
      <div className="phone-shell" style={{ background: theme.bg, color: theme.text }}>
        <div className="app-scroll">{screens[state.tab]}</div>
        <TabBar active={state.tab} onSelect={app.actions.setTab} />

        <NotificationsPanel app={app} />
        <RecordDetailSheet app={app} />
        <UploadModal app={app} />
        <ShareFlowModal app={app} />
        <EmergencyModal app={app} />
        <InCallModal app={app} />
        <OnboardingModal app={app} />
        <PersonalInfoModal app={app} />
        <PrivacySecurityModal app={app} />
        <LinkedAccountsModal app={app} />
        <NotificationSettingsModal app={app} />
        <FamilyAccessModal app={app} />
        <ProxyLogModal app={app} />
        <ActivityLogModal app={app} />
        <LanguageModal app={app} />
        <FaceIdLockScreen app={app} />

        <Toast message={state.toast} />
      </div>
    </ThemeContext.Provider>
  );
}

export default App;
