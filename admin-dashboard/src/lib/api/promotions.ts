import { apiClient } from './client';

export type DiscountType = 'percentage' | 'fixed_amount';

export interface Promotion {
  id: string;
  code: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: string;
  minOrderAmount: string;
  maxDiscountAmount: string | null;
  usageLimitPerUser: number;
  totalUsageLimit: number | null;
  /** Orders that used it, not counting cancelled or rejected ones. */
  timesUsed: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
}

export interface PromotionInput {
  code?: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  usageLimitPerUser: number;
  totalUsageLimit: number | null;
  validFrom: string;
  validUntil: string;
  isActive?: boolean;
}

export const promotionsApi = {
  list: async () => (await apiClient.get<Promotion[]>('/admin/promotions')).data,
  create: async (input: PromotionInput) => (await apiClient.post<Promotion>('/admin/promotions', input)).data,
  update: async (id: string, input: Partial<PromotionInput>) =>
    (await apiClient.patch<Promotion>(`/admin/promotions/${id}`, input)).data,
};
