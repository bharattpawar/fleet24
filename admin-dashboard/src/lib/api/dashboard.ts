import { apiClient } from './client';
import type {
  DashboardPeriod,
  OverviewMetricsResponse,
  RevenueAnalyticsResponse,
  RecentActivityResponse,
  SystemHealthResponse,
  SystemReadinessResponse,
} from '@/types/dashboard';

export const dashboardApi = {
  getOverview: async (period: DashboardPeriod): Promise<OverviewMetricsResponse> => {
    const res = await apiClient.get<OverviewMetricsResponse>('/admin/dashboard/overview', {
      params: { period },
    });
    return res.data;
  },

  getRevenueAnalytics: async (period: DashboardPeriod): Promise<RevenueAnalyticsResponse> => {
    const res = await apiClient.get<RevenueAnalyticsResponse>('/admin/dashboard/revenue', {
      params: { period },
    });
    return res.data;
  },

  getRecentActivity: async (limit: number = 10, type: string = 'all'): Promise<RecentActivityResponse> => {
    const res = await apiClient.get<RecentActivityResponse>('/admin/dashboard/recent-activity', {
      params: { limit, type },
    });
    return res.data;
  },

  getHealth: async (): Promise<SystemHealthResponse> => {
    const res = await apiClient.get<SystemHealthResponse>('/health');
    return res.data;
  },

  getReadiness: async (): Promise<SystemReadinessResponse> => {
    const res = await apiClient.get<any>('/health/ready');
    // Backend wraps response in { success: true, statusCode: 200, data: { status: 'ready', database: ... } }
    return res.data?.data || res.data;
  },
};
