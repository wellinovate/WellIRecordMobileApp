export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 700,
        color: '#0f172a',
        textTransform: 'uppercase',
        letterSpacing: '.04em',
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ width: 40, height: 24, borderRadius: 999, background: on ? '#0EA5E9' : '#cbd5e1', position: 'relative', cursor: 'pointer', flexShrink: 0 }}
    >
      <div style={{ position: 'absolute', top: 2, [on ? 'right' : 'left']: 2, width: 20, height: 20, borderRadius: 999, background: '#fff' }} />
    </div>
  );
}

export function Row({
  emoji,
  label,
  sub,
  onClick,
  danger,
}: {
  emoji: string;
  label: string;
  sub?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', cursor: 'pointer' }}
    >
      <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: danger ? '#dc2626' : '#0f172a' }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1 }}>{sub}</div>}
      </div>
      {!danger && (
        <svg width="14" height="14" viewBox="0 0 20 20">
          <path d="M7 4l6 6-6 6" stroke="#94a3b8" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

export function ToggleRow({
  emoji,
  label,
  sub,
  on,
  onClick,
}: {
  emoji: string;
  label: string;
  sub?: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px' }}>
      <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1 }}>{sub}</div>}
      </div>
      <Toggle on={on} onClick={onClick} />
    </div>
  );
}
