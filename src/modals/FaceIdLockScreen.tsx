import { Logo } from '../components/Logo';
import type { WelliApp } from '../state/useWelliApp';

export function FaceIdLockScreen({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  if (!state.showLockScreen) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#050d1a',
        zIndex: 70,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
        textAlign: 'center',
        padding: '0 30px',
      }}
    >
      <Logo height={30} color="#ffffff" />
      <div
        onClick={actions.unlockWithFaceId}
        style={{ width: 84, height: 84, borderRadius: 999, background: 'rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <path
            d="M6 4.5H5a1.5 1.5 0 00-1.5 1.5v1M18 4.5h1A1.5 1.5 0 0120.5 6v1M6 19.5H5A1.5 1.5 0 013.5 18v-1M18 19.5h1a1.5 1.5 0 001.5-1.5v-1"
            stroke="#0EA5E9"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="9" cy="10.5" r="0.9" fill="#0EA5E9" />
          <circle cx="15" cy="10.5" r="0.9" fill="#0EA5E9" />
          <path d="M9 15c1 1 5 1 6 0" stroke="#0EA5E9" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ color: '#fff', fontSize: 14.5, fontWeight: 700 }}>WelliRecord is locked</div>
      <div style={{ color: '#93a5c9', fontSize: 12.5 }}>Tap to unlock with Face ID</div>
    </div>
  );
}
