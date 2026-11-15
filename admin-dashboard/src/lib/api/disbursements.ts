import { apiClient } from './client';

interface Page<T> {
  items: T[];
  pagination: { page: number; total: number; totalPages: number };
}

interface Filters {
  page: number;
  status?: string;
  from?: string;
  to?: string;
}

interface Disbursement {
  id: string;
  currency: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  providerTransferId: string | null;
  failureReason: string | null;
}

export interface Settlement extends Disbursement {
  restaurantId: string;
  restaurantName: string;
  periodStart: string;
  periodEnd: string;
  grossOrderAmount: string;
  commissionAmount: string;
  taxAmount: string;
  refundDeductions: string;
  netPayableAmount: string;
  settlementReference: string | null;
  settledAt: string | null;
}

export interface Payout extends Disbursement {
  riderId: string;
  riderName: string | null;
  amount: string;
  requestedAt: string;
  rejectedAt: string | null;
  rejectionReason: string | null;
  processedAt: string | null;
}

interface Balance {
  currency: string;
  availableBalance: string;
  totalEarned: string;
  totalWithdrawn: string;
  reservedPending: string;
}

interface Earning {
  id: string;
  orderId: string | null;
  entryType: string;
  amount: string;
  currency: string;
  createdAt: string;
}

const finance = '/admin/finance';

export const disbursementsApi = {
  settlements: async (params: Filters & { restaurantId?: string }) =>
    (await apiClient.get<Page<Settlement>>(`${finance}/restaurants/settlements`, { params })).data,
  payouts: async (params: Filters & { riderId?: string }) =>
    (await apiClient.get<Page<Payout>>(`${finance}/riders/payouts`, { params })).data,
  balance: async (riderId: string) =>
    (await apiClient.get<Balance>(`${finance}/riders/${riderId}/earnings-summary`)).data,
  earnings: async (riderId: string, page: number) =>
    (await apiClient.get<Page<Earning>>(`${finance}/riders/earnings`, { params: { riderId, page } })).data,
};
