import { QRCodeSVG } from 'qrcode.react';
import type { WelliApp } from '../state/useWelliApp';

export function EmergencyModal({ app }: { app: WelliApp }) {
  const { state, actions, family } = app;
  if (!state.showEmergency) return null;

  const emergencyMember = family.find((f) => f.id === state.activeFamilyId) ?? family[0];
  const isDependent = emergencyMember.role === 'dependent';
  const guardianLine = isDependent ? `Guardian: ${family[0].name}` : null;

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#050d1a', zIndex: 45, paddingTop: 54, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 18px' }}>
        <div
          onClick={actions.closeEmergency}
          style={{ width: 30, height: 30, borderRadius: 999, background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <svg width="13" height="13" viewBox="0 0 20 20">
            <path d="M4 4l12 12M16 4L4 16" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 24px 30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        <div style={{ width: '100%', borderRadius: 20, background: 'linear-gradient(135deg, #020617 0%, #1e3a8a 100%)', padding: 22, boxShadow: '0 12px 40px rgba(0,0,0,.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z" stroke="#fbbf24" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
            <span style={{ color: '#fbbf24', fontSize: 12.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase' }}>Emergency Medical ID</span>
          </div>
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, marginBottom: 2, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{emergencyMember.name}</div>
          <div style={{ color: '#93a5c9', fontSize: 12.5, marginBottom: 8 }}>DOB: {emergencyMember.dob}</div>
          {guardianLine && <div style={{ color: '#fbbf24', fontSize: 12, fontWeight: 700, marginBottom: 18 }}>{guardianLine}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ color: '#6b87b3', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Blood Type</div>
              <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{emergencyMember.bloodType}</div>
            </div>
            <div>
              <div style={{ color: '#6b87b3', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Allergies</div>
              <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{emergencyMember.allergies}</div>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: '#6b87b3', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Conditions</div>
            <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 600 }}>{emergencyMember.conditions}</div>
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,.12)', marginBottom: 16 }} />
          <div style={{ color: '#6b87b3', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Emergency Contact</div>
          <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 600 }}>{emergencyMember.contact}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <QRCodeSVG
            value={`https://welli.link/emergency/${emergencyMember.id}`}
            size={130}
            fgColor="#0f172a"
            bgColor="#ffffff"
            level="M"
          />
          <div style={{ fontSize: 11.5, color: '#64748b', textAlign: 'center' }}>First responders can scan for full profile</div>
        </div>
      </div>
    </div>
  );
}
