import type { FinancialSettingsPayload } from '../../database/schema/financial-settings';

/** Used when the admin has not set GST rates yet. */
export const DEFAULT_FOOD_GST_PERCENT = 5;
export const DEFAULT_DELIVERY_FEE_GST_PERCENT = 0;

export interface TaxBreakdown {
  foodGstPercent: number;
  deliveryFeeGstPercent: number;
  foodTax: number;
  deliveryFeeTax: number;
  /** foodTax + deliveryFeeTax, what the customer pays as "Taxes". */
  taxAmount: number;
}

const money = (value: number) => Math.round(value * 100) / 100;

function rate(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** GST on the food and on the delivery fee, at the rates the admin set. */
export function computeTaxes(input: {
  itemTotal: number;
  deliveryFee: number;
  /** Coupon discount on the food; GST is charged on the food after it. */
  discountAmount?: number;
  settings?: Pick<FinancialSettingsPayload, 'taxes'> | null;
}): TaxBreakdown {
  const foodGstPercent = rate(input.settings?.taxes?.foodGstPercent, DEFAULT_FOOD_GST_PERCENT);
  const deliveryFeeGstPercent = rate(
    input.settings?.taxes?.deliveryFeeGstPercent,
    DEFAULT_DELIVERY_FEE_GST_PERCENT,
  );
  const taxableFood = Math.max(input.itemTotal - (input.discountAmount ?? 0), 0);
  const foodTax = money((taxableFood * foodGstPercent) / 100);
  const deliveryFeeTax = money((Math.max(input.deliveryFee, 0) * deliveryFeeGstPercent) / 100);
  return {
    foodGstPercent,
    deliveryFeeGstPercent,
    foodTax,
    deliveryFeeTax,
    taxAmount: money(foodTax + deliveryFeeTax),
  };
}
