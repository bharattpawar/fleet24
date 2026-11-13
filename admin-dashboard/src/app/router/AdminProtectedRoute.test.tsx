import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AdminProtectedRoute } from './AdminProtectedRoute';
import * as authContext from '@/features/auth/AdminAuthContext';

vi.mock('@/features/auth/AdminAuthContext', () => ({
  useAdminAuth: vi.fn(),
}));

describe('AdminProtectedRoute', () => {
  it('redirects to /login when user is not authenticated', () => {
    vi.mocked(authContext.useAdminAuth).mockReturnValue({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isAdmin: false,
      isLoading: false,
      error: null,
      requestOtp: vi.fn(),
      loginWithOtp: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/admin"
            element={
              <AdminProtectedRoute>
                <div>Admin Secret Console</div>
              </AdminProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Admin Secret Console')).not.toBeInTheDocument();
  });

  it('redirects to /access-denied when user is authenticated but lacks admin role', () => {
    vi.mocked(authContext.useAdminAuth).mockReturnValue({
      user: {
        id: 'user-1',
        phone: '+919999999999',
        fullName: 'Customer Guy',
        roles: ['customer'],
        isActive: true,
      },
      tokens: { accessToken: 'token-abc', refreshToken: 'ref-abc' },
      isAuthenticated: true,
      isAdmin: false,
      isLoading: false,
      error: null,
      requestOtp: vi.fn(),
      loginWithOtp: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/access-denied" element={<div>Access Denied Page</div>} />
          <Route
            path="/admin"
            element={
              <AdminProtectedRoute>
                <div>Admin Secret Console</div>
              </AdminProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Access Denied Page')).toBeInTheDocument();
    expect(screen.queryByText('Admin Secret Console')).not.toBeInTheDocument();
  });

  it('renders children when user is authenticated and has admin role', () => {
    vi.mocked(authContext.useAdminAuth).mockReturnValue({
      user: {
        id: 'admin-1',
        phone: '+919876543210',
        fullName: 'Super Admin',
        roles: ['admin'],
        isActive: true,
      },
      tokens: { accessToken: 'token-xyz', refreshToken: 'ref-xyz' },
      isAuthenticated: true,
      isAdmin: true,
      isLoading: false,
      error: null,
      requestOtp: vi.fn(),
      loginWithOtp: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route
            path="/admin"
            element={
              <AdminProtectedRoute>
                <div>Admin Secret Console</div>
              </AdminProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Admin Secret Console')).toBeInTheDocument();
  });
});

