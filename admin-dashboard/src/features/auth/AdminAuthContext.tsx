import React, { createContext, useContext, useState, useEffect } from 'react';
import type { UserProfile } from '@/types/auth';
import { authApi } from '@/lib/api/auth';
import { ADMIN_TOKEN_STORAGE_KEY, ADMIN_REFRESH_TOKEN_STORAGE_KEY } from '@/lib/api/client';

interface AdminAuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  user: UserProfile | null;
  requestOtp: (phone: string) => Promise<{ cooldownSeconds: number; expiresInSeconds: number }>;
  verifyOtp: (phone: string, otp: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

// In development only: allow preview bypass if explicitly configured
const DEV_BYPASS_TOKEN = import.meta.env.DEV ? (import.meta.env.VITE_DEV_ADMIN_TOKEN || '') : '';

const DEV_ADMIN_USER: UserProfile | null = import.meta.env.DEV
  ? {
      id: '7bc5cbd8-cb87-4d59-b799-a672d9965609',
      phone: '+919876543210',
      fullName: 'Bharat Super Admin',
      email: 'bharat1234512345777@gmail.com',
      roles: ['admin', 'customer', 'restaurant_staff', 'rider'],
    }
  : null;

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const existingToken = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || (import.meta.env.DEV ? DEV_BYPASS_TOKEN : '');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(Boolean(existingToken));
  const [isLoading, setIsLoading] = useState<boolean>(!existingToken);
  const [user, setUser] = useState<UserProfile | null>(existingToken ? DEV_ADMIN_USER : null);

  const isAdmin = Boolean(user?.roles?.includes('admin'));

  useEffect(() => {
    // If running in local dev, ensure localStorage is populated with a fresh valid token
    if (import.meta.env.DEV && DEV_BYPASS_TOKEN) {
      const stored = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
      if (!stored || stored.includes('00000000-0000-0000-0000-000000000001') || stored !== DEV_BYPASS_TOKEN) {
        localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, DEV_BYPASS_TOKEN);
        // Clear any old revoked refresh token so client uses the fresh dev token directly
        localStorage.removeItem(ADMIN_REFRESH_TOKEN_STORAGE_KEY);
      }
    }
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await authApi.getMe();
      if (res?.user) {
        setUser(res.user);
      }
    } catch {
      // Keep dev admin user active
      setUser(DEV_ADMIN_USER);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const requestOtp = async (phone: string) => {
    const res = await authApi.requestOtp(phone);
    return {
      cooldownSeconds: res.cooldownSeconds || 60,
      expiresInSeconds: res.expiresInSeconds || 300,
    };
  };

  const verifyOtp = async (phone: string, otp: string) => {
    setIsLoading(true);
    try {
      const res = await authApi.verifyOtp(phone, otp);
      if (res.tokens?.accessToken) {
        localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, res.tokens.accessToken);
        if (res.tokens.refreshToken) {
          localStorage.setItem(ADMIN_REFRESH_TOKEN_STORAGE_KEY, res.tokens.refreshToken);
        }
        setUser(res.user);
        setIsAuthenticated(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (idToken: string) => {
    setIsLoading(true);
    try {
      const res = await authApi.loginWithGoogle(idToken);
      if (res.tokens?.accessToken) {
        localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, res.tokens.accessToken);
        if (res.tokens.refreshToken) {
          localStorage.setItem(ADMIN_REFRESH_TOKEN_STORAGE_KEY, res.tokens.refreshToken);
        }
        setUser(res.user);
        setIsAuthenticated(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Continue client cleanup even if backend network call fails
    } finally {
      localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
      localStorage.removeItem(ADMIN_REFRESH_TOKEN_STORAGE_KEY);
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  return (
    <AdminAuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        isAdmin,
        user,
        requestOtp,
        verifyOtp,
        loginWithGoogle,
        logout,
        refreshProfile: fetchProfile,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

