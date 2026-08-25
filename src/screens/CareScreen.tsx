import { useTheme } from '../theme/ThemeContext';
import { Chip } from '../components/Chip';
import { CATEGORIES, PROVIDERS } from '../data/mockData';
import type { WelliApp } from '../state/useWelliApp';

export function CareScreen({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions } = app;

  const hasUpcomingVisit = state.activeFamilyId === 'me';
  const cq = state.careQuery.trim().toLowerCase();
  const providers = PROVIDERS.filter((p) => state.careCategory === 'All' || p.category === state.careCategory).filter(
    (p) => !cq || p.name.toLowerCase().includes(cq) || p.specialty.toLowerCase().includes(cq)
  );

  return (
    <div className="screen-pad wr-fade-up">
      <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 21, fontWeight: 800, color: theme.text, marginBottom: 14 }}>
        Find Care
      </div>

      {hasUpcomingVisit && (
        <div
          style={{
            borderRadius: 16,
            background: 'linear-gradient(135deg, #0B1F3A 0%, #0E5E6F 100%)',
            padding: '14px 16px',
            marginBottom: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ color: '#93c5fd', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>
              Upcoming Telehealth
            </div>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Dr. Sarah Chen &middot; Today, 3:00 PM</div>
          </div>
          <button
            onClick={actions.joinCall}
            style={{ background: '#0EA5E9', color: '#041E42', border: 'none', borderRadius: 999, padding: '9px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
          >
            Join
          </button>
        </div>
      )}

      <div style={{ position: 'relative', marginBottom: 14 }}>
        <input
          value={state.careQuery}
          onChange={(e) => actions.setCareQuery(e.target.value)}
          placeholder="Search specialists, clinics..."
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
        {CATEGORIES.map((c) => (
          <Chip key={c} label={c} active={state.careCategory === c} onClick={() => actions.setCareCategory(c)} />
        ))}
      </div>

      {providers.length === 0 && (
        <div style={{ textAlign: 'center', padding: '36px 10px', color: theme.mutedLight, fontSize: 13 }}>
          No providers match your search.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {providers.map((p) => (
          <div
            key={p.name}
            style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: theme.surface2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 17,
                flexShrink: 0,
              }}
            >
              {p.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: theme.text }}>{p.name}</div>
              <div style={{ fontSize: 11.5, color: theme.muted }}>
                {p.specialty} &middot; {p.distance}
              </div>
            </div>
            <button
              onClick={() => actions.bookProvider(p.name)}
              style={{
                background: '#f0fdfa',
                color: '#041E42',
                border: '1px solid #99f6e4',
                borderRadius: 999,
                padding: '7px 13px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Book
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
