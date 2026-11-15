import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { financialSettingsStatusEnum } from './enums';
import { users } from './users';
import { restaurants } from './restaurants';

/**
 * Configuration payload shape definition
 */
export interface RiderDistanceSlab {
  upToKm: number;
  rate: number;
}

export interface DeliveryServiceabilityConfig {
  maxRoadDistanceMeters: number; // e.g. 3000 (3 km)
}

export interface FinancialSettingsPayload {
  riderEarnings: {
    calculationStrategy: 'fixed_per_delivery' | 'distance_rate' | 'base_plus_distance' | 'distance_slabs';
    baseEarning: number; // e.g. 30.00
    additionalPerKmRate?: number; // e.g. 5.00
    distanceSlabs?: RiderDistanceSlab[];
    minDeliveryEarning?: number;
    maxDeliveryEarning?: number;
    peakHourMultiplier?: number;
    peakHours?: { startHour: number; endHour: number }[];
    waitingTimeRatePerMinute?: number;
  };
  restaurantCommission: {
    commissionPercentage: number; // e.g. 0.0 or 15.0
    fixedCommissionPerOrder?: number;
    commissionBasis: 'item_total' | 'item_total_minus_discounts' | 'total_payable';
  };
  customerDeliveryFee: {
    freeOrderThresholdCount: number; // e.g. 3
    baseDeliveryFeeAfterFree: number; // e.g. 30.00
    additionalPerKmFee?: number;
    minDeliveryFee?: number;
    maxDeliveryFee?: number;
    cancelledOrdersConsumeFreeQuota: boolean; // default false
  };
  restaurantMonthlyCreditBlock: {
    monthlyDeliveriesQuota: number; // e.g. 150
    additionalPerDeliveryFee: number; // e.g. 25.00
    billingPeriodMonths: number; // e.g. 1
  };
  incentives: {
    riderPromotionalBonus?: number;
    peakBonusFlat?: number;
  };
  deliveryServiceability?: DeliveryServiceabilityConfig;
}

/**
 * Immutable Financial Settings Versions
 */
export const financialSettingsVersions = pgTable(
  'financial_settings_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    versionNumber: integer('version_number').notNull(),
    status: financialSettingsStatusEnum('status').default('draft').notNull(),
    settingsPayload: jsonb('settings_payload').$type<FinancialSettingsPayload>().notNull(),
    changeReason: text('change_reason'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }),
    effectiveUntil: timestamp('effective_until', { withTimezone: true }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('financial_settings_versions_version_idx').on(table.versionNumber),
    index('financial_settings_versions_status_idx').on(table.status),
    index('financial_settings_versions_effective_idx').on(table.effectiveFrom, table.effectiveUntil),
  ],
);

/**
 * Active Pointer Table
 * Maintains single current active version reference
 */
export const financialSettings = pgTable(
  'financial_settings',
  {
    id: varchar('id', { length: 50 }).primaryKey().default('global'),
    activeVersionId: uuid('active_version_id')
      .notNull()
      .references(() => financialSettingsVersions.id, { onDelete: 'restrict' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
);

/**
 * Restaurant Monthly Delivery Credit Balances & Ledger
 */
export const restaurantMonthlyDeliveryCredits = pgTable(
  'restaurant_monthly_delivery_credits',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'restrict' }),
    periodMonthYear: varchar('period_month_year', { length: 7 }).notNull(), // 'YYYY-MM'
    allocatedCredits: integer('allocated_credits').default(150).notNull(),
    usedCredits: integer('used_credits').default(0).notNull(),
    additionalDeliveriesCount: integer('additional_deliveries_count').default(0).notNull(),
    additionalPerDeliveryFee: numeric('additional_per_delivery_fee', { precision: 10, scale: 2 }).default('25.00').notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    isExpired: timestamp('is_expired', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('restaurant_credits_restaurant_period_idx').on(table.restaurantId, table.periodMonthYear),
    index('restaurant_credits_restaurant_id_idx').on(table.restaurantId),
  ],
);

// Drizzle Relations
export const financialSettingsVersionsRelations = relations(financialSettingsVersions, ({ one }) => ({
  createdByUser: one(users, {
    fields: [financialSettingsVersions.createdBy],
    references: [users.id],
  }),
  approvedByUser: one(users, {
    fields: [financialSettingsVersions.approvedBy],
    references: [users.id],
  }),
}));

export const financialSettingsRelations = relations(financialSettings, ({ one }) => ({
  activeVersion: one(financialSettingsVersions, {
    fields: [financialSettings.activeVersionId],
    references: [financialSettingsVersions.id],
  }),
}));

export const restaurantMonthlyDeliveryCreditsRelations = relations(restaurantMonthlyDeliveryCredits, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [restaurantMonthlyDeliveryCredits.restaurantId],
    references: [restaurants.id],
  }),
}));

