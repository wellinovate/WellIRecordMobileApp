import { LogListModal } from './LogListModal';
import type { WelliApp } from '../state/useWelliApp';

export function ProxyLogModal({ app }: { app: WelliApp }) {
  const { state, actions, proxyLog } = app;
  if (!state.showProxyLog) return null;
  return (
    <LogListModal
      title="Proxy Access Log"
      intro="Actions taken on behalf of dependents in your care."
      entries={proxyLog}
      onClose={actions.closeProxyLog}
    />
  );
}
