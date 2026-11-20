import { apiClient } from './client';
import type { RequestOtpResponse, VerifyOtpResponse, UserProfile } from '@/types/auth';

export const authApi = {
  requestOtp: async (phone: string): Promise<RequestOtpResponse> => {
    const res = await apiClient.post<RequestOtpResponse>('/auth/otp/request', { phone });
    return res.data;
  },

  verifyOtp: async (phone: string, otp: string): Promise<VerifyOtpResponse> => {
    const res = await apiClient.post<VerifyOtpResponse>('/auth/otp/verify', { phone, otp });
    return res.data;
  },

  loginWithGoogle: async (idToken: string): Promise<VerifyOtpResponse> => {
    const res = await apiClient.post<VerifyOtpResponse>('/auth/google', { idToken });
    return res.data;
  },

  /** GET /auth/me returns the profile itself; older builds wrapped it as { user }. */
  getMe: async (): Promise<{ user: UserProfile }> => {
    const res = await apiClient.get<UserProfile | { user: UserProfile }>('/auth/me');
    const data = res.data;
    return data && 'user' in data ? data : { user: data as UserProfile };
  },

  logout: async (): Promise<{ message: string }> => {
    const res = await apiClient.post<{ message: string }>('/auth/logout');
    return res.data;
  },
};

