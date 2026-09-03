import { registerRootComponent, requireOptionalNativeModule } from 'expo';
import App from './src/App';

try {
  const DevMenuPreferences = requireOptionalNativeModule('DevMenuPreferences');
  DevMenuPreferences?.setPreferencesAsync?.({
    showFloatingActionButton: false,
  });
} catch {
  // Ignore in environments where DevMenuPreferences is unavailable
}

registerRootComponent(App);
