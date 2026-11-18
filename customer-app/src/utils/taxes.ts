/** GST rates and split sent by the server with the cart (set by the admin). */
export interface CartTaxes {
  foodGstPercent: number;
  deliveryFeeGstPercent: number;
  foodTax: number;
  deliveryFeeTax: number;
  taxAmount: number;
}

const DEFAULT_FOOD_GST_PERCENT = 5;
const DEFAULT_DELIVERY_FEE_GST_PERCENT = 0;
const money = (value: number) => Math.round(value * 100) / 100;

/** Local estimate for a guest cart, using the last rates the server sent (or the defaults). */
export function estimateTaxes(
  itemTotal: number,
  deliveryFee: number,
  rates?: Pick<CartTaxes, 'foodGstPercent' | 'deliveryFeeGstPercent'>,
): CartTaxes {
  const foodGstPercent = rates?.foodGstPercent ?? DEFAULT_FOOD_GST_PERCENT;
  const deliveryFeeGstPercent = rates?.deliveryFeeGstPercent ?? DEFAULT_DELIVERY_FEE_GST_PERCENT;
  const foodTax = money((itemTotal * foodGstPercent) / 100);
  const deliveryFeeTax = money((deliveryFee * deliveryFeeGstPercent) / 100);
  return { foodGstPercent, deliveryFeeGstPercent, foodTax, deliveryFeeTax, taxAmount: money(foodTax + deliveryFeeTax) };
}

const pct = (value: number) => `${Number(value.toFixed(2))}%`;

/** Bill label, e.g. "Govt Taxes (GST 5%)" or "Govt Taxes (GST 5% food, 18% delivery)". */
export function taxLabel(taxes?: Pick<CartTaxes, 'foodGstPercent' | 'deliveryFeeGstPercent'> | null): string {
  if (!taxes) return 'Govt Taxes (GST)';
  const { foodGstPercent: food, deliveryFeeGstPercent: delivery } = taxes;
  if (food > 0 && delivery > 0) {
    return food === delivery
      ? `Govt Taxes (GST ${pct(food)})`
      : `Govt Taxes (GST ${pct(food)} food, ${pct(delivery)} delivery)`;
  }
  if (food > 0) return `Govt Taxes (GST ${pct(food)})`;
  if (delivery > 0) return `Govt Taxes (GST ${pct(delivery)} on delivery)`;
  return 'Govt Taxes';
}
