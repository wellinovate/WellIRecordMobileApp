// Offline capture for a child's vaccine doses and growth measurements.
//
// When a save fails because the phone has no connection, the entry is stored
// on the phone and shown with a "waiting to sync" label. It is sent when the
// app is next online. Entries are never dropped silently: one the server
// refuses stays in the list with the reason until the guardian discards it.
//
// This file has no React Native imports so it can be tested in plain Node.
// childOfflineQueue.ts wires it to the real storage and API.

export const QUEUE_KEY = 'welli_child_offline_queue';
export const CACHE_PREFIX = 'welli_child_cache_';
export const CACHE_INDEX = 'welli_child_cache_index';
export const MAX_ATTEMPTS = 5;

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface QueueApi {
  addVaccination(memberId: string, payload: any): Promise<unknown>;
  addGrowth(memberId: string, payload: any): Promise<unknown>;
}

export type QueueItem = {
  id: string;
  memberId: string;
  createdAt: number;
  attempts: number;
  /** Set when the server refused the entry. It stays until discarded. */
  blockedReason?: string;
} & (
  | { kind: 'vaccination'; payload: any }
  | { kind: 'growth'; payload: any & { clientId: string } }
);

/** True when the request never reached the server, or the server was unavailable. */
export function isNetworkError(err: unknown): boolean {
  const e = err as { name?: string; statusCode?: number } | null;
  return Boolean(e && e.name === 'ApiError' && [0, 408, 502, 503, 504].includes(Number(e.statusCode)));
}

export const newLocalId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

type Listener = () => void;

export function createChildOfflineQueue(deps: { store: KeyValueStore; api: QueueApi; hasToken: () => boolean }) {
  const { store, api, hasToken } = deps;
  const listeners = new Set<Listener>();
  let flushing = false;

  async function read(): Promise<QueueItem[]> {
    try {
      const raw = await store.getItem(QUEUE_KEY);
      return raw ? (JSON.parse(raw) as QueueItem[]) : [];
    } catch {
      return [];
    }
  }

  async function write(items: QueueItem[]): Promise<void> {
    await store.setItem(QUEUE_KEY, JSON.stringify(items));
    listeners.forEach((l) => l());
  }

  return {
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

    async addVaccination(memberId: string, payload: any): Promise<QueueItem> {
      const item: QueueItem = { id: newLocalId(), memberId, createdAt: Date.now(), attempts: 0, kind: 'vaccination', payload };
      await write([...(await read()), item]);
      return item;
    },

    async addGrowth(memberId: string, payload: any): Promise<QueueItem> {
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
      if (flushing || !hasToken()) return 0;
      flushing = true;
      let synced = 0;
      try {
        let items = await read();
        for (const item of items) {
          if (item.blockedReason) continue;
          try {
            if (item.kind === 'vaccination') await api.addVaccination(item.memberId, item.payload);
            else await api.addGrowth(item.memberId, item.payload);
            items = items.filter((i) => i.id !== item.id);
            synced += 1;
          } catch (err) {
            if (isNetworkError(err)) break; // still offline, try again later
            const status = Number((err as any)?.statusCode) || 0;
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

    /** Removes every queued entry and every saved child profile. Call on sign out. */
    async clearAll(): Promise<void> {
      try {
        const ids: string[] = JSON.parse((await store.getItem(CACHE_INDEX)) || '[]');
        for (const id of ids) await store.removeItem(CACHE_PREFIX + id);
        await store.removeItem(CACHE_INDEX);
        await store.removeItem(QUEUE_KEY);
        listeners.forEach((l) => l());
      } catch {
        /* nothing to clear */
      }
    },
  };
}

export function createChildCache<T>(store: KeyValueStore) {
  return {
    async get(memberId: string): Promise<T | null> {
      try {
        const raw = await store.getItem(CACHE_PREFIX + memberId);
        return raw ? (JSON.parse(raw) as T) : null;
      } catch {
        return null;
      }
    },
    async set(memberId: string, value: T): Promise<void> {
      await store.setItem(CACHE_PREFIX + memberId, JSON.stringify(value));
      try {
        const ids: string[] = JSON.parse((await store.getItem(CACHE_INDEX)) || '[]');
        if (!ids.includes(memberId)) await store.setItem(CACHE_INDEX, JSON.stringify([...ids, memberId]));
      } catch {
        /* the index only helps clean-up on sign out */
      }
    },
  };
}
