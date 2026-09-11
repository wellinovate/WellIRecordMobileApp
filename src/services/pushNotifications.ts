import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiClient } from './apiClient';

const isExpoGo = Constants.appOwnership === 'expo';

// expo-notifications registers a push token listener as a side effect of
// being imported — that side effect crashes immediately in Expo Go (SDK
// 53+), before any of our own guard checks below ever run. A static
// `import * as Notifications from 'expo-notifications'` at the top of this
// file would trigger that crash unconditionally. Loading it dynamically,
// only when NOT in Expo Go, avoids ever executing that side effect here.
let Notifications: typeof import('expo-notifications') | null = null;

async function loadNotifications() {
  if (!isExpoGo && !Notifications) {
    Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
  return Notifications;
}

/**
 * Requests notification permission, fetches this device's Expo push token,
 * and registers it with the backend so the server can send push
 * notifications for order approvals, share/consent grants, and emergency
 * access alerts. Safe to call on every login — the backend deduplicates
 * tokens via $addToSet, and this function no-ops quietly on simulators
 * or if the user declines permission.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    if (isExpoGo) {
      console.log('[Push] Skipping push registration — not supported in Expo Go.');
      return null;
    }

    const N = await loadNotifications();
    if (!N) return null;

    if (!Device.isDevice) {
      return null;
    }

    const { status: existingStatus } = await N.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await N.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }

    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('default', {
        name: 'default',
        importance: N.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#041E42',
      });
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;
    if (!projectId) {
      console.warn('[Push] No EAS projectId found in app config; cannot fetch push token.');
      return null;
    }

    const tokenResponse = await N.getExpoPushTokenAsync({ projectId });
    const pushToken = tokenResponse.data;

    try {
      await apiClient.post('/auth/push-token', { pushToken });
    } catch (err) {
      console.warn('[Push] Failed to register push token with backend:', err);
    }

    return pushToken;
  } catch (err) {
    console.warn('[Push] Failed to register for push notifications:', err);
    return null;
  }
}
