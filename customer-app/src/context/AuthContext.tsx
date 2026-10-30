import React, { createContext, useContext, useState, useEffect } from 'react';
import { authStorage } from '../api/storage';
import { apiRequest } from '../api/client';
import { USE_MOCK_DATA, MOCK_USER_PROFILE } from '../api/mockData';

export interface UserProfile {
  id: string;
  phone?: string | null;
  fullName: string;
  email?: string;
  roles: string[];
}

export interface GoogleAuthResponse {
  isNewUser: boolean;
  needsPhoneVerification: boolean;
  user: UserProfile;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  requestOtp: (phone: string) => Promise<{ cooldownSeconds: number; expiresInSeconds: number }>;
  verifyOtp: (phone: string, otp: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<{ isNewUser: boolean; needsPhoneVerification: boolean; user: UserProfile }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = async () => {
    if (USE_MOCK_DATA) {
      setUser(MOCK_USER_PROFILE);
      return;
    }
    try {
      const profile = await apiRequest<UserProfile>('/auth/me');
      setUser(profile);
    } catch {
      setUser(null);
      await authStorage.clearTokens();
    }
  };

  useEffect(() => {
    const init = async () => {
      if (USE_MOCK_DATA) {
        setUser(MOCK_USER_PROFILE);
        setIsLoading(false);
        return;
      }
      const token = await authStorage.getAccessToken();
      if (token) {
        await refreshProfile();
      }
      setIsLoading(false);
    };
    init();
  }, []);

  const requestOtp = async (phone: string) => {
    if (USE_MOCK_DATA) {
      return { message: 'Mock OTP sent (use 123456)', cooldownSeconds: 30, expiresInSeconds: 300 };
    }
    return apiRequest<{ message: string; cooldownSeconds: number; expiresInSeconds: number }>(
      '/auth/otp/request',
      {
        method: 'POST',
        body: JSON.stringify({ phone }),
      },
    );
  };

  const verifyOtp = async (phone: string, otp: string) => {
    if (USE_MOCK_DATA) {
      const mockUser: UserProfile = {
        ...MOCK_USER_PROFILE,
        phone,
      };
      await authStorage.setTokens('mock_access_token_jwt', 'mock_refresh_token_jwt');
      setUser(mockUser);
      return;
    }

    const res = await apiRequest<{
      user: UserProfile;
      tokens: { accessToken: string; refreshToken: string };
    }>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    });

    await authStorage.setTokens(res.tokens.accessToken, res.tokens.refreshToken);
    setUser(res.user);
  };

  const loginWithGoogle = async (idToken: string) => {
    if (USE_MOCK_DATA) {
      const mockGoogleUser: UserProfile = {
        id: 'usr-google-aarav',
        fullName: 'Aarav Sharma (Google)',
        email: 'aarav.sharma@student.gbu.ac.in',
        phone: '9876543210',
        roles: ['customer'],
      };
      await authStorage.setTokens('mock_google_access_token', 'mock_google_refresh_token');
      setUser(mockGoogleUser);
      return {
        isNewUser: false,
        needsPhoneVerification: false,
        user: mockGoogleUser,
      };
    }

    const res = await apiRequest<GoogleAuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });

    await authStorage.setTokens(res.tokens.accessToken, res.tokens.refreshToken);
    setUser(res.user);
    return {
      isNewUser: res.isNewUser,
      needsPhoneVerification: res.needsPhoneVerification,
      user: res.user,
    };
  };

  const logout = async () => {
    try {
      if (!USE_MOCK_DATA) {
        await apiRequest('/auth/logout', { method: 'POST' });
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      await authStorage.clearTokens();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user,
        isLoading,
        user,
        requestOtp,
        verifyOtp,
        loginWithGoogle,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
