import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'customer',
  'restaurant_staff',
  'rider',
  'admin',
]);

export const orderStatusEnum = pgEnum('order_status', [
  'pending_payment',
  'placed',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'rejected',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'captured',
  'failed',
  'refunded',
  'partially_refunded',
]);

export const refundStatusEnum = pgEnum('refund_status', [
  'pending',
  'processed',
  'failed',
]);

export const deliveryStatusEnum = pgEnum('delivery_status', [
  'unassigned',
  'assigned',
  'accepted',
  'at_restaurant',
  'picked_up',
  'arrived_customer',
  'completed',
  'cancelled',
  'failed',
]);

export const assignmentAttemptStatusEnum = pgEnum('assignment_attempt_status', [
  'offered',
  'accepted',
  'rejected',
  'expired',
]);


export const promoTypeEnum = pgEnum('promo_type', [
  'percentage',
  'fixed_amount',
]);

export const riderVehicleTypeEnum = pgEnum('rider_vehicle_type', [
  'bicycle',
  'motorcycle',
  'scooter',
  'ev',
  'other',
]);

export const riderVerificationStatusEnum = pgEnum('rider_verification_status', [
  'pending',
  'approved',
  'rejected',
]);

export const riderAvailabilityStatusEnum = pgEnum('rider_availability_status', [
  'offline',
  'available',
  'busy',
]);

export const restaurantVerificationStatusEnum = pgEnum('restaurant_verification_status', [
  'pending',
  'approved',
  'rejected',
  'suspended',
]);

export const ledgerEntityTypeEnum = pgEnum('ledger_entity_type', [
  'rider',
  'restaurant',
  'platform',
  'customer',
]);

export const ledgerEntryTypeEnum = pgEnum('ledger_entry_type', [
  'order_payment',
  'rider_delivery_earning',
  'rider_incentive',
  'rider_payout',
  'rider_payout_reversal',
  'restaurant_order_credit',
  'restaurant_commission_debit',
  'restaurant_settlement',
  'restaurant_settlement_reversal',
  'customer_refund_debit',
  'manual_adjustment',
]);

export const ledgerDirectionEnum = pgEnum('ledger_direction', [
  'credit',
  'debit',
]);

export const payoutStatusEnum = pgEnum('payout_status', [
  'requested',
  'approved',
  'rejected',
  'processing',
  'processed',
  'failed',
]);

export const settlementStatusEnum = pgEnum('settlement_status', [
  'pending',
  'approved',
  'processing',
  'settled',
  'failed',
]);

export const financialSettingsStatusEnum = pgEnum('financial_settings_status', [
  'draft',
  'scheduled',
  'active',
  'superseded',
  'archived',
]);

export const riderEarningStrategyEnum = pgEnum('rider_earning_strategy', [
  'fixed_per_delivery',
  'distance_rate',
  'base_plus_distance',
  'distance_slabs',
]);

export const commissionBasisEnum = pgEnum('commission_basis', [
  'item_total',
  'item_total_minus_discounts',
  'total_payable',
]);



