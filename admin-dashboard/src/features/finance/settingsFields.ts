export interface SettingsField {
  key: string;
  label: string;
  min?: number;
  max?: number;
  integer?: boolean;
  optional?: boolean;
  options?: string[];
  checkbox?: boolean;
}

export const sections: { key: string; title: string; fields: SettingsField[] }[] = [
  { key: 'customerDeliveryFee', title: 'Customer delivery fees', fields: [
    { key: 'freeOrderThresholdCount', label: 'Free delivery orders', integer: true },
    { key: 'baseDeliveryFeeAfterFree', label: 'Base delivery fee (₹)' },
    { key: 'additionalPerKmFee', label: 'Extra delivery fee (₹/km)', optional: true },
    { key: 'minDeliveryFee', label: 'Minimum delivery fee (₹)', optional: true },
    { key: 'maxDeliveryFee', label: 'Maximum delivery fee (₹)', optional: true },
    { key: 'cancelledOrdersConsumeFreeQuota', label: 'Cancelled orders use free delivery quota', checkbox: true },
  ] },
  { key: 'restaurantMonthlyCreditBlock', title: 'Restaurant delivery credits', fields: [
    { key: 'monthlyDeliveriesQuota', label: 'Monthly delivery quota', integer: true },
    { key: 'additionalPerDeliveryFee', label: 'Additional delivery fee (₹/delivery)' },
    { key: 'billingPeriodMonths', label: 'Billing period (months)', integer: true, min: 1 },
  ] },
  { key: 'restaurantCommission', title: 'Restaurant commission', fields: [
    { key: 'commissionPercentage', label: 'Commission (%)', max: 100 },
    { key: 'fixedCommissionPerOrder', label: 'Fixed commission (₹/order)', optional: true },
    { key: 'commissionBasis', label: 'Commission basis', options: ['item_total', 'item_total_minus_discounts', 'total_payable'] },
  ] },
  { key: 'riderEarnings', title: 'Rider earnings', fields: [
    { key: 'calculationStrategy', label: 'Earnings strategy', options: ['fixed_per_delivery', 'distance_rate', 'base_plus_distance', 'distance_slabs'] },
    { key: 'baseEarning', label: 'Base earning (₹/delivery)' },
    { key: 'additionalPerKmRate', label: 'Distance rate (₹/km)', optional: true },
    { key: 'minDeliveryEarning', label: 'Minimum earning (₹)', optional: true },
    { key: 'maxDeliveryEarning', label: 'Maximum earning (₹)', optional: true },
    { key: 'peakHourMultiplier', label: 'Peak multiplier (×)', min: 1, optional: true },
    { key: 'waitingTimeRatePerMinute', label: 'Waiting rate (₹/minute)', optional: true },
  ] },
  { key: 'incentives', title: 'Incentives', fields: [
    { key: 'riderPromotionalBonus', label: 'Promotional bonus (₹)', optional: true },
    { key: 'peakBonusFlat', label: 'Flat peak bonus (₹)', optional: true },
  ] },
  { key: 'deliveryServiceability', title: 'Delivery Serviceability & Road Distance', fields: [
    { key: 'maxRoadDistanceMeters', label: 'Maximum delivery road distance (meters)', integer: true, min: 100, max: 50000 },
  ] },
];

export const riderTables = [
  { key: 'distanceSlabs', title: 'Distance slabs', fields: [
    { key: 'upToKm', label: 'Up to (km)', min: 0.000001 },
    { key: 'rate', label: 'Slab earning (₹)' },
  ] },
  { key: 'peakHours', title: 'Peak hour slots', fields: [
    { key: 'startHour', label: 'Start hour', integer: true, max: 23 },
    { key: 'endHour', label: 'End hour', integer: true, max: 23 },
  ] },
];
