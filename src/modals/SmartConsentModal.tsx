import { EXPIRY_LABEL_MAP } from '../utils/expiry';
import type { WelliApp } from '../state/useWelliApp';
import type { ShareExpiry } from '../data/types';

const EXPIRY_DEFS: [ShareExpiry, string, string?][] = [
  ['24h', '24 Hours', 'Emergency'],
  ['7d', '7 Days', 'Suggested'],
  ['30d', '30 Days'],
  ['custom', '90 Days'],
];

function Tile({
  label,
  selected,
  onClick,
  badge,
  solid,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  badge?: string;
  solid?: boolean;
}) {
  return (
    <div style={{ position: 'relative' }}>
      {badge && (
        <span
          style={{
            position: 'absolute',
            top: -8,
            right: 10,
            zIndex: 1,
            background: '#2563eb',
            color: '#fff',
            fontSize: 9.5,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 999,
          }}
        >
          {badge}
        </span>
      )}
      <div
        onClick={onClick}
        style={{
          textAlign: 'center',
          padding: '13px 10px',
          borderRadius: 12,
          cursor: 'pointer',
          fontSize: 13.5,
          fontWeight: 700,
          border: `1.5px solid ${selected ? '#10b981' : '#e2e8f0'}`,
          background: selected ? (solid ? '#059669' : '#ecfdf5') : '#fff',
          color: selected ? (solid ? '#fff' : '#059669') : '#0f172a',
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function SmartConsentModal({ app }: { app: WelliApp }) {
  const { state, actions, consentScopes } = app;
  if (!state.showSmartConsent) return null;

  const isOrg = state.consentGranteeType === 'organization';

  return (
    <div className="overlay-fullscreen">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 4px' }}>
        <span style={{ fontSize: 19, fontWeight: 800, color: '#0f172a' }}>Smart Consent Controls</span>
        <div
          onClick={actions.closeSmartConsent}
          style={{ width: 30, height: 30, borderRadius: 999, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          <svg width="13" height="13" viewBox="0 0 20 20">
            <path d="M4 4l12 12M16 4L4 16" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px 30px' }}>
        <div
          style={{
            borderRadius: 12,
            background: '#eef4ff',
            border: '1px solid #dbeafe',
            padding: '11px 13px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            fontSize: 12.5,
            fontWeight: 600,
            color: '#1e3a8a',
          }}
        >
          <span style={{ fontSize: 15 }}>🔗</span>
          Grant access to a provider or organization.
        </div>

        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>Grantee Type</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <Tile label="Individual Provider" selected={!isOrg} onClick={() => actions.setConsentGranteeType('individual')} />
          <Tile label="Organization" selected={isOrg} onClick={() => actions.setConsentGranteeType('organization')} />
        </div>

        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>{isOrg ? 'Organization ID' : 'Provider User ID'}</div>
        <input
          value={state.consentProviderId}
          onChange={(e) => actions.setConsentProviderId(e.target.value)}
          placeholder={isOrg ? 'Enter organization ID' : 'Enter provider user ID'}
          style={{
            width: '100%',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '12px 14px',
            fontSize: 13.5,
            boxSizing: 'border-box',
            marginBottom: 20,
          }}
        />

        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>Access Scope</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {consentScopes.map((scope) => (
            <Tile key={scope} label={scope} selected={state.consentScope === scope} onClick={() => actions.setConsentScope(scope)} />
          ))}
        </div>

        <div
          onClick={actions.toggleConsentWrite}
          style={{
            display: 'flex',
            gap: 12,
            padding: 14,
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            cursor: 'pointer',
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 5,
              border: `1.5px solid ${state.consentAllowWrite ? '#059669' : '#cbd5e1'}`,
              background: state.consentAllowWrite ? '#059669' : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            {state.consentAllowWrite && (
              <svg width="12" height="12" viewBox="0 0 20 20">
                <path d="M4 10l4 4 8-9" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>Allow write access</div>
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
              This provider can add new records (e.g. lab orders, prescriptions) for you, not just view existing ones. Off by default.
            </div>
          </div>
        </div>

        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>Auto-Expire Duration</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          {EXPIRY_DEFS.map(([val, label, badge]) => (
            <Tile key={val} label={label} badge={badge} selected={state.consentExpiry === val} onClick={() => actions.setConsentExpiry(val)} solid />
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: -14, marginBottom: 24 }}>
          Expires {EXPIRY_LABEL_MAP[state.consentExpiry]}.
        </div>

        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>Purpose</div>
        <textarea
          value={state.consentPurpose}
          onChange={(e) => actions.setConsentPurpose(e.target.value)}
          placeholder="Example: Second opinion, emergency treatment, lab review..."
          rows={3}
          style={{
            width: '100%',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '12px 14px',
            fontSize: 13.5,
            boxSizing: 'border-box',
            marginBottom: 26,
            fontFamily: 'inherit',
            resize: 'none',
          }}
        />

        <button
          onClick={actions.grantSmartAccess}
          style={{
            width: '100%',
            background: '#059669',
            color: '#fff',
            border: 'none',
            borderRadius: 14,
            padding: 15,
            fontSize: 14.5,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Grant Access
        </button>
      </div>
    </div>
  );
}
