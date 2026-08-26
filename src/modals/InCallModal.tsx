import type { WelliApp } from '../state/useWelliApp';

export function InCallModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  if (!state.inCall) return null;

  const mins = Math.floor(state.callDurationSec / 60)
    .toString()
    .padStart(2, '0');
  const secs = (state.callDurationSec % 60).toString().padStart(2, '0');
  const callDurationLabel = `${mins}:${secs}`;

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0f172a', zIndex: 45, paddingTop: 54, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#0B1F3A,#0E5E6F)' }}>
        <div
          style={{
            width: 92,
            height: 92,
            borderRadius: 999,
            background: '#1e293b',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 30,
            fontWeight: 800,
            fontFamily: "'Bricolage Grotesque', sans-serif",
          }}
        >
          SC
        </div>
        <div style={{ position: 'absolute', top: 18, left: 18, color: '#fff', fontSize: 13.5, fontWeight: 700 }}>Dr. Sarah Chen</div>
        <div style={{ position: 'absolute', top: 40, left: 18, color: '#cbd5e1', fontSize: 11.5 }}>{callDurationLabel}</div>
        <div
          style={{
            position: 'absolute',
            bottom: 18,
            right: 18,
            width: 76,
            height: 106,
            borderRadius: 12,
            background: state.callCameraOff ? '#1e293b' : '#334155',
            border: '1px solid rgba(255,255,255,.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            fontSize: 22,
          }}
        >
          {state.callCameraOff ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="6" width="13" height="12" rx="2" stroke="#64748b" strokeWidth="1.6" />
              <path d="M16 10.5l5-3v9l-5-3" stroke="#64748b" strokeWidth="1.6" fill="none" />
              <path d="M4 4l16 16" stroke="#64748b" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          ) : (
            '👤'
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '22px 20px 30px' }}>
        <div
          onClick={actions.toggleCallMute}
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            background: state.callMuted ? '#fff' : 'rgba(255,255,255,.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 16a3 3 0 003-3V6a3 3 0 10-6 0v7a3 3 0 003 3z" stroke={state.callMuted ? '#0f172a' : '#fff'} strokeWidth="1.6" />
            <path d="M6 11v1a6 6 0 0012 0v-1M12 18v3" stroke={state.callMuted ? '#0f172a' : '#fff'} strokeWidth="1.6" />
            {state.callMuted && <path d="M4 4l16 16" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" />}
          </svg>
        </div>
        <div
          onClick={actions.toggleCallCamera}
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            background: state.callCameraOff ? '#fff' : 'rgba(255,255,255,.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="6" width="13" height="12" rx="2" stroke={state.callCameraOff ? '#0f172a' : '#fff'} strokeWidth="1.6" />
            <path d="M16 10.5l5-3v9l-5-3" stroke={state.callCameraOff ? '#0f172a' : '#fff'} strokeWidth="1.6" fill="none" />
            {state.callCameraOff && <path d="M4 4l16 16" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" />}
          </svg>
        </div>
        <div
          onClick={actions.endCall}
          style={{ width: 60, height: 60, borderRadius: 999, background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transform: 'rotate(135deg)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 12c4-5 12-5 16 0l-2.6 2.6c-.5.5-1.3.6-1.9.2l-2-1.4c-.5-.4-1.2-.3-1.6.1l-1.4 1.4c-.4.4-1.1.5-1.6.1l-2-1.4c-.6-.4-.7-1.2-.2-1.7L4 12z"
              fill="#fff"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
