import { ModalHeader } from '../components/ModalHeader';
import type { LogEntry } from '../data/types';

interface LogListModalProps {
  title: string;
  intro?: string;
  entries: LogEntry[];
  onClose: () => void;
}

export function LogListModal({ title, intro, entries, onClose }: LogListModalProps) {
  return (
    <div className="overlay-fullscreen">
      <ModalHeader title={title} onClose={onClose} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {intro && <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{intro}</div>}
        {entries.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: 12, background: '#f8fafc', borderRadius: 14 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                background: '#fff',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              {a.emoji}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{a.title}</div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>{a.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
