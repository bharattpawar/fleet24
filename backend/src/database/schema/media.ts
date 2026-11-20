import { customType, index, integer, pgTable, primaryKey, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';
import { restaurantOutlets } from './restaurants';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

/**
 * Images uploaded by admins for the customer Home (banners, tiles, shortcuts, cuisine photos, outlet covers).
 * Stored once per content hash and referenced from content as `media:<id>`; the id never changes for the
 * same bytes, so clients may cache /public/media/<id> forever and a replaced image always gets a new id.
 */
export const mediaAssets = pgTable(
  'media_assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sha256: varchar('sha256', { length: 64 }).notNull().unique(),
    mimeType: varchar('mime_type', { length: 20 }).notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    data: bytea('data').notNull(),
    originalName: varchar('original_name', { length: 200 }),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
);

/** Restaurants a customer hearted on Home. */
export const customerFavoriteOutlets = pgTable(
  'customer_favorite_outlets',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    outletId: uuid('outlet_id').notNull().references(() => restaurantOutlets.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.outletId] }), index('customer_favorite_outlets_user_idx').on(table.userId)],
);
