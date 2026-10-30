import {
  pgTable,
  uuid,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { restaurantOutlets } from './restaurants';
import { menuItems } from './menus';

export const customerCarts = pgTable(
  'customer_carts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => restaurantOutlets.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('customer_carts_customer_id_idx').on(table.customerId),
    index('customer_carts_outlet_id_idx').on(table.outletId),
  ],
);

export const cartItems = pgTable(
  'cart_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => customerCarts.id, { onDelete: 'cascade' }),
    menuItemId: uuid('menu_item_id')
      .notNull()
      .references(() => menuItems.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('cart_items_cart_menu_item_idx').on(table.cartId, table.menuItemId),
    index('cart_items_cart_id_idx').on(table.cartId),
  ],
);

// Drizzle relations
export const customerCartsRelations = relations(customerCarts, ({ one, many }) => ({
  customer: one(users, {
    fields: [customerCarts.customerId],
    references: [users.id],
  }),
  outlet: one(restaurantOutlets, {
    fields: [customerCarts.outletId],
    references: [restaurantOutlets.id],
  }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(customerCarts, {
    fields: [cartItems.cartId],
    references: [customerCarts.id],
  }),
  menuItem: one(menuItems, {
    fields: [cartItems.menuItemId],
    references: [menuItems.id],
  }),
}));
