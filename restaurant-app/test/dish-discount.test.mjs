import { describe, it } from 'node:test';
import assert from 'node:assert';
import { discountedPrice, readDishDiscount, dishDiscountBadge } from '../src/utils/dishDiscount.ts';

describe('dish discount form', () => {
  it('computes the price the customer will pay', () => {
    assert.strictEqual(discountedPrice(200, 'percentage', 20), 160);
    assert.strictEqual(discountedPrice(200, 'fixed_amount', 30), 170);
  });

  it('turns the form into the API payload', () => {
    assert.deepStrictEqual(readDishDiscount({ enabled: true, type: 'percentage', value: '15' }, 200), {
      payload: { discountType: 'percentage', discountValue: 15 },
    });
    assert.deepStrictEqual(readDishDiscount({ enabled: false, type: 'percentage', value: '15' }, 200), {
      payload: { discountType: null },
    });
  });

  it('rejects values the server would reject', () => {
    assert.deepStrictEqual(readDishDiscount({ enabled: true, type: 'percentage', value: '95' }, 200), {
      error: 'Discount cannot be more than 90%.',
    });
    assert.deepStrictEqual(readDishDiscount({ enabled: true, type: 'fixed_amount', value: '200' }, 200), {
      error: 'Flat discount must be less than the price (₹200).',
    });
    assert.ok('error' in readDishDiscount({ enabled: true, type: 'fixed_amount', value: '' }, 200));
  });

  it('labels the discount', () => {
    assert.strictEqual(dishDiscountBadge('percentage', '20.00'), '20% OFF');
    assert.strictEqual(dishDiscountBadge('fixed_amount', 30), '₹30 OFF');
    assert.strictEqual(dishDiscountBadge(null, null), null);
  });
});
