import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface TokenCache {
  getToken: (key: string) => Promise<string | null | undefined>;
  saveToken: (key: string, token: string) => Promise<void>;
  clearToken?: (key: string) => Promise<void>;
}

const createTokenCache = (): TokenCache => {
  return {
    getToken: async (key: string) => {
      try {
        const item = await SecureStore.getItemAsync(key);
        return item;
      } catch (error) {
        console.error('SecureStore get item error: ', error);
        await SecureStore.deleteItemAsync(key);
        return null;
      }
    },
    saveToken: async (key: string, value: string) => {
      try {
        await SecureStore.setItemAsync(key, value);
      } catch (err) {
        console.error('SecureStore save item error: ', err);
      }
    },
    clearToken: async (key: string) => {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (err) {
        console.error('SecureStore delete item error: ', err);
      }
    },
  };
};

export const tokenCache = Platform.OS !== 'web' ? createTokenCache() : undefined;
