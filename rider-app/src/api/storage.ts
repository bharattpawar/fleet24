import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'fleet24_rider_access_token';
const REFRESH_TOKEN_KEY = 'fleet24_rider_refresh_token';
const USER_KEY = 'fleet24_rider_user_data';
const MOCK_SESSION_KEY = 'fleet24_rider_mock_session';

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
      console.warn('Error storing auth tokens:', e);
    }
  },

  async getMockSession(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(MOCK_SESSION_KEY);
    }
    try {
      return await SecureStore.getItemAsync(MOCK_SESSION_KEY);
    } catch {
      return null;
    }
  },

  async setMockSession(phone: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(MOCK_SESSION_KEY, phone);
      return;
    }
    try {
      await SecureStore.setItemAsync(MOCK_SESSION_KEY, phone);
    } catch (e) {
      console.warn('Error storing mock session:', e);
    }
  },

  async clearMockSession(): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(MOCK_SESSION_KEY);
      return;
    }
    try {
      await SecureStore.deleteItemAsync(MOCK_SESSION_KEY);
    } catch (e) {
      console.warn('Error clearing mock session:', e);
    }
  },

  async clear(): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(MOCK_SESSION_KEY);
      return;
    }
    try {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
      await SecureStore.deleteItemAsync(MOCK_SESSION_KEY);
    } catch (e) {
      console.warn('Error clearing secure store:', e);
    }
  },
};
