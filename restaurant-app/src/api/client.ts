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

export type AuthFailureListener = (reason: 'session_expired' | 'unauthorized') => void;

let authFailureListener: AuthFailureListener | null = null;
let isLoggingOut = false;
let refreshPromise: Promise<string | null> | null = null;

export function setAuthFailureListener(listener: AuthFailureListener | null) {
  authFailureListener = listener;
}

export function resetAuthFailureState() {
  isLoggingOut = false;
  refreshPromise = null;
}

/**
 * Single-flight refresh token rotation handler.
 * Concurrently queued requests await the same refresh operation.
 */
export async function attemptTokenRefresh(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = await authStorage.getRefreshToken();
      if (!refreshToken) {
        return null;
      }

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        return null;
      }

      const resText = await response.text();
      let resData: any = null;
      try {
        resData = JSON.parse(resText);
      } catch {
        return null;
      }

      const tokens = resData?.data?.tokens || resData?.tokens;
      if (tokens?.accessToken) {
        await authStorage.setTokens(tokens.accessToken, tokens.refreshToken);
        return tokens.accessToken;
      }
      return null;
    } catch (e) {
      console.warn('[Restaurant API Client] Token refresh network error:', e);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Centralized API request runner with timeout, token refresh, and single-flight 401 handling.
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const accessToken = await authStorage.getAccessToken();

  const isPublicAuthEndpoint =
    endpoint.includes('/auth/otp/request') ||
    endpoint.includes('/auth/otp/verify') ||
    endpoint.includes('/auth/refresh');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // 15-second request timeout controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const text = await response.text();
    let json: any = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`Non-JSON response received from ${endpoint} (HTTP ${response.status})`);
      }
    }

    // Handle 401 Unauthorized
    if (response.status === 401) {
      // Exclude public endpoints (e.g. wrong OTP code on login)
      if (isPublicAuthEndpoint) {
        const errorMsg = Array.isArray(json?.message)
          ? json.message.join(', ')
          : json?.message || 'Authentication failed';
        throw new Error(errorMsg);
      }

      // If this request hasn't been retried yet, attempt refresh token rotation
      if (!isRetry) {
        const newAccessToken = await attemptTokenRefresh();
        if (newAccessToken) {
          return apiRequest<T>(endpoint, options, true);
        }
      }

      // Refresh failed or no refresh token -> Trigger single-flight automatic logout
      if (!isLoggingOut) {
        isLoggingOut = true;
        console.warn(`[Restaurant API Client] Session expired at ${endpoint}. Initiating automatic logout.`);
        await authStorage.clear();
        authFailureListener?.('session_expired');
      }

      throw new Error('Your session has expired. Please log in again.');
    }

    if (!response.ok) {
      const errorMsg = Array.isArray(json?.message)
        ? json.message.join(', ')
        : json?.message || `HTTP ${response.status}: Request failed`;
      throw new Error(errorMsg);
    }

    // Handle standard Fleet24 envelope { success: true, statusCode: 200, data: T }
    if (json && typeof json === 'object' && 'data' in json) {
      return json.data as T;
    }

    return json as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request to ${endpoint} timed out. Please check your network connection.`);
    }
    throw err;
  }
}
