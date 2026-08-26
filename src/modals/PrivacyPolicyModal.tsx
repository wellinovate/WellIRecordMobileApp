import { ModalHeader } from '../components/ModalHeader';
import type { WelliApp } from '../state/useWelliApp';

const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: 'Information We Collect',
    body: 'WelliRecord stores the health records you or your care team add — lab results, prescriptions, imaging, and clinical notes — along with basic profile details like your name, date of birth, blood type, and emergency contact. If you connect a wearable, we also store the vitals it reports.',
  },
  {
    heading: 'How We Use Your Information',
    body: 'Your records are used only to display your health history back to you and to the people you explicitly grant access to. We do not sell your data, and we do not use it for advertising.',
  },
  {
    heading: 'Sharing & Consent',
    body: 'Nothing leaves your account until you grant access — by selecting specific records for a doctor, generating a WelliBridge link or QR code, or setting up a Smart Consent grant scoped to a category (like Labs Only) with an auto-expire duration. Every grant can be revoked at any time from the Share tab, and expired grants stop working automatically.',
  },
  {
    heading: 'Data Security',
    body: 'All records are encrypted at rest and in transit. Optional protections — Two-Factor Authentication and Face ID Lock — are available in Privacy & Security and Settings, and are off by default.',
  },
  {
    heading: 'Family & Dependent Data',
    body: "If you manage a dependent's records as a guardian, actions you take on their behalf are recorded in the Proxy Access Log, visible to you at any time from your Profile.",
  },
  {
    heading: 'Your Rights',
    body: 'You can download a full copy of your data at any time from Privacy & Security. If you’d like your account deleted, contact WelliRecord support and we’ll process the request.',
  },
  {
    heading: 'Changes to This Policy',
    body: "If this policy changes in a way that affects how your data is used, we'll notify you in the app before the change takes effect.",
  },
  {
    heading: 'Contact Us',
    body: 'Questions about this policy or your data can be sent to privacy@wellirecord.example.',
  },
];

export function PrivacyPolicyModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  if (!state.showPrivacyPolicy) return null;

  return (
    <div className="overlay-fullscreen">
      <ModalHeader title="Privacy Policy" onClose={actions.closePrivacyPolicy} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 20px 32px' }}>
        <div style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 20 }}>Last updated August 2026</div>
        {SECTIONS.map((s) => (
          <div key={s.heading} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{s.heading}</div>
            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{s.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
