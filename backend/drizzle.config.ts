import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Load environment variables for CLI migrations
dotenv.config();

export default defineConfig({
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
    ssl: { rejectUnauthorized: false },
  },
  verbose: true,
  strict: true,
});
