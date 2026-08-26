import { ModalHeader } from '../components/ModalHeader';
import type { WelliApp } from '../state/useWelliApp';

const RELATIONSHIPS = ['Child', 'Spouse', 'Parent', 'Other'];

export function AddFamilyMemberModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  if (!state.showAddFamilyMember) return null;

  return (
    <div className="overlay-fullscreen">
      <ModalHeader title="Add Family Member" onClose={actions.closeAddFamilyMember} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px 30px' }}>
        <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 20 }}>
          Add a dependent to manage their records as their guardian.
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Full Name</div>
        <input
          value={state.newMemberName}
          onChange={(e) => actions.setNewMemberName(e.target.value)}
          placeholder="e.g. Nia Nwosu"
          style={{
            width: '100%',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '11px 14px',
            fontSize: 13.5,
            boxSizing: 'border-box',
            marginBottom: 20,
          }}
        />

        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Relationship</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {RELATIONSHIPS.map((r) => {
            const selected = state.newMemberRelationship === r;
            return (
              <div
                key={r}
                onClick={() => actions.setNewMemberRelationship(r)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 999,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${selected ? '#041E42' : '#e2e8f0'}`,
                  background: selected ? '#041E42' : '#fff',
                  color: selected ? '#fff' : '#0f172a',
                }}
              >
                {r}
              </div>
            );
          })}
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Date of Birth</div>
        <input
          value={state.newMemberDob}
          onChange={(e) => actions.setNewMemberDob(e.target.value)}
          placeholder="e.g. March 14, 1990"
          style={{
            width: '100%',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '11px 14px',
            fontSize: 13.5,
            boxSizing: 'border-box',
            marginBottom: 20,
          }}
        />

        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Blood Type</div>
        <input
          value={state.newMemberBloodType}
          onChange={(e) => actions.setNewMemberBloodType(e.target.value)}
          placeholder="e.g. O+ (optional)"
          style={{
            width: '100%',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '11px 14px',
            fontSize: 13.5,
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ flexShrink: 0, padding: '10px 20px 24px' }}>
        <button
          onClick={actions.addFamilyMember}
          style={{ width: '100%', background: '#041E42', color: '#fff', border: 'none', borderRadius: 14, padding: 15, fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}
        >
          Add Family Member
        </button>
      </div>
    </div>
  );
}
