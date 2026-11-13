import React from 'react';
import { IndianRupee, ShoppingBag, Bike, Store, AlertCircle } from 'lucide-react';
import type { OverviewMetricsResponse } from '@/types/dashboard';

interface KpiCardsProps {
  data?: OverviewMetricsResponse;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export const KpiCards: React.FC<KpiCardsProps> = ({
  data,
  isLoading,
  isError,
  onRetry,
}) => {
  if (isError) {
    return (
      <div className="p-4 rounded-xl bg-[#E98755]/10 border border-[#E98755]/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[#E98755]" />
          <span className="text-xs text-[#F7F6F0]">Failed to load primary platform KPIs.</span>
        </div>
        <button
          onClick={onRetry}
          className="text-xs font-semibold text-[#D9F078] hover:underline cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  // Format currency in Indian standard format (₹ xx,xx,xxx.xx)
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Gross Volume */}
      <div className="p-5 rounded-xl bg-[#17211B] border border-[#24533F]/30 hover:border-[#24533F]/60 transition-colors flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#F7F6F0]/50">
            Gross Volume
          </span>
          <div className="w-8 h-8 rounded-lg bg-[#24533F]/40 flex items-center justify-center text-[#D9F078]">
            <IndianRupee className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="h-7 w-28 bg-white/5 animate-pulse rounded" />
          ) : (
            <div className="text-2xl font-bold tracking-tight text-[#F7F6F0]">
              {formatCurrency(data?.financials.totalCapturedAmount || 0)}
            </div>
          )}
          <p className="text-[11px] text-[#F7F6F0]/40 mt-1">
            Total captured transactions in period
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-[#24533F]/20 flex items-center justify-between text-[11px]">
          <span className="text-[#F7F6F0]/60">Net Retained:</span>
          <span className="font-mono text-[#D9F078] font-semibold">
            {isLoading ? '...' : formatCurrency(data?.financials.netCollectedAmount || 0)}
          </span>
        </div>
      </div>

      {/* 2. Total Orders */}
      <div className="p-5 rounded-xl bg-[#17211B] border border-[#24533F]/30 hover:border-[#24533F]/60 transition-colors flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#F7F6F0]/50">
            Total Orders
          </span>
          <div className="w-8 h-8 rounded-lg bg-[#24533F]/40 flex items-center justify-center text-[#D9F078]">
            <ShoppingBag className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="h-7 w-20 bg-white/5 animate-pulse rounded" />
          ) : (
            <div className="text-2xl font-bold tracking-tight text-[#F7F6F0]">
              {(data?.orders.totalOrders || 0).toLocaleString('en-IN')}
            </div>
          )}
          <p className="text-[11px] text-[#F7F6F0]/40 mt-1">
            Orders created in period
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-[#24533F]/20 flex items-center justify-between text-[11px]">
          <span className="text-[#F7F6F0]/60">Delivered:</span>
          <span className="font-mono text-[#D9F078] font-semibold">
            {isLoading ? '...' : (data?.orders.completedOrders || 0).toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* 3. Active Fleet */}
      <div className="p-5 rounded-xl bg-[#17211B] border border-[#24533F]/30 hover:border-[#24533F]/60 transition-colors flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#F7F6F0]/50">
            Active Fleet
          </span>
          <div className="w-8 h-8 rounded-lg bg-[#24533F]/40 flex items-center justify-center text-[#D9F078]">
            <Bike className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="h-7 w-20 bg-white/5 animate-pulse rounded" />
          ) : (
            <div className="text-2xl font-bold tracking-tight text-[#F7F6F0]">
              {(data?.riders.availableRiders || 0) + (data?.riders.busyRiders || 0)}
            </div>
          )}
          <p className="text-[11px] text-[#F7F6F0]/40 mt-1">
            Riders online right now
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-[#24533F]/20 flex items-center justify-between text-[11px]">
          <span className="text-[#F7F6F0]/60">Available / Busy:</span>
          <span className="font-mono text-[#D9F078] font-semibold">
            {isLoading
              ? '...'
              : `${data?.riders.availableRiders || 0} / ${data?.riders.busyRiders || 0}`}
          </span>
        </div>
      </div>

      {/* 4. Live Restaurants */}
      <div className="p-5 rounded-xl bg-[#17211B] border border-[#24533F]/30 hover:border-[#24533F]/60 transition-colors flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#F7F6F0]/50">
            Live Restaurants
          </span>
          <div className="w-8 h-8 rounded-lg bg-[#24533F]/40 flex items-center justify-center text-[#D9F078]">
            <Store className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="h-7 w-20 bg-white/5 animate-pulse rounded" />
          ) : (
            <div className="text-2xl font-bold tracking-tight text-[#F7F6F0]">
              {data?.restaurants.activeRestaurants || 0}
            </div>
          )}
          <p className="text-[11px] text-[#F7F6F0]/40 mt-1">
            Active verified parent brands
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-[#24533F]/20 flex items-center justify-between text-[11px]">
          <span className="text-[#F7F6F0]/60">Open Outlets:</span>
          <span className="font-mono text-[#D9F078] font-semibold">
            {isLoading ? '...' : `${data?.restaurants.acceptingOrdersOutlets || 0} / ${data?.restaurants.totalOutlets || 0}`}
          </span>
        </div>
      </div>
    </div>
  );
};
