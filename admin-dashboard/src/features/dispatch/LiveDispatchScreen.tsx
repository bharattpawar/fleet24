import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dispatchApi } from '@/lib/api/dispatch';
import { OrderStatusBadge } from '@/features/orders/components/OrderStatusBadge';
import type { ActiveDeliverySummary } from '@/types/dispatch';
import { 
  Send, 
  MapPin, 
  Bike, 
  Store, 
  RefreshCw, 
  Radio, 
  AlertCircle, 
  CheckCircle2, 
  Navigation
} from 'lucide-react';

export const LiveDispatchScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedDelivery, setSelectedDelivery] = useState<ActiveDeliverySummary | null>(null);
  const [manualAssignOrderId, setManualAssignOrderId] = useState<string | null>(null);
  const [targetRiderId, setTargetRiderId] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'deliveries', 'active'],
    queryFn: () => dispatchApi.getActiveDeliveries(),
    refetchInterval: 10000, // Poll active deliveries every 10s as real-time fallback
  });

  const retryDispatchMutation = useMutation({
    mutationFn: (orderId: string) => dispatchApi.retryDispatch(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'deliveries', 'active'] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.message || err?.message || 'Dispatch retry failed');
    },
  });

  const manualAssignMutation = useMutation({
    mutationFn: ({ orderId, riderId }: { orderId: string; riderId: string }) =>
      dispatchApi.assignRider(orderId, riderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'deliveries', 'active'] });
      setManualAssignOrderId(null);
      setTargetRiderId('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.message || err?.message || 'Manual assignment failed');
    },
  });

  const deliveries = data?.data || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#24533F]/30">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#F7F6F0]">
              Live Dispatch & Delivery Telemetry
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#24533F]/50 text-[#D9F078] text-[10px] font-mono border border-[#24533F]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D9F078] animate-pulse" />
              Live Telemetry Polling Active (10s)
            </span>
          </div>
          <p className="text-xs text-[#F7F6F0]/60 mt-1">
            Super Admin Dispatch Operations · In-Flight Rider Locations, Broadcast Retries, Manual Assignments
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#24533F]/40 border border-[#24533F] text-xs font-medium text-[#D9F078] hover:bg-[#24533F]/60 transition-colors disabled:opacity-50 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Sync Dispatch</span>
        </button>
      </div>

      {actionError && (
        <div className="p-3 rounded-lg bg-[#E98755]/15 border border-[#E98755]/30 flex items-center gap-2 text-xs text-[#E98755]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Split Operations Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Active Deliveries Queue (1 col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#F7F6F0]/60">
              Active Deliveries ({deliveries.length})
            </span>
            <span className="text-[11px] font-mono text-[#D9F078]">
              {deliveries.filter((d) => d.deliveryStatus === 'unassigned').length} Unassigned
            </span>
          </div>

          <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-28 bg-white/5 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : isError ? (
              <div className="p-4 rounded-xl bg-[#E98755]/15 text-xs text-[#E98755]">
                Failed to load active delivery stream.
              </div>
            ) : deliveries.length === 0 ? (
              <div className="p-8 text-center bg-[#17211B] rounded-xl border border-dashed border-[#24533F]/30 space-y-2">
                <CheckCircle2 className="w-6 h-6 text-[#D9F078] mx-auto" />
                <p className="text-xs text-[#F7F6F0]/80 font-semibold">Zero In-Flight Deliveries</p>
                <p className="text-[11px] text-[#F7F6F0]/40">
                  All customer orders have been completed or are awaiting kitchen confirmation.
                </p>
              </div>
            ) : (
              deliveries.map((del) => {
                const isSelected = selectedDelivery?.id === del.id;
                const isUnassigned = del.deliveryStatus === 'unassigned';

                return (
                  <div
                    key={del.id}
                    onClick={() => setSelectedDelivery(del)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2.5 ${
                      isSelected
                        ? 'bg-[#24533F]/30 border-[#D9F078] shadow-lg'
                        : 'bg-[#17211B] border-[#24533F]/30 hover:border-[#24533F]/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-mono font-bold text-xs text-[#F7F6F0]">
                        #{del.orderNumber}
                      </div>
                      <OrderStatusBadge type="delivery" status={del.deliveryStatus} />
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 text-[#F7F6F0]/80">
                        <Store className="w-3.5 h-3.5 text-[#D9F078] shrink-0" />
                        <span className="font-semibold truncate">{del.restaurant?.name || 'Restaurant'}</span>
                        <span className="text-[#F7F6F0]/40 text-[10px]">({del.restaurant?.outletName || 'Outlet'})</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[#F7F6F0]/70">
                        <Bike className="w-3.5 h-3.5 text-[#D9F078] shrink-0" />
                        {del.rider ? (
                          <span className="font-mono text-[11px] text-[#D9F078]">
                            {del.rider.fullName || 'Fleet Rider'} ({del.rider.vehicleType})
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-amber-400 font-bold">
                            No Rider Assigned
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Telemetry info */}
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-[#F7F6F0]/40">
                      <span>
                        {del.location
                          ? `GPS: ${del.location.freshness.toUpperCase()} (${del.location.ageSeconds}s ago)`
                          : 'GPS: Missing / Offline'}
                      </span>
                      {isUnassigned && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            retryDispatchMutation.mutate(del.orderId);
                          }}
                          className="px-2 py-0.5 rounded bg-[#24533F] text-[#D9F078] font-bold hover:bg-[#24533F]/80 cursor-pointer"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Live Telemetry Map & Controls (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#F7F6F0]/60">
              Live Coordinate Map & Dispatch Interventions
            </span>
            {selectedDelivery && (
              <span className="text-xs font-mono text-[#D9F078]">
                Selected Order: #{selectedDelivery.orderNumber}
              </span>
            )}
          </div>

          {/* Coordinate Visualizer Box */}
          <div className="rounded-2xl border border-[#24533F]/30 bg-[#17211B] p-6 min-h-[420px] flex flex-col justify-between relative overflow-hidden">
            {selectedDelivery ? (
              <div className="space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[#F7F6F0] flex items-center gap-2">
                      <Navigation className="w-5 h-5 text-[#D9F078]" />
                      <span>Order #{selectedDelivery.orderNumber} In-Flight Status</span>
                    </h3>
                    <p className="text-xs text-[#F7F6F0]/50 mt-1">
                      {selectedDelivery.restaurant?.name || 'Restaurant'} · Outlet: {selectedDelivery.restaurant?.address || 'Outlet Address'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setManualAssignOrderId(selectedDelivery.orderId)}
                      className="px-3 py-1.5 rounded-lg bg-[#24533F] text-[#D9F078] text-xs font-bold hover:bg-[#24533F]/80 transition-colors cursor-pointer"
                    >
                      Manual Rider Override
                    </button>
                    <button
                      disabled={retryDispatchMutation.isPending}
                      onClick={() => retryDispatchMutation.mutate(selectedDelivery.orderId)}
                      className="px-3 py-1.5 rounded-lg bg-black/40 text-[#D9F078] border border-[#24533F] text-xs font-semibold hover:bg-[#24533F]/30 transition-colors cursor-pointer"
                    >
                      Retry Dispatch
                    </button>
                  </div>
                </div>

                {/* Coordinate Telemetry Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Outlet Node */}
                  <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#F7F6F0]">
                      <Store className="w-4 h-4 text-[#D9F078]" />
                      <span>Kitchen Coordinates</span>
                    </div>
                    {selectedDelivery.restaurantLocation ? (
                      <div className="text-[11px] font-mono text-[#F7F6F0]/70 space-y-0.5">
                        <div>Lat: {selectedDelivery.restaurantLocation.latitude.toFixed(6)}</div>
                        <div>Lng: {selectedDelivery.restaurantLocation.longitude.toFixed(6)}</div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#F7F6F0]/40">No outlet coordinates</div>
                    )}
                  </div>

                  {/* Rider Live Node */}
                  <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#F7F6F0]">
                      <Bike className="w-4 h-4 text-[#D9F078]" />
                      <span>Rider GPS Fix</span>
                    </div>
                    {selectedDelivery.location ? (
                      <div className="text-[11px] font-mono text-[#F7F6F0]/70 space-y-0.5">
                        <div>Lat: {selectedDelivery.location.latitude.toFixed(6)}</div>
                        <div>Lng: {selectedDelivery.location.longitude.toFixed(6)}</div>
                        <div className="text-[#D9F078] text-[10px]">
                          Freshness: {selectedDelivery.location.freshness} ({selectedDelivery.location.ageSeconds}s)
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#E98755]">No active GPS transmitted</div>
                    )}
                  </div>

                  {/* Customer Dropoff Node */}
                  <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#F7F6F0]">
                      <MapPin className="w-4 h-4 text-[#E98755]" />
                      <span>Dropoff Pin</span>
                    </div>
                    {selectedDelivery.customerLocation?.latitude ? (
                      <div className="text-[11px] font-mono text-[#F7F6F0]/70 space-y-0.5">
                        <div>Lat: {selectedDelivery.customerLocation.latitude.toFixed(6)}</div>
                        <div>Lng: {selectedDelivery.customerLocation.longitude?.toFixed(6)}</div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#F7F6F0]/40">Standard Address Delivery</div>
                    )}
                  </div>
                </div>

                {/* Simulated Map Visualizer Canvas */}
                <div className="h-60 rounded-xl bg-black/50 border border-[#24533F]/40 flex flex-col items-center justify-center relative p-4 text-center">
                  <div className="absolute inset-0 bg-[radial-gradient(#24533F_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
                  <Radio className="w-8 h-8 text-[#D9F078] animate-ping mb-3 z-10" />
                  <div className="z-10 space-y-1">
                    <p className="text-xs font-bold text-[#F7F6F0]">
                      Live Telemetry Vector Active
                    </p>
                    <p className="text-[11px] text-[#F7F6F0]/60 max-w-sm">
                      Coordinates captured directly from rider GPS breadcrumbs and outlet geo-fence. Real map tiles require Google Maps / Mapbox API token configuration.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-16">
                <Navigation className="w-10 h-10 text-[#F7F6F0]/20" />
                <p className="text-sm font-semibold text-[#F7F6F0]/70">
                  Select an In-Flight Delivery from the Left Panel
                </p>
                <p className="text-xs text-[#F7F6F0]/40 max-w-sm">
                  Click any active order to inspect live rider GPS coordinates, delivery attempt history, and manual dispatch interventions.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Super Admin Manual Rider Assignment */}
      {manualAssignOrderId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-60">
          <div className="bg-[#17211B] border border-[#24533F] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-[#D9F078]">
              <Send className="w-5 h-5" />
              <h3 className="text-sm font-bold">Manual Rider Assignment Override</h3>
            </div>
            <p className="text-xs text-[#F7F6F0]/70 leading-relaxed">
              Manually assign a specific delivery partner to this order. The target rider must be verified, active, and not currently suspended.
            </p>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#F7F6F0]/60">
                Target Rider UUID
              </label>
              <input
                type="text"
                value={targetRiderId}
                onChange={(e) => setTargetRiderId(e.target.value)}
                placeholder="Enter rider UUID..."
                className="w-full text-xs p-2 rounded-lg bg-black/30 border border-[#24533F] text-[#F7F6F0] focus:outline-none focus:border-[#D9F078] font-mono"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setManualAssignOrderId(null)}
                className="px-3 py-1.5 text-xs text-[#F7F6F0]/60 hover:text-[#F7F6F0] cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={!targetRiderId.trim() || manualAssignMutation.isPending}
                onClick={() =>
                  manualAssignMutation.mutate({
                    orderId: manualAssignOrderId,
                    riderId: targetRiderId.trim(),
                  })
                }
                className="px-4 py-1.5 rounded-lg bg-[#D9F078] text-black text-xs font-bold hover:bg-[#D9F078]/80 disabled:opacity-50 cursor-pointer"
              >
                {manualAssignMutation.isPending ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
