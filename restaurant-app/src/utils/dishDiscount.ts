export type DishDiscountType = 'percentage' | 'fixed_amount';

export interface DishDiscountForm {
  enabled: boolean;
  type: DishDiscountType;
  value: string;
}

/** Price after the discount, rounded to paise. */
export function discountedPrice(price: number, type: DishDiscountType, value: number): number {
  const off = type === 'percentage' ? (price * value) / 100 : value;
  return Math.round(Math.max(price - off, 0) * 100) / 100;
}

/**
 * Checks the discount fields of the dish form. Returns an error message, or the
 * payload to send: `{ discountType: null }` removes the discount.
 */
export function readDishDiscount(
  form: DishDiscountForm,
  price: number,
): { error: string } | { payload: { discountType: DishDiscountType | null; discountValue?: number } } {
  if (!form.enabled) return { payload: { discountType: null } };
  const value = Number(form.value.trim());
  if (!form.value.trim() || !Number.isFinite(value) || value <= 0) {
    return { error: form.type === 'percentage' ? 'Enter the discount in %.' : 'Enter the discount in ₹.' };
  }
  if (Math.round(value * 100) !== value * 100) return { error: 'Use at most 2 decimal places.' };
  if (form.type === 'percentage' && value > 90) return { error: 'Discount cannot be more than 90%.' };
  if (form.type === 'fixed_amount' && price > 0 && value >= price) {
    return { error: `Flat discount must be less than the price (₹${price}).` };
  }
  return { payload: { discountType: form.type, discountValue: value } };
}

/** "20% OFF" / "₹30 OFF" from a menu item, or null. */
export function dishDiscountBadge(type?: DishDiscountType | null, value?: string | number | null): string | null {
  const n = Number(value);
  if (!type || !Number.isFinite(n) || n <= 0) return null;
  const shown = Number(n.toFixed(2));
  return type === 'percentage' ? `${shown}% OFF` : `₹${shown} OFF`;
}
