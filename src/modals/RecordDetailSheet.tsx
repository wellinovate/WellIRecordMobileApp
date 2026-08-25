import { RECORD_META } from '../data/mockData';
import type { WelliApp } from '../state/useWelliApp';

export function RecordDetailSheet({ app }: { app: WelliApp }) {
  const { state, actions, records } = app;
  const record = records.find((r) => r.id === state.recordDetailId);
  if (!record) return null;
  const meta = RECORD_META[record.type];

  return (
    <div className="overlay-scrim" style={{ zIndex: 40, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={actions.closeRecord}>
      <div className="wr-fade-up" style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '22px 22px 32px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: 40, height: 5, borderRadius: 999, background: '#e2e8f0', margin: '0 auto 18px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div
            style={{ width: 42, height: 42, borderRadius: 12, background: meta.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}
          >
            {meta.emoji}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{record.title}</div>
            <div style={{ fontSize: 12.5, color: '#64748b' }}>
              {record.provider} &middot; {record.date}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.55, background: '#f8fafc', borderRadius: 14, padding: 13, marginBottom: 18 }}>
          {record.summary}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => actions.shareThisRecord(record.id)}
            style={{ flex: 1, background: '#041E42', color: '#fff', border: 'none', borderRadius: 12, padding: 12, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}
          >
            Share This Record
          </button>
          <button
            onClick={actions.downloadRecord}
            style={{ width: 48, background: '#f1f5f9', border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="17" height="17" viewBox="0 0 20 20">
              <path d="M10 3v10m0 0l-4-4m4 4l4-4M4 16h12" stroke="#334155" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
