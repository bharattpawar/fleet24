import { Injectable, Inject, OnModuleDestroy, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_POOL, DRIZZLE_CONNECTION } from './database.constants';
import * as schema from './schema';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    @Inject(DRIZZLE_CONNECTION)
    public readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Performs an actual ping/query check against PostgreSQL without altering data.
   */
  async checkConnection(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
      await this.pool.query('SELECT 1');
      const latencyMs = Date.now() - start;
      return { ok: true, latencyMs };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
      this.logger.error(`Database connection check failed: ${errorMessage}`);
      return { ok: false, error: errorMessage };
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing PostgreSQL connection pool...');
    await this.pool.end();
    this.logger.log('PostgreSQL connection pool closed.');
  }
}
