import { useEffect, useRef } from 'react';
import { AppState, BackHandler } from 'react-native';
import { activity, markActivity } from '../utils/inactivityCore';

const CHECK_EVERY_MS = 15_000;

// Calls `onTimeout` after 10 minutes without a touch (the app locks; it does not sign out). The timer is checked against the clock, not
// counted down, so time spent with the app in the background counts and a paused phone cannot extend it.
// `paused` holds it off during a video visit, where the person may not touch the screen for a while.
export function useInactivityLogout(enabled: boolean, paused: boolean, onTimeout: () => void) {
  // Refs keep the timer from restarting (and counting as activity) every time the app re-renders.
  const pausedRef = useRef(paused);
  const timeoutRef = useRef(onTimeout);
  pausedRef.current = paused;
  timeoutRef.current = onTimeout;

  useEffect(() => {
    if (!enabled) return;
    markActivity(); // signing in starts the clock
    let fired = false;
    const check = () => {
      if (!activity.expired()) { fired = false; return; } // activity after an unlock re-arms it
      if (fired || pausedRef.current) return;
      fired = true; // once per quiet spell
      timeoutRef.current();
    };
    const timer = setInterval(check, CHECK_EVERY_MS);
    // Coming back to the app after a long time away locks at once, before anything is shown.
    const app = AppState.addEventListener('change', (next) => { if (next === 'active') check(); });
    // The Android back button is a use of the app too.
    const back = BackHandler.addEventListener('hardwareBackPress', () => { markActivity(); return false; });
    return () => { clearInterval(timer); app.remove(); back.remove(); };
  }, [enabled]);

  // A video visit ending counts as activity, so the person is not signed out the moment it closes.
  useEffect(() => { if (!paused) markActivity(); }, [paused]);
}
