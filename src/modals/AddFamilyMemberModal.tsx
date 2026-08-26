import { ModalHeader } from '../components/ModalHeader';
import { FormSelect } from '../components/FormSelect';
import { BLOOD_TYPES, GENDER_OPTIONS, GENOTYPES } from '../data/mockData';
import type { WelliApp } from '../state/useWelliApp';

const RELATIONSHIPS = ['Child', 'Spouse', 'Parent', 'Other'];

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: '11px 14px',
  fontSize: 13.5,
  boxSizing: 'border-box',
};

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
          style={{ ...inputStyle, marginBottom: 20 }}
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
          type="date"
          value={state.newMemberDob}
          onChange={(e) => actions.setNewMemberDob(e.target.value)}
          style={{ ...inputStyle, marginBottom: 20 }}
        />

        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Gender</div>
        <div style={{ marginBottom: 20 }}>
          <FormSelect value={state.newMemberGender} onChange={actions.setNewMemberGender} options={GENDER_OPTIONS} placeholder="Select gender" />
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Blood Type</div>
        <div style={{ marginBottom: 20 }}>
          <FormSelect value={state.newMemberBloodType} onChange={actions.setNewMemberBloodType} options={BLOOD_TYPES} placeholder="Select blood type" />
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Genotype</div>
        <FormSelect value={state.newMemberGenotype} onChange={actions.setNewMemberGenotype} options={GENOTYPES} placeholder="Select genotype" />
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
