import { Logo } from '../components/Logo';
import type { WelliApp } from '../state/useWelliApp';

export function LoggedOutScreen({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  if (!state.loggedOut) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 80,
        background: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
        textAlign: 'center',
        padding: '0 32px',
      }}
    >
      <Logo height={32} />
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 999,
          background: '#eef2f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path d="M9 12h11m0 0l-3.5-3.5M20 12l-3.5 3.5" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13 5H6a2 2 0 00-2 2v10a2 2 0 002 2h7" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>You've been logged out</div>
        <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
          Your session has ended. Log back in to access your health records.
        </div>
      </div>
      <button
        onClick={actions.logBackIn}
        style={{
          width: '100%',
          background: '#041E42',
          color: '#fff',
          border: 'none',
          borderRadius: 14,
          padding: 15,
          fontSize: 14.5,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Log Back In
      </button>
    </div>
  );
}
