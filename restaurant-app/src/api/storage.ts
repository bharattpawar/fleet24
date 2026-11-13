import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'fleet24_restaurant_access_token';
const REFRESH_TOKEN_KEY = 'fleet24_restaurant_refresh_token';
const ACTIVE_OUTLET_KEY = 'fleet24_restaurant_active_outlet_id';

export const authStorage = {
  async getAccessToken(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(ACCESS_TOKEN_KEY);
    }
    try {
      return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async getRefreshToken(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    }
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async setTokens(accessToken: string, refreshToken?: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      return;
    }
    try {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      if (refreshToken) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      }
    } catch (e) {
      console.warn('Error saving restaurant auth tokens:', e);
    }
  },

  async getActiveOutletId(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(ACTIVE_OUTLET_KEY);
    }
    try {
      return await SecureStore.getItemAsync(ACTIVE_OUTLET_KEY);
    } catch {
      return null;
    }
  },

  async setActiveOutletId(outletId: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(ACTIVE_OUTLET_KEY, outletId);
      return;
    }
    try {
      await SecureStore.setItemAsync(ACTIVE_OUTLET_KEY, outletId);
    } catch (e) {
      console.warn('Error saving active outlet ID:', e);
    }
  },

  async clear(): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(ACTIVE_OUTLET_KEY);
      return;
    }
    try {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(ACTIVE_OUTLET_KEY);
    } catch (e) {
      console.warn('Error clearing restaurant auth storage:', e);
    }
  },
};

