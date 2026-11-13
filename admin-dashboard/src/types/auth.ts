export interface UserProfile {
  id: string;
  phone: string | null;
  fullName: string;
  email: string | null;
  roles: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface VerifyOtpResponse {
  isNewUser: boolean;
  user: UserProfile;
  tokens: AuthTokens;
}

export interface RequestOtpResponse {
  message: string;
  cooldownSeconds: number;
  expiresInSeconds: number;
}

