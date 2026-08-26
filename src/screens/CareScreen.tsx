import { useTheme } from '../theme/ThemeContext';
import { Chip } from '../components/Chip';
import { FACILITY_SECTIONS, FACILITY_TYPE_FILTERS, SPECIALTY_FILTERS } from '../data/mockData';
import type { CareFacility } from '../data/types';
import type { WelliApp } from '../state/useWelliApp';

function FacilityCard({ facility, onBook }: { facility: CareFacility; onBook: () => void }) {
  const isRich = facility.type !== 'Private Practice';

  if (!isRich) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 17,
            flexShrink: 0,
          }}
        >
          {facility.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{facility.name}</div>
          <div style={{ fontSize: 11.5, color: '#64748b' }}>
            {facility.leadTitle} &middot; {facility.specialty}
          </div>
        </div>
        {facility.acceptingPatients ? (
          <button
            onClick={onBook}
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
        ) : (
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>Not accepting</span>
        )}
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      <div style={{ background: facility.gradient, padding: '16px 16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#fff',
              color: '#0f172a',
              borderRadius: 999,
              padding: '5px 11px',
              fontSize: 11.5,
              fontWeight: 700,
            }}
          >
            {facility.emoji} {facility.typeLabel}
          </span>
          {facility.acceptingPatients && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(16,185,129,.9)',
                color: '#fff',
                borderRadius: 999,
                padding: '5px 11px',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 999, background: '#fff' }} />
              Accepting Patients
            </span>
          )}
        </div>
        {(facility.accredited || facility.verified) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            {facility.accredited && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 12, padding: '8px 12px' }}>
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: '#ecfdf5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 11,
                  }}
                >
                  W
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0f172a' }}>Accredited Facility</span>
              </span>
            )}
            {facility.verified && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'rgba(15,23,42,.55)',
                  color: '#5eead4',
                  borderRadius: 999,
                  padding: '5px 11px',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z" stroke="#5eead4" strokeWidth="2" />
                </svg>
                Verified
              </span>
            )}
          </div>
        )}
      </div>
      <div style={{ background: '#fff', padding: 16 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginBottom: 2 }}>{facility.name}</div>
        <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 12 }}>
          {facility.leadName} &middot; {facility.leadTitle}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            background: '#f8fafc',
            borderRadius: 12,
            padding: '10px 12px',
            marginBottom: 12,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
            <path
              d="M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11z"
              stroke="#059669"
              strokeWidth="1.8"
            />
            <circle cx="12" cy="10" r="2.5" stroke="#059669" strokeWidth="1.8" />
          </svg>
          <span style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.4 }}>{facility.address}</span>
        </div>
        {facility.instantBooking && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fef3c7', borderRadius: 999, padding: '5px 12px', marginBottom: 14 }}>
            <span style={{ fontSize: 12 }}>⚡</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#92400e' }}>Instant Booking</span>
          </div>
        )}
        <div style={{ height: 1, background: '#e2e8f0', margin: '0 0 14px' }} />
        {facility.acceptingPatients ? (
          <button
            onClick={onBook}
            style={{
              width: '100%',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 14,
              padding: 14,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="4" width="14" height="13" rx="2" stroke="#fff" strokeWidth="1.6" />
              <path d="M3 8h14M7 2v4M13 2v4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Book Appointment
          </button>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 12.5, color: '#94a3b8', fontWeight: 600, padding: 6 }}>Not currently accepting patients</div>
        )}
      </div>
    </div>
  );
}

export function CareScreen({ app }: { app: WelliApp }) {
  const theme = useTheme();
  const { state, actions, facilities } = app;

  const hasUpcomingVisit = state.activeFamilyId === 'me';
  const cq = state.careQuery.trim().toLowerCase();
  const filtered = facilities
    .filter((f) => state.careFacilityType === 'All' || f.type === state.careFacilityType)
    .filter((f) => state.careSpecialty === 'All Specialties' || f.specialty === state.careSpecialty)
    .filter((f) => !cq || f.name.toLowerCase().includes(cq) || f.specialty.toLowerCase().includes(cq) || f.leadName.toLowerCase().includes(cq));

  const sectionsWithResults = FACILITY_SECTIONS.map((section) => ({
    ...section,
    items: filtered.filter((f) => f.type === section.type),
  })).filter((section) => section.items.length > 0);

  const categoryCount = new Set(filtered.map((f) => f.type)).size;

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
          placeholder="Search hospital, clinic, lab, pharmacy, or doctor..."
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

      <div className="hscroll" style={{ marginBottom: 10 }}>
        {FACILITY_TYPE_FILTERS.map((f) => (
          <Chip key={f.value} label={f.label} active={state.careFacilityType === f.value} onClick={() => actions.setCareFacilityType(f.value)} />
        ))}
      </div>
      <div className="hscroll" style={{ marginBottom: 14 }}>
        {SPECIALTY_FILTERS.map((s) => (
          <Chip key={s} label={s} active={state.careSpecialty === s} onClick={() => actions.setCareSpecialty(s)} />
        ))}
      </div>

      <div style={{ fontSize: 12, color: theme.mutedLight, marginBottom: 16 }}>
        Showing {filtered.length} {filtered.length === 1 ? 'provider' : 'providers'} across {categoryCount} {categoryCount === 1 ? 'category' : 'categories'}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '36px 10px', color: theme.mutedLight, fontSize: 13 }}>
          No providers match your search.
        </div>
      )}

      {sectionsWithResults.map((section) => (
        <div key={section.type} style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 16 }}>{section.emoji}</span>
            <span className="section-label" style={{ color: theme.text, flex: 1 }}>
              {section.label}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0EA5E9', background: 'rgba(14,165,233,.12)', borderRadius: 999, padding: '2px 9px' }}>
              {section.items.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {section.items.map((facility) => (
              <FacilityCard key={facility.id} facility={facility} onBook={() => actions.openBookAppointment(facility.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
