export type DiscountType = 'percentage' | 'fixed_amount';

const money = (value: number) => Math.round(value * 100) / 100;

/** Price of a dish after the restaurant's own discount. Never below 0. */
export function applyDishDiscount(
  price: number,
  discountType?: DiscountType | null,
  discountValue?: number | string | null,
): number {
  const value = Number(discountValue);
  if (!discountType || !Number.isFinite(value) || value <= 0) return money(price);
  const off = discountType === 'percentage' ? (price * Math.min(value, 100)) / 100 : value;
  return money(Math.max(price - off, 0));
}

/** Short text for the dish, e.g. "20% OFF" or "₹30 OFF". */
export function dishDiscountLabel(
  discountType?: DiscountType | null,
  discountValue?: number | string | null,
): string | null {
  const value = Number(discountValue);
  if (!discountType || !Number.isFinite(value) || value <= 0) return null;
  const shown = Number(value.toFixed(2));
  return discountType === 'percentage' ? `${shown}% OFF` : `₹${shown} OFF`;
}

export interface CouponRules {
  discountType: DiscountType;
  discountValue: number | string;
  minOrderAmount?: number | string | null;
  maxDiscountAmount?: number | string | null;
}

/**
 * Coupon discount on the item total. Returns 0 with a reason when the order is too small.
 */
export function computeCouponDiscount(
  rules: CouponRules,
  itemTotal: number,
): { discountAmount: number; reason: string | null } {
  const min = Number(rules.minOrderAmount ?? 0) || 0;
  if (itemTotal <= 0) return { discountAmount: 0, reason: 'Add items to use this coupon.' };
  if (itemTotal < min) {
    return {
      discountAmount: 0,
      reason: `Add items worth ₹${Number((min - itemTotal).toFixed(2))} more to use this coupon.`,
    };
  }
  const value = Number(rules.discountValue) || 0;
  let discount = rules.discountType === 'percentage' ? (itemTotal * value) / 100 : value;
  const cap = rules.maxDiscountAmount == null ? null : Number(rules.maxDiscountAmount);
  if (cap != null && Number.isFinite(cap) && cap > 0) discount = Math.min(discount, cap);
  return { discountAmount: money(Math.min(Math.max(discount, 0), itemTotal)), reason: null };
}
