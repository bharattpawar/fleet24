import 'reflect-metadata';
import { validate, Environment, isDevAuthBypassEnabled } from './env.validation';

describe('Environment Validation', () => {
  it('should validate valid configuration and apply defaults', () => {
    const config = {
      DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/fleet24_test',
    };

    const validated = validate(config);
    expect(validated.DATABASE_URL).toBe(config.DATABASE_URL);
    expect(validated.NODE_ENV).toBe(Environment.Development);
    expect(validated.PORT).toBe(4000);
    expect(validated.CORS_ORIGINS).toBeUndefined();
  });

  it('never falls back to a JWT secret published in source code', () => {
    const validated = validate({ DATABASE_URL: 'postgresql://localhost:5432/a' });
    expect(validated.JWT_ACCESS_SECRET).toHaveLength(64);
    expect(validated.JWT_ACCESS_SECRET).not.toContain('fleet24_dev');
    // Stable per installation, different across installations
    expect(validate({ DATABASE_URL: 'postgresql://localhost:5432/a' }).JWT_ACCESS_SECRET).toBe(
      validated.JWT_ACCESS_SECRET,
    );
    expect(validate({ DATABASE_URL: 'postgresql://localhost:5432/b' }).JWT_ACCESS_SECRET).not.toBe(
      validated.JWT_ACCESS_SECRET,
    );
  });

  describe('production secrets', () => {
    const complete = {
      DATABASE_URL: 'postgresql://db/prod',
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'x'.repeat(40),
      DELIVERY_OTP_ENCRYPTION_KEY: 'k'.repeat(64),
      RAZORPAY_WEBHOOK_SECRET: 'whsec',
      CORS_ORIGINS: 'https://admin.fleet24.in',
      GOOGLE_CLIENT_IDS: 'web.apps.googleusercontent.com',
    };

    it('starts when every required secret is set', () => {
      expect(() => validate(complete)).not.toThrow();
    });

    it.each([
      ['JWT_ACCESS_SECRET', undefined],
      ['JWT_ACCESS_SECRET', 'too-short'],
      ['DELIVERY_OTP_ENCRYPTION_KEY', undefined],
      ['RAZORPAY_WEBHOOK_SECRET', undefined],
      ['CORS_ORIGINS', undefined],
      ['GOOGLE_CLIENT_IDS', undefined],
    ])('refuses to start when %s is %p', (key, value) => {
      const config: Record<string, unknown> = { ...complete, [key]: value };
      if (value === undefined) delete config[key];
      expect(() => validate(config)).toThrow(/Refusing to start in production.*/);
      expect(() => validate(config)).toThrow(key);
    });
  });

  describe('isDevAuthBypassEnabled', () => {
    it('is enabled only for an explicit development opt-in', () => {
      expect(isDevAuthBypassEnabled({ NODE_ENV: 'development', ALLOW_DEV_AUTH_BYPASS: 'true' })).toBe(true);
      expect(isDevAuthBypassEnabled({ NODE_ENV: 'development', ALLOW_DEV_AUTH_BYPASS: 'false' })).toBe(false);
      expect(isDevAuthBypassEnabled({ NODE_ENV: 'development' })).toBe(false);
      expect(isDevAuthBypassEnabled({ ALLOW_DEV_AUTH_BYPASS: 'true' })).toBe(false);
      expect(isDevAuthBypassEnabled({ NODE_ENV: 'test', ALLOW_DEV_AUTH_BYPASS: 'true' })).toBe(false);
      expect(isDevAuthBypassEnabled({ NODE_ENV: 'production', ALLOW_DEV_AUTH_BYPASS: 'true' })).toBe(false);
    });
  });

  it('should throw an error when DATABASE_URL is missing', () => {
    const config = {};
    expect(() => validate(config)).toThrow('[Fleet24 Backend Startup Error]');
  });

  it('should throw an error when NODE_ENV is invalid', () => {
    const config = {
      DATABASE_URL: 'postgresql://localhost:5432/test',
      NODE_ENV: 'invalid_env',
    };
    expect(() => validate(config)).toThrow('[Fleet24 Backend Startup Error]');
  });
});
