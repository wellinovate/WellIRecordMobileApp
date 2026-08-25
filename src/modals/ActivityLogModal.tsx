import { LogListModal } from './LogListModal';
import type { WelliApp } from '../state/useWelliApp';

export function ActivityLogModal({ app }: { app: WelliApp }) {
  const { state, actions, activityLog } = app;
  if (!state.showActivity) return null;
  return <LogListModal title="Recent Activity" entries={activityLog} onClose={actions.closeActivity} />;
}
