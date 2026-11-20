import { describe, expect, it, vi } from 'vitest';

const get = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ apiClient: { get } }));
import { authApi } from './auth';

describe('authApi.getMe', () => {
  it('accepts the profile the backend returns directly', async () => {
    get.mockResolvedValue({ data: { id: 'u1', roles: ['admin'] } });
    await expect(authApi.getMe()).resolves.toEqual({ user: { id: 'u1', roles: ['admin'] } });
  });

  it('still accepts the wrapped { user } shape', async () => {
    get.mockResolvedValue({ data: { user: { id: 'u2', roles: ['admin'] } } });
    await expect(authApi.getMe()).resolves.toEqual({ user: { id: 'u2', roles: ['admin'] } });
  });
});
