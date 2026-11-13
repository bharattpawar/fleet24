import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAdminAuth } from '@/features/auth/AdminAuthContext';
import { dashboardApi } from '@/lib/api/dashboard';
import type { DashboardPeriod } from '@/types/dashboard';

import { OverviewHeader } from './components/OverviewHeader';
import { KpiCards } from './components/KpiCards';
import { CriticalAlerts } from './components/CriticalAlerts';
import { RevenueAnalyticsSection } from './components/RevenueAnalyticsSection';
import { OperationalSnapshot } from './components/OperationalSnapshot';
import { RecentActivitySection } from './components/RecentActivitySection';
import { SystemHealthSection } from './components/SystemHealthSection';

export const OverviewScreen: React.FC = () => {
  const { user } = useAdminAuth();
  const [period, setPeriod] = useState<DashboardPeriod>('last_7_days');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(() => new Date());

  // 1. Overview KPIs Query
  const {
    data: overviewData,
    isLoading: isOverviewLoading,
    isError: isOverviewError,
    refetch: refetchOverview,
    isFetching: isOverviewFetching,
  } = useQuery({
    queryKey: ['admin', 'dashboard', 'overview', period],
    queryFn: () => dashboardApi.getOverview(period),
    staleTime: 60 * 1000,
  });

  // 2. Revenue Analytics Query
  const {
    data: revenueData,
    isLoading: isRevenueLoading,
    isError: isRevenueError,
    refetch: refetchRevenue,
    isFetching: isRevenueFetching,
  } = useQuery({
    queryKey: ['admin', 'dashboard', 'revenue', period],
    queryFn: () => dashboardApi.getRevenueAnalytics(period),
    staleTime: 60 * 1000,
  });

  // 3. Operational Recent Activity Query
  const {
    data: activityData,
    isLoading: isActivityLoading,
    isError: isActivityError,
    refetch: refetchActivity,
    isFetching: isActivityFetching,
  } = useQuery({
    queryKey: ['admin', 'dashboard', 'recent-activity'],
    queryFn: () => dashboardApi.getRecentActivity(10, 'all'),
    staleTime: 30 * 1000,
  });

  // 4. System Health Liveness Query
  const {
    data: healthData,
    isLoading: isHealthLoading,
    isError: isHealthError,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: ['system', 'health'],
    queryFn: () => dashboardApi.getHealth(),
    staleTime: 15 * 1000,
  });

  // 5. System Database Readiness Query
  const {
    data: readinessData,
    isLoading: isReadinessLoading,
    isError: isReadinessError,
    refetch: refetchReadiness,
  } = useQuery({
    queryKey: ['system', 'readiness'],
    queryFn: () => dashboardApi.getReadiness(),
    staleTime: 15 * 1000,
  });

  const handleGlobalRefresh = async () => {
    await Promise.allSettled([
      refetchOverview(),
      refetchRevenue(),
      refetchActivity(),
      refetchHealth(),
      refetchReadiness(),
    ]);
    setLastRefreshedAt(new Date());
  };

  const isGlobalRefreshing =
    isOverviewFetching || isRevenueFetching || isActivityFetching;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* 1. Header with Period Selector & Real Admin Identity */}
      <OverviewHeader
        adminName={user?.fullName || 'Super Administrator'}
        adminPhone={user?.phone ?? undefined}
        selectedPeriod={period}
        onPeriodChange={(newPeriod) => {
          setPeriod(newPeriod);
          setLastRefreshedAt(new Date());
        }}
        lastUpdated={lastRefreshedAt}
        isRefreshing={isGlobalRefreshing}
        onRefresh={handleGlobalRefresh}
      />

      {/* 2. Critical Attention Alerts */}
      <CriticalAlerts overview={overviewData} />

      {/* 3. Platform KPI Cards */}
      <KpiCards
        data={overviewData}
        isLoading={isOverviewLoading}
        isError={isOverviewError}
        onRetry={refetchOverview}
      />

      {/* 4. Revenue Analytics Section */}
      <RevenueAnalyticsSection
        data={revenueData}
        isLoading={isRevenueLoading}
        isError={isRevenueError}
        onRetry={refetchRevenue}
      />

      {/* 5. Operational Snapshot */}
      <OperationalSnapshot
        data={overviewData}
        isLoading={isOverviewLoading}
        isError={isOverviewError}
        onRetry={refetchOverview}
      />

      {/* 6. Recent Platform Activity Timeline */}
      <RecentActivitySection
        data={activityData}
        isLoading={isActivityLoading}
        isError={isActivityError}
        onRetry={refetchActivity}
      />

      {/* 7. System Diagnostics & Infrastructure Health */}
      <SystemHealthSection
        health={healthData}
        readiness={readinessData}
        isHealthLoading={isHealthLoading}
        isReadinessLoading={isReadinessLoading}
        isHealthError={isHealthError}
        isReadinessError={isReadinessError}
        onRefresh={() => {
          refetchHealth();
          refetchReadiness();
        }}
      />
    </div>
  );
};
