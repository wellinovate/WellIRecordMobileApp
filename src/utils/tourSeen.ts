import { storage } from './storage';

const STORAGE_NAME = 'wr.tourSeen.v1';

/** True once the person has chosen Get Started, Log In, finished the tour or skipped it. */
export async function hasSeenTour(): Promise<boolean> {
  return (await storage.getItem(STORAGE_NAME)) === '1';
}

export async function markTourSeen(): Promise<void> {
  await storage.setItem(STORAGE_NAME, '1');
}
