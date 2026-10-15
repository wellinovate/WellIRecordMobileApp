/**
 * WelliRecord Offline-First Sync & Emergency Vault Service
 *
 * Provides:
 * 1. Persistent Emergency Medical ID & QR offline caching
 * 2. Offline caching for health records
 * 3. Offline mutation queue
 * 4. Queue synchronization when connectivity is available
 * 5. Simulated offline mode for development/demo purposes
 *
 * NOTE:
 * - Web can use navigator.onLine and browser online/offline events.
 * - Native currently assumes online unless simulated offline mode is enabled.
 * - Native network monitoring can later be upgraded with @react-native-community/netinfo.
 */

import { Platform } from "react-native";

import type { HealthRecord } from "../data/types";
import { storage } from "../utils/secureStorage";

/* =========================================================
   TYPES
========================================================= */

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

  emergencyContacts?: Array<{
    name?: string;
    phone?: string;
    relationship?: string;
  }>;

  hmoProvider?: string;
  hmoPolicyNumber?: string;

  /**
   * Must be a real server-issued, token-gated share link.
   * Never generate a predictable emergency URL from wrId/id.
   */
  qrPayload: string;

  lastUpdated: number;
}

export type QueuedActionType =
  | "CREATE_RECORD"
  | "DELETE_RECORD"
  | "UPDATE_PROFILE"
  | "ORDER_PRESCRIPTION";

export interface QueuedSyncItem {
  id: string;
  type: QueuedActionType;
  payload: any;
  createdAt: number;
  retryCount: number;
  status: "pending" | "syncing" | "failed";
  error?: string;
}

export interface OfflineSyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: number | null;
}

type SyncListener = (
  status: OfflineSyncStatus,
) => void;

/* =========================================================
   CONSTANTS
========================================================= */

const EMERGENCY_CACHE_KEY =
  "welli_emergency_offline_profile";

const SYNC_QUEUE_KEY =
  "welli_offline_mutation_queue";

const RECORD_CACHE_PREFIX =
  "welli_offline_records_";

const MAX_SYNC_RETRIES = 5;

/* =========================================================
   PLATFORM HELPERS
========================================================= */

/**
 * Safely reads navigator.onLine only when running on web.
 *
 * Returns:
 * - true / false when browser connectivity state is available
 * - null when unavailable or running on native
 */
function getWebOnlineState(): boolean | null {
  if (Platform.OS !== "web") {
    return null;
  }

  try {
    const navigatorRef = (
      globalThis as typeof globalThis & {
        navigator?: {
          onLine?: boolean;
        };
      }
    ).navigator;

    if (
      typeof navigatorRef?.onLine === "boolean"
    ) {
      return navigatorRef.onLine;
    }
  } catch {
    // Browser connectivity state unavailable.
  }

  return null;
}

/**
 * Safely returns the browser window without assuming
 * window exists in React Native.
 */
function getWebWindow():
  | {
      addEventListener?: (
        event: string,
        callback: () => void,
      ) => void;
    }
  | null {
  if (Platform.OS !== "web") {
    return null;
  }

  try {
    const globalRef = globalThis as typeof globalThis & {
      window?: {
        addEventListener?: (
          event: string,
          callback: () => void,
        ) => void;
      };
    };

    return globalRef.window ?? null;
  } catch {
    return null;
  }
}

/* =========================================================
   SERVICE
========================================================= */

class OfflineSyncService {
  /**
   * Native currently defaults to online.
   *
   * Web uses navigator.onLine when available.
   */
  private isOnlineState: boolean =
    getWebOnlineState() ?? true;

  private isSimulatedOffline = false;

  private isSyncing = false;

  private lastSyncedAt: number | null = null;

  private listeners = new Set<SyncListener>();

  constructor() {
    this.registerWebNetworkListeners();
  }

  /* =======================================================
     NETWORK
  ======================================================= */

  private registerWebNetworkListeners(): void {
    const webWindow = getWebWindow();

    if (
      !webWindow ||
      typeof webWindow.addEventListener !==
        "function"
    ) {
      return;
    }

    webWindow.addEventListener(
      "online",
      this.handleWebOnline,
    );

    webWindow.addEventListener(
      "offline",
      this.handleWebOffline,
    );
  }

  private handleWebOnline = (): void => {
    this.handleNetworkChange(true);
  };

  private handleWebOffline = (): void => {
    this.handleNetworkChange(false);
  };

  public isOnline(): boolean {
    if (this.isSimulatedOffline) {
      return false;
    }

    const webOnlineState =
      getWebOnlineState();

    if (webOnlineState !== null) {
      return webOnlineState;
    }

    return this.isOnlineState;
  }

  public setSimulatedOffline(
    offline: boolean,
  ): void {
    this.isSimulatedOffline = offline;

    void this.notify();

    if (!offline && this.isOnline()) {
      void this.processQueue();
    }
  }

  public isSimulationActive(): boolean {
    return this.isSimulatedOffline;
  }

  private handleNetworkChange(
    online: boolean,
  ): void {
    this.isOnlineState = online;

    void this.notify();

    if (
      online &&
      !this.isSimulatedOffline
    ) {
      void this.processQueue();
    }
  }

  /* =======================================================
     SUBSCRIPTIONS
  ======================================================= */

  public subscribe(
    listener: SyncListener,
  ): () => void {
    this.listeners.add(listener);

    /**
     * Give subscribers an immediate snapshot so UI
     * does not need to wait for storage.
     */
    listener({
      isOnline: this.isOnline(),
      isSyncing: this.isSyncing,
      pendingCount: 0,
      lastSyncedAt: this.lastSyncedAt,
    });

    /**
     * Then asynchronously provide the real queue count.
     */
    void this.getQueueCount()
      .then((pendingCount) => {
        if (!this.listeners.has(listener)) {
          return;
        }

        listener({
          isOnline: this.isOnline(),
          isSyncing: this.isSyncing,
          pendingCount,
          lastSyncedAt:
            this.lastSyncedAt,
        });
      })
      .catch((error) => {
        console.warn(
          "[offlineSync] Failed to read queue count:",
          error,
        );
      });

    return () => {
      this.listeners.delete(listener);
    };
  }

  private async notify(): Promise<void> {
    let pendingCount = 0;

    try {
      pendingCount =
        await this.getQueueCount();
    } catch (error) {
      console.warn(
        "[offlineSync] Failed to calculate pending queue count:",
        error,
      );
    }

    const payload: OfflineSyncStatus = {
      isOnline: this.isOnline(),
      isSyncing: this.isSyncing,
      pendingCount,
      lastSyncedAt: this.lastSyncedAt,
    };

    this.listeners.forEach(
      (listener) => {
        try {
          listener(payload);
        } catch (error) {
          console.error(
            "[offlineSync] Listener error:",
            error,
          );
        }
      },
    );
  }

  /* =======================================================
     EMERGENCY PROFILE CACHE
  ======================================================= */

  public async cacheEmergencyProfile(
    profile: Partial<EmergencyOfflineProfile>,
  ): Promise<void> {
    try {
      const existing =
        (await this.getCachedEmergencyProfile()) ??
        ({} as EmergencyOfflineProfile);

      const updated: EmergencyOfflineProfile = {
        id:
          profile.id ??
          existing.id ??
          "me",

        name:
          profile.name ??
          existing.name ??
          "WelliRecord Patient",

        wrId:
          profile.wrId ??
          existing.wrId ??
          "WR-892401",

        dob:
          profile.dob ??
          existing.dob ??
          "1992-06-14",

        bloodType:
          profile.bloodType ??
          existing.bloodType ??
          "O+",

        genotype:
          profile.genotype ??
          existing.genotype ??
          "AA",

        allergies:
          profile.allergies ??
          existing.allergies ??
          "Penicillin, Peanuts (Severe)",

        conditions:
          profile.conditions ??
          existing.conditions ??
          "Mild Asthma",

        contact:
          profile.contact ??
          existing.contact ??
          "Dr. Chidi Okafor (+234 803 123 4567)",

        emergencyContacts:
          profile.emergencyContacts ??
          existing.emergencyContacts ??
          [],

        hmoProvider:
          profile.hmoProvider ??
          existing.hmoProvider ??
          "Hygeia HMO Nigeria",

        hmoPolicyNumber:
          profile.hmoPolicyNumber ??
          existing.hmoPolicyNumber ??
          "HYG-90214-LAG",

        /**
         * Deliberately no predictable fallback.
         *
         * Emergency QR links must be issued by the
         * server/share service.
         */
        qrPayload:
          profile.qrPayload ??
          existing.qrPayload ??
          "",

        lastUpdated: Date.now(),
      };

      await storage.setItem(
        EMERGENCY_CACHE_KEY,
        JSON.stringify(updated),
      );
    } catch (error) {
      console.warn(
        "[offlineSync] Failed to cache emergency profile:",
        error,
      );
    }
  }

  public async getCachedEmergencyProfile(): Promise<EmergencyOfflineProfile | null> {
    try {
      const raw =
        await storage.getItem(
          EMERGENCY_CACHE_KEY,
        );

      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);

      if (
        !parsed ||
        typeof parsed !== "object"
      ) {
        return null;
      }

      return parsed as EmergencyOfflineProfile;
    } catch (error) {
      console.warn(
        "[offlineSync] Failed to read emergency profile:",
        error,
      );

      return null;
    }
  }

  /* =======================================================
     HEALTH RECORD CACHE
  ======================================================= */

  private getRecordsCacheKey(
    ownerId = "me",
  ): string {
    return `${RECORD_CACHE_PREFIX}${ownerId}`;
  }

  public async cacheRecords(
    ownerId = "me",
    records: HealthRecord[],
  ): Promise<void> {
    try {
      const key =
        this.getRecordsCacheKey(ownerId);

      await storage.setItem(
        key,
        JSON.stringify({
          cachedAt: Date.now(),
          records,
        }),
      );
    } catch (error) {
      console.warn(
        "[offlineSync] Failed to cache health records:",
        error,
      );
    }
  }

  public async getCachedRecords(
    ownerId = "me",
  ): Promise<HealthRecord[] | null> {
    try {
      const key =
        this.getRecordsCacheKey(ownerId);

      const raw =
        await storage.getItem(key);

      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed?.records)) {
        return null;
      }

      return parsed.records as HealthRecord[];
    } catch (error) {
      console.warn(
        "[offlineSync] Failed to read cached health records:",
        error,
      );

      return null;
    }
  }

  /* =======================================================
     SYNC QUEUE STORAGE
  ======================================================= */

  public async getQueue(): Promise<
    QueuedSyncItem[]
  > {
    try {
      const raw =
        await storage.getItem(
          SYNC_QUEUE_KEY,
        );

      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed as QueuedSyncItem[];
    } catch (error) {
      console.warn(
        "[offlineSync] Failed to read queue:",
        error,
      );

      return [];
    }
  }

  public async getQueueCount(): Promise<number> {
    const queue = await this.getQueue();

    return queue.filter(
      (item) =>
        item.status === "pending" ||
        item.status === "failed",
    ).length;
  }

  private async saveQueue(
    queue: QueuedSyncItem[],
    notifyListeners = true,
  ): Promise<void> {
    try {
      await storage.setItem(
        SYNC_QUEUE_KEY,
        JSON.stringify(queue),
      );

      if (notifyListeners) {
        await this.notify();
      }
    } catch (error) {
      console.error(
        "[offlineSync] Failed to save queue:",
        error,
      );

      throw error;
    }
  }

  /* =======================================================
     ENQUEUE
  ======================================================= */

  public async enqueue(
    type: QueuedActionType,
    payload: any,
  ): Promise<QueuedSyncItem> {
    const queue = await this.getQueue();

    const item: QueuedSyncItem = {
      id: this.createQueueId(),
      type,
      payload,
      createdAt: Date.now(),
      retryCount: 0,
      status: "pending",
    };

    queue.push(item);

    await this.saveQueue(queue);

    /**
     * Do not block the caller waiting for network sync.
     */
    if (this.isOnline()) {
      void this.processQueue();
    }

    return item;
  }

  private createQueueId(): string {
    const randomPart = Math.random()
      .toString(36)
      .slice(2, 9);

    return `queue_${Date.now()}_${randomPart}`;
  }

  /* =======================================================
     PROCESS QUEUE
  ======================================================= */

  public async processQueue(): Promise<{
    synced: number;
    failed: number;
  }> {
    if (
      !this.isOnline() ||
      this.isSyncing
    ) {
      return {
        synced: 0,
        failed: 0,
      };
    }

    this.isSyncing = true;

    await this.notify();

    let synced = 0;
    let failed = 0;

    try {
      const queue = await this.getQueue();

      if (queue.length === 0) {
        this.lastSyncedAt = Date.now();

        return {
          synced: 0,
          failed: 0,
        };
      }

      const remainingQueue: QueuedSyncItem[] =
        [];

      for (const queuedItem of queue) {
        /**
         * Clone rather than mutating persisted state objects
         * directly.
         */
        const item: QueuedSyncItem = {
          ...queuedItem,
          status: "syncing",
        };

        try {
          await this.executeMutation(item);

          synced += 1;
        } catch (error: any) {
          failed += 1;

          const retryCount =
            item.retryCount + 1;

          console.warn(
            `[offlineSync] Failed to sync item ${item.id}:`,
            error,
          );

          /**
           * Only retain the failed item while retries remain.
           */
          if (
            retryCount <
            MAX_SYNC_RETRIES
          ) {
            remainingQueue.push({
              ...item,
              retryCount,
              status: "failed",
              error:
                error?.message ??
                String(error),
            });
          } else {
            console.warn(
              `[offlineSync] Dropping queue item ${item.id} after ${MAX_SYNC_RETRIES} failed attempts.`,
            );
          }
        }
      }

      /**
       * Avoid notifying here because the finally block will
       * publish the final status after isSyncing is false.
       */
      await this.saveQueue(
        remainingQueue,
        false,
      );

      this.lastSyncedAt = Date.now();

      return {
        synced,
        failed,
      };
    } catch (error) {
      console.error(
        "[offlineSync] Queue processing failed:",
        error,
      );

      return {
        synced,
        failed: failed + 1,
      };
    } finally {
      this.isSyncing = false;

      await this.notify();
    }
  }

  /* =======================================================
     EXECUTE MUTATION
  ======================================================= */

  private async executeMutation(
    item: QueuedSyncItem,
  ): Promise<void> {
    /**
     * Dynamic import keeps apiClient out of service
     * initialization and reduces circular dependency risk.
     */
    const { apiClient } =
      await import("./apiClient");

    switch (item.type) {
      case "CREATE_RECORD": {
        await apiClient.post(
          "/records",
          item.payload,
        );

        return;
      }

      case "DELETE_RECORD": {
        const recordId =
          item.payload?.recordId;

        if (!recordId) {
          throw new Error(
            "DELETE_RECORD requires payload.recordId",
          );
        }

        await apiClient.delete(
          `/records/${recordId}`,
        );

        return;
      }

      case "UPDATE_PROFILE": {
        await apiClient.post(
          "/profile/update",
          item.payload,
        );

        return;
      }

      case "ORDER_PRESCRIPTION": {
        await apiClient.post(
          "/pharmacy/orders",
          item.payload,
        );

        return;
      }

      default: {
        const exhaustiveType =
          (item as QueuedSyncItem).type;

        throw new Error(
          `Unknown mutation type: ${String(
            exhaustiveType,
          )}`,
        );
      }
    }
  }

  /* =======================================================
     CLEAR QUEUE
  ======================================================= */

  public async clearQueue(): Promise<void> {
    await this.saveQueue([]);
  }
}

/* =========================================================
   SINGLETON
========================================================= */

export const offlineSyncService =
  new OfflineSyncService();

export default offlineSyncService;