import { Logo } from '../components/Logo';
import type { WelliApp } from '../state/useWelliApp';

export function OnboardingModal({ app }: { app: WelliApp }) {
  const { state, actions, onboardingSlides } = app;
  if (!state.showOnboarding) return null;

  const slide = onboardingSlides[state.onboardingStep];
  const isPermissionSlide = !!slide.permission;
  const buttonLabel = state.onboardingStep >= onboardingSlides.length - 1 ? 'Get Started' : 'Continue';

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#fff', zIndex: 50, paddingTop: 54, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 18px' }}>
        <span onClick={actions.closeOnboarding} style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', cursor: 'pointer' }}>
          Skip
        </span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '10px 32px' }}>
        <div style={{ marginBottom: 18 }}>
          <Logo height={34} />
        </div>
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 24,
            background: slide.tint,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 36,
            marginBottom: 26,
          }}
        >
          {slide.emoji}
        </div>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 21, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>{slide.title}</div>
        <div style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.6 }}>{slide.desc}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '6px 0 18px' }}>
        {onboardingSlides.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === state.onboardingStep ? 22 : 6,
              height: 6,
              borderRadius: 999,
              background: i === state.onboardingStep ? '#041E42' : '#e2e8f0',
              transition: 'width .2s',
            }}
          />
        ))}
      </div>
      {isPermissionSlide && (
        <div style={{ padding: '6px 24px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={actions.allowNotifications}
            style={{ width: '100%', background: '#041E42', color: '#fff', border: 'none', borderRadius: 14, padding: 15, fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}
          >
            Allow Notifications
          </button>
          <button onClick={actions.skipNotifications} style={{ width: '100%', background: 'transparent', color: '#64748b', border: 'none', padding: 6, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            Not Now
          </button>
        </div>
      )}
      <div style={{ padding: '6px 24px 30px' }}>
        {!isPermissionSlide && (
          <button
            onClick={actions.onboardingNext}
            style={{ width: '100%', background: '#041E42', color: '#fff', border: 'none', borderRadius: 14, padding: 15, fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}
          >
            {buttonLabel}
          </button>
        )}
      </div>
    </div>
  );
}
