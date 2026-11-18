import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { authApi } from '@/lib/api/auth';
import { ADMIN_TOKEN_STORAGE_KEY } from '@/lib/api/client';
import { AdminAuthProvider, useAdminAuth } from './AdminAuthContext';

vi.mock('@/lib/api/auth', () => ({
  authApi: { getMe: vi.fn(), verifyOtp: vi.fn() },
}));

function AuthProbe() {
  const auth = useAdminAuth();
  return (
    <>
      <span>{auth.isLoading ? 'Loading' : auth.user?.fullName ?? 'Signed out'}</span>
      <button onClick={() => void auth.verifyOtp('9876543210', '123456').catch(() => {})}>Sign in</button>
    </>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
});

it('uses only the profile returned from the authenticated profile endpoint', async () => {
  const user = { id: 'admin', roles: ['admin'], phone: null, email: null, fullName: 'Server Admin' };
  vi.mocked(authApi.verifyOtp).mockResolvedValue({
    user: { ...user, fullName: 'Login response' },
    isNewUser: false,
    tokens: { accessToken: 'access', refreshToken: 'refresh' },
  });
  vi.mocked(authApi.getMe).mockImplementation(async () => {
    expect(localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)).toBe('access');
    return { user };
  });
  render(<AdminAuthProvider><AuthProbe /></AdminAuthProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText('Server Admin')).toBeTruthy();
  expect(screen.queryByText('Login response')).toBeNull();
});

it('stays signed out when a saved token cannot load a profile', async () => {
  localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, 'expired');
  vi.mocked(authApi.getMe).mockRejectedValue(new Error('Unauthorized'));
  render(<AdminAuthProvider><AuthProbe /></AdminAuthProvider>);
  expect(await screen.findByText('Signed out')).toBeTruthy();
  expect(localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)).toBeNull();
});
