import { Platform } from 'react-native';
import { authStorage } from './storage';

/**
 * Environment & Network Configuration
 * - EXPO_PUBLIC_API_URL takes precedence in Staging & Production builds.
 * - Falls back to local development network endpoints when not set.
 */
export const DEV_LAN_IP = '172.20.10.2';
export const DEV_PORT = 4000;

export const API_BASE_URL = (() => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEV_PORT}/api/v1`;
  }
  if (Platform.OS === 'web') {
    return `http://localhost:${DEV_PORT}/api/v1`;
  }
  // iOS (both physical device via Expo Go and Simulator)
  // Using workstation LAN IP enables direct reachability from physical iPhone
  return `http://${DEV_LAN_IP}:${DEV_PORT}/api/v1`;
})();

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
