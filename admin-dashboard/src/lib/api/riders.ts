import { apiClient } from './client';
import type {
  RiderQueryFilters,
  RiderListResponse,
  RiderDetail,
  VerifyRiderPayload,
  SuspendRiderPayload,
} from '@/types/riders';

export const ridersApi = {
  /**
   * List riders with optional filtering by verificationStatus, availabilityStatus, search & pagination
   * GET /api/v1/admin/riders
   */
  listRiders: async (params?: RiderQueryFilters): Promise<RiderListResponse> => {
    const res = await apiClient.get<RiderListResponse>('/admin/riders', {
      params,
    });
    return res.data;
  },

  /**
   * Get single rider profile details
   * GET /api/v1/admin/riders/:id
   */
  getRiderDetails: async (riderId: string): Promise<RiderDetail> => {
    const res = await apiClient.get<RiderDetail>(`/admin/riders/${riderId}`);
    return res.data;
  },

  /**
   * Approve or reject rider onboarding verification
   * PATCH /api/v1/admin/riders/:id/verification
   */
  verifyRider: async (
    riderId: string,
    payload: VerifyRiderPayload,
  ): Promise<RiderDetail> => {
    const res = await apiClient.patch(`/admin/riders/${riderId}/verification`, payload);
    return res.data;
  },

  /**
   * Suspend a rider with mandatory reason, automatically forcing them offline
   * PATCH /api/v1/admin/riders/:id/suspension
   */
  suspendRider: async (
    riderId: string,
    payload: SuspendRiderPayload,
  ): Promise<RiderDetail> => {
    const res = await apiClient.patch(`/admin/riders/${riderId}/suspension`, payload);
    return res.data;
  },

  /**
   * Reinstates a suspended rider
   * PATCH /api/v1/admin/riders/:id/unsuspend
   */
  unsuspendRider: async (riderId: string): Promise<RiderDetail> => {
    const res = await apiClient.patch(`/admin/riders/${riderId}/unsuspend`);
    return res.data;
  },
};

