import { estimateTaxes, taxLabel } from './taxes';

describe('customer tax display', () => {
  it('labels the bill with the rates the admin set', () => {
    expect(taxLabel({ foodGstPercent: 5, deliveryFeeGstPercent: 0 })).toBe('Govt Taxes (GST 5%)');
    expect(taxLabel({ foodGstPercent: 5, deliveryFeeGstPercent: 18 })).toBe('Govt Taxes (GST 5% food, 18% delivery)');
    expect(taxLabel({ foodGstPercent: 18, deliveryFeeGstPercent: 18 })).toBe('Govt Taxes (GST 18%)');
    expect(taxLabel({ foodGstPercent: 0, deliveryFeeGstPercent: 0 })).toBe('Govt Taxes');
    expect(taxLabel(undefined)).toBe('Govt Taxes (GST)');
  });

  it('estimates a guest cart with the last known rates', () => {
    expect(estimateTaxes(300, 30).taxAmount).toBe(15);
    expect(estimateTaxes(200, 30, { foodGstPercent: 12, deliveryFeeGstPercent: 18 }).taxAmount).toBe(29.4);
  });
});
