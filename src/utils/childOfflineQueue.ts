// Offline capture for a child's vaccine doses and growth measurements.
//
// When a save fails because the phone has no connection, the entry is stored
// on the phone and shown with a "waiting to sync" label. It is sent when the
// app is next online. Entries are never dropped silently: one the server
// refuses stays in the list with the reason until the guardian discards it.

import { ApiError, getAuthToken } from '../services/apiClient';
import { childHealthService, type ChildProfileBundle, type GrowthInput, type VaccinationInput } from '../services/childHealthService';
import type { ImmunizationSchedule } from './immunization';
import { storage } from './secureStorage';

const QUEUE_KEY = 'welli_child_offline_queue';
const CACHE_PREFIX = 'welli_child_cache_';
const CACHE_INDEX = 'welli_child_cache_index';
const MAX_ATTEMPTS = 5;

export type QueueItem = {
  id: string;
  memberId: string;
  createdAt: number;
  attempts: number;
  /** Set when the server refused the entry. It stays until discarded. */
  blockedReason?: string;
} & (
  | { kind: 'vaccination'; payload: VaccinationInput }
  | { kind: 'growth'; payload: GrowthInput & { clientId: string } }
);

/** True when the request never reached the server. */
export function isNetworkError(err: unknown): boolean {
  return err instanceof ApiError && (err.statusCode === 0 || err.statusCode === 408 || err.statusCode === 502 || err.statusCode === 503 || err.statusCode === 504);
}

export const newLocalId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

type Listener = () => void;
const listeners = new Set<Listener>();
let flushing = false;

async function read(): Promise<QueueItem[]> {
  try {
    const raw = await storage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueueItem[]) : [];
  } catch {
    return [];
  }
}

async function write(items: QueueItem[]): Promise<void> {
  await storage.setItem(QUEUE_KEY, JSON.stringify(items));
  listeners.forEach((l) => l());
}

export const childOfflineQueue = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  async list(memberId?: string): Promise<QueueItem[]> {
    const all = await read();
    return memberId ? all.filter((i) => i.memberId === memberId) : all;
  },

  async addVaccination(memberId: string, payload: VaccinationInput): Promise<QueueItem> {
    const item: QueueItem = { id: newLocalId(), memberId, createdAt: Date.now(), attempts: 0, kind: 'vaccination', payload };
    await write([...(await read()), item]);
    return item;
  },

  async addGrowth(memberId: string, payload: GrowthInput): Promise<QueueItem> {
    const id = newLocalId();
    const item: QueueItem = { id, memberId, createdAt: Date.now(), attempts: 0, kind: 'growth', payload: { ...payload, clientId: `g_${id}` } };
    await write([...(await read()), item]);
    return item;
  },

  async remove(id: string): Promise<void> {
    await write((await read()).filter((i) => i.id !== id));
  },

  /** Sends what it can. Returns how many entries reached the server. */
  async flush(): Promise<number> {
    if (flushing || !getAuthToken()) return 0;
    flushing = true;
    let synced = 0;
    try {
      let items = await read();
      for (const item of items) {
        if (item.blockedReason) continue;
        try {
          if (item.kind === 'vaccination') await childHealthService.addVaccination(item.memberId, item.payload);
          else await childHealthService.addGrowth(item.memberId, item.payload);
          items = items.filter((i) => i.id !== item.id);
          synced += 1;
        } catch (err) {
          if (isNetworkError(err)) break; // still offline, try again later
          const status = err instanceof ApiError ? err.statusCode : 0;
          if (status === 409 && item.kind === 'vaccination') {
            // The dose is already on the server.
            items = items.filter((i) => i.id !== item.id);
            synced += 1;
            continue;
          }
          const message = err instanceof Error ? err.message : 'The server refused this entry';
          items = items.map((i) => {
            if (i.id !== item.id) return i;
            const attempts = i.attempts + 1;
            const permanent = status >= 400 && status < 500;
            return permanent || attempts >= MAX_ATTEMPTS ? { ...i, attempts, blockedReason: message } : { ...i, attempts };
          });
        }
      }
      await write(items);
    } finally {
      flushing = false;
    }
    return synced;
  },
};

// Last good copy of a child's profile, so it can be read without a connection.
export interface CachedChild {
  bundle: ChildProfileBundle;
  schedule: ImmunizationSchedule;
  savedAt: number;
}

export const childCache = {
  async get(memberId: string): Promise<CachedChild | null> {
    try {
      const raw = await storage.getItem(CACHE_PREFIX + memberId);
      return raw ? (JSON.parse(raw) as CachedChild) : null;
    } catch {
      return null;
    }
  },
  async set(memberId: string, value: CachedChild): Promise<void> {
    await storage.setItem(CACHE_PREFIX + memberId, JSON.stringify(value));
    try {
      const ids: string[] = JSON.parse((await storage.getItem(CACHE_INDEX)) || '[]');
      if (!ids.includes(memberId)) await storage.setItem(CACHE_INDEX, JSON.stringify([...ids, memberId]));
    } catch {
      /* the index only helps clean-up on sign out */
    }
  },
};

/** Removes every saved child profile and queued entry. Call when the person signs out. */
export async function clearChildOfflineData(): Promise<void> {
  try {
    const ids: string[] = JSON.parse((await storage.getItem(CACHE_INDEX)) || '[]');
    for (const id of ids) await storage.removeItem(CACHE_PREFIX + id);
    await storage.removeItem(CACHE_INDEX);
    await storage.removeItem(QUEUE_KEY);
    listeners.forEach((l) => l());
  } catch {
    /* nothing to clear */
  }
}
