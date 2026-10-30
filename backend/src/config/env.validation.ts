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

  @IsString()
  @IsOptional()
  CORS_ORIGINS: string = 'http://localhost:3000,http://localhost:8081,http://172.20.10.2:4000';

  @IsString()
  @IsOptional()
  JWT_ACCESS_SECRET: string = 'fleet24_dev_super_secret_access_jwt_key_2026';

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

  @IsString()
  @IsOptional()
  SMS_PROVIDER: string = 'mock'; // 'mock' | 'twilio' | 'msg91'

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID?: string;

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

  return validatedConfig;
}
