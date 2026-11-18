import { apiClient } from './client';

export interface SettingsPayload {
  riderEarnings: {
    calculationStrategy: 'fixed_per_delivery' | 'distance_rate' | 'base_plus_distance' | 'distance_slabs';
    baseEarning: number;
    additionalPerKmRate?: number;
    distanceSlabs?: { upToKm: number; rate: number }[];
    minDeliveryEarning?: number;
    maxDeliveryEarning?: number;
    peakHourMultiplier?: number;
    peakHours?: { startHour: number; endHour: number }[];
    waitingTimeRatePerMinute?: number;
  };
  restaurantCommission: {
    commissionPercentage: number;
    fixedCommissionPerOrder?: number;
    commissionBasis: 'item_total' | 'item_total_minus_discounts' | 'total_payable';
  };
  customerDeliveryFee: {
    freeOrderThresholdCount: number;
    baseDeliveryFeeAfterFree: number;
    additionalPerKmFee?: number;
    minDeliveryFee?: number;
    maxDeliveryFee?: number;
    cancelledOrdersConsumeFreeQuota?: boolean;
  };
  restaurantMonthlyCreditBlock: {
    monthlyDeliveriesQuota: number;
    additionalPerDeliveryFee: number;
    billingPeriodMonths: number;
  };
  incentives: { riderPromotionalBonus?: number; peakBonusFlat?: number };
  deliveryServiceability?: {
    maxRoadDistanceMeters: number;
    minDeliveryMinutes?: number;
    handlingMinutes?: number;
    riderPickupRadiusMeters?: number;
  };
}

export interface SettingsVersion {
  id: string;
  versionNumber: number;
  status: 'active' | 'draft' | 'scheduled' | 'superseded' | 'archived';
  settingsPayload: SettingsPayload;
  changeReason: string;
  effectiveFrom: string | null;
}
interface ActiveSettings {
  versionId: string;
  versionNumber: number;
  effectiveFrom: string | null;
  settings: SettingsPayload;
}
interface DraftRequest { settingsPayload: SettingsPayload; changeReason: string }
interface PreviewRequest {
  proposedSettings: SettingsPayload;
  riderSample: { distanceKm: number; waitingMinutes: number };
  restaurantSample: { itemTotal: number; discountAmount: number };
  customerSample: { distanceKm: number; customerPriorCompletedOrdersCount: number };
}
interface Preview {
  riderCalculation: { finalEarning: number; baseFare: number; distanceEarning: number; incentives: number; waitingTimeEarning: number };
  restaurantCalculation: { totalCommission: number; commissionBasisAmount: number; commissionAmount: number; fixedCommission: number };
  customerCalculation: { deliveryFee: number; reason: string; isFreeDelivery: boolean };
  notice: string;
}
const url = '/admin/finance/settings';
export const financialSettingsApi = {
  active: async () => (await apiClient.get<ActiveSettings>(url)).data,
  history: async (page: number) => (await apiClient.get<{ items: SettingsVersion[]; pagination: { totalPages: number } }>(url + '/history', { params: { page } })).data,
  save: async (id: string | undefined, payload: DraftRequest) => (id
    ? await apiClient.patch<SettingsVersion>(url + '/' + id, payload)
    : await apiClient.post<SettingsVersion>(url, payload)).data,
  preview: async (payload: PreviewRequest) => (await apiClient.post<Preview>(url + '/preview', payload)).data,
  publish: async (id: string, effectiveFrom: string) => (await apiClient.post<SettingsVersion>(url + '/' + id + '/publish', { effectiveFrom })).data,
};
