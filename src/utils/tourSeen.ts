import { storage } from './storage';

const KEY = 'wr.tourSeen.v1';

/** True once the person has chosen Get Started, Log In, finished the tour or skipped it. */
export async function hasSeenTour(): Promise<boolean> {
  return (await storage.getItem(KEY)) === '1';
}

export async function markTourSeen(): Promise<void> {
  await storage.setItem(KEY, '1');
}
