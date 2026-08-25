import { ModalHeader } from '../components/ModalHeader';
import type { WelliApp } from '../state/useWelliApp';

export function PersonalInfoModal({ app }: { app: WelliApp }) {
  const { state, actions, family } = app;
  if (!state.showPersonalInfo) return null;

  const activeMember = family.find((f) => f.id === state.activeFamilyId) ?? family[0];
  const isGuardianView = state.activeFamilyId !== 'me';

  const fields = [
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 20px 30px' }}>
        {isGuardianView && (
          <div style={{ fontSize: 12, color: '#92582b', background: '#fdf4ec', border: '1px solid #f3dcc4', borderRadius: 10, padding: '8px 12px', marginBottom: 14 }}>
            Viewing as guardian. Some fields may be limited for dependents.
          </div>
        )}
        <div style={{ background: '#f8fafc', borderRadius: 16, overflow: 'hidden' }}>
          {fields.map((f, i) => (
            <div key={f.label} style={{ padding: '12px 14px', borderBottom: i === fields.length - 1 ? 'none' : '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>{f.label}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>{f.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
