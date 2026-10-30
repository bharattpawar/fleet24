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
import { promoTypeEnum } from './enums';
import { users } from './users';
import { orders } from './orders';

export const promotions = pgTable(
  'promotions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 30 }).notNull(),
    description: text('description'),
    discountType: promoTypeEnum('discount_type').notNull(),
    discountValue: numeric('discount_value', { precision: 10, scale: 2 }).notNull(),
    minOrderAmount: numeric('min_order_amount', { precision: 10, scale: 2 }).default('0.00').notNull(),
    maxDiscountAmount: numeric('max_discount_amount', { precision: 10, scale: 2 }),
    usageLimitPerUser: integer('usage_limit_per_user').default(1).notNull(),
    totalUsageLimit: integer('total_usage_limit'),
    timesUsed: integer('times_used').default(0).notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
    validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('promotions_code_idx').on(table.code),
    index('promotions_is_active_idx').on(table.isActive),
  ],
);

export const promotionRedemptions = pgTable(
  'promotion_redemptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    promotionId: uuid('promotion_id')
      .notNull()
      .references(() => promotions.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    discountAmount: numeric('discount_amount', { precision: 10, scale: 2 }).notNull(),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('promotion_redemptions_order_promo_idx').on(table.orderId, table.promotionId),
    index('promotion_redemptions_user_id_idx').on(table.userId),
  ],
);

// Drizzle relations
export const promotionsRelations = relations(promotions, ({ many }) => ({
  redemptions: many(promotionRedemptions),
}));

export const promotionRedemptionsRelations = relations(promotionRedemptions, ({ one }) => ({
  promotion: one(promotions, {
    fields: [promotionRedemptions.promotionId],
    references: [promotions.id],
  }),
  user: one(users, {
    fields: [promotionRedemptions.userId],
    references: [users.id],
  }),
  order: one(orders, {
    fields: [promotionRedemptions.orderId],
    references: [orders.id],
  }),
}));
