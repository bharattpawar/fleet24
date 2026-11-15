import { integer, jsonb, pgTable } from 'drizzle-orm/pg-core';

export const customerHome = pgTable('customer_home', {
  id: integer('id').primaryKey(),
  draft: jsonb('draft').notNull().default([]),
  published: jsonb('published').notNull().default([]),
});
