import { useTheme } from '../theme/ThemeContext';
import type { WelliApp } from '../state/useWelliApp';

export function NotificationsPanel({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions } = app;
  if (!state.showNotifications) return null;

  return (
    <div
      className="overlay-scrim"
      style={{ zIndex: 55 }}
      onClick={actions.closeNotifications}
    >
      <div
        className="wr-slide-down"
        style={{
          position: 'absolute',
          top: 54,
          left: 16,
          right: 16,
          background: theme.surface,
          color: theme.text,
          borderRadius: 18,
          boxShadow: '0 12px 30px rgba(0,0,0,.25)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '14px 16px', fontSize: 14, fontWeight: 700, borderBottom: `1px solid ${theme.border}` }}>Notifications</div>
        {state.notifications.length === 0 && (
          <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: theme.mutedLight }}>You're all caught up.</div>
        )}
        {state.notifications.map((n) => (
          <div key={n.id} style={{ display: 'flex', gap: 10, padding: '13px 16px', borderBottom: `1px solid ${theme.border}`, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 999,
                background: n.tint,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              {n.emoji}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{n.title}</div>
              <div style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>{n.desc}</div>
              <div style={{ fontSize: 10.5, color: theme.mutedLight, marginTop: 4 }}>{n.time}</div>
            </div>
            <div
              onClick={() => actions.dismissNotification(n.id)}
              style={{ width: 22, height: 22, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
            >
              <svg width="11" height="11" viewBox="0 0 20 20">
                <path d="M4 4l12 12M16 4L4 16" stroke={theme.mutedLight} strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
