import Constants from 'expo-constants';
import { resolveApiBaseUrl } from './apiBaseUrl';
import { authStorage } from './storage';

export const API_BASE_URL = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL,
  __DEV__ ? Constants.expoConfig?.hostUri : undefined,
);

export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL?.trim() || new URL(API_BASE_URL).origin;

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  data: T;
  timestamp: string;
  message?: string;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const accessToken = await authStorage.getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const text = await response.text();
    let data: any = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Non-JSON response received from ${endpoint} (HTTP ${response.status})`);
      }
    }

    if (!response.ok) {
      // Automatic token refresh retry on 401 Unauthorized
      if (response.status === 401 && !endpoint.includes('/auth/')) {
        const refreshToken = await authStorage.getRefreshToken();
        if (refreshToken) {
          try {
            const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            });
            if (refreshRes.ok) {
              const refreshData = await refreshRes.json();
              const newTokens = refreshData.data?.tokens || refreshData.tokens;
              if (newTokens?.accessToken) {
                await authStorage.setTokens(newTokens.accessToken, newTokens.refreshToken || refreshToken);
                const retryHeaders = {
                  ...headers,
                  Authorization: `Bearer ${newTokens.accessToken}`,
                };
                const retryRes = await fetch(url, { ...options, headers: retryHeaders });
                const retryText = await retryRes.text();
                const retryData = retryText ? JSON.parse(retryText) : null;
                if (retryRes.ok) {
                  if (retryData && typeof retryData === 'object' && 'data' in retryData && 'statusCode' in retryData) {
                    return retryData.data as T;
                  }
                  return retryData as T;
                }
              }
            }
          } catch (refreshErr) {
            console.warn('[Auth] Token refresh retry failed:', refreshErr);
          }
        }
      }

      const errorMsg = Array.isArray(data?.message)
        ? data.message.join(', ')
        : data?.message || `Request failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    // Unpack NestJS response wrapper if present
    if (data && typeof data === 'object' && 'data' in data && 'statusCode' in data) {
      return data.data as T;
    }

    return data as T;
  } catch (error: any) {
    if (error.message === 'Network request failed') {
      console.warn(`[Network Error] Could not reach backend at ${url}`);
    }
    throw error;
  }
}

