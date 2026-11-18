import {
  Injectable,
  Inject,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc } from 'drizzle-orm';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { ISmsProvider, SMS_PROVIDER_TOKEN } from './sms/sms-provider.interface';
import { isDevAuthBypassEnabled } from '../config/env.validation';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client;

  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    @Inject(SMS_PROVIDER_TOKEN)
    private readonly smsProvider: ISmsProvider,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.googleClient = new OAuth2Client();
  }

  /**
   * Normalizes mobile number to E.164-like standard (+91XXXXXXXXXX)
   */
  normalizePhoneNumber(rawPhone: string): string {
    const cleaned = rawPhone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `+91${cleaned}`;
    }
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
      return `+${cleaned}`;
    }
    return rawPhone.trim();
  }

  /**
   * Generates a cryptographically secure 6-digit numeric OTP
   */
  generateSecureOtp(): string {
    const randomInt = crypto.randomInt(100000, 1000000);
    return randomInt.toString();
  }

  /**
   * SHA-256 hash helper
   */
  hashValue(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /**
   * Request an OTP for a phone number.
   * Handles cooldown, expiration, secure hash storage, and delivery via SMS provider.
   */
  async requestOtp(rawPhone: string) {
    const phone = this.normalizePhoneNumber(rawPhone);
    const cooldownSec = this.configService.get<number>('OTP_RESEND_COOLDOWN_SECONDS', 60);
    const expirySec = this.configService.get<number>('OTP_EXPIRY_SECONDS', 300);
    const maxAttempts = this.configService.get<number>('OTP_MAX_ATTEMPTS', 5);

    // Check most recent active OTP for this phone
    const recentChallenge = await this.db.query.phoneOtpChallenges.findFirst({
      where: eq(schema.phoneOtpChallenges.phone, phone),
      orderBy: [desc(schema.phoneOtpChallenges.createdAt)],
    });

    const now = new Date();

    if (recentChallenge) {
      const elapsedSeconds = (now.getTime() - recentChallenge.createdAt.getTime()) / 1000;
      if (elapsedSeconds < cooldownSec && !recentChallenge.isUsed) {
        const remaining = Math.ceil(cooldownSec - elapsedSeconds);
        throw new BadRequestException(
          `Please wait ${remaining} seconds before requesting a new OTP.`,
        );
      }
    }

    const plainOtp = this.generateSecureOtp();
    const otpHash = this.hashValue(plainOtp);
    const expiresAt = new Date(now.getTime() + expirySec * 1000);

    // Save hashed challenge to database
    await this.db.insert(schema.phoneOtpChallenges).values({
      phone,
      otpHash,
      attemptsCount: 0,
      maxAttempts,
      isUsed: false,
      expiresAt,
    });

    // Send via SMS provider (Mock in dev, real gateway in production)
    await this.smsProvider.sendOtp(phone, plainOtp);

    return {
      message: 'OTP sent successfully',
      cooldownSeconds: cooldownSec,
      expiresInSeconds: expirySec,
    };
  }

  /**
   * Verifies submitted OTP, creates or retrieves user, assigns default role, and creates session.
   */
  async verifyOtp(rawPhone: string, plainOtp: string, userAgent?: string, ipAddress?: string) {
    const phone = this.normalizePhoneNumber(rawPhone);
    const candidateHash = this.hashValue(plainOtp);

    // Find the latest challenge for this phone
    const challenge = await this.db.query.phoneOtpChallenges.findFirst({
      where: eq(schema.phoneOtpChallenges.phone, phone),
      orderBy: [desc(schema.phoneOtpChallenges.createdAt)],
    });

    if (!challenge) {
      throw new BadRequestException('No OTP request found for this phone number. Please request a new OTP.');
    }

    if (challenge.isUsed) {
      throw new BadRequestException('This OTP has already been used. Please request a new OTP.');
    }

    const now = new Date();
    if (now > challenge.expiresAt) {
      throw new BadRequestException('The OTP has expired. Please request a new OTP.');
    }

    if (challenge.attemptsCount >= challenge.maxAttempts) {
      throw new BadRequestException('Maximum verification attempts exceeded. Please request a new OTP.');
    }

    const isMasterBypass =
      this.isDevAuthBypassEnabled() && (plainOtp === '123456' || plainOtp === '000000');

    // Timing-safe comparison of the hash or dev bypass
    const isMatch = isMasterBypass || crypto.timingSafeEqual(
      Buffer.from(candidateHash, 'hex'),
      Buffer.from(challenge.otpHash, 'hex'),
    );

    if (!isMatch) {
      // Increment attempt count
      await this.db
        .update(schema.phoneOtpChallenges)
        .set({ attemptsCount: challenge.attemptsCount + 1 })
        .where(eq(schema.phoneOtpChallenges.id, challenge.id));

      const attemptsRemaining = challenge.maxAttempts - (challenge.attemptsCount + 1);
      throw new BadRequestException(
        `Invalid OTP. Attempts remaining: ${Math.max(0, attemptsRemaining)}`,
      );
    }

    // Mark challenge as used
    await this.db
      .update(schema.phoneOtpChallenges)
      .set({ isUsed: true })
      .where(eq(schema.phoneOtpChallenges.id, challenge.id));

    // Find or create user
    let user = await this.db.query.users.findFirst({
      where: eq(schema.users.phone, phone),
      with: {
        roles: true,
      },
    });

    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const [createdUser] = await this.db
        .insert(schema.users)
        .values({
          phone,
          fullName: 'Fleet24 User',
        })
        .returning();

      // Assign default 'customer' role strictly. Admin and staff roles must be explicitly provisioned.
      await this.db.insert(schema.userRoles).values([
        {
          userId: createdUser.id,
          role: 'customer',
        },
      ]);

      user = await this.db.query.users.findFirst({
        where: eq(schema.users.id, createdUser.id),
        with: {
          roles: true,
        },
      });
    }

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is inactive or suspended.');
    }

    const roles = user.roles.map((r) => r.role);

    // Create session and issue tokens
    const { accessToken, refreshToken } = await this.createSession(
      user.id,
      user.phone,
      roles,
      userAgent,
      ipAddress,
    );

    return {
      isNewUser,
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        email: user.email,
        roles,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  /**
   * Creates a user session with refresh token rotation support
   */
  private async createSession(
    userId: string,
    phone: string | null,
    roles: string[],
    userAgent?: string,
    ipAddress?: string,
  ) {
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = this.hashValue(rawRefreshToken);

    const refreshDays = this.configService.get<number>('JWT_REFRESH_EXPIRY_DAYS', 30);
    const expiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000);

    const [session] = await this.db
      .insert(schema.userSessions)
      .values({
        userId,
        refreshTokenHash,
        isRevoked: false,
        userAgent: userAgent ? userAgent.substring(0, 255) : null,
        ipAddress: ipAddress ? ipAddress.substring(0, 45) : null,
        expiresAt,
      })
      .returning();

    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
    const accessExpiry = this.configService.get<string>('JWT_ACCESS_EXPIRY', '15m');

    const accessToken = await this.jwtService.signAsync(
      {
        userId,
        phone,
        sessionId: session.id,
        roles,
      },
      {
        secret: accessSecret,
        expiresIn: accessExpiry,
      },
    );

    return {
      accessToken,
      refreshToken: `${session.id}.${rawRefreshToken}`,
    };
  }

  /**
   * Refreshes access token and rotates refresh token.
   * Detects reuse of revoked or already rotated tokens.
   */
  async refreshTokens(compoundToken: string, userAgent?: string, ipAddress?: string) {
    const [sessionId, rawToken] = compoundToken.split('.');

    if (!sessionId || !rawToken) {
      throw new UnauthorizedException('Invalid refresh token structure.');
    }

    const session = await this.db.query.userSessions.findFirst({
      where: eq(schema.userSessions.id, sessionId),
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh session.');
    }

    // Reuse detection: if a revoked session is attempted to be reused
    if (session.isRevoked) {
      this.logger.warn(`Potential refresh token reuse detected for user ${session.userId}.`);
      throw new UnauthorizedException('Session has been revoked.');
    }

    if (new Date() > session.expiresAt) {
      throw new UnauthorizedException('Refresh token has expired.');
    }

    const candidateHash = this.hashValue(rawToken);

    if (candidateHash !== session.refreshTokenHash) {
      // Possible compromise: Revoke session immediately
      await this.db
        .update(schema.userSessions)
        .set({ isRevoked: true })
        .where(eq(schema.userSessions.id, sessionId));

      this.logger.warn(`Refresh token hash mismatch for session ${sessionId}. Revoked session.`);
      throw new UnauthorizedException('Invalid refresh token.');
    }

    // Revoke old session (Rotation)
    await this.db
      .update(schema.userSessions)
      .set({ isRevoked: true })
      .where(eq(schema.userSessions.id, sessionId));

    // Fetch user and roles
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, session.userId),
      with: {
        roles: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account inactive.');
    }

    const roles = user.roles.map((r) => r.role);

    // Issue new session
    return this.createSession(user.id, user.phone, roles, userAgent, ipAddress);
  }

  /**
   * Revokes the current session (Logout)
   */
  async logout(sessionId: string) {
    await this.db
      .update(schema.userSessions)
      .set({ isRevoked: true })
      .where(eq(schema.userSessions.id, sessionId));

    return { message: 'Logged out successfully' };
  }

  /**
   * Fetches profile of current user with roles and staff assignments
   */
  async getCurrentUserProfile(userId: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      with: {
        roles: true,
        staffAssignments: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      roles: user.roles.map((r) => r.role),
      staffAssignments: user.staffAssignments.map((s) => ({
        outletId: s.outletId,
        designation: s.designation,
      })),
      createdAt: user.createdAt,
    };
  }

  /**
   * Updates only permitted profile fields (e.g. fullName)
   */
  async updateProfile(userId: string, updateDto: { fullName: string }) {
    const [updatedUser] = await this.db
      .update(schema.users)
      .set({
        fullName: updateDto.fullName,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId))
      .returning();

    return {
      id: updatedUser.id,
      phone: updatedUser.phone,
      fullName: updatedUser.fullName,
      email: updatedUser.email,
    };
  }

  /**
   * Verifies Google ID token, finds or creates Fleet24 user account, and issues Fleet24 tokens
   */
  async authenticateGoogleUser(idToken: string, userAgent?: string, ipAddress?: string) {
    if (!idToken || typeof idToken !== 'string') {
      throw new BadRequestException('A valid Google ID token is required.');
    }

    let payload: any;

    // Development mock bypass for testing (explicit opt-in, development only)
    if (this.isDevAuthBypassEnabled() && idToken === 'mock-google-id-token') {
      payload = {
        sub: 'google-mock-customer-sub-001',
        email: 'customer.demo@fleet24.app',
        name: 'Demo Customer',
      };
    } else {
      const allowedAudiences = this.getAllowedGoogleClientIds();
      if (allowedAudiences.length === 0) {
        this.logger.error('Google sign-in attempted but GOOGLE_CLIENT_IDS is not configured.');
        throw new UnauthorizedException('Google sign-in is not configured.');
      }

      try {
        // Only tokens issued to Fleet24's own OAuth clients are accepted. verifyIdToken also checks
        // the Google signature, issuer and expiry.
        const ticket = await this.googleClient.verifyIdToken({
          idToken,
          audience: allowedAudiences,
        });
        payload = ticket.getPayload();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Invalid or expired Google credential';
        this.logger.warn(`Google token verification failed: ${msg}`);
        throw new UnauthorizedException('Google authentication failed. Invalid or expired token.');
      }

      if (!payload?.email_verified) {
        throw new UnauthorizedException('Google account email is not verified.');
      }
    }

    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid Google payload.');
    }

    const googleId = payload.sub;
    const email = payload.email ? payload.email.toLowerCase().trim() : null;
    const fullName = payload.name ? payload.name.trim() : 'Fleet24 User';

    // 1. Look up by unique googleId
    let user = await this.db.query.users.findFirst({
      where: eq(schema.users.googleId, googleId),
      with: {
        roles: true,
      },
    });

    let isNewUser = false;

    // 2. If no user by googleId, check if an account exists with the verified Google email
    if (!user && email) {
      const userByEmail = await this.db.query.users.findFirst({
        where: eq(schema.users.email, email),
        with: {
          roles: true,
        },
      });

      if (userByEmail) {
        // Link googleId to existing verified account
        await this.db
          .update(schema.users)
          .set({
            googleId,
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, userByEmail.id));

        user = await this.db.query.users.findFirst({
          where: eq(schema.users.id, userByEmail.id),
          with: {
            roles: true,
          },
        });
      }
    }

    // 3. If still no user, create a new customer account
    if (!user) {
      isNewUser = true;
      const [createdUser] = await this.db
        .insert(schema.users)
        .values({
          fullName,
          email,
          googleId,
          phone: null,
          isActive: true,
        })
        .returning();

      // Assign default 'customer' role strictly. Admin and staff roles must be explicitly provisioned.
      await this.db.insert(schema.userRoles).values([
        {
          userId: createdUser.id,
          role: 'customer',
        },
      ]);

      user = await this.db.query.users.findFirst({
        where: eq(schema.users.id, createdUser.id),
        with: {
          roles: true,
        },
      });
    }

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is inactive or suspended.');
    }

    const roles = user.roles.map((r) => r.role);

    // Create Fleet24 session & tokens
    const { accessToken, refreshToken } = await this.createSession(
      user.id,
      user.phone || '',
      roles,
      userAgent,
      ipAddress,
    );

    return {
      isNewUser,
      needsPhoneVerification: !user.phone,
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        email: user.email,
        roles,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  /** Development OTP / mock-token shortcuts: explicit opt-in, NODE_ENV=development only. */
  private isDevAuthBypassEnabled(): boolean {
    return isDevAuthBypassEnabled({
      NODE_ENV: this.configService.get<string>('NODE_ENV'),
      ALLOW_DEV_AUTH_BYPASS: this.configService.get<string>('ALLOW_DEV_AUTH_BYPASS'),
    });
  }

  /** Google OAuth client IDs accepted as ID-token audiences (GOOGLE_CLIENT_IDS plus legacy GOOGLE_CLIENT_ID). */
  private getAllowedGoogleClientIds(): string[] {
    const raw = [
      this.configService.get<string>('GOOGLE_CLIENT_IDS') || '',
      this.configService.get<string>('GOOGLE_CLIENT_ID') || '',
    ].join(',');
    return Array.from(
      new Set(
        raw
          .split(',')
          .map((id) => id.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean),
      ),
    );
  }
}
