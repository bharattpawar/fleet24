import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  numeric,
  timestamp,
  time,
  smallint,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { restaurantVerificationStatusEnum } from './enums';
import { users } from './users';

export const restaurants = pgTable(
  'restaurants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    description: text('description'),
    logoUrl: text('logo_url'),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
    verificationStatus: restaurantVerificationStatusEnum('verification_status').default('pending').notNull(),
    rejectionReason: text('rejection_reason'),
    suspensionReason: text('suspension_reason'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: uuid('verified_by').references(() => users.id, { onDelete: 'set null' }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('restaurants_slug_idx').on(table.slug),
    index('restaurants_verification_status_idx').on(table.verificationStatus),
    index('restaurants_owner_id_idx').on(table.ownerId),
  ],
);

export const restaurantDocuments = pgTable(
  'restaurant_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    documentType: varchar('document_type', { length: 50 }).notNull(), // e.g. 'fssai_license', 'gst_certificate', 'pan_card'
    documentNumber: varchar('document_number', { length: 100 }),
    documentUrl: text('document_url').notNull(),
    storageProvider: varchar('storage_provider', { length: 30 }).default('s3_compatible').notNull(),
    storageKey: varchar('storage_key', { length: 255 }),
    verificationStatus: varchar('verification_status', { length: 30 }).default('pending').notNull(), // 'pending', 'verified', 'rejected'
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('restaurant_documents_restaurant_id_idx').on(table.restaurantId),
  ],
);

export const restaurantOutlets = pgTable(
  'restaurant_outlets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 100 }).notNull(),
    phone: varchar('phone', { length: 20 }).notNull(),
    address: text('address').notNull(),
    latitude: numeric('latitude', { precision: 10, scale: 7 }).notNull(),
    longitude: numeric('longitude', { precision: 10, scale: 7 }).notNull(),
    deliveryRadiusKm: numeric('delivery_radius_km', { precision: 4, scale: 2 })
      .default('3.00')
      .notNull(),
    isAcceptingOrders: boolean('is_accepting_orders').default(true).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('restaurant_outlets_restaurant_id_idx').on(table.restaurantId),
  ],
);

export const outletOperatingHours = pgTable(
  'outlet_operating_hours',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => restaurantOutlets.id, { onDelete: 'cascade' }),
    dayOfWeek: smallint('day_of_week').notNull(), // 0 = Sunday, 6 = Saturday
    openTime: time('open_time').notNull(),
    closeTime: time('close_time').notNull(),
    isClosed: boolean('is_closed').default(false).notNull(),
  },
  (table) => [
    uniqueIndex('outlet_operating_hours_unique_day_idx').on(table.outletId, table.dayOfWeek),
    index('outlet_operating_hours_outlet_id_idx').on(table.outletId),
  ],
);

// Drizzle relations
export const restaurantsRelations = relations(restaurants, ({ one, many }) => ({
  owner: one(users, {
    fields: [restaurants.ownerId],
    references: [users.id],
  }),
  outlets: many(restaurantOutlets),
  documents: many(restaurantDocuments),
}));

export const restaurantDocumentsRelations = relations(restaurantDocuments, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [restaurantDocuments.restaurantId],
    references: [restaurants.id],
  }),
}));

export const restaurantOutletsRelations = relations(restaurantOutlets, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [restaurantOutlets.restaurantId],
    references: [restaurants.id],
  }),
  operatingHours: many(outletOperatingHours),
}));

export const outletOperatingHoursRelations = relations(outletOperatingHours, ({ one }) => ({
  outlet: one(restaurantOutlets, {
    fields: [outletOperatingHours.outletId],
    references: [restaurantOutlets.id],
  }),
}));
