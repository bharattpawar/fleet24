import axios from 'axios';

export const ADMIN_TOKEN_STORAGE_KEY = 'fleet24_admin_access_token';
export const ADMIN_REFRESH_TOKEN_STORAGE_KEY = 'fleet24_admin_refresh_token';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Bearer token
apiClient.interceptors.request.use((config) => {
  let token = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  
  // Development-only token fallback for local preview environments
  if (!token && import.meta.env.DEV) {
    token = import.meta.env.VITE_DEV_ADMIN_TOKEN || null;
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshInFlight: Promise<string> | null = null;

/**
 * One refresh for every request that hit 401 together. Refresh tokens rotate, so parallel refreshes
 * with the same token made all but one fail as "revoked" and signed the admin out.
 */
export function refreshAdminSession(refreshToken: string): Promise<string> {
  refreshInFlight ??= axios
    .post(`${baseURL}/auth/refresh`, { refreshToken })
    .then((res) => {
      const tokens = res.data?.data?.tokens || res.data?.tokens;
      if (!tokens?.accessToken) throw new Error('Refresh returned no access token');
      localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, tokens.accessToken);
      if (tokens.refreshToken) localStorage.setItem(ADMIN_REFRESH_TOKEN_STORAGE_KEY, tokens.refreshToken);
      return tokens.accessToken as string;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

// Response interceptor: preserve Axios response object format where .data contains unpacked data
apiClient.interceptors.response.use(
  (response) => {
    // Unpack standard Fleet24 API format { success, statusCode, data } into response.data
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      return {
        ...response,
        data: response.data.data,
      };
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem(ADMIN_REFRESH_TOKEN_STORAGE_KEY);
      if (refreshToken) {
        try {
          const accessToken = await refreshAdminSession(refreshToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return apiClient(originalRequest);
        } catch (refreshErr) {
          // If refresh token is revoked or expired in development, clear it and fall back to fresh dev admin token
          localStorage.removeItem(ADMIN_REFRESH_TOKEN_STORAGE_KEY);
          if (import.meta.env.DEV && import.meta.env.VITE_DEV_ADMIN_TOKEN) {
            const devToken = import.meta.env.VITE_DEV_ADMIN_TOKEN;
            localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, devToken);
            originalRequest.headers.Authorization = `Bearer ${devToken}`;
            return apiClient(originalRequest);
          } else {
            localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
            window.location.href = '/login';
          }
        }
      } else {
        if (import.meta.env.DEV && import.meta.env.VITE_DEV_ADMIN_TOKEN) {
          const devToken = import.meta.env.VITE_DEV_ADMIN_TOKEN;
          localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, devToken);
          originalRequest.headers.Authorization = `Bearer ${devToken}`;
          return apiClient(originalRequest);
        } else {
          localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
          localStorage.removeItem(ADMIN_REFRESH_TOKEN_STORAGE_KEY);
        }
      }
    }
    return Promise.reject(error);
  },
);

