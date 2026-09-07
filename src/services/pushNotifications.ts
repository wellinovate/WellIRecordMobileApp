import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiClient } from './apiClient';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
    if (!Device.isDevice) {
      // Push tokens require a physical device; simulators/emulators can't
      // receive real push notifications, so skip silently.
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
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

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
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
