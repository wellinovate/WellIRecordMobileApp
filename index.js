import {
  registerRootComponent,
  requireOptionalNativeModule,
} from 'expo';

import { registerGlobals } from '@livekit/react-native';

import App from './src/App.expo';

registerGlobals();

try {
  const DevMenuPreferences =
    requireOptionalNativeModule('DevMenuPreferences');

  DevMenuPreferences?.setPreferencesAsync?.({
    showFloatingActionButton: false,
  });
} catch {
  // Ignore in environments where DevMenuPreferences is unavailable
}

registerRootComponent(App);