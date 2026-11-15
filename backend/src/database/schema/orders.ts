import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { orderStatusEnum } from './enums';
import { users } from './users';
import { restaurantOutlets } from './restaurants';
import { menuItems } from './menus';

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderNumber: varchar('order_number', { length: 30 }).notNull(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    outletId: uuid('outlet_id')
      .notNull()
      .references(() => restaurantOutlets.id, { onDelete: 'restrict' }),
    status: orderStatusEnum('status').default('pending_payment').notNull(),

    // Financial breakdown (all in numeric(10, 2))
    itemTotal: numeric('item_total', { precision: 10, scale: 2 }).notNull(),
    deliveryFee: numeric('delivery_fee', { precision: 10, scale: 2 }).default('0.00').notNull(),
    taxAmount: numeric('tax_amount', { precision: 10, scale: 2 }).default('0.00').notNull(),
    discountAmount: numeric('discount_amount', { precision: 10, scale: 2 }).default('0.00').notNull(),
    totalPayable: numeric('total_payable', { precision: 10, scale: 2 }).notNull(),

    // Immutable address snapshot
    deliveryAddressSnapshot: jsonb('delivery_address_snapshot').notNull(),
    deliveryLatitude: numeric('delivery_latitude', { precision: 10, scale: 7 }).notNull(),
    deliveryLongitude: numeric('delivery_longitude', { precision: 10, scale: 7 }).notNull(),

    customerInstructions: text('customer_instructions'),
    cancellationReason: text('cancellation_reason'),
    idempotencyKey: varchar('idempotency_key', { length: 100 }),
    paymentConflictDetails: jsonb('payment_conflict_details'),

    placedAt: timestamp('placed_at', { withTimezone: true }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('orders_order_number_idx').on(table.orderNumber),
    uniqueIndex('orders_idempotency_key_idx').on(table.idempotencyKey),
    uniqueIndex('orders_single_active_per_customer_idx')
      .on(table.customerId)
      .where(
        sql`status IN ('placed', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery')`,
      ),
    index('orders_customer_id_idx').on(table.customerId),
    index('orders_outlet_id_idx').on(table.outletId),
    index('orders_status_idx').on(table.status),
    index('orders_created_at_idx').on(table.createdAt),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    menuItemId: uuid('menu_item_id')
      .references(() => menuItems.id, { onDelete: 'set null' }),
    itemName: varchar('item_name', { length: 100 }).notNull(), // Frozen at order time
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(), // Frozen at order time
    quantity: integer('quantity').notNull(),
    totalPrice: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('order_items_order_id_idx').on(table.orderId),
  ],
);

export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    previousStatus: orderStatusEnum('previous_status'),
    newStatus: orderStatusEnum('new_status').notNull(),
    changedByUserId: uuid('changed_by_user_id')
      .references(() => users.id, { onDelete: 'set null' }),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('order_status_history_order_id_idx').on(table.orderId),
  ],
);

// Drizzle relations
export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(users, {
    fields: [orders.customerId],
    references: [users.id],
  }),
  outlet: one(restaurantOutlets, {
    fields: [orders.outletId],
    references: [restaurantOutlets.id],
  }),
  items: many(orderItems),
  statusHistory: many(orderStatusHistory),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  menuItem: one(menuItems, {
    fields: [orderItems.menuItemId],
    references: [menuItems.id],
  }),
}));

export const orderStatusHistoryRelations = relations(orderStatusHistory, ({ one }) => ({
  order: one(orders, {
    fields: [orderStatusHistory.orderId],
    references: [orders.id],
  }),
  changedByUser: one(users, {
    fields: [orderStatusHistory.changedByUserId],
    references: [users.id],
  }),
}));
