import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import { SMS_PROVIDER_TOKEN } from './sms/sms-provider.interface';

describe('AuthService (Unit Tests)', () => {
  let service: AuthService;
  let mockDb: any;
  let mockSmsProvider: any;
  let mockJwtService: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockDb = {
      query: {
        phoneOtpChallenges: {
          findFirst: jest.fn(),
        },
        users: {
          findFirst: jest.fn(),
        },
        userSessions: {
          findFirst: jest.fn(),
        },
      },
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn(),
        }),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn(),
        }),
      }),
    };

    mockSmsProvider = {
      sendOtp: jest.fn().mockResolvedValue(true),
    };

    mockJwtService = {
      signAsync: jest.fn().mockResolvedValue('mock_access_jwt_token'),
      verifyAsync: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const configMap: Record<string, any> = {
          OTP_EXPIRY_SECONDS: 300,
          OTP_RESEND_COOLDOWN_SECONDS: 60,
          OTP_MAX_ATTEMPTS: 5,
          JWT_ACCESS_SECRET: 'test_secret_for_auth_spec',
          JWT_ACCESS_EXPIRY: '15m',
          JWT_REFRESH_EXPIRY_DAYS: 30,
        };
        return configMap[key] !== undefined ? configMap[key] : defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DRIZZLE_CONNECTION, useValue: mockDb },
        { provide: SMS_PROVIDER_TOKEN, useValue: mockSmsProvider },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('normalizePhoneNumber', () => {
    it('should format 10-digit Indian numbers with +91', () => {
      expect(service.normalizePhoneNumber('9876543210')).toBe('+919876543210');
      expect(service.normalizePhoneNumber('+919876543210')).toBe('+919876543210');
      expect(service.normalizePhoneNumber('919876543210')).toBe('+919876543210');
    });
  });

  describe('requestOtp', () => {
    it('should generate, hash and dispatch OTP for a valid phone number', async () => {
      mockDb.query.phoneOtpChallenges.findFirst.mockResolvedValueOnce(null);

      const res = await service.requestOtp('+919876543210');

      expect(res.message).toBe('OTP sent successfully');
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockSmsProvider.sendOtp).toHaveBeenCalledWith(
        '+919876543210',
        expect.stringMatching(/^\d{6}$/),
      );
    });

    it('should enforce OTP resend cooldown', async () => {
      const recentDate = new Date(); // 0 seconds ago (< 60s cooldown)
      mockDb.query.phoneOtpChallenges.findFirst.mockResolvedValueOnce({
        createdAt: recentDate,
        isUsed: false,
      });

      await expect(service.requestOtp('+919876543210')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('verifyOtp', () => {
    it('should reject verification if no challenge exists', async () => {
      mockDb.query.phoneOtpChallenges.findFirst.mockResolvedValueOnce(null);

      await expect(service.verifyOtp('+919876543210', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject already used OTP', async () => {
      mockDb.query.phoneOtpChallenges.findFirst.mockResolvedValueOnce({
        isUsed: true,
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(service.verifyOtp('+919876543210', '123456')).rejects.toThrow(
        'This OTP has already been used.',
      );
    });

    it('should reject expired OTP', async () => {
      mockDb.query.phoneOtpChallenges.findFirst.mockResolvedValueOnce({
        isUsed: false,
        expiresAt: new Date(Date.now() - 10000), // Expired
      });

      await expect(service.verifyOtp('+919876543210', '123456')).rejects.toThrow(
        'The OTP has expired.',
      );
    });

    it('should reject when maximum attempts exceeded', async () => {
      mockDb.query.phoneOtpChallenges.findFirst.mockResolvedValueOnce({
        isUsed: false,
        expiresAt: new Date(Date.now() + 100000),
        attemptsCount: 5,
        maxAttempts: 5,
      });

      await expect(service.verifyOtp('+919876543210', '123456')).rejects.toThrow(
        'Maximum verification attempts exceeded.',
      );
    });

    it('should increment attemptsCount on incorrect OTP', async () => {
      const plainOtp = '987654';
      const actualHash = service.hashValue('654321'); // Mismatched and not a dev bypass OTP

      mockDb.query.phoneOtpChallenges.findFirst.mockResolvedValueOnce({
        id: 'challenge-id-1',
        isUsed: false,
        expiresAt: new Date(Date.now() + 100000),
        attemptsCount: 1,
        maxAttempts: 5,
        otpHash: actualHash,
      });

      await expect(service.verifyOtp('+919876543210', plainOtp)).rejects.toThrow(
        /Invalid OTP/,
      );
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should successfully verify OTP, create user session and issue tokens', async () => {
      const plainOtp = '123456';
      const actualHash = service.hashValue(plainOtp);

      mockDb.query.phoneOtpChallenges.findFirst.mockResolvedValueOnce({
        id: 'challenge-id-1',
        isUsed: false,
        expiresAt: new Date(Date.now() + 100000),
        attemptsCount: 0,
        maxAttempts: 5,
        otpHash: actualHash,
      });

      // Mock user exists
      mockDb.query.users.findFirst.mockResolvedValueOnce({
        id: 'user-uuid-1',
        phone: '+919876543210',
        fullName: 'Test Customer',
        email: 'test@example.com',
        isActive: true,
        roles: [{ role: 'customer' }],
      });

      // Mock session insert returning
      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockReturnValueOnce({
          returning: jest.fn().mockResolvedValueOnce([
            { id: 'session-uuid-1' },
          ]),
        }),
      });

      const result = await service.verifyOtp('+919876543210', plainOtp);

      expect(result.tokens.accessToken).toBe('mock_access_jwt_token');
      expect(result.tokens.refreshToken).toMatch(/^session-uuid-1\./);
      expect(result.user.roles).toContain('customer');
    });
  });

  describe('refreshTokens', () => {
    it('should reject refresh token with invalid structure', async () => {
      await expect(service.refreshTokens('invalid-structure')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should detect reuse of a revoked session', async () => {
      mockDb.query.userSessions.findFirst.mockResolvedValueOnce({
        id: 'session-id',
        isRevoked: true,
      });

      await expect(service.refreshTokens('session-id.secret')).rejects.toThrow(
        'Session has been revoked.',
      );
    });

    it('should rotate valid refresh token and revoke previous session', async () => {
      const rawToken = 'plain-refresh-token';
      const hash = service.hashValue(rawToken);

      mockDb.query.userSessions.findFirst.mockResolvedValueOnce({
        id: 'session-id-1',
        userId: 'user-id-1',
        refreshTokenHash: hash,
        isRevoked: false,
        expiresAt: new Date(Date.now() + 1000000),
      });

      mockDb.query.users.findFirst.mockResolvedValueOnce({
        id: 'user-id-1',
        phone: '+919876543210',
        isActive: true,
        roles: [{ role: 'customer' }],
      });

      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockReturnValueOnce({
          returning: jest.fn().mockResolvedValueOnce([
            { id: 'session-id-2' },
          ]),
        }),
      });

      const res = await service.refreshTokens(`session-id-1.${rawToken}`);

      expect(res.accessToken).toBe('mock_access_jwt_token');
      expect(mockDb.update).toHaveBeenCalled(); // Revoked old session
    });
  });

  describe('logout', () => {
    it('should mark user session as revoked', async () => {
      const res = await service.logout('session-id-1');
      expect(res.message).toBe('Logged out successfully');
      expect(mockDb.update).toHaveBeenCalled();
    });
  });
  describe('authentication hardening', () => {
    const baseConfig: Record<string, any> = {
      OTP_EXPIRY_SECONDS: 300,
      OTP_RESEND_COOLDOWN_SECONDS: 60,
      OTP_MAX_ATTEMPTS: 5,
      JWT_ACCESS_SECRET: 'test_secret_for_auth_spec',
      JWT_ACCESS_EXPIRY: '15m',
      JWT_REFRESH_EXPIRY_DAYS: 30,
    };
    const useConfig = (extra: Record<string, any>) => {
      const map = { ...baseConfig, ...extra };
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) =>
        map[key] !== undefined ? map[key] : defaultValue,
      );
    };
    const pendingChallenge = () => ({
      id: 'challenge-id-1',
      isUsed: false,
      expiresAt: new Date(Date.now() + 100000),
      attemptsCount: 0,
      maxAttempts: 5,
      otpHash: service.hashValue('654321'),
    });

    it.each([
      ['NODE_ENV unset', {}],
      ['production', { NODE_ENV: 'production', ALLOW_DEV_AUTH_BYPASS: 'true' }],
      ['development without opt-in', { NODE_ENV: 'development' }],
    ])('rejects the dev OTP 123456 when %s', async (_label, extra) => {
      useConfig(extra);
      mockDb.query.phoneOtpChallenges.findFirst.mockResolvedValueOnce(pendingChallenge());
      await expect(service.verifyOtp('+919876543210', '123456')).rejects.toThrow(/Invalid OTP/);
    });

    it('verifies Google tokens only against configured client IDs, with no fallback', async () => {
      useConfig({ GOOGLE_CLIENT_IDS: 'web-id.apps.googleusercontent.com, android-id.apps.googleusercontent.com' });
      const verifyIdToken = jest.fn().mockRejectedValue(new Error('Wrong recipient, payload audience != requiredAudience'));
      (service as any).googleClient = { verifyIdToken };
      const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64');
      const body = Buffer.from(JSON.stringify({ aud: 'some-other-app.apps.googleusercontent.com' })).toString('base64');

      await expect(service.authenticateGoogleUser(`${header}.${body}.sig`)).rejects.toThrow(UnauthorizedException);
      expect(verifyIdToken).toHaveBeenCalledTimes(1);
      expect(verifyIdToken).toHaveBeenCalledWith({
        idToken: `${header}.${body}.sig`,
        audience: ['web-id.apps.googleusercontent.com', 'android-id.apps.googleusercontent.com'],
      });
    });

    it('rejects Google accounts whose email is not verified', async () => {
      useConfig({ GOOGLE_CLIENT_IDS: 'web-id.apps.googleusercontent.com' });
      (service as any).googleClient = {
        verifyIdToken: jest.fn().mockResolvedValue({
          getPayload: () => ({ sub: 'g-1', email: 'victim@example.com', email_verified: false }),
        }),
      };
      await expect(service.authenticateGoogleUser('a.b.c')).rejects.toThrow(/not verified/);
      expect(mockDb.query.users.findFirst).not.toHaveBeenCalled();
    });

    it('rejects Google sign-in when no client IDs are configured', async () => {
      useConfig({});
      const verifyIdToken = jest.fn();
      (service as any).googleClient = { verifyIdToken };
      await expect(service.authenticateGoogleUser('a.b.c')).rejects.toThrow(UnauthorizedException);
      expect(verifyIdToken).not.toHaveBeenCalled();
    });

    it('ignores the mock Google token unless the dev bypass is explicitly enabled', async () => {
      useConfig({ NODE_ENV: 'development' });
      await expect(service.authenticateGoogleUser('mock-google-id-token')).rejects.toThrow(UnauthorizedException);
    });
  });
});
