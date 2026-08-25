import { ModalHeader } from '../components/ModalHeader';
import type { WelliApp } from '../state/useWelliApp';

export function UploadModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  if (!state.showUpload) return null;

  return (
    <div className="overlay-fullscreen">
      <ModalHeader title="Add a Record" onClose={actions.closeUpload} />

      {state.uploadStep === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: '10px 20px 30px', justifyContent: 'center' }}>
          <div onClick={actions.startScan} style={{ border: '1.5px dashed #94a3b8', borderRadius: 18, padding: '30px 18px', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>📸</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>Scan a Document</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Use your camera to capture a lab result, prescription or note</div>
          </div>
          <div onClick={actions.startScan} style={{ border: '1px solid #e2e8f0', borderRadius: 18, padding: '22px 18px', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Upload from Files</div>
          </div>
        </div>
      )}

      {state.uploadStep === 1 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 20 }}>
          <div style={{ width: 220, height: 280, borderRadius: 16, background: '#0f172a', position: 'relative', overflow: 'hidden' }}>
            <div className="wr-scan-line" />
            <div style={{ position: 'absolute', inset: 0, border: '2px solid rgba(14,165,233,.4)', borderRadius: 16, margin: 14 }} />
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#64748b' }}>Analyzing document&hellip;</div>
        </div>
      )}

      {state.uploadStep === 2 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '20px 30px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: 'rgba(16,185,129,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 20 20">
              <path d="M4 10l4 4 8-9" stroke="#10b981" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Record Added</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>&quot;Allergy Panel Results&quot; was added to your timeline and verified.</div>
          <button
            onClick={actions.closeUpload}
            style={{ width: '100%', background: '#041E42', color: '#fff', border: 'none', borderRadius: 12, padding: 13, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
