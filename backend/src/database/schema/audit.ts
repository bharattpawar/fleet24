import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    action: varchar('action', { length: 100 }).notNull(), // e.g. 'refund_approved', 'manual_rider_assignment'
    entityType: varchar('entity_type', { length: 50 }).notNull(), // e.g. 'order', 'refund', 'outlet'
    entityId: varchar('entity_id', { length: 100 }).notNull(),
    performedByUserId: uuid('performed_by_user_id')
      .references(() => users.id, { onDelete: 'set null' }),
    details: jsonb('details'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('audit_logs_entity_idx').on(table.entityType, table.entityId),
    index('audit_logs_created_at_idx').on(table.createdAt),
  ],
);

// Drizzle relations
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  performedByUser: one(users, {
    fields: [auditLogs.performedByUserId],
    references: [users.id],
  }),
}));
