import { apiClient, getAuthToken } from './apiClient';
import { CONFIG } from './config';
import { storage } from '../utils/secureStorage';
import { INITIAL_NOTIFICATIONS } from '../data/mockData';
import type { Notification } from '../data/types';
import { registerForPushNotificationsAsync } from './pushNotifications';

export interface EmergencyScanAlert {
  id: string;
  token?: string;
  grantId?: string;
  patientName?: string;
  ipAddress?: string;
  scannedAt?: string;
  title: string;
  desc: string;
}

type AlertListener = (alert: EmergencyScanAlert) => void;
type NotificationsListener = (notifications: Notification[]) => void;

class NotificationService {
  private readonly CACHE_KEY = 'welli_notifications_cache_v1';
  private alertListeners: Set<AlertListener> = new Set();
  private listListeners: Set<NotificationsListener> = new Set();
  private eventSource: EventSource | null = null;
  private pollInterval: any = null;
  private currentNotifications: Notification[] = [...INITIAL_NOTIFICATIONS];
  private activeEmergencyAlert: EmergencyScanAlert | null = null;

  constructor() {
    this.loadCachedNotifications();
  }

  private async loadCachedNotifications() {
    try {
      const cached = await storage.getItem(this.CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.currentNotifications = parsed;
          this.notifyListListeners();
        }
      }
    } catch (e) {
      console.warn('[NotificationService] Error loading cached notifications:', e);
    }
  }

  /**
   * Initializes notification system: registers device push token and connects live SSE stream
   */
  async init() {
    // 1. Register for OS push notifications if on mobile device
    try {
      await registerForPushNotificationsAsync();
    } catch (e) {
      console.warn('[NotificationService] Push registration skipped:', e);
    }

    // 2. Fetch fresh notifications from server
    await this.fetchNotifications();

    // 3. Connect live stream
    this.connectLiveStream();
  }

  /**
   * Fetches latest notifications from server with fallback to cache
   */
  async fetchNotifications(): Promise<Notification[]> {
    try {
      const res = await apiClient.get<{ success: boolean; notifications: Notification[] }>('/notifications');
      if (res?.success && Array.isArray(res.notifications) && res.notifications.length > 0) {
        // Merge with initial list to preserve mock demonstrations while prioritizing live server items
        const serverIds = new Set(res.notifications.map((n) => n.id));
        const combined = [
          ...res.notifications,
          ...INITIAL_NOTIFICATIONS.filter((n) => !serverIds.has(n.id)),
        ];
        this.currentNotifications = combined;
        await storage.setItem(this.CACHE_KEY, JSON.stringify(combined));
        this.notifyListListeners();
        return combined;
      }
    } catch (e) {
      console.warn('[NotificationService] Failed to fetch remote notifications, using cache:', e);
    }
    return this.currentNotifications;
  }

  /**
   * Marks a notification as read
   */
  async markAsRead(id: string): Promise<void> {
    this.currentNotifications = this.currentNotifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    this.notifyListListeners();
    await storage.setItem(this.CACHE_KEY, JSON.stringify(this.currentNotifications));

    try {
      await apiClient.post(`/notifications/${id}/read`, {});
    } catch (e) {
      // offline or silent fail
    }
  }

  /**
   * Marks all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    this.currentNotifications = this.currentNotifications.map((n) => ({ ...n, read: true }));
    this.notifyListListeners();
    await storage.setItem(this.CACHE_KEY, JSON.stringify(this.currentNotifications));
  }

  /**
   * Connects to Server-Sent Events stream for real-time notifications
   */
  private connectLiveStream() {
    if (typeof window === 'undefined') return;

    try {
      const token = getAuthToken();
      if (!token) return;

      const streamUrl = `${CONFIG.apiBaseUrl}/notifications/stream`;
      if (typeof EventSource !== 'undefined') {
        if (this.eventSource) {
          this.eventSource.close();
        }

        this.eventSource = new EventSource(streamUrl);

        this.eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data?.type === 'connected') return;

            this.handleIncomingNotification(data);
          } catch (err) {
            console.warn('[NotificationService] Error parsing SSE payload:', err);
          }
        };

        this.eventSource.onerror = () => {
          // SSE failed (e.g. auth header requirement in standard EventSource)
          // Fall back to periodic light polling
          if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
          }
          this.startPollingFallback();
        };
      } else {
        this.startPollingFallback();
      }
    } catch (err) {
      this.startPollingFallback();
    }
  }

  private startPollingFallback() {
    if (this.pollInterval) return;
    this.pollInterval = setInterval(() => {
      this.fetchNotifications().catch(() => {});
    }, 15000); // 15 seconds
  }

  private handleIncomingNotification(data: any) {
    const newNotif: Notification = {
      id: data.id || `notif_${Date.now()}`,
      type: data.type || 'system',
      emoji: data.emoji || '🔔',
      tint: data.tint || '#e0e7ff',
      categoryLabel: data.categoryLabel || 'Notification',
      title: data.title || 'New Notification',
      desc: data.desc || data.body || '',
      time: 'Just now',
      read: false,
      actionLabel: data.actionLabel || 'View',
      targetTab: data.targetTab,
      targetModal: data.targetModal,
      targetId: data.targetId,
    };

    // Prepend to notifications
    this.currentNotifications = [newNotif, ...this.currentNotifications.filter((n) => n.id !== newNotif.id)];
    this.notifyListListeners();
    storage.setItem(this.CACHE_KEY, JSON.stringify(this.currentNotifications)).catch(() => {});

    // If it's a critical emergency alert, trigger the active emergency banner
    if (data.type === 'critical_alert') {
      const alert: EmergencyScanAlert = {
        id: newNotif.id,
        token: data.metadata?.token,
        grantId: data.metadata?.grantId,
        patientName: data.metadata?.patientName,
        ipAddress: data.metadata?.ipAddress,
        scannedAt: data.metadata?.scannedAt || new Date().toISOString(),
        title: newNotif.title,
        desc: newNotif.desc,
      };
      this.activeEmergencyAlert = alert;
      this.notifyAlertListeners(alert);
    }
  }

  /**
   * Triggers a test emergency scan alert on demand to demonstrate the end-to-end flow
   */
  async triggerTestEmergencyAlert(): Promise<EmergencyScanAlert> {
    try {
      const res = await apiClient.post<{ success: boolean; notification: any }>(
        '/notifications/test-emergency-alert',
        {}
      );
      if (res?.notification) {
        this.handleIncomingNotification(res.notification);
      }
    } catch (err) {
      console.warn('[NotificationService] Server test alert call failed, creating local test alert:', err);
    }

    const testAlert: EmergencyScanAlert = {
      id: `alert_${Date.now()}`,
      token: 'test_token',
      patientName: 'Chibuike Joshua Nwogha',
      ipAddress: '102.89.44.18 (Lagos, NG)',
      scannedAt: new Date().toISOString(),
      title: '🚨 Emergency Medical ID Accessed!',
      desc: 'Your Emergency Medical ID was scanned by a first responder just now. Tap to review access details or revoke link.',
    };

    this.activeEmergencyAlert = testAlert;
    this.notifyAlertListeners(testAlert);
    return testAlert;
  }

  /**
   * Revokes an active emergency bridge QR share token immediately
   */
  async revokeEmergencyToken(token: string): Promise<boolean> {
    try {
      await apiClient.post(`/shares/bridge/revoke/${token}`, {});
    } catch (e) {
      console.warn('[NotificationService] Remote revoke call error, applied locally:', e);
    }

    if (this.activeEmergencyAlert?.token === token) {
      this.activeEmergencyAlert = null;
    }
    return true;
  }

  dismissActiveAlert() {
    this.activeEmergencyAlert = null;
  }

  getActiveAlert(): EmergencyScanAlert | null {
    return this.activeEmergencyAlert;
  }

  subscribeToAlerts(listener: AlertListener): () => void {
    this.alertListeners.add(listener);
    if (this.activeEmergencyAlert) {
      listener(this.activeEmergencyAlert);
    }
    return () => this.alertListeners.delete(listener);
  }

  subscribeToNotifications(listener: NotificationsListener): () => void {
    this.listListeners.add(listener);
    listener(this.currentNotifications);
    return () => this.listListeners.delete(listener);
  }

  private notifyAlertListeners(alert: EmergencyScanAlert) {
    this.alertListeners.forEach((fn) => {
      try {
        fn(alert);
      } catch (err) {
        console.error(err);
      }
    });
  }

  private notifyListListeners() {
    this.listListeners.forEach((fn) => {
      try {
        fn(this.currentNotifications);
      } catch (err) {
        console.error(err);
      }
    });
  }
}

export const notificationService = new NotificationService();
