import { computeTaxes } from './taxes';

describe('computeTaxes', () => {
  it('uses 5% on food and 0% on delivery when the admin has not set rates', () => {
    expect(computeTaxes({ itemTotal: 300, deliveryFee: 30 })).toEqual({
      foodGstPercent: 5,
      deliveryFeeGstPercent: 0,
      foodTax: 15,
      deliveryFeeTax: 0,
      taxAmount: 15,
    });
  });

  it('uses the rates the admin set, on food and on the delivery fee', () => {
    const result = computeTaxes({
      itemTotal: 250,
      deliveryFee: 30,
      settings: { taxes: { foodGstPercent: 18, deliveryFeeGstPercent: 18 } },
    });
    expect(result.foodTax).toBe(45);
    expect(result.deliveryFeeTax).toBe(5.4);
    expect(result.taxAmount).toBe(50.4);
  });

  it('allows 0% GST and rounds to paise', () => {
    expect(
      computeTaxes({
        itemTotal: 199.99,
        deliveryFee: 0,
        settings: { taxes: { foodGstPercent: 0, deliveryFeeGstPercent: 18 } },
      }).taxAmount,
    ).toBe(0);
    expect(computeTaxes({ itemTotal: 123.45, deliveryFee: 0 }).foodTax).toBe(6.17);
  });
});

describe('computeTaxes with a coupon', () => {
  it('charges food GST on the amount after the coupon', () => {
    expect(computeTaxes({ itemTotal: 300, deliveryFee: 30, discountAmount: 100 }).foodTax).toBe(10);
  });
});
