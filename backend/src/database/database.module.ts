import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { DATABASE_POOL, DRIZZLE_CONNECTION } from './database.constants';
import { DatabaseService } from './database.service';
import * as schema from './schema';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('DatabasePoolFactory');
        const databaseUrl = configService.get<string>('DATABASE_URL');

        if (!databaseUrl) {
          throw new Error('DATABASE_URL environment variable is not defined.');
        }

        try {
          // Parse connection URL safely to log host and database name without exposing credentials
          const parsed = new URL(databaseUrl);
          const sanitizedHost = parsed.hostname;
          const sanitizedPort = parsed.port || '5432';
          const sanitizedDb = parsed.pathname.replace(/^\//, '');
          logger.log(
            `Initializing PostgreSQL pool for host: ${sanitizedHost}:${sanitizedPort}, database: ${sanitizedDb}`,
          );
        } catch {
          logger.log('Initializing PostgreSQL pool (opaque connection string format)');
        }

        const isRemote =
          databaseUrl.includes('supabase.com') ||
          databaseUrl.includes('sslmode=require') ||
          databaseUrl.includes('pooler');

        const pool = new Pool({
          connectionString: databaseUrl,
          ssl: isRemote ? { rejectUnauthorized: false } : undefined,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
        });

        pool.on('error', (err) => {
          logger.error(`Unexpected error on idle PostgreSQL client: ${err.message}`);
        });

        return pool;
      },
      inject: [ConfigService],
    },
    {
      provide: DRIZZLE_CONNECTION,
      useFactory: (pool: Pool) => {
        return drizzle(pool, { schema });
      },
      inject: [DATABASE_POOL],
    },
    DatabaseService,
  ],
  exports: [DATABASE_POOL, DRIZZLE_CONNECTION, DatabaseService],
})
export class DatabaseModule {}
