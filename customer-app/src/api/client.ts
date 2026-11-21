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

export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  error?: string;
  code?: string;
  activeOrder?: {
    id: string;
    orderNumber: string;
    status: string;
    placedAt?: string;
    totalPayable?: string;
  };
}

export class ApiError extends Error {
  statusCode: number;
  code?: string;
  activeOrder?: ApiErrorResponse['activeOrder'];
  raw: any;

  constructor(message: string, statusCode: number, code?: string, activeOrder?: any, raw?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.activeOrder = activeOrder;
    this.raw = raw;
  }
}

type AuthFailureListener = () => void;
let authFailureListener: AuthFailureListener | null = null;
let refreshPromise: Promise<string | null> | null = null;

/** AuthContext registers this so an expired session signs the customer out in the UI too. */
export function setAuthFailureListener(listener: AuthFailureListener | null) {
  authFailureListener = listener;
}

const PUBLIC_AUTH_ENDPOINTS = ['/auth/otp/request', '/auth/otp/verify', '/auth/google', '/auth/refresh'];
const isPublicAuthEndpoint = (endpoint: string) =>
  PUBLIC_AUTH_ENDPOINTS.some((path) => endpoint.startsWith(path));

/**
 * Rotates the refresh token once for all requests that hit 401 at the same time.
 * Returns the new access token; null when the session is gone (refresh rejected).
 * Throws on network failure so a flaky connection never signs the customer out.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const refreshToken = await authStorage.getRefreshToken();
      if (!refreshToken) return null;
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        // 5xx is the server's problem, not an ended session.
        if (response.status >= 500) throw new ApiError('Could not refresh your session.', response.status);
        return null;
      }
      const body = await response.json().catch(() => null);
      const tokens = body?.data?.tokens ?? body?.tokens ?? body?.data;
      if (!tokens?.accessToken || !tokens?.refreshToken) return null;
      await authStorage.setTokens(tokens.accessToken, tokens.refreshToken);
      return tokens.accessToken as string;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false,
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

    // Access tokens last 15 minutes: refresh once and replay the request.
    if (response.status === 401 && accessToken && !isRetry && !isPublicAuthEndpoint(endpoint)) {
      const newAccessToken = await refreshAccessToken();
      if (newAccessToken) return apiRequest<T>(endpoint, options, true);
      await authStorage.clearTokens();
      authFailureListener?.();
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const msg = typeof data.message === 'string'
        ? data.message
        : (typeof data.error?.message === 'string'
          ? data.error.message
          : (typeof data.error === 'string' ? data.error : `Request failed with status ${response.status}`));
      const code = data.code || data.error?.code;
      const activeOrder = data.activeOrder || data.error?.activeOrder;
      throw new ApiError(msg, response.status, code, activeOrder, data);
    }

    // Backend wraps response in { success: true, statusCode: 200, data: T }
    return data.data !== undefined ? data.data : data;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    const errorMsg = err instanceof Error ? err.message : 'Network error';
    throw new ApiError(errorMsg, 0);
  }
}
