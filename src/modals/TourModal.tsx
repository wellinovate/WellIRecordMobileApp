import { Modal } from '../components/ActivityModal';
import { WelcomeTour } from '../components/WelcomeTour';
import type { WelliApp } from '../state/useWelliApp';

/** The feature tour, reopened from Profile. Always mounted; returns null while closed. */
export function TourModal({ app }: { app: WelliApp }) {
  const { state, actions } = app;
  if (!state.showTour) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={actions.closeTour}>
      <WelcomeTour onSkip={actions.closeTour} onFinish={actions.closeTour} finalLabel="Done" />
    </Modal>
  );
}
