import { ModalHeader } from '../components/ModalHeader';
import type { FamilyMember } from '../data/types';
import type { WelliApp } from '../state/useWelliApp';

const EDITABLE_FIELDS: { key: Exclude<keyof FamilyMember, 'id' | 'role' | 'initials'>; label: string }[] = [
  { key: 'name', label: 'Full Name' },
  { key: 'dob', label: 'Date of Birth' },
  { key: 'gender', label: 'Gender' },
  { key: 'bloodType', label: 'Blood Type' },
  { key: 'height', label: 'Height' },
  { key: 'weight', label: 'Weight' },
  { key: 'allergies', label: 'Allergies' },
  { key: 'conditions', label: 'Conditions' },
  { key: 'contact', label: 'Emergency Contact' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Address' },
  { key: 'insuranceProvider', label: 'Insurance Provider' },
  { key: 'insuranceId', label: 'Insurance ID' },
];

export function PersonalInfoModal({ app }: { app: WelliApp }) {
  const { state, actions, family } = app;
  if (!state.showPersonalInfo) return null;

  const activeMember = family.find((f) => f.id === state.activeFamilyId) ?? family[0];
  const isGuardianView = state.activeFamilyId !== 'me';
  const editing = state.personalInfoEditMode;

  const displayFields = [
    { label: 'Full Name', value: activeMember.name },
    { label: 'Date of Birth', value: activeMember.dob },
    { label: 'Gender', value: activeMember.gender },
    { label: 'Blood Type', value: activeMember.bloodType },
    { label: 'Height / Weight', value: `${activeMember.height} / ${activeMember.weight}` },
    { label: 'Allergies', value: activeMember.allergies },
    { label: 'Conditions', value: activeMember.conditions },
    { label: 'Emergency Contact', value: activeMember.contact },
    { label: 'Email', value: activeMember.email },
    { label: 'Phone', value: activeMember.phone },
    { label: 'Address', value: activeMember.address },
    { label: 'Insurance Provider', value: activeMember.insuranceProvider },
    { label: 'Insurance ID', value: activeMember.insuranceId },
  ];

  return (
    <div className="overlay-fullscreen">
      <ModalHeader title={<>Personal Info &middot; {activeMember.name}</>} onClose={actions.closePersonalInfo} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 20px 4px' }}>
        {!editing && (
          <span onClick={actions.startEditPersonalInfo} style={{ fontSize: 12.5, fontWeight: 700, color: '#0EA5E9', cursor: 'pointer' }}>
            Edit
          </span>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 20px 30px' }}>
        {isGuardianView && (
          <div style={{ fontSize: 12, color: '#92582b', background: '#fdf4ec', border: '1px solid #f3dcc4', borderRadius: 10, padding: '8px 12px', marginBottom: 14 }}>
            Viewing as guardian. Some fields may be limited for dependents.
          </div>
        )}

        {editing && state.personalInfoDraft ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {EDITABLE_FIELDS.map((f) => (
              <div key={f.key}>
                <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{f.label}</div>
                <input
                  value={state.personalInfoDraft![f.key]}
                  onChange={(e) => actions.updatePersonalInfoDraft(f.key, e.target.value)}
                  style={{
                    width: '100%',
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '9px 12px',
                    fontSize: 13.5,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: '#f8fafc', borderRadius: 16, overflow: 'hidden' }}>
            {displayFields.map((f, i) => (
              <div key={f.label} style={{ padding: '12px 14px', borderBottom: i === displayFields.length - 1 ? 'none' : '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>{f.label}</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>{f.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div style={{ flexShrink: 0, display: 'flex', gap: 10, padding: '10px 20px 24px' }}>
          <button
            onClick={actions.cancelEditPersonalInfo}
            style={{ flex: 1, background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 14, padding: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={actions.savePersonalInfo}
            style={{ flex: 2, background: '#041E42', color: '#fff', border: 'none', borderRadius: 14, padding: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}
