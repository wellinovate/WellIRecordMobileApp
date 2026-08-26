import { useTheme } from '../theme/ThemeContext';
import { Avatar } from '../components/Avatar';
import type { WelliApp } from '../state/useWelliApp';

interface SettingsRow {
  emoji: string;
  label: string;
  action: () => void;
}

export function ProfileScreen({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions, family } = app;
  const owner = family.find((f) => f.role === 'owner') ?? family[0];

  const settingsRows: SettingsRow[] = [
    { emoji: '👤', label: 'Personal Info', action: actions.openPersonalInfo },
    { emoji: '🔔', label: 'Notifications', action: actions.openNotificationSettings },
    { emoji: '🔐', label: 'Privacy & Security', action: actions.openPrivacySecurity },
    { emoji: '🔗', label: 'Linked Accounts', action: actions.openLinkedAccounts },
    { emoji: '📋', label: 'Recent Activity', action: actions.openActivity },
    { emoji: '🌐', label: `Language (${state.language})`, action: actions.openLanguage },
    { emoji: '✨', label: 'Replay Welcome Tour', action: actions.openOnboarding },
  ];

  return (
    <div className="screen-pad wr-fade-up">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <Avatar member={owner} size={56} fontSize={19} />
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: theme.text, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{owner.name}</div>
          <div style={{ fontSize: 12.5, color: theme.muted }}>Member since 2022</div>
        </div>
      </div>

      <div
        onClick={actions.openEmergency}
        style={{
          borderRadius: 16,
          background: 'linear-gradient(135deg, #020617 0%, #1e3a8a 100%)',
          padding: '13px 15px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          marginBottom: 22,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z" stroke="#fbbf24" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
        <span style={{ flex: 1, color: '#fff', fontSize: 13.5, fontWeight: 700 }}>Emergency ID Card</span>
        <svg width="16" height="16" viewBox="0 0 20 20">
          <path d="M7 4l6 6-6 6" stroke="#93a5c9" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="section-label" style={{ color: theme.text, marginBottom: 10 }}>
        Family &amp; Caregiver Access
      </div>
      <div
        onClick={actions.openFamilyAccess}
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          padding: '13px 15px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 16 }}>👪</span>
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: theme.text }}>Manage Family Access</span>
        <svg width="14" height="14" viewBox="0 0 20 20">
          <path d="M7 4l6 6-6 6" stroke={theme.mutedLight} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div
        onClick={actions.openProxyLog}
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          padding: '13px 15px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          marginBottom: 22,
        }}
      >
        <span style={{ fontSize: 16 }}>📋</span>
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: theme.text }}>Proxy Access Log</span>
        <svg width="14" height="14" viewBox="0 0 20 20">
          <path d="M7 4l6 6-6 6" stroke={theme.mutedLight} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="section-label" style={{ color: theme.text, marginBottom: 10 }}>
        Vitals &amp; Wearable Sync
      </div>
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 4, marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
            🍎
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: theme.text }}>Apple Health</div>
            <div style={{ fontSize: 11.5, color: '#10b981' }}>Connected</div>
          </div>
          <div style={{ width: 40, height: 24, borderRadius: 999, background: '#1a6b42', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: 999, background: '#fff' }} />
          </div>
        </div>
        <div style={{ height: 1, background: theme.border, margin: '0 12px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#fdf4ec', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
            ⌚
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: theme.text }}>Fitbit</div>
            <div style={{ fontSize: 11.5, color: theme.mutedLight }}>Not connected</div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0EA5E9' }}>Connect</span>
        </div>
      </div>

      <div className="section-label" style={{ color: theme.text, marginBottom: 10 }}>
        Settings
      </div>
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderBottom: `1px solid ${theme.border}` }}>
          <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>🌙</span>
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: theme.text }}>Dark Mode</span>
          <div
            onClick={actions.toggleDarkMode}
            style={{ width: 40, height: 24, borderRadius: 999, background: state.darkMode ? '#0EA5E9' : '#cbd5e1', position: 'relative', cursor: 'pointer' }}
          >
            <div
              style={{
                position: 'absolute',
                top: 2,
                [state.darkMode ? 'right' : 'left']: 2,
                width: 20,
                height: 20,
                borderRadius: 999,
                background: '#fff',
              }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderBottom: `1px solid ${theme.border}` }}>
          <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>🔒</span>
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: theme.text }}>
            Face ID Lock <span style={{ color: theme.mutedLight, fontWeight: 500 }}>(optional)</span>
          </span>
          <div
            onClick={actions.toggleFaceId}
            style={{ width: 40, height: 24, borderRadius: 999, background: state.faceIdEnabled ? '#0EA5E9' : '#cbd5e1', position: 'relative', cursor: 'pointer' }}
          >
            <div
              style={{
                position: 'absolute',
                top: 2,
                [state.faceIdEnabled ? 'right' : 'left']: 2,
                width: 20,
                height: 20,
                borderRadius: 999,
                background: '#fff',
              }}
            />
          </div>
        </div>
        {settingsRows.map((row, i) => (
          <div
            key={row.label}
            onClick={row.action}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '13px 14px',
              cursor: 'pointer',
              borderBottom: i === settingsRows.length - 1 ? 'none' : `1px solid ${theme.border}`,
            }}
          >
            <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{row.emoji}</span>
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: theme.text }}>{row.label}</span>
            <svg width="14" height="14" viewBox="0 0 20 20">
              <path d="M7 4l6 6-6 6" stroke={theme.mutedLight} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        ))}
      </div>

      <button
        onClick={actions.logOut}
        style={{ width: '100%', background: 'transparent', border: 'none', color: '#dc2626', fontSize: 13.5, fontWeight: 700, padding: 10, cursor: 'pointer' }}
      >
        Log Out
      </button>
    </div>
  );
}
