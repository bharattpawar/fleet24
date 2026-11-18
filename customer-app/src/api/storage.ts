import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'fleet24_access_token';
const REFRESH_TOKEN_KEY = 'fleet24_refresh_token';

// In-memory fallback for web or environments where SecureStore isn't native
const memoryStorage: Record<string, string> = {};

export const authStorage = {
  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      } else {
        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      }
    } catch {
      memoryStorage[ACCESS_TOKEN_KEY] = accessToken;
      memoryStorage[REFRESH_TOKEN_KEY] = refreshToken;
    }
  },

  async getAccessToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(ACCESS_TOKEN_KEY);
      }
      return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    } catch {
      return memoryStorage[ACCESS_TOKEN_KEY] || null;
    }
  },

  async getRefreshToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(REFRESH_TOKEN_KEY);
      }
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch {
      return memoryStorage[REFRESH_TOKEN_KEY] || null;
    }
  },

  async clearTokens(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      } else {
        await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      }
    } catch {
      delete memoryStorage[ACCESS_TOKEN_KEY];
      delete memoryStorage[REFRESH_TOKEN_KEY];
    }
  },
};

/** Small non-secret preferences (e.g. the selected delivery address id). */
export const preferenceStorage = {
  async get(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') return localStorage.getItem(key);
      return await SecureStore.getItemAsync(key);
    } catch {
      return memoryStorage[key] ?? null;
    }
  },
  async set(key: string, value: string | null): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } else if (value === null) {
        await SecureStore.deleteItemAsync(key);
      } else {
        await SecureStore.setItemAsync(key, value);
      }
    } catch {
      if (value === null) delete memoryStorage[key];
      else memoryStorage[key] = value;
    }
  },
};
