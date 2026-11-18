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

function clearTokens() {
  localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  localStorage.removeItem(ADMIN_REFRESH_TOKEN_STORAGE_KEY);
}

async function fetchUser() {
  const profile = await authApi.getMe();
  if (!profile?.user) throw new Error('Could not load the admin profile.');
  return profile.user;
}

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);

  const isAuthenticated = Boolean(user);
  const isAdmin = Boolean(user?.roles?.includes('admin'));

  useEffect(() => {
    if (!localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) && !DEV_BYPASS_TOKEN) {
      setIsLoading(false);
      return;
    }
    let active = true;
    void fetchUser().then((profile) => {
      if (active) setUser(profile);
    }).catch(() => {
      if (active) clearTokens();
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, []);

  const fetchProfile = async () => {
    setUser(await fetchUser());
  };

  const requestOtp = async (phone: string) => {
    const res = await authApi.requestOtp(phone);
    return {
      cooldownSeconds: res.cooldownSeconds || 60,
      expiresInSeconds: res.expiresInSeconds || 300,
    };
  };

  const authenticate = async (login: () => ReturnType<typeof authApi.verifyOtp>) => {
    setIsLoading(true);
    try {
      const { tokens } = await login();
      if (!tokens?.accessToken) throw new Error('Sign-in did not return an access token.');
      clearTokens();
      localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, tokens.accessToken);
      if (tokens.refreshToken) {
        localStorage.setItem(ADMIN_REFRESH_TOKEN_STORAGE_KEY, tokens.refreshToken);
      }
      await fetchProfile();
    } catch (error) {
      clearTokens();
      setUser(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = (phone: string, otp: string) => authenticate(() => authApi.verifyOtp(phone, otp));
  const loginWithGoogle = (idToken: string) => authenticate(() => authApi.loginWithGoogle(idToken));

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Continue client cleanup even if backend network call fails
    } finally {
      clearTokens();
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

