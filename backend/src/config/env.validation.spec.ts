import 'reflect-metadata';
import { validate, Environment } from './env.validation';

describe('Environment Validation', () => {
  it('should validate valid configuration and apply defaults', () => {
    const config = {
      DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/fleet24_test',
    };

    const validated = validate(config);
    expect(validated.DATABASE_URL).toBe(config.DATABASE_URL);
    expect(validated.NODE_ENV).toBe(Environment.Development);
    expect(validated.PORT).toBe(4000);
    expect(validated.CORS_ORIGINS).toBe('http://localhost:3000,http://localhost:8081,http://172.20.10.2:4000');
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
