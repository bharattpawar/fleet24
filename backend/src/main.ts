import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    rawBody: true, // Enables req.rawBody on all routes without breaking body parsers
  });

  const configService = app.get(ConfigService);

  // Global uncaught exception protection against transient network drops (e.g. Supabase connection resets)
  process.on('uncaughtException', (err: any) => {
    if (
      err?.code === 'ECONNRESET' ||
      err?.code === 'ETIMEDOUT' ||
      err?.code === 'ENOTFOUND' ||
      err?.message?.includes('ECONNRESET')
    ) {
      logger.warn(`[TransientNetworkError] Handled socket drop gracefully: ${err.message}`);
      return;
    }
    logger.error('[FatalUncaughtException]', err);
  });

  // Global API routing prefix
  app.setGlobalPrefix('api/v1');

  // Input validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filters and interceptors
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // CORS Configuration
  const corsOriginsRaw = configService.get<string>('CORS_ORIGINS', '');
  const allowedOrigins = corsOriginsRaw
    ? corsOriginsRaw.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps React Native / Expo, curl, Postman)
      if (!origin) {
        return callback(null, true);
      }
      const isProduction = configService.get<string>('NODE_ENV') === 'production';
      const isLocalDevOrigin =
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.startsWith('http://172.20.10.2:');
      if (
        allowedOrigins.includes(origin) ||
        (!isProduction && (allowedOrigins.length === 0 || isLocalDevOrigin))
      ) {
        return callback(null, true);
      }
      callback(new Error(`Origin '${origin}' is not allowed by CORS policy.`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  const port = configService.get<number>('PORT', 4000);
  await app.listen(port);

  logger.log(`Fleet24 backend is listening on http://localhost:${port}/api/v1`);
  logger.log(`Health endpoint: http://localhost:${port}/api/v1/health`);
  logger.log(`Readiness endpoint: http://localhost:${port}/api/v1/health/ready`);
}

bootstrap().catch((err) => {
  console.error('[Fleet24 Backend Startup Failure]', err);
  process.exit(1);
});
