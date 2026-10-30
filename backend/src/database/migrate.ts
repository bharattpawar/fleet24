import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('Migration execution failed: DATABASE_URL is not set.');
    process.exit(1);
  }

  // Sanitize connection info for logs
  try {
    const parsed = new URL(connectionString);
    console.log(`Connecting to PostgreSQL at ${parsed.hostname}:${parsed.port || 5432}/${parsed.pathname.replace(/^\//, '')}...`);
  } catch {
    console.log('Connecting to PostgreSQL database...');
  }

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5000,
  });

  const db = drizzle(pool);

  console.log('Running pending Drizzle migrations...');
  const migrationsFolder = path.resolve(__dirname, '../../drizzle');

  try {
    await migrate(db, { migrationsFolder });
    console.log('Migrations completed successfully.');
  } catch (error: any) {
    console.error('Migration error full:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error('Unexpected migration failure:', err);
  process.exit(1);
});
