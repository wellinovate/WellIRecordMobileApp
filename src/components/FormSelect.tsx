interface FormSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}

export function FormSelect({ value, onChange, options, placeholder }: FormSelectProps) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: '9px 32px 9px 12px',
          fontSize: 13.5,
          boxSizing: 'border-box',
          color: value ? '#0f172a' : '#94a3b8',
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
        }}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <svg
        width="12"
        height="12"
        viewBox="0 0 20 20"
        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
      >
        <path d="M5 8l5 5 5-5" stroke="#94a3b8" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
