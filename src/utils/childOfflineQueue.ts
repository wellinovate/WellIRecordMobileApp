// Offline capture for a child's vaccine doses and growth measurements.
// The logic is in childOfflineQueueCore.ts. This file connects it to the phone's
// secure storage and the live API.

import { getAuthToken } from '../services/apiClient';
import { childHealthService, type ChildProfileBundle } from '../services/childHealthService';
import type { ImmunizationSchedule } from './immunization';
import { storage } from './secureStorage';
import { createChildCache, createChildOfflineQueue } from './childOfflineQueueCore';

export { isNetworkError, newLocalId, type QueueItem } from './childOfflineQueueCore';

export const childOfflineQueue = createChildOfflineQueue({
  store: storage,
  api: childHealthService,
  hasToken: () => Boolean(getAuthToken()),
});

// Last good copy of a child's profile, so it can be read without a connection.
export interface CachedChild {
  bundle: ChildProfileBundle;
  schedule: ImmunizationSchedule;
  savedAt: number;
}

export const childCache = createChildCache<CachedChild>(storage);

/** Removes every saved child profile and queued entry. Call when the person signs out. */
export const clearChildOfflineData = () => childOfflineQueue.clearAll();
