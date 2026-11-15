import React from 'react';
import { ShoppingBag, Bike, Store, AlertCircle } from 'lucide-react';
import type { OverviewMetricsResponse } from '@/types/dashboard';

interface OperationalSnapshotProps {
  data?: OverviewMetricsResponse;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export const OperationalSnapshot: React.FC<OperationalSnapshotProps> = ({
  data,
  isLoading,
  isError,
  onRetry,
}) => {
  if (isError) {
    return (
      <div className="p-6 rounded-xl bg-[#FFFFFF] border border-[#E3E7EC] space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold  text-[#171A21]">
            Operational Snapshot
          </h2>
          <button
            onClick={onRetry}
            className="text-xs font-semibold text-[#205641] hover:underline cursor-pointer"
          >
            Retry
          </button>
        </div>
        <div className="p-4 rounded-lg bg-[#9A431F]/10 border border-[#9A431F]/20 flex items-center gap-2 text-xs text-[#9A431F]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Failed to retrieve operational state from backend.</span>
        </div>
      </div>
    );
  }

  const orders = data?.orders;
  const riders = data?.riders;
  const restaurants = data?.restaurants;
  const deliveries = data?.deliveries;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold  text-[#171A21]">
          Operational Snapshot
        </h2>
        <span className="text-[11px] tabular-nums text-slate-600">
          Real-time Platform State
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Orders Pipeline */}
        <div className="p-5 rounded-xl bg-[#FFFFFF] border border-[#E3E7EC] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#205641]" />
              <span className="text-xs font-bold  text-[#171A21]">
                Orders Pipeline
              </span>
            </div>
            <span className="text-xs tabular-nums font-bold text-[#205641]">
              {isLoading ? '...' : orders?.totalOrders || 0}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-[#E3E7EC]">
              <span className="text-slate-600">Processing / In Kitchen</span>
              <span className="tabular-nums text-[#171A21] font-semibold">
                {isLoading ? '...' : orders?.processingOrders || 0}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#E3E7EC]">
              <span className="text-slate-600">Awaiting Rider Assign</span>
              <span className="tabular-nums text-[#9A431F] font-semibold">
                {isLoading ? '...' : orders?.awaitingRiderAssignment || 0}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#E3E7EC]">
              <span className="text-slate-600">Successfully Delivered</span>
              <span className="tabular-nums text-[#205641] font-semibold">
                {isLoading ? '...' : orders?.completedOrders || 0}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#E3E7EC]">
              <span className="text-slate-600">Cancelled by Customer</span>
              <span className="tabular-nums text-slate-600 font-semibold">
                {isLoading ? '...' : orders?.cancelledOrders || 0}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-600">Rejected by Kitchen</span>
              <span className="tabular-nums text-[#9A431F] font-semibold">
                {isLoading ? '...' : orders?.rejectedOrders || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Delivery Fleet Availability */}
        <div className="p-5 rounded-xl bg-[#FFFFFF] border border-[#E3E7EC] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bike className="w-4 h-4 text-[#205641]" />
              <span className="text-xs font-bold  text-[#171A21]">
                Fleet Status
              </span>
            </div>
            <span className="text-xs tabular-nums font-bold text-[#205641]">
              {isLoading ? '...' : riders?.totalRiders || 0} registered
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-[#E3E7EC]">
              <span className="text-slate-600">Available for Dispatch</span>
              <span className="tabular-nums text-[#205641] font-semibold">
                {isLoading ? '...' : riders?.availableRiders || 0}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#E3E7EC]">
              <span className="text-slate-600">Busy on Active Delivery</span>
              <span className="tabular-nums text-[#171A21] font-semibold">
                {isLoading ? '...' : riders?.busyRiders || 0}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#E3E7EC]">
              <span className="text-slate-600">Offline Fleet</span>
              <span className="tabular-nums text-slate-600 font-semibold">
                {isLoading ? '...' : riders?.offlineRiders || 0}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#E3E7EC]">
              <span className="text-slate-600">Pending KYC Verification</span>
              <span className="tabular-nums text-[#9A431F] font-semibold">
                {isLoading ? '...' : riders?.pendingVerification || 0}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-600">Suspended Riders</span>
              <span className="tabular-nums text-[#9A431F] font-semibold">
                {isLoading ? '...' : riders?.suspendedRiders || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Restaurant Directory */}
        <div className="p-5 rounded-xl bg-[#FFFFFF] border border-[#E3E7EC] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-[#205641]" />
              <span className="text-xs font-bold  text-[#171A21]">
                Restaurant Outlets
              </span>
            </div>
            <span className="text-xs tabular-nums font-bold text-[#205641]">
              {isLoading ? '...' : restaurants?.totalRestaurants || 0} brands
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-[#E3E7EC]">
              <span className="text-slate-600">Active Brands</span>
              <span className="tabular-nums text-[#205641] font-semibold">
                {isLoading ? '...' : restaurants?.activeRestaurants || 0}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#E3E7EC]">
              <span className="text-slate-600">Total Onboarded Outlets</span>
              <span className="tabular-nums text-[#171A21] font-semibold">
                {isLoading ? '...' : restaurants?.totalOutlets || 0}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#E3E7EC]">
              <span className="text-slate-600">Currently Accepting Orders</span>
              <span className="tabular-nums text-[#205641] font-semibold">
                {isLoading ? '...' : restaurants?.acceptingOrdersOutlets || 0}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-[#E3E7EC]">
              <span className="text-slate-600">Inactive Brands</span>
              <span className="tabular-nums text-slate-600 font-semibold">
                {isLoading ? '...' : restaurants?.inactiveRestaurants || 0}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-600">Active Live Deliveries</span>
              <span className="tabular-nums text-[#205641] font-semibold">
                {isLoading ? '...' : deliveries?.activeDeliveries || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
