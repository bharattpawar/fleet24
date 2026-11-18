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

    const data = await response.json();

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
