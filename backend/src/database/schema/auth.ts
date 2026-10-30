import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const phoneOtpChallenges = pgTable(
  'phone_otp_challenges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    phone: varchar('phone', { length: 20 }).notNull(),
    otpHash: varchar('otp_hash', { length: 128 }).notNull(), // SHA-256 hash of random 6-digit OTP
    attemptsCount: integer('attempts_count').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(5).notNull(),
    isUsed: boolean('is_used').default(false).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('phone_otp_challenges_phone_idx').on(table.phone),
    index('phone_otp_challenges_created_at_idx').on(table.createdAt),
  ],
);

export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: varchar('refresh_token_hash', { length: 128 }).notNull(), // SHA-256 hash
    isRevoked: boolean('is_revoked').default(false).notNull(),
    userAgent: varchar('user_agent', { length: 255 }),
    ipAddress: varchar('ip_address', { length: 45 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('user_sessions_user_id_idx').on(table.userId),
    index('user_sessions_refresh_token_hash_idx').on(table.refreshTokenHash),
  ],
);

// Drizzle relations
export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));
