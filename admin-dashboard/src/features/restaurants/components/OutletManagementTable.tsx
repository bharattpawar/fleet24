import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { restaurantsApi } from '@/lib/api/restaurants';
import type { RestaurantOutlet } from '@/types/restaurants';
import { MapPin, Phone, ShieldAlert, CheckCircle2, AlertCircle, ToggleLeft, ToggleRight, Radio, Settings } from 'lucide-react';
import { OutletDeliverySettingsModal } from './OutletDeliverySettingsModal';

interface OutletManagementTableProps {
  restaurantId: string;
  isRestaurantSuspended: boolean;
  outlets: RestaurantOutlet[];
}

export const OutletManagementTable: React.FC<OutletManagementTableProps> = ({
  restaurantId,
  isRestaurantSuspended,
  outlets,
}) => {
  const queryClient = useQueryClient();
  const [deliverySettingsOutlet, setDeliverySettingsOutlet] = useState<RestaurantOutlet | null>(null);
  const [overrideModalOutlet, setOverrideModalOutlet] = useState<RestaurantOutlet | null>(null);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [targetIsActive, setTargetIsActive] = useState<boolean>(true);
  const [targetIsAccepting, setTargetIsAccepting] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const updateOperationsMutation = useMutation({
    mutationFn: ({
      outletId,
      isActive,
      isAcceptingOrders,
    }: {
      outletId: string;
      isActive: boolean;
      isAcceptingOrders: boolean;
    }) =>
      restaurantsApi.updateOutletOperations(outletId, {
        isActive,
        isAcceptingOrders,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurant', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'restaurants'] });
      setOverrideModalOutlet(null);
      setOverrideReason('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(
        err?.response?.data?.message || err?.message || 'Failed to update outlet operational state',
      );
    },
  });

  const handleOpenOverride = (outlet: RestaurantOutlet) => {
    setOverrideModalOutlet(outlet);
    setTargetIsActive(outlet.isActive);
    setTargetIsAccepting(outlet.isAcceptingOrders);
    setOverrideReason('');
    setActionError(null);
  };

  if (!outlets || outlets.length === 0) {
    return (
      <div className="p-8 text-center bg-black/20 rounded-xl border border-[#24533F]/20">
        <MapPin className="w-6 h-6 text-[#F7F6F0]/30 mx-auto mb-2" />
        <p className="text-xs text-[#F7F6F0]/60">No physical outlets configured for this restaurant brand.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isRestaurantSuspended && (
        <div className="p-3 rounded-lg bg-[#E98755]/15 border border-[#E98755]/30 flex items-start gap-2.5 text-xs text-[#E98755]">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Parent Restaurant Brand is Suspended:</span> All outlets are restricted from taking customer orders by platform policy.
          </div>
        </div>
      )}

      {actionError && (
        <div className="p-3 rounded-lg bg-[#E98755]/15 border border-[#E98755]/30 flex items-center gap-2 text-xs text-[#E98755]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[#24533F]/30 bg-[#17211B]">
        <table className="w-full text-left text-xs">
          <thead className="bg-black/30 border-b border-[#24533F]/30 text-[10px] uppercase font-mono tracking-wider text-[#F7F6F0]/50">
            <tr>
              <th className="px-4 py-3">Outlet Name & Address</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Radius (KM)</th>
              <th className="px-4 py-3">Catalog Status</th>
              <th className="px-4 py-3">Accepting Orders</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {outlets.map((outlet) => {
              return (
                <tr key={outlet.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 space-y-0.5">
                    <div className="font-bold text-[#F7F6F0] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#D9F078]" />
                      <span>{outlet.name}</span>
                    </div>
                    <div className="text-[11px] text-[#F7F6F0]/50 max-w-xs truncate">
                      {outlet.address}
                    </div>
                  </td>

                  <td className="px-4 py-3 font-mono text-[11px] text-[#F7F6F0]/70">
                    <div className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-[#F7F6F0]/40" />
                      <span>{outlet.phone}</span>
                    </div>
                  </td>

                  <td className="px-4 py-3 font-mono text-[11px] text-[#F7F6F0]/80">
                    {outlet.deliveryRadiusKm} km
                  </td>

                  <td className="px-4 py-3">
                    {outlet.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#24533F] text-[#D9F078]">
                        <CheckCircle2 className="w-3 h-3" /> ACTIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-white/5 text-[#F7F6F0]/40 border border-white/5">
                        INACTIVE
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {outlet.isAcceptingOrders ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#24533F]/40 text-[#D9F078] border border-[#24533F]">
                        <Radio className="w-2.5 h-2.5 animate-pulse text-[#D9F078]" /> ACCEPTING
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#E98755]/15 text-[#E98755] border border-[#E98755]/30">
                        PAUSED
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setDeliverySettingsOutlet(outlet)}
                        className="px-2.5 py-1 rounded bg-black/40 hover:bg-black/60 text-[11px] font-semibold text-[#F7F6F0]/80 border border-white/10 transition-colors cursor-pointer inline-flex items-center gap-1"
                        title="Configure Delivery Radius & Location"
                      >
                        <Settings className="w-3 h-3 text-[#D9F078]" />
                        <span>Delivery</span>
                      </button>
                      <button
                        onClick={() => handleOpenOverride(outlet)}
                        className="px-2.5 py-1 rounded bg-[#24533F]/40 hover:bg-[#24533F] text-[11px] font-semibold text-[#D9F078] border border-[#24533F] transition-colors cursor-pointer"
                      >
                        Override
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Outlet Delivery Settings Modal */}
      {deliverySettingsOutlet && (
        <OutletDeliverySettingsModal
          isOpen={Boolean(deliverySettingsOutlet)}
          onClose={() => setDeliverySettingsOutlet(null)}
          outlet={deliverySettingsOutlet}
          restaurantId={restaurantId}
        />
      )}

      {/* Super Admin Operational Override Modal */}
      {overrideModalOutlet && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#17211B] border border-[#24533F] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#24533F]/30 pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#F7F6F0]">
                  Super Admin Operational Override
                </h3>
                <p className="text-[11px] font-mono text-[#D9F078] mt-0.5">
                  {overrideModalOutlet.name}
                </p>
              </div>
              <button
                onClick={() => setOverrideModalOutlet(null)}
                className="text-[#F7F6F0]/50 hover:text-[#F7F6F0] text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Toggle 1: Catalog Active */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5">
                <div>
                  <div className="font-semibold text-[#F7F6F0]">Outlet Catalog Active (isActive)</div>
                  <div className="text-[10px] text-[#F7F6F0]/50">Controls public search visibility</div>
                </div>
                <button
                  type="button"
                  onClick={() => setTargetIsActive(!targetIsActive)}
                  className="cursor-pointer"
                >
                  {targetIsActive ? (
                    <ToggleRight className="w-7 h-7 text-[#D9F078]" />
                  ) : (
                    <ToggleLeft className="w-7 h-7 text-[#F7F6F0]/30" />
                  )}
                </button>
              </div>

              {/* Toggle 2: Accepting Orders */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/5">
                <div>
                  <div className="font-semibold text-[#F7F6F0]">Accepting Customer Orders</div>
                  <div className="text-[10px] text-[#F7F6F0]/50">Controls cart checkout capability</div>
                </div>
                <button
                  type="button"
                  disabled={isRestaurantSuspended && !targetIsAccepting}
                  onClick={() => setTargetIsAccepting(!targetIsAccepting)}
                  className="cursor-pointer disabled:opacity-30"
                >
                  {targetIsAccepting ? (
                    <ToggleRight className="w-7 h-7 text-[#D9F078]" />
                  ) : (
                    <ToggleLeft className="w-7 h-7 text-[#F7F6F0]/30" />
                  )}
                </button>
              </div>

              {/* Mandatory Reason */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#F7F6F0]/70">
                  Administrative Override Reason
                </label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Reason for changing live outlet operations (e.g. food safety audit, power outage, owner request)..."
                  rows={2}
                  className="w-full text-xs p-2 rounded-lg bg-black/30 border border-[#24533F] text-[#F7F6F0] focus:outline-none focus:border-[#D9F078]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setOverrideModalOutlet(null)}
                className="px-3 py-1.5 text-xs text-[#F7F6F0]/60 hover:text-[#F7F6F0] cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={updateOperationsMutation.isPending}
                onClick={() =>
                  updateOperationsMutation.mutate({
                    outletId: overrideModalOutlet.id,
                    isActive: targetIsActive,
                    isAcceptingOrders: targetIsAccepting,
                  })
                }
                className="px-4 py-1.5 rounded-lg bg-[#D9F078] text-black text-xs font-bold hover:bg-[#D9F078]/80 disabled:opacity-50 cursor-pointer"
              >
                {updateOperationsMutation.isPending ? 'Applying...' : 'Apply Live Override'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

