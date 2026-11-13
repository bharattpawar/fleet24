import { apiClient } from './client';
import type {
  AdminOrderQuery,
  AdminOrderListResponse,
  AdminOrderDetail,
  CancelOrderPayload,
} from '@/types/orders';

export const ordersApi = {
  /**
   * List global orders with pagination, search & status filters
   * GET /api/v1/admin/orders
   */
  listOrders: async (params?: AdminOrderQuery): Promise<AdminOrderListResponse> => {
    const res = await apiClient.get<AdminOrderListResponse>('/admin/orders', {
      params,
    });
    return res.data;
  },

  /**
   * Get complete operational details of an order
   * GET /api/v1/admin/orders/:orderId
   */
  getOrderDetails: async (orderId: string): Promise<AdminOrderDetail> => {
    const res = await apiClient.get<AdminOrderDetail>(`/admin/orders/${orderId}`);
    return res.data;
  },

  /**
   * Cancel order with mandatory reason, capacity cleanup & refund trigger
   * POST /api/v1/admin/orders/:orderId/cancel
   */
  cancelOrder: async (
    orderId: string,
    payload: CancelOrderPayload,
  ): Promise<{ id: string; status: string; message: string; refund?: any }> => {
    const res = await apiClient.post(`/admin/orders/${orderId}/cancel`, payload);
    return res.data;
  },

  /**
   * Admin-initiated dispatch retry for unassigned order
   * POST /api/v1/admin/orders/:orderId/retry-dispatch
   */
  retryDispatch: async (
    orderId: string,
  ): Promise<{ assigned: boolean; riderId?: string | null; message: string }> => {
    const res = await apiClient.post(`/admin/orders/${orderId}/retry-dispatch`);
    return res.data;
  },
};

