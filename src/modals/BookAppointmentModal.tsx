import { ModalHeader } from '../components/ModalHeader';
import type { WelliApp } from '../state/useWelliApp';

const TIME_SLOTS = ['Morning (8am–12pm)', 'Afternoon (12pm–4pm)', 'Evening (4pm–7pm)'];

export function BookAppointmentModal({ app }: { app: WelliApp }) {
  const { state, actions, facilities } = app;
  if (!state.showBookAppointment) return null;

  const facility = facilities.find((f) => f.id === state.bookingFacilityId);
  if (!facility) return null;

  const disabled = !state.bookingDate || !state.bookingTimeSlot;

  return (
    <div className="overlay-fullscreen">
      <ModalHeader title="Book Appointment" onClose={actions.closeBookAppointment} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px 30px' }}>
        <div style={{ background: '#f8fafc', borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: '#fff',
              border: '1px solid #e2e8f0',
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
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{facility.name}</div>
            <div style={{ fontSize: 11.5, color: '#64748b' }}>
              {facility.leadName} &middot; {facility.leadTitle}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Date</div>
        <input
          type="date"
          value={state.bookingDate}
          onChange={(e) => actions.setBookingDate(e.target.value)}
          style={{
            width: '100%',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '11px 14px',
            fontSize: 13.5,
            boxSizing: 'border-box',
            marginBottom: 20,
          }}
        />

        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Time</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {TIME_SLOTS.map((slot) => {
            const selected = state.bookingTimeSlot === slot;
            return (
              <div
                key={slot}
                onClick={() => actions.setBookingTimeSlot(slot)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 14,
                  borderRadius: 14,
                  cursor: 'pointer',
                  border: `1.5px solid ${selected ? '#2563eb' : '#e2e8f0'}`,
                  background: selected ? '#eff6ff' : '#fff',
                  color: '#0f172a',
                }}
              >
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{slot}</span>
                {selected && (
                  <svg width="16" height="16" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="9" fill="#2563eb" />
                    <path d="M6 10l3 3 5-6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ flexShrink: 0, padding: '10px 20px 24px' }}>
        <button
          onClick={actions.confirmBooking}
          disabled={disabled}
          style={{
            width: '100%',
            border: 'none',
            borderRadius: 14,
            padding: 15,
            fontSize: 14.5,
            fontWeight: 700,
            cursor: disabled ? 'not-allowed' : 'pointer',
            background: disabled ? '#e2e8f0' : '#2563eb',
            color: disabled ? '#94a3b8' : '#fff',
          }}
        >
          Request Appointment
        </button>
      </div>
    </div>
  );
}
