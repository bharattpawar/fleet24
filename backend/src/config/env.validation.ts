import { parseCorsOrigins } from './cors-origins';
import { createHash } from 'crypto';
import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 4000;

  @IsString()
  DATABASE_URL!: string;

  /** Comma-separated allowed browser origins. Required in production. */
  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;

  /**
   * Required in production (min 32 chars). Outside production, a per-installation secret is
   * derived from DATABASE_URL when unset, so no secret published in source ever signs tokens.
   */
  @IsString()
  @IsOptional()
  JWT_ACCESS_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRY: string = '15m';

  @IsNumber()
  @IsOptional()
  JWT_REFRESH_EXPIRY_DAYS: number = 30;

  @IsNumber()
  @IsOptional()
  OTP_EXPIRY_SECONDS: number = 300; // 5 minutes

  @IsNumber()
  @IsOptional()
  OTP_RESEND_COOLDOWN_SECONDS: number = 60; // 1 minute

  @IsNumber()
  @IsOptional()
  OTP_MAX_ATTEMPTS: number = 5;

  /**
   * Enables the development OTP (123456/000000) and mock Google token shortcuts.
   * Honoured only when NODE_ENV=development; ignored everywhere else.
   */
  @IsString()
  @IsOptional()
  ALLOW_DEV_AUTH_BYPASS: string = 'false';

  @IsString()
  @IsOptional()
  SMS_PROVIDER: string = 'mock'; // 'mock' | 'twilio' | 'msg91'

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID?: string;

  /** Comma-separated Google OAuth client IDs (web, iOS, Android) accepted as ID-token audiences. */
  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_IDS?: string;

  /**
   * Comma-separated allowlist of payment return URL prefixes (deep-link schemes or https origins).
   * Defaults to the Fleet24 app scheme plus Expo development schemes.
   */
  @IsString()
  @IsOptional()
  PAYMENT_RETURN_URL_ALLOWLIST?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  RAZORPAY_KEY_ID?: string;

  @IsString()
  @IsOptional()
  RAZORPAY_KEY_SECRET?: string;

  @IsString()
  @IsOptional()
  RAZORPAY_WEBHOOK_SECRET?: string;

  @IsString()
  @IsOptional()
  RAZORPAY_MODE: string = 'test';

  /**
   * Google Routes API key for authoritative road-distance routing and matrix computation.
   * Configured locally via backend environment. Optional for development/testing without live routes.
   */
  @IsString()
  @IsOptional()
  GOOGLE_ROUTES_API_KEY?: string;

  /**
   * Primary routing provider ('google' by default).
   */
  @IsString()
  @IsOptional()
  ROUTING_PROVIDER: string = 'google';

  /**
   * Timeout in milliseconds for external routing requests (default: 3000ms).
   */
  @IsNumber()
  @IsOptional()
  ROUTING_TIMEOUT_MS: number = 3000;

  /**
   * Time-to-live in seconds for static point-to-point route cache entries (default: 3600s).
   */
  @IsNumber()
  @IsOptional()
  ROUTING_CACHE_TTL_SECONDS: number = 3600;

  /**
   * Maximum capacity for the in-memory LRU routing cache (default: 2000 entries).
   */
  @IsNumber()
  @IsOptional()
  ROUTING_CACHE_MAX_ENTRIES: number = 2000;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorDetails = errors
      .map((err) => {
        const constraints = Object.values(err.constraints || {}).join(', ');
        return `Field '${err.property}': ${constraints}`;
      })
      .join('; ');

    throw new Error(
      `[Fleet24 Backend Startup Error] Environment configuration validation failed: ${errorDetails}`,
    );
  }

  const corsOrigins = parseCorsOrigins(validatedConfig.CORS_ORIGINS);
  validatedConfig.CORS_ORIGINS = corsOrigins.join(',') || undefined;

  if (validatedConfig.NODE_ENV === Environment.Production) {
    const missing: string[] = [];
    if (!validatedConfig.JWT_ACCESS_SECRET || validatedConfig.JWT_ACCESS_SECRET.length < 32) {
      missing.push('JWT_ACCESS_SECRET (at least 32 characters)');
    }
    if (!validatedConfig.RAZORPAY_WEBHOOK_SECRET) missing.push('RAZORPAY_WEBHOOK_SECRET');
    if (!validatedConfig.CORS_ORIGINS) missing.push('CORS_ORIGINS');
    if (!validatedConfig.GOOGLE_CLIENT_IDS && !validatedConfig.GOOGLE_CLIENT_ID) {
      missing.push('GOOGLE_CLIENT_IDS');
    }
    if (missing.length > 0) {
      throw new Error(
        `[Fleet24 Backend Startup Error] Refusing to start in production. Missing or weak: ${missing.join(', ')}`,
      );
    }
  } else if (!validatedConfig.JWT_ACCESS_SECRET) {
    // Never sign tokens with a secret that is published in source code. Derive a per-installation
    // dev secret from DATABASE_URL so it stays stable across dev-server restarts.
    validatedConfig.JWT_ACCESS_SECRET = createHash('sha256')
      .update(`fleet24-dev-jwt:${validatedConfig.DATABASE_URL}`)
      .digest('hex');
  }

  return validatedConfig;
}

/** True only for an explicit development opt-in; never true in production, test or when NODE_ENV is unset. */
export function isDevAuthBypassEnabled(env: { NODE_ENV?: string; ALLOW_DEV_AUTH_BYPASS?: string }): boolean {
  return env.NODE_ENV === Environment.Development && env.ALLOW_DEV_AUTH_BYPASS === 'true';
}
