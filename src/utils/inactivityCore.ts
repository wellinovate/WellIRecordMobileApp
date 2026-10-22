// Tracks the last time the person touched the app, so the app can lock itself after a quiet spell.
// Kept free of React Native so it can be tested.
export const INACTIVITY_MS = 10 * 60 * 1000;

export interface InactivityTracker {
  /** Call on any touch or button press. */
  touch(): void;
  /** True when no touch has been seen for the whole timeout. */
  expired(): boolean;
  /** Milliseconds left before it expires (0 when expired). */
  remaining(): number;
}

export function createInactivityTracker(timeoutMs: number = INACTIVITY_MS, now: () => number = Date.now): InactivityTracker {
  let last = now();
  return {
    touch() { last = now(); },
    expired() { return now() - last >= timeoutMs; },
    remaining() { return Math.max(0, timeoutMs - (now() - last)); },
  };
}

// One tracker for the whole app. Screens, modals and the root view all call markActivity.
export const activity = createInactivityTracker();
export const markActivity = () => activity.touch();
