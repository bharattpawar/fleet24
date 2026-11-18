import { applyDishDiscount, computeCouponDiscount, dishDiscountLabel } from './discounts';

describe('dish discounts', () => {
  it('takes a percentage or flat amount off the dish price', () => {
    expect(applyDishDiscount(200, 'percentage', 20)).toBe(160);
    expect(applyDishDiscount(200, 'fixed_amount', '30.00')).toBe(170);
    expect(applyDishDiscount(199, 'percentage', 15)).toBe(169.15);
  });

  it('never goes below zero and ignores missing discounts', () => {
    expect(applyDishDiscount(50, 'fixed_amount', 80)).toBe(0);
    expect(applyDishDiscount(120, null, null)).toBe(120);
    expect(applyDishDiscount(120, 'percentage', 0)).toBe(120);
  });

  it('labels the discount', () => {
    expect(dishDiscountLabel('percentage', '20.00')).toBe('20% OFF');
    expect(dishDiscountLabel('fixed_amount', 30)).toBe('₹30 OFF');
    expect(dishDiscountLabel(null, null)).toBeNull();
  });
});

describe('coupon discounts', () => {
  it('applies percentage with a cap', () => {
    expect(
      computeCouponDiscount({ discountType: 'percentage', discountValue: 50, maxDiscountAmount: 100 }, 400),
    ).toEqual({ discountAmount: 100, reason: null });
    expect(computeCouponDiscount({ discountType: 'percentage', discountValue: 10 }, 400).discountAmount).toBe(40);
  });

  it('applies a flat amount but never more than the food total', () => {
    expect(computeCouponDiscount({ discountType: 'fixed_amount', discountValue: 75 }, 300).discountAmount).toBe(75);
    expect(computeCouponDiscount({ discountType: 'fixed_amount', discountValue: 75 }, 60).discountAmount).toBe(60);
  });

  it('explains when the order is below the minimum', () => {
    expect(
      computeCouponDiscount({ discountType: 'fixed_amount', discountValue: 50, minOrderAmount: '199.00' }, 150),
    ).toEqual({ discountAmount: 0, reason: 'Add items worth ₹49 more to use this coupon.' });
  });
});
