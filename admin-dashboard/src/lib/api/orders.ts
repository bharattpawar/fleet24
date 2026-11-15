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
    const res = await apiClient.get<{
      order: Pick<AdminOrderDetail, 'id' | 'orderNumber' | 'status' | 'totalPayable' | 'discountAmount' | 'deliveryAddress' | 'cancellationReason' | 'cancelledAt' | 'createdAt'> & {
        itemTotal: number;
        deliveryFee: number;
        taxAmount: number;
        customerInstructions: string | null;
        items: (Omit<AdminOrderDetail['items'][number], 'price'> & { unitPrice: number })[];
      };
    } & Pick<AdminOrderDetail, 'customer' | 'restaurant' | 'payment' | 'delivery' | 'timeline'>>(`/admin/orders/${orderId}`);
    const { order, ...related } = res.data;
    return {
      ...order,
      ...related,
      itemSubtotal: order.itemTotal,
      deliveryCharge: order.deliveryFee,
      packagingCharge: 0,
      taxes: order.taxAmount,
      deliveryInstructions: order.customerInstructions,
      items: order.items.map(({ unitPrice, ...item }) => ({ ...item, price: unitPrice })),
    };
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

  /**
   * List payment conflicts (both active and resolved) with authoritative refund status
   * GET /api/v1/admin/payment-conflicts
   */
  listPaymentConflicts: async (params?: {
    search?: string;
    filterStatus?: string;
    page?: number;
    limit?: number;
  }): Promise<import('@/types/orders').PaymentConflictListResponse> => {
    const res = await apiClient.get<import('@/types/orders').PaymentConflictListResponse>(
      '/admin/payment-conflicts',
      { params },
    );
    return res.data;
  },

  /**
   * Get full details of a payment conflict including audit trail
   * GET /api/v1/admin/payment-conflicts/:orderId
   */
  getPaymentConflictDetails: async (
    orderId: string,
  ): Promise<import('@/types/orders').PaymentConflictDetail> => {
    const res = await apiClient.get<import('@/types/orders').PaymentConflictDetail>(
      `/admin/payment-conflicts/${orderId}`,
    );
    return res.data;
  },

  /**
   * Explicit Admin approval for full refund of a payment conflict order
   * POST /api/v1/admin/payment-conflicts/:orderId/approve-refund
   */
  approveConflictRefund: async (
    orderId: string,
    payload: import('@/types/orders').ApproveConflictRefundPayload,
  ): Promise<import('@/types/orders').ApproveConflictRefundResponse> => {
    const res = await apiClient.post<import('@/types/orders').ApproveConflictRefundResponse>(
      `/admin/payment-conflicts/${orderId}/approve-refund`,
      payload,
    );
    return res.data;
  },
};

