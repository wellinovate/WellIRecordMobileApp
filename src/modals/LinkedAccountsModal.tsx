import { ModalHeader } from '../components/ModalHeader';
import { SectionLabel } from '../components/SettingsUI';
import type { WelliApp } from '../state/useWelliApp';

export function LinkedAccountsModal({ app }: { app: WelliApp }) {
  const { state, actions, linkedAccountDefs } = app;
  if (!state.showLinkedAccounts) return null;

  const healthcare = linkedAccountDefs.filter((a) => a.category === 'healthcare');
  const signIn = linkedAccountDefs.filter((a) => a.category === 'signin');

  const renderGroup = (label: string, items: typeof linkedAccountDefs) => (
    <>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', marginBottom: 22 }}>
        {items.map((a, i) => {
          const connected = !!state.linkedAccounts[a.id];
          return (
            <div
              key={a.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '13px 14px',
                borderBottom: i === items.length - 1 ? 'none' : '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                {a.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>{a.name}</div>
                <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{a.sub}</div>
              </div>
              {connected ? (
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: 'rgba(16,185,129,.14)',
                    color: '#10b981',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  Connected
                </span>
              ) : (
                <span
                  onClick={() => actions.connectAccount(a.id, a.name)}
                  style={{ fontSize: 12, fontWeight: 700, color: '#0EA5E9', cursor: 'pointer', flexShrink: 0 }}
                >
                  Connect
                </span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="overlay-fullscreen">
      <ModalHeader title="Linked Accounts" onClose={actions.closeLinkedAccounts} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 20px 30px' }}>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 18 }}>
          Connect accounts to speed up refills, claims, and sign-in.
        </div>
        {renderGroup('Healthcare Accounts', healthcare)}
        {renderGroup('Sign-In Methods', signIn)}
      </div>
    </div>
  );
}
