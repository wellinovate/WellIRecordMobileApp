import { ModalHeader } from '../components/ModalHeader';
import { Row, SectionLabel, ToggleRow } from '../components/SettingsUI';
import type { WelliApp } from '../state/useWelliApp';

export function PrivacySecurityModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  if (!state.showPrivacySecurity) return null;

  return (
    <div className="overlay-fullscreen">
      <ModalHeader title="Privacy & Security" onClose={actions.closePrivacySecurity} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 20px 30px' }}>
        <div
          style={{
            fontSize: 12,
            color: '#64748b',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '10px 12px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z" stroke="#1a6b42" strokeWidth="1.8" />
          </svg>
          All records are encrypted at rest and in transit.
        </div>

        <SectionLabel>Security</SectionLabel>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', marginBottom: 22 }}>
          <ToggleRow
            emoji="🔑"
            label="Two-Factor Authentication"
            sub="Add an extra step when signing in"
            on={state.twoFactorEnabled}
            onClick={actions.toggleTwoFactor}
          />
        </div>

        <SectionLabel>Active Sessions</SectionLabel>
        <div style={{ background: '#f8fafc', borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              background: '#fff',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              flexShrink: 0,
            }}
          >
            📱
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>This device</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>San Francisco, CA &middot; Active now</div>
          </div>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: '3px 9px',
              borderRadius: 999,
              background: 'rgba(16,185,129,.14)',
              color: '#10b981',
              whiteSpace: 'nowrap',
            }}
          >
            Current
          </span>
        </div>

        <SectionLabel>Data</SectionLabel>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', marginBottom: 22 }}>
          <div style={{ borderBottom: '1px solid #e2e8f0' }}>
            <Row emoji="📥" label="Download My Data" onClick={actions.downloadMyData} />
          </div>
          <Row emoji="📄" label="Privacy Policy" onClick={actions.openPrivacyPolicy} />
        </div>

        <div style={{ background: '#fff', border: '1px solid #fca5a5', borderRadius: 16, overflow: 'hidden' }}>
          <Row emoji="🗑️" label="Delete Account" onClick={actions.requestAccountDeletion} danger />
        </div>
      </div>
    </div>
  );
}
