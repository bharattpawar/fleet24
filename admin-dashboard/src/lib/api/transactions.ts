import { apiClient } from './client';
import type { PaymentStatus } from '@/types/orders';

export type RefundStatus = 'pending' | 'processed' | 'failed';
export interface Payment {
  id: string;
  orderId: string;
  orderNumber: string;
  customer: string | null;
  customerPhone: string;
  restaurant: string;
  outletId: string;
  outlet: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  paidAt: string | null;
  createdAt: string;
}
export interface Refund {
  id: string;
  paymentId: string;
  amount: string;
  currency: string;
  status: RefundStatus;
  reason: string;
  createdAt: string;
  providerRefundId: string | null;
  isManualReviewRequired: boolean;
}
export interface RefundRow extends Refund {
  orderId: string;
  orderNumber: string;
}
export interface PaymentDetail extends Payment {
  provider: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  refunds: Refund[];
}
export interface RefundDetail extends RefundRow {
  attemptCount: string;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  processingLeaseExpiresAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  updatedAt: string;
}
interface Page<T> { data: T[]; page: number; limit: number; total: number; totalPages: number }
interface Filters { search?: string; from?: string; to?: string; page: number; limit?: number }
export interface PaymentFilters extends Filters { status?: PaymentStatus; outletId?: string }
export interface RefundFilters extends Filters { status?: RefundStatus; needsReview?: boolean }

export const transactionsApi = {
  payments: async (params: PaymentFilters) => (await apiClient.get<Page<Payment>>('/admin/finance/payments', { params })).data,
  refunds: async (params: RefundFilters) => (await apiClient.get<Page<RefundRow>>('/admin/finance/refunds', { params })).data,
  payment: async (id: string) => (await apiClient.get<PaymentDetail>(`/admin/finance/payments/${encodeURIComponent(id)}`)).data,
  refund: async (id: string) => (await apiClient.get<RefundDetail>(`/admin/finance/refunds/${encodeURIComponent(id)}`)).data,
  outlets: async () => (await apiClient.get<{ id: string; name: string; restaurant: string }[]>('/admin/finance/payments/outlets')).data,
};
