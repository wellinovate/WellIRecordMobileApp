import { ModalHeader } from '../components/ModalHeader';
import { BridgeCodeCard } from '../components/BridgeCodeCard';
import { RECORD_META } from '../data/mockData';
import { bridgeLinkFor } from '../utils/bridgeCode';
import { EXPIRY_LABEL_MAP } from '../utils/expiry';
import type { WelliApp } from '../state/useWelliApp';
import type { ShareExpiry } from '../data/types';

const SHARE_TITLES = ['Select Records', 'Choose Recipient', 'Set Expiry', 'Review & Send', 'Sent'];
const NEXT_LABELS = ['Continue', 'Continue', 'Continue', 'Send Access', 'Done'];
const EXPIRY_DEFS: [ShareExpiry, string][] = [
  ['24h', '24 Hours'],
  ['7d', '7 Days'],
  ['30d', '30 Days'],
  ['custom', '90 Days'],
];

export function ShareFlowModal({ app }: { app: WelliApp }) {
  const { state, actions, records, family, doctors } = app;
  if (!state.showShareFlow) return null;

  const activeMember = family.find((f) => f.id === state.activeFamilyId) ?? family[0];
  const isGuardianView = state.activeFamilyId !== 'me';
  const shareSubjectName = isGuardianView ? `${activeMember.name}'s records` : 'your records';

  const ownedRecords = records.filter((r) => r.ownerId === state.activeFamilyId);
  const shareSelectedCount = Object.values(state.shareSelected).filter(Boolean).length;
  const shareSelectedRecordsList = ownedRecords.filter((r) => state.shareSelected[r.id]);

  const doctorResults = doctors.filter(
    (d) =>
      !state.shareDoctorQuery ||
      d.name.toLowerCase().includes(state.shareDoctorQuery.toLowerCase()) ||
      d.specialty.toLowerCase().includes(state.shareDoctorQuery.toLowerCase())
  );
  const isBridge = state.shareSelectedDoctorId === 'bridge';
  const selectedDoctor = doctors.find((d) => d.id === state.shareSelectedDoctorId);
  const shareSelectedDoctorName = isBridge
    ? 'Anyone with your WelliBridge link'
    : selectedDoctor
      ? selectedDoctor.name
      : 'your doctor';
  const shareExpiryLabel = EXPIRY_LABEL_MAP[state.shareExpiry];

  const stepValid = [shareSelectedCount > 0, !!state.shareSelectedDoctorId, true, true, true];
  const disabled = !stepValid[state.shareStep];
  const showFooter = state.shareStep <= 3;

  return (
    <div className="overlay-fullscreen">
      <ModalHeader title={SHARE_TITLES[state.shareStep]} onClose={actions.closeShareFlow} onBack={actions.shareBack} />

      <div style={{ display: 'flex', gap: 6, padding: '8px 20px 16px' }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: i <= state.shareStep ? '#0EA5E9' : '#e2e8f0' }} />
        ))}
      </div>

      {state.shareStep === 0 && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 4 }}>Choose which of {shareSubjectName} to include.</div>
          {ownedRecords.map((r) => {
            const meta = RECORD_META[r.type];
            const checked = !!state.shareSelected[r.id];
            return (
              <div
                key={r.id}
                onClick={() => actions.toggleShareRecord(r.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderRadius: 14,
                  cursor: 'pointer',
                  border: `1.5px solid ${checked ? '#0EA5E9' : '#e2e8f0'}`,
                  background: checked ? '#f0f9ff' : '#fff',
                }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 10, background: meta.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  {meta.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>{r.title}</div>
                  <div style={{ fontSize: 11.5, color: '#64748b' }}>{r.date}</div>
                </div>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: checked ? '#0EA5E9' : '#f1f5f9',
                    border: `1.5px solid ${checked ? '#0EA5E9' : '#cbd5e1'}`,
                  }}
                >
                  {checked && (
                    <svg width="11" height="11" viewBox="0 0 20 20">
                      <path d="M4 10l4 4 8-9" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {state.shareStep === 1 && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <div
              onClick={() => actions.setMethod('search')}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: 9,
                borderRadius: 10,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                background: state.shareMethod === 'search' ? '#041E42' : '#f1f5f9',
                color: state.shareMethod === 'search' ? '#fff' : '#334155',
              }}
            >
              Search
            </div>
            <div
              onClick={() => actions.setMethod('bridge')}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: 9,
                borderRadius: 10,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: state.shareMethod === 'bridge' ? '#041E42' : '#f1f5f9',
                color: state.shareMethod === 'bridge' ? '#fff' : '#334155',
              }}
            >
              WelliBridge
            </div>
          </div>

          {state.shareMethod === 'search' && (
            <>
              <input
                value={state.shareDoctorQuery}
                onChange={(e) => actions.setDoctorQuery(e.target.value)}
                placeholder="Search by name or clinic..."
                style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '11px 14px', fontSize: 13.5, boxSizing: 'border-box', marginBottom: 4 }}
              />
              {doctorResults.map((d) => {
                const selected = state.shareSelectedDoctorId === d.id;
                return (
                  <div
                    key={d.id}
                    onClick={() => actions.selectDoctor(d.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '11px 12px',
                      borderRadius: 14,
                      cursor: 'pointer',
                      border: `1.5px solid ${selected ? '#0EA5E9' : '#e2e8f0'}`,
                      background: selected ? '#f0f9ff' : '#fff',
                    }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 999, background: '#eef4ff', color: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                      {d.initials}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>{d.name}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>
                        {d.specialty} &middot; {d.org}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {state.shareMethod === 'bridge' && state.bridgeCode && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '16px 0 6px' }}>
              <div style={{ fontSize: 12.5, color: '#64748b', textAlign: 'center', padding: '0 8px' }}>
                Let your doctor scan this code, or copy the link and send it however you like.
              </div>
              <BridgeCodeCard code={state.bridgeCode} link={bridgeLinkFor(state.bridgeCode)} />
              <button
                onClick={actions.copyBridgeLink}
                style={{
                  background: '#f0f9ff',
                  color: '#041E42',
                  border: '1px solid #bae6fd',
                  borderRadius: 999,
                  padding: '10px 22px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                  <rect x="6" y="6" width="11" height="11" rx="2" stroke="#041E42" strokeWidth="1.6" />
                  <path d="M3 13V4a1 1 0 011-1h9" stroke="#041E42" strokeWidth="1.6" />
                </svg>
                Copy Link
              </button>
            </div>
          )}
        </div>
      )}

      {state.shareStep === 2 && (
        <div style={{ flex: 1, padding: '4px 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 4 }}>How long should {shareSelectedDoctorName} have access?</div>
          {EXPIRY_DEFS.map(([val, label]) => {
            const checked = state.shareExpiry === val;
            return (
              <div
                key={val}
                onClick={() => actions.setExpiry(val)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 14,
                  borderRadius: 14,
                  cursor: 'pointer',
                  border: `1.5px solid ${checked ? '#0EA5E9' : '#e2e8f0'}`,
                  background: checked ? '#f0f9ff' : '#fff',
                  color: '#0f172a',
                }}
              >
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{label}</span>
                {checked && (
                  <svg width="16" height="16" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="9" fill="#0EA5E9" />
                    <path d="M6 10l3 3 5-6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}

      {state.shareStep === 3 && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#f8fafc', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 11.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700, marginBottom: 6 }}>Sharing with</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: isBridge ? 4 : 14 }}>{shareSelectedDoctorName}</div>
            {isBridge && (
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5, color: '#0EA5E9', marginBottom: 14 }}>{state.bridgeCode}</div>
            )}
            <div style={{ fontSize: 11.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700, marginBottom: 6 }}>
              Records ({shareSelectedCount})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
              {shareSelectedRecordsList.map((r) => (
                <div key={r.id} style={{ fontSize: 13, color: '#334155' }}>
                  &bull; {r.title}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700, marginBottom: 6 }}>Access expires</div>
            <div style={{ fontSize: 13.5, color: '#334155', fontWeight: 600 }}>{shareExpiryLabel}</div>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '0 6px' }}>
            You can revoke this access at any time from the Share tab.
          </div>
        </div>
      )}

      {state.shareStep === 4 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '20px 30px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: 'rgba(16,185,129,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 20 20">
              <path d="M4 10l4 4 8-9" stroke="#10b981" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Access Granted</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            {shareSelectedDoctorName} can now view {shareSelectedCount} records until {shareExpiryLabel}.
          </div>
        </div>
      )}

      {showFooter && (
        <div style={{ padding: '10px 20px 24px' }}>
          <button
            onClick={actions.shareNext}
            disabled={disabled}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: 14,
              padding: 14,
              fontSize: 14.5,
              fontWeight: 700,
              cursor: disabled ? 'not-allowed' : 'pointer',
              background: disabled ? '#e2e8f0' : '#041E42',
              color: disabled ? '#94a3b8' : '#fff',
            }}
          >
            {NEXT_LABELS[state.shareStep]}
          </button>
        </div>
      )}
    </div>
  );
}
