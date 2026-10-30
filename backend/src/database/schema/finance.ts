import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import {
  ledgerEntityTypeEnum,
  ledgerEntryTypeEnum,
  ledgerDirectionEnum,
  payoutStatusEnum,
  settlementStatusEnum,
} from './enums';
import { orders } from './orders';
import { users } from './users';
import { riders } from './deliveries';
import { restaurants } from './restaurants';

/**
 * Immutable Financial Ledger
 * Double-entry / balanced ledger entries for all monetary events across Fleet24.
 */
export const financialLedger = pgTable(
  'financial_ledger',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    transactionReference: varchar('transaction_reference', { length: 100 }).notNull(),
    entityType: ledgerEntityTypeEnum('entity_type').notNull(),
    entityId: varchar('entity_id', { length: 100 }).notNull(), // UUID string of rider, restaurant, customer, or 'platform'
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    entryType: ledgerEntryTypeEnum('entry_type').notNull(),
    direction: ledgerDirectionEnum('direction').notNull(), // 'credit' | 'debit'
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 10 }).default('INR').notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 120 }).notNull(),
    sourceReference: varchar('source_reference', { length: 120 }), // e.g. payoutId, settlementId, razorpayPaymentId
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('financial_ledger_idempotency_key_idx').on(table.idempotencyKey),
    index('financial_ledger_entity_idx').on(table.entityType, table.entityId),
    index('financial_ledger_order_id_idx').on(table.orderId),
    index('financial_ledger_entry_type_idx').on(table.entryType),
    index('financial_ledger_created_at_idx').on(table.createdAt),
  ],
);

/**
 * Rider Payout Requests and Disbursements
 */
export const riderPayouts = pgTable(
  'rider_payouts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    riderId: uuid('rider_id')
      .notNull()
      .references(() => riders.id, { onDelete: 'restrict' }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 10 }).default('INR').notNull(),
    status: payoutStatusEnum('status').default('requested').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectedByUserId: uuid('rejected_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    rejectionReason: text('rejection_reason'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    processedByUserId: uuid('processed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    providerTransferId: varchar('provider_transfer_id', { length: 100 }),
    failureReason: text('failure_reason'),
    idempotencyKey: varchar('idempotency_key', { length: 120 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('rider_payouts_idempotency_key_idx').on(table.idempotencyKey),
    index('rider_payouts_rider_id_idx').on(table.riderId),
    index('rider_payouts_status_idx').on(table.status),
    index('rider_payouts_created_at_idx').on(table.createdAt),
  ],
);

/**
 * Restaurant Periodic / Order Settlements
 */
export const restaurantSettlements = pgTable(
  'restaurant_settlements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'restrict' }),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    grossOrderAmount: numeric('gross_order_amount', { precision: 12, scale: 2 }).notNull(),
    commissionAmount: numeric('commission_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
    taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
    refundDeductions: numeric('refund_deductions', { precision: 12, scale: 2 }).default('0.00').notNull(),
    netPayableAmount: numeric('net_payable_amount', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 10 }).default('INR').notNull(),
    status: settlementStatusEnum('status').default('pending').notNull(),
    settlementReference: varchar('settlement_reference', { length: 100 }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
    idempotencyKey: varchar('idempotency_key', { length: 120 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('restaurant_settlements_idempotency_key_idx').on(table.idempotencyKey),
    index('restaurant_settlements_restaurant_id_idx').on(table.restaurantId),
    index('restaurant_settlements_status_idx').on(table.status),
    index('restaurant_settlements_period_idx').on(table.periodStart, table.periodEnd),
  ],
);

// Drizzle relations
export const financialLedgerRelations = relations(financialLedger, ({ one }) => ({
  order: one(orders, {
    fields: [financialLedger.orderId],
    references: [orders.id],
  }),
}));

export const riderPayoutsRelations = relations(riderPayouts, ({ one }) => ({
  rider: one(riders, {
    fields: [riderPayouts.riderId],
    references: [riders.id],
  }),
  approvedByUser: one(users, {
    fields: [riderPayouts.approvedByUserId],
    references: [users.id],
  }),
}));

export const restaurantSettlementsRelations = relations(restaurantSettlements, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [restaurantSettlements.restaurantId],
    references: [restaurants.id],
  }),
  approvedByUser: one(users, {
    fields: [restaurantSettlements.approvedByUserId],
    references: [users.id],
  }),
}));

