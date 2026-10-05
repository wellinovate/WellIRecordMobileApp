/**
 * WelliRecord Offline-First Sync & Emergency Vault Service
 *
 * Provides:
 * 1. Persistent Emergency Medical ID & QR offline caching in secure storage
 * 2. Stale-While-Revalidate caching for Health Records vault
 * 3. Offline mutation sync queue for uploads, prescription orders, and edits
 * 4. Automatic background synchronization upon network recovery
 */

import { storage } from '../utils/secureStorage';
import type { HealthRecord } from '../data/types';

export interface EmergencyOfflineProfile {
  id: string;
  name: string;
  wrId?: string;
  dob: string;
  bloodType: string;
  genotype: string;
  allergies: string;
  conditions: string;
  contact: string;
  emergencyContacts?: Array<{ name?: string; phone?: string; relationship?: string }>;
  hmoProvider?: string;
  hmoPolicyNumber?: string;
  qrPayload: string;
  lastUpdated: number;
}

export type QueuedActionType =
  | 'CREATE_RECORD'
  | 'DELETE_RECORD'
  | 'UPDATE_PROFILE'
  | 'ORDER_PRESCRIPTION';

export interface QueuedSyncItem {
  id: string;
  type: QueuedActionType;
  payload: any;
  createdAt: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
}

type SyncListener = (status: {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: number | null;
}) => void;

class OfflineSyncService {
  private isOnlineState: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSimulatedOffline: boolean = false;
  private isSyncing: boolean = false;
  private lastSyncedAt: number | null = null;
  private listeners: Set<SyncListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
    }
  }

  // -------------------------------------------------------------
  // NETWORK STATUS & SIMULATION
  // -------------------------------------------------------------

  public isOnline(): boolean {
    if (this.isSimulatedOffline) return false;
    return typeof navigator !== 'undefined' ? navigator.onLine : this.isOnlineState;
  }

  public setSimulatedOffline(offline: boolean) {
    this.isSimulatedOffline = offline;
    this.notify();
    if (!offline && this.isOnline()) {
      this.processQueue();
    }
  }

  public isSimulationActive(): boolean {
    return this.isSimulatedOffline;
  }

  private handleNetworkChange(online: boolean) {
    this.isOnlineState = online;
    this.notify();
    if (online && !this.isSimulatedOffline) {
      this.processQueue();
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener({
      isOnline: this.isOnline(),
      isSyncing: this.isSyncing,
      pendingCount: 0,
      lastSyncedAt: this.lastSyncedAt,
    });
    this.getQueueCount().then((count) => {
      listener({
        isOnline: this.isOnline(),
        isSyncing: this.isSyncing,
        pendingCount: count,
        lastSyncedAt: this.lastSyncedAt,
      });
    });
    return () => this.listeners.delete(listener);
  }

  private async notify() {
    const pendingCount = await this.getQueueCount();
    const payload = {
      isOnline: this.isOnline(),
      isSyncing: this.isSyncing,
      pendingCount,
      lastSyncedAt: this.lastSyncedAt,
    };
    this.listeners.forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.error('[offlineSync] listener error:', e);
      }
    });
  }

  // -------------------------------------------------------------
  // EMERGENCY MEDICAL ID & QR OFFLINE CACHE
  // -------------------------------------------------------------

  private readonly EMERGENCY_CACHE_KEY = 'welli_emergency_offline_profile';

  public async cacheEmergencyProfile(profile: Partial<EmergencyOfflineProfile>): Promise<void> {
    try {
      const existing = (await this.getCachedEmergencyProfile()) || ({} as EmergencyOfflineProfile);
      const updated: EmergencyOfflineProfile = {
        id: profile.id || existing.id || 'me',
        name: profile.name || existing.name || 'WelliRecord Patient',
        wrId: profile.wrId || existing.wrId || 'WR-892401',
        dob: profile.dob || existing.dob || '1992-06-14',
        bloodType: profile.bloodType || existing.bloodType || 'O+',
        genotype: profile.genotype || existing.genotype || 'AA',
        allergies: profile.allergies || existing.allergies || 'Penicillin, Peanuts (Severe)',
        conditions: profile.conditions || existing.conditions || 'Mild Asthma',
        contact: profile.contact || existing.contact || 'Dr. Chidi Okafor (+234 803 123 4567)',
        emergencyContacts: profile.emergencyContacts || existing.emergencyContacts || [],
        hmoProvider: profile.hmoProvider || existing.hmoProvider || 'Hygeia HMO Nigeria',
        hmoPolicyNumber: profile.hmoPolicyNumber || existing.hmoPolicyNumber || 'HYG-90214-LAG',
        qrPayload:
          profile.qrPayload ||
          existing.qrPayload ||
          `https://wellirecord.com/emergency/${profile.wrId || existing.wrId || 'me'}`,
        lastUpdated: Date.now(),
      };
      await storage.setItem(this.EMERGENCY_CACHE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('[offlineSync] Failed to cache emergency profile:', err);
    }
  }

  public async getCachedEmergencyProfile(): Promise<EmergencyOfflineProfile | null> {
    try {
      const raw = await storage.getItem(this.EMERGENCY_CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------
  // HEALTH RECORDS OFFLINE VAULT CACHE
  // -------------------------------------------------------------

  private getRecordsCacheKey(ownerId: string = 'me'): string {
    return `welli_offline_records_${ownerId}`;
  }

  public async cacheRecords(ownerId: string = 'me', records: HealthRecord[]): Promise<void> {
    try {
      const key = this.getRecordsCacheKey(ownerId);
      await storage.setItem(
        key,
        JSON.stringify({
          cachedAt: Date.now(),
          records,
        })
      );
    } catch (err) {
      console.warn('[offlineSync] Failed to cache health records:', err);
    }
  }

  public async getCachedRecords(ownerId: string = 'me'): Promise<HealthRecord[] | null> {
    try {
      const key = this.getRecordsCacheKey(ownerId);
      const raw = await storage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.records) ? parsed.records : null;
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------
  // MUTATION SYNC QUEUE
  // -------------------------------------------------------------

  private readonly SYNC_QUEUE_KEY = 'welli_offline_mutation_queue';

  public async getQueue(): Promise<QueuedSyncItem[]> {
    try {
      const raw = await storage.getItem(this.SYNC_QUEUE_KEY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  public async getQueueCount(): Promise<number> {
    const q = await this.getQueue();
    return q.filter((item) => item.status === 'pending' || item.status === 'failed').length;
  }

  private async saveQueue(queue: QueuedSyncItem[]): Promise<void> {
    try {
      await storage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(queue));
      this.notify();
    } catch (err) {
      console.error('[offlineSync] Failed to save queue:', err);
    }
  }

  public async enqueue(type: QueuedActionType, payload: any): Promise<QueuedSyncItem> {
    const queue = await this.getQueue();
    const item: QueuedSyncItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      payload,
      createdAt: Date.now(),
      retryCount: 0,
      status: 'pending',
    };
    queue.push(item);
    await this.saveQueue(queue);

    // If online, attempt immediate sync
    if (this.isOnline()) {
      this.processQueue();
    }

    return item;
  }

  public async processQueue(): Promise<{ synced: number; failed: number }> {
    if (!this.isOnline() || this.isSyncing) {
      return { synced: 0, failed: 0 };
    }

    this.isSyncing = true;
    this.notify();

    let synced = 0;
    let failed = 0;
    const queue = await this.getQueue();
    const remainingQueue: QueuedSyncItem[] = [];

    for (const item of queue) {
      if (item.status === 'syncing') continue;
      item.status = 'syncing';

      try {
        await this.executeMutation(item);
        synced++;
        // Successfully synced — do not re-add to remainingQueue
      } catch (err: any) {
        console.warn(`[offlineSync] Failed to sync item ${item.id}:`, err);
        item.retryCount++;
        item.status = 'failed';
        item.error = err?.message || String(err);
        failed++;
        // Keep in queue if retryCount is within reason (< 5)
        if (item.retryCount < 5) {
          remainingQueue.push(item);
        }
      }
    }

    await this.saveQueue(remainingQueue);
    this.isSyncing = false;
    this.lastSyncedAt = Date.now();
    this.notify();

    return { synced, failed };
  }

  private async executeMutation(item: QueuedSyncItem): Promise<void> {
    // Dynamic import to avoid circular dependency
    const { apiClient } = await import('./apiClient');

    switch (item.type) {
      case 'CREATE_RECORD': {
        await apiClient.post('/records', item.payload);
        break;
      }
      case 'DELETE_RECORD': {
        await apiClient.delete(`/records/${item.payload.recordId}`);
        break;
      }
      case 'UPDATE_PROFILE': {
        await apiClient.post('/profile/update', item.payload);
        break;
      }
      case 'ORDER_PRESCRIPTION': {
        await apiClient.post('/pharmacy/orders', item.payload);
        break;
      }
      default:
        throw new Error(`Unknown mutation type: ${(item as any).type}`);
    }
  }

  public async clearQueue(): Promise<void> {
    await this.saveQueue([]);
  }
}

export const offlineSyncService = new OfflineSyncService();
export default offlineSyncService;
