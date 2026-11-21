jest.mock('expo-secure-store', () => ({}));

const store: Record<string, string | null> = {};
jest.mock('./storage', () => ({
  authStorage: {
    getAccessToken: jest.fn(async () => store.access ?? null),
    getRefreshToken: jest.fn(async () => store.refresh ?? null),
    setTokens: jest.fn(async (a: string, r: string) => {
      store.access = a;
      store.refresh = r;
    }),
    clearTokens: jest.fn(async () => {
      store.access = null;
      store.refresh = null;
    }),
  },
}));

import { ApiError, apiRequest, setAuthFailureListener } from './client';
import { isSessionEnded } from '../auth/sessionErrors';

const json = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('customer API client token refresh', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    (globalThis as any).fetch = fetchMock;
    store.access = 'expired-access';
    store.refresh = 'session.refresh-1';
    setAuthFailureListener(null);
  });

  it('refreshes an expired access token once and replays the request', async () => {
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) {
        return json(200, { data: { tokens: { accessToken: 'new-access', refreshToken: 'session.refresh-2' } } });
      }
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer new-access' ? json(200, { data: { id: 'order-1' } }) : json(401, { message: 'Unauthorized' });
    });

    await expect(apiRequest('/orders/active')).resolves.toEqual({ id: 'order-1' });
    expect(store).toMatchObject({ access: 'new-access', refresh: 'session.refresh-2' });
  });

  it('shares one refresh between requests that expire together (refresh tokens rotate)', async () => {
    let refreshCalls = 0;
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        return json(200, { data: { tokens: { accessToken: 'new-access', refreshToken: 'session.refresh-2' } } });
      }
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer new-access' ? json(200, { data: 'ok' }) : json(401, {});
    });

    await Promise.all([apiRequest('/cart'), apiRequest('/orders'), apiRequest('/auth/me')]);
    expect(refreshCalls).toBe(1);
  });

  it('signs out when the refresh token is rejected', async () => {
    const onFailure = jest.fn();
    setAuthFailureListener(onFailure);
    fetchMock.mockImplementation(async () => json(401, { message: 'Session has been revoked.' }));

    const err = await apiRequest('/auth/me').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(isSessionEnded(err)).toBe(true);
    expect(store.access).toBeNull();
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it('keeps the session when the network drops during refresh', async () => {
    const onFailure = jest.fn();
    setAuthFailureListener(onFailure);
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/refresh')) throw new TypeError('Network request failed');
      return json(401, {});
    });

    const err = await apiRequest('/auth/me').catch((e) => e);
    expect(isSessionEnded(err)).toBe(false);
    expect(store.refresh).toBe('session.refresh-1');
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('does not treat a wrong OTP (401 on a login endpoint) as an expired session', async () => {
    fetchMock.mockImplementation(async () => json(401, { message: 'Invalid OTP' }));
    await expect(apiRequest('/auth/otp/verify', { method: 'POST' })).rejects.toThrow('Invalid OTP');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(store.refresh).toBe('session.refresh-1');
  });
});

describe('isSessionEnded', () => {
  it('only ends the session for auth rejections', () => {
    expect(isSessionEnded(new ApiError('offline', 0))).toBe(false);
    expect(isSessionEnded(new ApiError('server', 503))).toBe(false);
    expect(isSessionEnded(new ApiError('expired', 401))).toBe(true);
    expect(isSessionEnded(new Error('x'))).toBe(false);
  });
});
