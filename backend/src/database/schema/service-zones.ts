import { boolean, index, integer, numeric, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Admin-managed delivery service areas. A zone is a circle (centre + radius).
 * Customers can only order, outlets can only operate and riders can only go online
 * inside an active zone. When no zone exists at all, enforcement is off.
 */
export const serviceZones = pgTable(
  'service_zones',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 80 }).notNull(),
    centerLatitude: numeric('center_latitude', { precision: 10, scale: 7 }).notNull(),
    centerLongitude: numeric('center_longitude', { precision: 10, scale: 7 }).notNull(),
    radiusMeters: integer('radius_meters').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('service_zones_is_active_idx').on(table.isActive)],
);
