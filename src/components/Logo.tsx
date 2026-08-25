interface LogoProps {
  height?: number;
  color?: string;
}

export function Logo({ height = 26, color = '#041E42' }: LogoProps) {
  const markSize = height * 1.15;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: height * 0.28, height }}>
      <svg width={markSize} height={markSize} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <path
          d="M12 2.3c-.28 0-.56.06-.82.19L4.9 5.4a1.85 1.85 0 00-1 1.65v5.02c0 5.02 3.06 8.98 7.66 10.47.28.09.58.09.86 0 4.6-1.49 7.66-5.45 7.66-10.47V7.05a1.85 1.85 0 00-1-1.65l-6.28-2.9a1.85 1.85 0 00-.82-.2z"
          fill={color}
        />
        <path d="M6 15.2l6-6.4 6 6.4" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M7.4 17.6l4.6-4.9 4.6 4.9" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M16.7 4.6h1.3v1.3h1.3v1.3h-1.3v1.3h-1.3V7.2h-1.3V5.9h1.3z" fill="#fff" />
      </svg>
      <span
        style={{
          fontFamily: "'Bricolage Grotesque', sans-serif",
          fontWeight: 800,
          fontSize: height * 0.62,
          color,
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
        }}
      >
        WelliRecord
      </span>
    </div>
  );
}
