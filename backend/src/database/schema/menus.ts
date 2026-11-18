import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  numeric,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { restaurants, restaurantOutlets } from './restaurants';
import { promoTypeEnum } from './enums';

export const menuCategories = pgTable(
  'menu_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 60 }).notNull(),
    displayOrder: integer('display_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('menu_categories_restaurant_id_idx').on(table.restaurantId),
  ],
);

export const menuItems = pgTable(
  'menu_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => menuCategories.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    basePrice: numeric('base_price', { precision: 10, scale: 2 }).notNull(),
    isVeg: boolean('is_veg').default(true).notNull(),
    imageUrl: text('image_url'),
    isAvailable: boolean('is_available').default(true).notNull(),
    /** Restaurant's own discount on this dish; null = no discount. */
    discountType: promoTypeEnum('discount_type'),
    discountValue: numeric('discount_value', { precision: 10, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('menu_items_restaurant_id_idx').on(table.restaurantId),
    index('menu_items_category_id_idx').on(table.categoryId),
  ],
);

export const outletMenuItemOverrides = pgTable(
  'outlet_menu_item_overrides',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => restaurantOutlets.id, { onDelete: 'cascade' }),
    menuItemId: uuid('menu_item_id')
      .notNull()
      .references(() => menuItems.id, { onDelete: 'cascade' }),
    isAvailable: boolean('is_available').default(true).notNull(),
    customPrice: numeric('custom_price', { precision: 10, scale: 2 }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('outlet_menu_item_overrides_unique_idx').on(table.outletId, table.menuItemId),
    index('outlet_menu_item_overrides_outlet_id_idx').on(table.outletId),
  ],
);

// Drizzle relations
export const menuCategoriesRelations = relations(menuCategories, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [menuCategories.restaurantId],
    references: [restaurants.id],
  }),
  items: many(menuItems),
}));

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [menuItems.restaurantId],
    references: [restaurants.id],
  }),
  category: one(menuCategories, {
    fields: [menuItems.categoryId],
    references: [menuCategories.id],
  }),
  outletOverrides: many(outletMenuItemOverrides),
}));

export const outletMenuItemOverridesRelations = relations(outletMenuItemOverrides, ({ one }) => ({
  outlet: one(restaurantOutlets, {
    fields: [outletMenuItemOverrides.outletId],
    references: [restaurantOutlets.id],
  }),
  menuItem: one(menuItems, {
    fields: [outletMenuItemOverrides.menuItemId],
    references: [menuItems.id],
  }),
}));
