import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Secure Session Storage Utility
 * - Native (iOS / Android): uses expo-secure-store (backed by iOS Keychain / Android Keystore)
 *   with fallback to AsyncStorage only if a payload exceeds SecureStore capacity.
 * - Web SPA: uses localStorage (bearer token SPA environment).
 */
export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          return localStorage.getItem(key);
        }
        return null;
      }

      // Native: Try SecureStore (iOS Keychain / Android Keystore)
      const secureVal = await SecureStore.getItemAsync(key);
      if (secureVal !== null && secureVal !== undefined) {
        return secureVal;
      }

      // Fallback check on AsyncStorage in case of migrated/large value
      return await AsyncStorage.getItem(key);
    } catch (err) {
      console.warn(`[secureStorage] getItem failed for key "${key}":`, err);
      try {
        return await AsyncStorage.getItem(key);
      } catch {
        return null;
      }
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, value);
        }
        return;
      }

      // Native: Attempt to persist in hardware-backed SecureStore
      try {
        await SecureStore.setItemAsync(key, value);
        // Clean up any legacy plaintext AsyncStorage copy
        await AsyncStorage.removeItem(key).catch(() => {});
      } catch (secureErr) {
        // Fallback to AsyncStorage if value exceeds SecureStore storage limit (~2KB)
        console.warn(`[secureStorage] SecureStore setItem failed for key "${key}", falling back to AsyncStorage:`, secureErr);
        await AsyncStorage.setItem(key, value);
      }
    } catch (err) {
      console.error(`[secureStorage] setItem failed completely for key "${key}":`, err);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key);
        }
        return;
      }

      await Promise.allSettled([
        SecureStore.deleteItemAsync(key),
        AsyncStorage.removeItem(key),
      ]);
    } catch (err) {
      console.warn(`[secureStorage] removeItem failed for key "${key}":`, err);
    }
  },
};

export default storage;
