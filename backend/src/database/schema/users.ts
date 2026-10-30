import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  numeric,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { userRoleEnum } from './enums';
import { restaurantOutlets } from './restaurants';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    phone: varchar('phone', { length: 20 }),
    email: varchar('email', { length: 255 }),
    googleId: varchar('google_id', { length: 255 }),
    fullName: varchar('full_name', { length: 100 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    blockedReason: text('blocked_reason'),
    blockedAt: timestamp('blocked_at', { withTimezone: true }),
    blockedBy: uuid('blocked_by').references((): any => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('users_phone_idx').on(table.phone),
    uniqueIndex('users_email_idx').on(table.email),
    uniqueIndex('users_google_id_idx').on(table.googleId),
  ],
);

export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: userRoleEnum('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_roles_user_role_idx').on(table.userId, table.role),
    index('user_roles_user_id_idx').on(table.userId),
  ],
);

export const restaurantStaff = pgTable(
  'restaurant_staff',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => restaurantOutlets.id, { onDelete: 'cascade' }),
    designation: varchar('designation', { length: 50 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('restaurant_staff_user_outlet_idx').on(table.userId, table.outletId),
    index('restaurant_staff_outlet_id_idx').on(table.outletId),
  ],
);

export const customerAddresses = pgTable(
  'customer_addresses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 30 }).default('Home').notNull(),
    addressLine1: text('address_line1').notNull(),
    addressLine2: text('address_line2'),
    landmark: varchar('landmark', { length: 100 }),
    city: varchar('city', { length: 50 }).default('Greater Noida').notNull(),
    postalCode: varchar('postal_code', { length: 10 }).notNull(),
    latitude: numeric('latitude', { precision: 10, scale: 7 }).notNull(),
    longitude: numeric('longitude', { precision: 10, scale: 7 }).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('customer_addresses_user_id_idx').on(table.userId),
  ],
);

// Drizzle relations
export const usersRelations = relations(users, ({ many }) => ({
  roles: many(userRoles),
  addresses: many(customerAddresses),
  staffAssignments: many(restaurantStaff),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
}));

export const customerAddressesRelations = relations(customerAddresses, ({ one }) => ({
  user: one(users, {
    fields: [customerAddresses.userId],
    references: [users.id],
  }),
}));

export const restaurantStaffRelations = relations(restaurantStaff, ({ one }) => ({
  user: one(users, {
    fields: [restaurantStaff.userId],
    references: [users.id],
  }),
  outlet: one(restaurantOutlets, {
    fields: [restaurantStaff.outletId],
    references: [restaurantOutlets.id],
  }),
}));
