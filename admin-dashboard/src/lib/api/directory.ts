import { apiClient } from './client';

interface Pagination { page: number; limit: number; total: number; totalPages: number }
interface DatePage { page: number; from?: string; to?: string }
export interface CustomerFilters extends DatePage {
  search?: string;
  status?: 'active' | 'blocked';
  sortBy: 'created_at' | 'order_count';
  sortOrder: 'asc' | 'desc';
}
export interface Customer {
  id: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  accountStatus: 'active' | 'blocked';
  blockedReason: string | null;
  blockedAt: string | null;
  createdAt: string;
}
interface OrderSummary { totalOrders: number; completedOrders: number; totalSpentAmount: number }
export interface LedgerFilters extends DatePage {
  entityType?: string;
  entityId?: string;
  orderId?: string;
  entryType?: string;
}
export interface LedgerEntry {
  id: string;
  createdAt: string;
  entityType: string;
  entityId: string;
  orderId: string | null;
  entryType: string;
  direction: 'credit' | 'debit';
  amount: string;
  currency: string;
  transactionReference: string;
  sourceReference: string | null;
  paymentId: string | null;
  refundId: string | null;
}
export const directoryApi = {
  customers: async (params: CustomerFilters) =>
    (await apiClient.get<Pagination & { data: (Customer & OrderSummary)[] }>('/admin/customers', { params })).data,
  customer: async (id: string) =>
    (await apiClient.get<{ customer: Customer; orderSummary: OrderSummary & { cancelledOrders: number } }>(`/admin/customers/${encodeURIComponent(id)}`)).data,
  ledger: async (params: LedgerFilters) =>
    (await apiClient.get<{ items: LedgerEntry[]; pagination: Pagination }>('/admin/finance/ledger', { params })).data,
};
