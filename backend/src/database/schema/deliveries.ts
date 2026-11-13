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
import {
  deliveryStatusEnum,
  assignmentAttemptStatusEnum,
  riderVehicleTypeEnum,
  riderVerificationStatusEnum,
  riderAvailabilityStatusEnum,
} from './enums';
import { users } from './users';
import { orders } from './orders';

export const riders = pgTable(
  'riders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fullName: varchar('full_name', { length: 100 }),
    profileImageUrl: text('profile_image_url'),
    dateOfBirth: timestamp('date_of_birth', { withTimezone: true }),
    vehicleType: riderVehicleTypeEnum('vehicle_type').default('motorcycle').notNull(),
    vehicleNumber: varchar('vehicle_number', { length: 30 }),
    licenseNumber: varchar('license_number', { length: 50 }),
    verificationStatus: riderVerificationStatusEnum('verification_status').default('pending').notNull(),
    availabilityStatus: riderAvailabilityStatusEnum('availability_status').default('offline').notNull(),
    suspensionReason: text('suspension_reason'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    // Compatibility fields
    isOnline: boolean('is_online').default(false).notNull(),
    currentActiveOrdersCount: integer('current_active_orders_count').default(0).notNull(),
    maxActiveOrders: integer('max_active_orders').default(2).notNull(),
    isVerified: boolean('is_verified').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('riders_user_id_idx').on(table.userId),
    index('riders_is_online_idx').on(table.isOnline),
    index('riders_verification_status_idx').on(table.verificationStatus),
    index('riders_availability_status_idx').on(table.availabilityStatus),
  ],
);

export const riderLocations = pgTable(
  'rider_locations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    riderId: uuid('rider_id')
      .notNull()
      .references(() => riders.id, { onDelete: 'cascade' }),
    latitude: numeric('latitude', { precision: 10, scale: 7 }).notNull(),
    longitude: numeric('longitude', { precision: 10, scale: 7 }).notNull(),
    accuracy: numeric('accuracy', { precision: 6, scale: 2 }),
    heading: numeric('heading', { precision: 5, scale: 2 }),
    speed: numeric('speed', { precision: 5, scale: 2 }),
    capturedAt: timestamp('captured_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('rider_locations_rider_id_idx').on(table.riderId),
    index('rider_locations_updated_at_idx').on(table.updatedAt),
  ],
);

// Backward-compatible alias for existing imports if any
export const riderLatestLocations = riderLocations;

export const deliveries = pgTable(
  'deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    riderId: uuid('rider_id')
      .references(() => riders.id, { onDelete: 'set null' }),
    status: deliveryStatusEnum('status').default('unassigned').notNull(),
    distanceMeters: numeric('distance_meters', { precision: 10, scale: 2 }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
    offerExpiresAt: timestamp('offer_expires_at', { withTimezone: true }),
    lastDispatchAttemptAt: timestamp('last_dispatch_attempt_at', { withTimezone: true }),
    dispatchFailureReason: text('dispatch_failure_reason'),
    deliveryOtpHash: varchar('delivery_otp_hash', { length: 128 }), // Server-secret HMAC-SHA256 hash of delivery OTP
    encryptedDeliveryOtp: text('encrypted_delivery_otp'), // Authenticated AES-256-GCM encrypted OTP payload for customer retrieval (iv:authTag:ciphertext)
    otpExpiresAt: timestamp('otp_expires_at', { withTimezone: true }),
    otpAttemptsCount: integer('otp_attempts_count').default(0).notNull(),
    otpVerifiedAt: timestamp('otp_verified_at', { withTimezone: true }),
    arrivedCustomerAt: timestamp('arrived_customer_at', { withTimezone: true }),
    pickedUpAt: timestamp('picked_up_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('deliveries_order_id_idx').on(table.orderId),
    index('deliveries_rider_id_idx').on(table.riderId),
    index('deliveries_status_idx').on(table.status),
    index('deliveries_offer_expires_at_idx').on(table.offerExpiresAt),
  ],
);

export const deliveryAssignmentAttempts = pgTable(
  'delivery_assignment_attempts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    deliveryId: uuid('delivery_id')
      .notNull()
      .references(() => deliveries.id, { onDelete: 'cascade' }),
    riderId: uuid('rider_id')
      .notNull()
      .references(() => riders.id, { onDelete: 'cascade' }),
    status: assignmentAttemptStatusEnum('status').default('offered').notNull(),
    distanceMeters: numeric('distance_meters', { precision: 10, scale: 2 }),
    offeredAt: timestamp('offered_at', { withTimezone: true }).defaultNow().notNull(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('delivery_assignment_attempts_order_id_idx').on(table.orderId),
    index('delivery_assignment_attempts_delivery_id_idx').on(table.deliveryId),
    index('delivery_assignment_attempts_rider_id_idx').on(table.riderId),
    index('delivery_assignment_attempts_status_idx').on(table.status),
    uniqueIndex('delivery_assignment_attempts_order_rider_offered_idx').on(
      table.orderId,
      table.riderId,
      table.offeredAt,
    ),
  ],
);

// Drizzle relations
export const ridersRelations = relations(riders, ({ one, many }) => ({
  user: one(users, {
    fields: [riders.userId],
    references: [users.id],
    relationName: 'riderUser',
  }),
  approver: one(users, {
    fields: [riders.approvedBy],
    references: [users.id],
    relationName: 'riderApprover',
  }),
  location: one(riderLocations, {
    fields: [riders.id],
    references: [riderLocations.riderId],
  }),
  latestLocation: one(riderLocations, {
    fields: [riders.id],
    references: [riderLocations.riderId],
  }),
  deliveries: many(deliveries),
  assignmentAttempts: many(deliveryAssignmentAttempts),
}));

export const riderLocationsRelations = relations(riderLocations, ({ one }) => ({
  rider: one(riders, {
    fields: [riderLocations.riderId],
    references: [riders.id],
  }),
}));

export const riderLatestLocationsRelations = riderLocationsRelations;

export const deliveriesRelations = relations(deliveries, ({ one, many }) => ({
  order: one(orders, {
    fields: [deliveries.orderId],
    references: [orders.id],
  }),
  rider: one(riders, {
    fields: [deliveries.riderId],
    references: [riders.id],
  }),
  assignmentAttempts: many(deliveryAssignmentAttempts),
}));

export const deliveryAssignmentAttemptsRelations = relations(
  deliveryAssignmentAttempts,
  ({ one }) => ({
    order: one(orders, {
      fields: [deliveryAssignmentAttempts.orderId],
      references: [orders.id],
    }),
    delivery: one(deliveries, {
      fields: [deliveryAssignmentAttempts.deliveryId],
      references: [deliveries.id],
    }),
    rider: one(riders, {
      fields: [deliveryAssignmentAttempts.riderId],
      references: [riders.id],
    }),
  }),
);

