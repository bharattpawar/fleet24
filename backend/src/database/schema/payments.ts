import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { paymentStatusEnum, refundStatusEnum } from './enums';
import { orders } from './orders';
import { users } from './users';

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    provider: varchar('provider', { length: 30 }).notNull(), // e.g., 'razorpay', 'cod'
    providerOrderId: varchar('provider_order_id', { length: 100 }),
    providerPaymentId: varchar('provider_payment_id', { length: 100 }),
    idempotencyKey: varchar('idempotency_key', { length: 100 }),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 10 }).default('INR').notNull(),
    status: paymentStatusEnum('status').default('pending').notNull(),
    rawResponseMetadata: jsonb('raw_response_metadata'), // Gateway metadata without raw card/sensitive data
    paidAt: timestamp('paid_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('payments_idempotency_key_idx').on(table.idempotencyKey),
    index('payments_order_id_idx').on(table.orderId),
    index('payments_provider_order_id_idx').on(table.providerOrderId),
    index('payments_provider_payment_id_idx').on(table.providerPaymentId),
    index('payments_status_idx').on(table.status),
  ],
);

export const paymentWebhookEvents = pgTable(
  'payment_webhook_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: varchar('event_id', { length: 100 }).notNull(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    provider: varchar('provider', { length: 30 }).default('razorpay').notNull(),
    payload: jsonb('payload'),
    processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('payment_webhook_events_event_id_idx').on(table.eventId),
    index('payment_webhook_events_type_idx').on(table.eventType),
  ],
);

export const refunds = pgTable(
  'refunds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'restrict' }),
    idempotencyKey: varchar('idempotency_key', { length: 100 }).notNull(),
    operationKey: varchar('operation_key', { length: 100 }), // Unique business key (e.g. 'full_refund_<orderId>')
    providerRefundId: varchar('provider_refund_id', { length: 100 }),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    reason: text('reason').notNull(),
    status: refundStatusEnum('status').default('pending').notNull(),
    requestPayload: jsonb('request_payload'), // Immutable request snapshot sent to gateway
    attemptCount: numeric('attempt_count', { precision: 5, scale: 0 }).default('1').notNull(),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    processingLeaseExpiresAt: timestamp('processing_lease_expires_at', { withTimezone: true }),
    isManualReviewRequired: boolean('is_manual_review_required').default(false).notNull(),
    lastErrorCode: varchar('last_error_code', { length: 100 }),
    lastErrorMessage: text('last_error_message'),
    approvedByUserId: uuid('approved_by_user_id')
      .references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('refunds_idempotency_key_idx').on(table.idempotencyKey),
    uniqueIndex('refunds_operation_key_idx').on(table.operationKey),
    index('refunds_payment_id_idx').on(table.paymentId),
    index('refunds_provider_refund_id_idx').on(table.providerRefundId),
    index('refunds_status_idx').on(table.status),
    index('refunds_reconciliation_idx').on(table.status, table.nextRetryAt),
  ],
);

// Drizzle relations
export const paymentsRelations = relations(payments, ({ one, many }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
  refunds: many(refunds),
}));

export const refundsRelations = relations(refunds, ({ one }) => ({
  payment: one(payments, {
    fields: [refunds.paymentId],
    references: [payments.id],
  }),
  approvedByUser: one(users, {
    fields: [refunds.approvedByUserId],
    references: [users.id],
  }),
}));
