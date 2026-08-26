import { QRCodeSVG } from 'qrcode.react';

interface BridgeCodeCardProps {
  code: string;
  link: string;
  size?: number;
}

export function BridgeCodeCard({ code, link, size = 168 }: BridgeCodeCardProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ background: '#fff', padding: 14, borderRadius: 18, border: '1px solid #e2e8f0', boxShadow: '0 4px 14px rgba(15,23,42,.06)' }}>
        <QRCodeSVG value={`https://${link}`} size={size} fgColor="#041E42" bgColor="#ffffff" level="M" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: '#0f172a',
          }}
        >
          {code}
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{link}</div>
      </div>
    </div>
  );
}
