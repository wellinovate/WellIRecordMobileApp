import { useTheme } from '../theme/ThemeContext';
import { FAMILY } from '../data/mockData';
import type { WelliApp } from '../state/useWelliApp';

export function ShareScreen({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions } = app;

  const activeSharesView = state.activeShares.map((sh) => {
    const owner = FAMILY.find((f) => f.id === sh.ownerId) ?? FAMILY[0];
    return { ...sh, ownerLabel: owner.id === 'me' ? null : `For ${owner.name.split(' ')[0]}` };
  });

  return (
    <div className="screen-pad wr-fade-up">
      <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 21, fontWeight: 800, color: theme.text, marginBottom: 4 }}>
        Share &amp; Consent
      </div>
      <div style={{ fontSize: 13, color: theme.muted, marginBottom: 18 }}>
        You control exactly what's shared, with who, for how long.
      </div>

      <button
        onClick={() => actions.openShareFlow()}
        style={{
          width: '100%',
          background: '#041E42',
          color: '#fff',
          border: 'none',
          borderRadius: 14,
          padding: 14,
          fontSize: 14.5,
          fontWeight: 700,
          marginBottom: 22,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 20 20">
          <path d="M10 3v14M3 10h14" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
        New Share
      </button>

      <div className="section-label" style={{ color: theme.text, marginBottom: 10 }}>
        Active Shares
      </div>
      {activeSharesView.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 10px', color: theme.mutedLight, fontSize: 13 }}>
          No active shares right now.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {activeSharesView.map((sh) => (
          <div key={sh.id} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  background: '#eef4ff',
                  color: '#1e3a8a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                {sh.initials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: theme.text }}>{sh.doctorName}</div>
                <div style={{ fontSize: 11.5, color: theme.muted }}>
                  {sh.recordCount} records &middot; expires {sh.expiresLabel}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
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
                  Active
                </span>
                {sh.ownerLabel && (
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 999,
                      background: '#fdf4ec',
                      color: '#92582b',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {sh.ownerLabel}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => actions.revokeShare(sh.id)}
              style={{
                width: '100%',
                background: 'transparent',
                border: '1px solid #fca5a5',
                color: '#dc2626',
                borderRadius: 10,
                padding: 8,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Revoke Access
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
