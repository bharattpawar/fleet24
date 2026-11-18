import type { Promotion } from '@/lib/api/promotions';

const rupees = (value: string | number) => `₹${Number(Number(value).toFixed(2))}`;

/** e.g. "20% off up to ₹100 · min order ₹199" */
export function describeOffer(p: Pick<Promotion, 'discountType' | 'discountValue' | 'maxDiscountAmount' | 'minOrderAmount'>) {
  const offer = p.discountType === 'percentage'
    ? `${Number(p.discountValue)}% off${p.maxDiscountAmount ? ` up to ${rupees(p.maxDiscountAmount)}` : ''}`
    : `${rupees(p.discountValue)} off`;
  return Number(p.minOrderAmount) > 0 ? `${offer} · min order ${rupees(p.minOrderAmount)}` : offer;
}

export function promotionStatus(p: Pick<Promotion, 'isActive' | 'validFrom' | 'validUntil' | 'totalUsageLimit' | 'timesUsed'>, now = new Date()) {
  if (!p.isActive) return 'Paused';
  if (now < new Date(p.validFrom)) return 'Scheduled';
  if (now > new Date(p.validUntil)) return 'Expired';
  if (p.totalUsageLimit != null && p.timesUsed >= p.totalUsageLimit) return 'Used up';
  return 'Live';
}

/** Value for a datetime-local input, in the browser's time zone. */
export function toLocalInput(date: Date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}
