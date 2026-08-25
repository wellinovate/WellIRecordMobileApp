import { ModalHeader } from '../components/ModalHeader';
import { LANGUAGES } from '../data/mockData';
import type { WelliApp } from '../state/useWelliApp';

export function LanguageModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  if (!state.showLanguage) return null;

  return (
    <div className="overlay-fullscreen">
      <ModalHeader
        title={
          <>
            Language <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: 12 }}>(optional)</span>
          </>
        }
        onClose={actions.closeLanguage}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 20px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {LANGUAGES.map((l) => {
          const checked = state.language === l;
          return (
            <div
              key={l}
              onClick={() => actions.setLanguage(l)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: 14,
                borderRadius: 14,
                cursor: 'pointer',
                border: `1.5px solid ${checked ? '#0EA5E9' : '#e2e8f0'}`,
                background: checked ? '#f0f9ff' : '#fff',
                color: '#0f172a',
              }}
            >
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{l}</span>
              {checked && (
                <svg width="16" height="16" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="9" fill="#0EA5E9" />
                  <path d="M6 10l3 3 5-6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
