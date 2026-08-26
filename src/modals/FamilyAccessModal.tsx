import { ModalHeader } from '../components/ModalHeader';
import type { WelliApp } from '../state/useWelliApp';

export function FamilyAccessModal({ app }: { app: WelliApp }) {
  const { state, actions, family } = app;
  if (!state.showFamilyAccess) return null;

  const familyAccessView = family.map((f) => ({
    id: f.id,
    name: f.name,
    initials: f.initials,
    badge: f.role === 'owner' ? 'Account Owner' : 'Dependent',
    badgeColor: f.role === 'owner' ? '#0EA5E9' : '#c87941',
    sub: f.role === 'owner' ? 'Full access to your own records' : 'Managed by you as guardian',
  }));

  return (
    <div className="overlay-fullscreen">
      <ModalHeader title="Family & Caregiver Access" onClose={actions.closeFamilyAccess} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={actions.openAddFamilyMember}
          style={{
            width: '100%',
            background: '#041E42',
            color: '#fff',
            border: 'none',
            borderRadius: 14,
            padding: 13,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 4,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 20 20">
            <path d="M10 3v14M3 10h14" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add Family Member
        </button>
        {familyAccessView.map((f) => (
          <div key={f.id} style={{ background: '#f8fafc', borderRadius: 16, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
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
              {f.initials}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{f.name}</div>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>{f.sub}</div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: f.badgeColor, color: '#fff', whiteSpace: 'nowrap' }}>
              {f.badge}
            </span>
          </div>
        ))}
        <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '10px 6px' }}>
          Guardian access can be transferred or revoked by contacting WelliRecord support.
        </div>
      </div>
    </div>
  );
}
