export type DashboardPeriod =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'custom';

export interface OverviewMetricsResponse {
  customers: {
    totalCustomers: number;
    newCustomers: number;
    activeCustomers: number;
  };
  restaurants: {
    totalRestaurants: number;
    activeRestaurants: number;
    inactiveRestaurants: number;
    totalOutlets: number;
    activeOutlets: number;
    acceptingOrdersOutlets: number;
  };
  riders: {
    totalRiders: number;
    pendingVerification: number;
    approvedRiders: number;
    rejectedRiders: number;
    suspendedRiders: number;
    availableRiders: number;
    busyRiders: number;
    offlineRiders: number;
  };
  orders: {
    totalOrders: number;
    todayOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    rejectedOrders: number;
    processingOrders: number;
    awaitingRiderAssignment: number;
  };
  deliveries: {
    totalDeliveries: number;
    activeDeliveries: number;
    unassignedDeliveries: number;
    pendingOffers: number;
    acceptedDeliveries: number;
    pickedUpDeliveries: number;
    completedDeliveries: number;
    expiredOffers: number;
  };
  financials: {
    currency: string;
    totalCapturedAmount: number;
    todayCapturedAmount: number;
    totalRefundedAmount: number;
    todayRefundedAmount: number;
    netCollectedAmount: number;
    pendingRefundAmount: number;
  };
  meta: {
    period: DashboardPeriod;
    startDate: string;
    endDate: string;
    timezone: string;
  };
}

export interface RevenueAnalyticsResponse {
  period: DashboardPeriod;
  currency: string;
  summary: {
    grossCapturedAmount: number;
    processedRefundAmount: number;
    netCollectedAmount: number;
    pendingRefundAmount: number;
    fleet24CommissionNote?: string;
  };
  paymentStatusBreakdown: {
    captured: number;
    failed: number;
    pending: number;
  };
  refundStatusBreakdown: {
    processed: number;
    pending: number;
    failed: number;
  };
  dailyPaymentSeries: Array<{
    date: string;
    capturedAmount: number;
    transactionCount: number;
  }>;
  dailyRefundSeries: Array<{
    date: string;
    refundedAmount: number;
    refundCount: number;
  }>;
  meta: {
    startDate: string;
    endDate: string;
    timezone: string;
  };
}

export interface ActivityEvent {
  id: string;
  source: 'order' | 'refund' | 'rider';
  eventType: string;
  description: string;
  timestamp: string;
  metadata: Record<string, any>;
}

export interface RecentActivityResponse {
  page: number;
  limit: number;
  totalEvents: number;
  events: ActivityEvent[];
}

export interface SystemHealthResponse {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  uptime: number;
  timestamp: string;
}

export interface SystemReadinessResponse {
  status: 'ready' | 'degraded';
  database: {
    connected: boolean;
    latencyMs?: number;
    error?: string;
  };
  timestamp: string;
}

