interface ModalHeaderProps {
  title: React.ReactNode;
  onClose: () => void;
  onBack?: () => void;
  dark?: boolean;
}

function CircleButton({ onClick, dark, children }: { onClick: () => void; dark?: boolean; children: React.ReactNode }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 30,
        height: 30,
        borderRadius: 999,
        background: dark ? 'rgba(255,255,255,.1)' : '#f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

export function ModalHeader({ title, onClose, onBack, dark }: ModalHeaderProps) {
  const strokeColor = dark ? '#fff' : '#334155';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: onBack ? '14px 18px 6px' : '14px 18px' }}>
      {onBack ? (
        <CircleButton onClick={onBack} dark={dark}>
          <svg width="13" height="13" viewBox="0 0 20 20">
            <path d="M12 4l-6 6 6 6" stroke={strokeColor} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </CircleButton>
      ) : (
        <span style={{ width: 30 }} />
      )}
      <span style={{ fontSize: 15, fontWeight: 700, color: dark ? '#fff' : '#0f172a' }}>{title}</span>
      <CircleButton onClick={onClose} dark={dark}>
        <svg width="13" height="13" viewBox="0 0 20 20">
          <path d="M4 4l12 12M16 4L4 16" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
        </svg>
      </CircleButton>
    </div>
  );
}
