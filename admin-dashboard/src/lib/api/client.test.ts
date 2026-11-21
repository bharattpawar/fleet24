import { afterEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { ADMIN_REFRESH_TOKEN_STORAGE_KEY, ADMIN_TOKEN_STORAGE_KEY, refreshAdminSession } from './client';

describe('refreshAdminSession', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('shares one refresh between requests that expire together', async () => {
    let resolve!: (v: unknown) => void;
    const post = vi.spyOn(axios, 'post').mockReturnValue(new Promise((r) => { resolve = r; }) as never);

    const calls = [refreshAdminSession('s.1'), refreshAdminSession('s.1'), refreshAdminSession('s.1')];
    resolve({ data: { data: { tokens: { accessToken: 'new-access', refreshToken: 's.2' } } } });

    await expect(Promise.all(calls)).resolves.toEqual(['new-access', 'new-access', 'new-access']);
    expect(post).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)).toBe('new-access');
    expect(localStorage.getItem(ADMIN_REFRESH_TOKEN_STORAGE_KEY)).toBe('s.2');
  });

  it('starts a new refresh after the previous one finished', async () => {
    const post = vi
      .spyOn(axios, 'post')
      .mockResolvedValue({ data: { data: { tokens: { accessToken: 'a', refreshToken: 'r' } } } } as never);
    await refreshAdminSession('s.1');
    await refreshAdminSession('r');
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('rejects when the backend returns no token', async () => {
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { data: {} } } as never);
    await expect(refreshAdminSession('s.1')).rejects.toThrow(/no access token/);
  });
});
