import { ridersApi } from '@/lib/api/riders';
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
  const [view, setView] = useState<'active' | 'unassigned'>('active');
  const [page, setPage] = useState(1);
  const [selectedDelivery, setSelectedDelivery] = useState<ActiveDeliverySummary | null>(null);
  const [manualAssignOrderId, setManualAssignOrderId] = useState<string | null>(null);
  const [targetRiderId, setTargetRiderId] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'deliveries', 'active', view, page],
    queryFn: () => dispatchApi.getActiveDeliveries({ page, status: view === 'unassigned' ? 'unassigned' : undefined }),
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
      setSelectedDelivery(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'dispatch', 'available-riders'] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.message || err?.message || 'Manual assignment failed');
    },
  });

  const availableRiders = useQuery({
    queryKey: ['admin', 'dispatch', 'available-riders'],
    queryFn: () => ridersApi.listRiders({ availabilityStatus: 'available', verificationStatus: 'approved', limit: 25 }),
    refetchInterval: 10000,
  });
  const deliveries = [...(data?.data ?? [])].sort((a, b) =>
    Number(b.deliveryStatus === 'unassigned') - Number(a.deliveryStatus === 'unassigned'),
  );

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[#E3E7EC]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-[#171A21]">
              Live Dispatch & Delivery Telemetry
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E8F2ED] text-[#24533F] text-[10px] tabular-nums border border-[#24533F]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#24533F] animate-pulse" />
              Live Telemetry Polling Active (10s)
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Monitor deliveries and assign riders.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#E8F2ED] border border-[#24533F] text-xs font-medium text-[#24533F] hover:bg-[#E8F2ED] transition-colors disabled:opacity-50 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Sync Dispatch</span>
        </button>
      </div>

      {actionError && (
        <div className="p-3 rounded-lg bg-[#9A431F]/15 border border-[#9A431F]/30 flex items-center gap-2 text-xs text-[#9A431F]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Split Operations Workspace */}
      <section className="admin-panel flex flex-wrap items-center gap-3 p-4">
        <h2 className="text-sm font-bold">Available riders</h2>
        <span className="text-sm text-slate-600">{availableRiders.isLoading ? 'Loading…' : availableRiders.isError ? 'Unavailable' : availableRiders.data?.pagination.total ?? 0}</span>
        {availableRiders.data?.data.slice(0, 4).map((rider) => (
          <span key={rider.id} className="rounded-md bg-[#E8F2ED] px-2 py-1 text-xs text-[#24533F]">{rider.fullName || rider.vehicleType}</span>
        ))}
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Active Deliveries Queue (1 col) */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2" aria-label="Delivery queue">
            {(['active', 'unassigned'] as const).map((option) => (
              <button key={option} type="button" aria-pressed={view === option}
                className={view === option ? 'admin-primary' : 'admin-control'}
                onClick={() => { setView(option); setPage(1); setSelectedDelivery(null); }}>
                {option === 'active' ? 'Active deliveries' : 'Unassigned'}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <button className="admin-control" disabled={page === 1} onClick={() => { setPage(page - 1); setSelectedDelivery(null); }}>Previous</button>
            <span>Page {page}{data?.totalPages ? ` of ${data.totalPages}` : ''}</span>
            <button className="admin-control" disabled={page >= (data?.totalPages ?? 1)} onClick={() => { setPage(page + 1); setSelectedDelivery(null); }}>Next</button>
          </div>

          <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : isError ? (
              <div className="p-4 rounded-xl bg-[#9A431F]/15 text-xs text-[#9A431F]">
                Failed to load active delivery stream.
              </div>
            ) : deliveries.length === 0 ? (
              <div className="p-8 text-center bg-[#FFFFFF] rounded-xl border border-dashed border-[#E3E7EC] space-y-2">
                <CheckCircle2 className="w-6 h-6 text-[#24533F] mx-auto" />
                <p className="text-xs text-slate-600 font-semibold">{view === 'unassigned' ? 'No unassigned deliveries on this page' : 'Zero In-Flight Deliveries'}</p>
                <p className="text-[11px] text-slate-600">
                  {view === 'unassigned' ? 'Orders waiting for a rider appear here.' : 'Active deliveries appear here.'}
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
                        ? 'bg-[#E8F2ED] border-[#24533F] shadow-lg'
                        : 'bg-[#FFFFFF] border-[#E3E7EC] hover:border-[#E3E7EC]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="tabular-nums font-bold text-xs text-[#171A21]">
                        #{del.orderNumber}
                      </div>
                      <OrderStatusBadge type="delivery" status={del.deliveryStatus} />
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Store className="w-3.5 h-3.5 text-[#24533F] shrink-0" />
                        <span className="font-semibold truncate">{del.restaurant?.name || 'Restaurant'}</span>
                        <span className="text-slate-600 text-[10px]">({del.restaurant?.outletName || 'Outlet'})</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Bike className="w-3.5 h-3.5 text-[#24533F] shrink-0" />
                        {del.rider ? (
                          <span className="tabular-nums text-[11px] text-[#24533F]">
                            {del.rider.fullName || 'Fleet Rider'} ({del.rider.vehicleType})
                          </span>
                        ) : (
                          <span className="text-[11px] tabular-nums text-amber-700 font-bold">
                            No Rider Assigned
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Telemetry info */}
                    <div className="pt-2 border-t border-[#E3E7EC] flex items-center justify-between text-[10px] tabular-nums text-slate-600">
                      <span>
                        {del.location
                          ? `GPS: ${del.location.freshness.toUpperCase()} (${del.location.ageSeconds}s ago)`
                          : 'GPS: Missing / Offline'}
                      </span>
                      {isUnassigned && (
                        <div className="flex flex-wrap justify-end gap-2">
                        <button className="admin-primary" onClick={(event) => {
                          event.stopPropagation();
                          setActionError(null);
                          setTargetRiderId('');
                          setManualAssignOrderId(del.orderId);
                        }}>Assign rider</button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            retryDispatchMutation.mutate(del.orderId);
                          }}
                          className="px-2 py-0.5 rounded bg-[#24533F] text-white font-bold hover:bg-[#24533F]/80 cursor-pointer"
                        >
                          Retry
                        </button>
                        </div>
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
            <span className="text-xs font-bold  text-slate-600">
              Live Coordinate Map & Dispatch Interventions
            </span>
            {selectedDelivery && (
              <span className="text-xs tabular-nums text-[#24533F]">
                Selected Order: #{selectedDelivery.orderNumber}
              </span>
            )}
          </div>

          {/* Coordinate Visualizer Box */}
          <div className="rounded-2xl border border-[#E3E7EC] bg-[#FFFFFF] p-6 min-h-[420px] flex flex-col justify-between relative overflow-hidden">
            {selectedDelivery ? (
              <div className="space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[#171A21] flex items-center gap-2">
                      <Navigation className="w-5 h-5 text-[#24533F]" />
                      <span>Order #{selectedDelivery.orderNumber} In-Flight Status</span>
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      {selectedDelivery.restaurant?.name || 'Restaurant'} · Outlet: {selectedDelivery.restaurant?.address || 'Outlet Address'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setManualAssignOrderId(selectedDelivery.orderId)}
                      className="px-3 py-1.5 rounded-lg bg-[#24533F] text-white text-xs font-bold hover:bg-[#24533F]/80 transition-colors cursor-pointer"
                    >
                      Manual Rider Override
                    </button>
                    <button
                      disabled={retryDispatchMutation.isPending}
                      onClick={() => retryDispatchMutation.mutate(selectedDelivery.orderId)}
                      className="px-3 py-1.5 rounded-lg bg-[#F5F6F8] text-[#24533F] border border-[#24533F] text-xs font-semibold hover:bg-[#E8F2ED] transition-colors cursor-pointer"
                    >
                      Retry Dispatch
                    </button>
                  </div>
                </div>

                {/* Coordinate Telemetry Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Outlet Node */}
                  <div className="p-4 rounded-xl bg-[#F5F6F8] border border-[#E3E7EC] space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#171A21]">
                      <Store className="w-4 h-4 text-[#24533F]" />
                      <span>Kitchen Coordinates</span>
                    </div>
                    {selectedDelivery.restaurantLocation ? (
                      <div className="text-[11px] tabular-nums text-slate-600 space-y-0.5">
                        <div>Lat: {selectedDelivery.restaurantLocation.latitude.toFixed(6)}</div>
                        <div>Lng: {selectedDelivery.restaurantLocation.longitude.toFixed(6)}</div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-600">No outlet coordinates</div>
                    )}
                  </div>

                  {/* Rider Live Node */}
                  <div className="p-4 rounded-xl bg-[#F5F6F8] border border-[#E3E7EC] space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#171A21]">
                      <Bike className="w-4 h-4 text-[#24533F]" />
                      <span>Rider GPS Fix</span>
                    </div>
                    {selectedDelivery.location ? (
                      <div className="text-[11px] tabular-nums text-slate-600 space-y-0.5">
                        <div>Lat: {selectedDelivery.location.latitude.toFixed(6)}</div>
                        <div>Lng: {selectedDelivery.location.longitude.toFixed(6)}</div>
                        <div className="text-[#24533F] text-[10px]">
                          Freshness: {selectedDelivery.location.freshness} ({selectedDelivery.location.ageSeconds}s)
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#9A431F]">No active GPS transmitted</div>
                    )}
                  </div>

                  {/* Customer Dropoff Node */}
                  <div className="p-4 rounded-xl bg-[#F5F6F8] border border-[#E3E7EC] space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#171A21]">
                      <MapPin className="w-4 h-4 text-[#9A431F]" />
                      <span>Dropoff Pin</span>
                    </div>
                    {selectedDelivery.customerLocation?.latitude ? (
                      <div className="text-[11px] tabular-nums text-slate-600 space-y-0.5">
                        <div>Lat: {selectedDelivery.customerLocation.latitude.toFixed(6)}</div>
                        <div>Lng: {selectedDelivery.customerLocation.longitude?.toFixed(6)}</div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-600">Standard Address Delivery</div>
                    )}
                  </div>
                </div>

                {/* Simulated Map Visualizer Canvas */}
                <div className="h-60 rounded-xl bg-[#F5F6F8] border border-[#E3E7EC] flex flex-col items-center justify-center relative p-4 text-center">
                  <div className="absolute inset-0 bg-[radial-gradient(#24533F_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
                  <Radio className="w-8 h-8 text-[#24533F] animate-ping mb-3 z-10" />
                  <div className="z-10 space-y-1">
                    <p className="text-xs font-bold text-[#171A21]">
                      Live Telemetry Vector Active
                    </p>
                    <p className="text-[11px] text-slate-600 max-w-sm">
                      Coordinates captured directly from rider GPS breadcrumbs and outlet geo-fence. Real map tiles require Google Maps / Mapbox API token configuration.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-16">
                <Navigation className="w-10 h-10 text-slate-600" />
                <p className="text-sm font-semibold text-slate-600">
                  Select an In-Flight Delivery from the Left Panel
                </p>
                <p className="text-xs text-slate-600 max-w-sm">
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
          <div className="bg-[#FFFFFF] border border-[#24533F] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-[#24533F]">
              <Send className="w-5 h-5" />
              <h3 className="text-sm font-bold">Assign rider</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Manually assign a specific delivery partner to this order. The target rider must be verified, active, and not currently suspended.
            </p>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-600">
                Target Rider UUID
              </label>
              <input
                type="text"
                value={targetRiderId}
                onChange={(e) => setTargetRiderId(e.target.value)}
                placeholder="Enter rider UUID..."
                className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#24533F] text-[#171A21] focus:outline-none focus:border-[#24533F] tabular-nums"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setManualAssignOrderId(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-[#171A21] cursor-pointer"
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
                className="px-4 py-1.5 rounded-lg bg-[#24533F] text-white text-xs font-bold hover:bg-[#24533F]/80 disabled:opacity-50 cursor-pointer"
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
