import { useTheme } from '../theme/ThemeContext';
import { Chip } from '../components/Chip';
import { Logo } from '../components/Logo';
import { RECORD_META, VITALS } from '../data/mockData';
import type { WelliApp } from '../state/useWelliApp';

export function HomeScreen({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions, records, family } = app;

  const activeMember = family.find((f) => f.id === state.activeFamilyId) ?? family[0];
  const isGuardianView = state.activeFamilyId !== 'me';
  const ownedRecords = records.filter((r) => r.ownerId === state.activeFamilyId);
  const recentRecords = ownedRecords.slice(0, 3);
  const hasUpcomingVisit = state.activeFamilyId === 'me';
  const vitals = state.activeFamilyId === 'me' ? VITALS : [];
  const unreadCount = state.notifications.length;

  return (
    <div className="screen-pad wr-fade-up">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Logo height={26} color={theme.text} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            onClick={actions.toggleNotifications}
            style={{
              position: 'relative',
              width: 36,
              height: 36,
              borderRadius: 999,
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 10a6 6 0 1112 0c0 3 1 4.5 2 5.5H4c1-1 2-2.5 2-5.5z" stroke={theme.text} strokeWidth="1.7" strokeLinejoin="round" />
              <path d="M9.5 18.5a2.5 2.5 0 005 0" stroke={theme.text} strokeWidth="1.7" />
            </svg>
            {unreadCount > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 999,
                  background: '#dc2626',
                  color: '#fff',
                  fontSize: 9.5,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px',
                }}
              >
                {unreadCount}
              </div>
            )}
          </div>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 999,
              background: '#041E42',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 15,
              fontFamily: "'Bricolage Grotesque', sans-serif",
              flexShrink: 0,
            }}
          >
            {activeMember.initials}
          </div>
        </div>
      </div>

      <div className="hscroll" style={{ marginBottom: 16 }}>
        {family.map((m) => (
          <Chip
            key={m.id}
            label={m.id === 'me' ? 'You' : m.name.split(' ')[0]}
            active={state.activeFamilyId === m.id}
            onClick={() => actions.setFamily(m.id)}
          />
        ))}
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: theme.muted, fontWeight: 500 }}>Good afternoon</div>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 800, color: theme.text }}>
          {activeMember.name}
        </div>
      </div>

      {isGuardianView && (
        <div
          style={{
            borderRadius: 12,
            background: '#fdf4ec',
            border: '1px solid #f3dcc4',
            padding: '9px 13px',
            fontSize: 12,
            color: '#92582b',
            fontWeight: 600,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z" stroke="#c87941" strokeWidth="1.8" />
          </svg>
          Managing {activeMember.name.split(' ')[0]}'s health as guardian
        </div>
      )}

      <div
        onClick={actions.openEmergency}
        style={{
          borderRadius: 20,
          padding: '16px 18px',
          background: 'linear-gradient(135deg, #020617 0%, #1e3a8a 100%)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(4,30,66,.25)',
          marginBottom: 16,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z" stroke="#fbbf24" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M12 8v5M12 16h.01" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14.5 }}>Emergency ID</div>
          <div style={{ color: '#93a5c9', fontSize: 12 }}>Tap for allergies, blood type &amp; contacts</div>
        </div>
        <svg width="18" height="18" viewBox="0 0 20 20">
          <path d="M7 4l6 6-6 6" stroke="#93a5c9" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button className="quick-action" onClick={() => actions.openShareFlow()} style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <circle cx="6" cy="12" r="2.6" stroke="#0EA5E9" strokeWidth="1.8" />
            <circle cx="17" cy="6" r="2.6" stroke="#0EA5E9" strokeWidth="1.8" />
            <circle cx="17" cy="18" r="2.6" stroke="#0EA5E9" strokeWidth="1.8" />
            <path d="M8.3 10.8l6.4-3.6M8.3 13.2l6.4 3.6" stroke="#0EA5E9" strokeWidth="1.6" />
          </svg>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: theme.text }}>Share Records</span>
        </button>
        <button className="quick-action" onClick={actions.openUpload} style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="3" width="16" height="18" rx="2" stroke="#1a6b42" strokeWidth="1.8" />
            <path d="M8 8h8M8 12h8M8 16h5" stroke="#1a6b42" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: theme.text }}>Scan Document</span>
        </button>
        <button className="quick-action" onClick={() => actions.setTab('care')} style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <path d="M12 20s-7-4.4-7-10a4.5 4.5 0 018-2.8A4.5 4.5 0 0121 10c0 5.6-7 10-7 10z" stroke="#c87941" strokeWidth="1.8" />
          </svg>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: theme.text }}>Book Visit</span>
        </button>
      </div>

      {hasUpcomingVisit && (
        <div
          onClick={() => actions.setTab('care')}
          style={{
            borderRadius: 16,
            background: '#eef4ff',
            border: '1px solid #dbeafe',
            padding: '13px 15px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
            cursor: 'pointer',
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: 999, background: '#0EA5E9', flexShrink: 0 }} className="wr-pulse-dot" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>Video visit with Dr. Chen</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Today, 3:00 PM</div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0EA5E9' }}>Join &rsaquo;</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span className="section-label" style={{ color: theme.text }}>Vitals</span>
        <span style={{ fontSize: 12, color: theme.mutedLight }}>Synced 2h ago</span>
      </div>
      {vitals.length === 0 && (
        <div style={{ fontSize: 12.5, color: theme.mutedLight, padding: '10px 0 22px' }}>
          No wearable data for {activeMember.name} yet.
        </div>
      )}
      {vitals.length > 0 && (
        <div className="hscroll" style={{ marginBottom: 22, paddingBottom: 2 }}>
          {vitals.map((v) => (
            <div
              key={v.label}
              style={{
                flexShrink: 0,
                width: 108,
                background: theme.surface,
                border: `1px solid ${theme.border}`,
                borderRadius: 14,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 11, color: theme.muted, marginBottom: 4 }}>{v.label}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: theme.text, fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                {v.value}
                <span style={{ fontSize: 11, color: theme.mutedLight, fontWeight: 500 }}> {v.unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span className="section-label" style={{ color: theme.text }}>Recent Records</span>
        <span onClick={() => actions.setTab('records')} style={{ fontSize: 12.5, fontWeight: 600, color: '#0EA5E9', cursor: 'pointer' }}>
          See all
        </span>
      </div>
      {recentRecords.length === 0 && (
        <div style={{ fontSize: 12.5, color: theme.mutedLight, padding: '4px 0' }}>No records for {activeMember.name} yet.</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recentRecords.map((r) => {
          const meta = RECORD_META[r.type];
          return (
            <div
              key={r.id}
              onClick={() => actions.openRecord(r.id)}
              style={{
                background: theme.surface,
                border: `1px solid ${theme.border}`,
                borderRadius: 14,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: meta.tint,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: 15,
                }}
              >
                {meta.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.title}
                </div>
                <div style={{ fontSize: 11.5, color: theme.muted }}>
                  {r.provider} &middot; {r.date}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
