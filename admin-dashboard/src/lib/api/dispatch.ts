import { apiClient } from './client';
import type {
  ActiveDeliveriesResponse,
  DeliveryDetail,
  DispatchRetryResponse,
} from '@/types/dispatch';

export const dispatchApi = {
  /**
   * Monitor all active in-flight deliveries with GPS locations
   * GET /api/v1/admin/deliveries/active
   */
  getActiveDeliveries: async (params?: {
    status?: 'unassigned';
    deliveryStatus?: string;
    locationFreshness?: string;
    page?: number;
    limit?: number;
  }): Promise<ActiveDeliveriesResponse> => {
    const res = await apiClient.get<ActiveDeliveriesResponse>(
      '/admin/deliveries/active',
      { params },
    );
    return res.data;
  },

  /**
   * Get granular delivery telemetry, coordinates & attempt history
   * GET /api/v1/admin/deliveries/:deliveryId
   */
  getDeliveryDetails: async (deliveryId: string): Promise<DeliveryDetail> => {
    const res = await apiClient.get<DeliveryDetail>(
      `/admin/deliveries/${deliveryId}`,
    );
    return res.data;
  },

  /**
   * Retry automated rider dispatch matching for an order
   * POST /api/v1/admin/orders/:orderId/retry-dispatch
   */
  retryDispatch: async (orderId: string): Promise<DispatchRetryResponse> => {
    const res = await apiClient.post(`/admin/orders/${orderId}/retry-dispatch`);
    return res.data;
  },

  /**
   * Super Admin manual rider assignment override
   * POST /api/v1/admin/riders/orders/:orderId/assign
   */
  assignRider: async (
    orderId: string,
    riderId: string,
  ): Promise<DispatchRetryResponse> => {
    const res = await apiClient.post(
      `/admin/riders/orders/${orderId}/assign`,
      { riderId },
    );
    return res.data;
  },
};

