import { useTheme } from '../theme/ThemeContext';
import { Chip } from '../components/Chip';
import { RECORD_META, RECORD_TYPES } from '../data/mockData';
import type { WelliApp } from '../state/useWelliApp';

export function RecordsScreen({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions, records } = app;

  const ownedRecords = records.filter((r) => r.ownerId === state.activeFamilyId);
  const q = state.recordQuery.trim().toLowerCase();
  const filteredRecords = ownedRecords
    .filter((r) => state.recordFilter === 'All' || r.type === state.recordFilter)
    .filter((r) => !q || r.title.toLowerCase().includes(q) || r.provider.toLowerCase().includes(q));

  return (
    <div className="screen-pad wr-fade-up">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 21, fontWeight: 800, color: theme.text }}>
          Health Records
        </div>
        <button
          onClick={actions.openUpload}
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: '#041E42',
            border: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 20 20">
            <path d="M10 3v14M3 10h14" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <input
          value={state.recordQuery}
          onChange={(e) => actions.setRecordQuery(e.target.value)}
          placeholder="Search records..."
          style={{
            width: '100%',
            background: theme.surface,
            color: theme.text,
            border: `1px solid ${theme.border}`,
            borderRadius: 12,
            padding: '11px 14px 11px 38px',
            fontSize: 13.5,
            boxSizing: 'border-box',
          }}
        />
        <svg width="15" height="15" viewBox="0 0 20 20" style={{ position: 'absolute', left: 13, top: 12 }}>
          <circle cx="8.5" cy="8.5" r="6" stroke={theme.mutedLight} strokeWidth="1.8" fill="none" />
          <path d="M13 13l4 4" stroke={theme.mutedLight} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>

      <div className="hscroll" style={{ marginBottom: 16 }}>
        {RECORD_TYPES.map((f) => (
          <Chip key={f} label={f} active={state.recordFilter === f} onClick={() => actions.setFilter(f)} />
        ))}
      </div>

      {filteredRecords.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 10px', color: theme.mutedLight, fontSize: 13 }}>
          No records match your search.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredRecords.map((r) => {
          const meta = RECORD_META[r.type];
          return (
            <div
              key={r.id}
              onClick={() => actions.openRecord(r.id)}
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 14, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: meta.tint,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 16,
                  }}
                >
                  {meta.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{r.title}</div>
                  <div style={{ fontSize: 11.5, color: theme.muted }}>{r.provider}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: theme.mutedLight }}>{r.date}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: 'rgba(16,185,129,.14)',
                    color: '#10b981',
                  }}
                >
                  Verified
                </span>
                <span style={{ fontSize: 11.5, color: theme.mutedLight }}>{r.type}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
