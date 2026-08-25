import { ModalHeader } from '../components/ModalHeader';
import { SectionLabel, ToggleRow } from '../components/SettingsUI';
import type { WelliApp } from '../state/useWelliApp';

export function NotificationSettingsModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  if (!state.showNotificationSettings) return null;

  const pushDisabled = state.notifPermission !== 'granted';

  return (
    <div className="overlay-fullscreen">
      <ModalHeader title="Notifications" onClose={actions.closeNotificationSettings} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 20px 30px' }}>
        {pushDisabled && (
          <div
            style={{
              borderRadius: 14,
              background: '#fdf4ec',
              border: '1px solid #f3dcc4',
              padding: '12px 14px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <path
                d="M6 10a6 6 0 1112 0c0 3 1 4.5 2 5.5H4c1-1 2-2.5 2-5.5z"
                stroke="#92582b"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path d="M9.5 18.5a2.5 2.5 0 005 0" stroke="#92582b" strokeWidth="1.7" />
            </svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#92582b' }}>Push notifications are off</div>
              <div style={{ fontSize: 11.5, color: '#92582b', opacity: 0.85, marginTop: 1 }}>
                Enable them to get access, appointment & record alerts.
              </div>
            </div>
            <span
              onClick={actions.enablePushNotifications}
              style={{ fontSize: 12, fontWeight: 700, color: '#0EA5E9', cursor: 'pointer', flexShrink: 0 }}
            >
              Enable
            </span>
          </div>
        )}

        <SectionLabel>Alert Types</SectionLabel>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', marginBottom: 22 }}>
          <div style={{ borderBottom: '1px solid #e2e8f0' }}>
            <ToggleRow
              emoji="⏳"
              label="Access Expiring"
              sub="When someone's access to records is about to expire"
              on={state.notifyAccessExpiring}
              onClick={() => actions.toggleNotifyPref('notifyAccessExpiring')}
            />
          </div>
          <div style={{ borderBottom: '1px solid #e2e8f0' }}>
            <ToggleRow
              emoji="📅"
              label="Appointment Reminders"
              sub="Upcoming visits and telehealth calls"
              on={state.notifyAppointments}
              onClick={() => actions.toggleNotifyPref('notifyAppointments')}
            />
          </div>
          <div style={{ borderBottom: '1px solid #e2e8f0' }}>
            <ToggleRow
              emoji="🧾"
              label="New Records"
              sub="When a record is added or verified"
              on={state.notifyNewRecords}
              onClick={() => actions.toggleNotifyPref('notifyNewRecords')}
            />
          </div>
          <ToggleRow
            emoji="👪"
            label="Family Activity"
            sub="Actions taken by caregivers on your behalf"
            on={state.notifyFamilyActivity}
            onClick={() => actions.toggleNotifyPref('notifyFamilyActivity')}
          />
        </div>

        <SectionLabel>Delivery</SectionLabel>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
          <ToggleRow
            emoji="✉️"
            label="Email Updates"
            sub="A weekly summary sent to your inbox"
            on={state.notifyEmailUpdates}
            onClick={() => actions.toggleNotifyPref('notifyEmailUpdates')}
          />
        </div>
      </div>
    </div>
  );
}
