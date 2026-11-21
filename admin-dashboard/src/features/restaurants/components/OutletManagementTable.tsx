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
      <div className="p-8 text-center bg-[#F5F6F8] rounded-xl border border-[#E3E7EC]">
        <MapPin className="w-6 h-6 text-slate-600 mx-auto mb-2" />
        <p className="text-xs text-slate-600">No physical outlets configured for this restaurant brand.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isRestaurantSuspended && (
        <div className="p-3 rounded-lg bg-[#9A431F]/15 border border-[#9A431F]/30 flex items-start gap-2.5 text-xs text-[#9A431F]">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Parent Restaurant Brand is Suspended:</span> All outlets are restricted from taking customer orders by platform policy.
          </div>
        </div>
      )}

      {actionError && (
        <div className="p-3 rounded-lg bg-[#9A431F]/15 border border-[#9A431F]/30 flex items-center gap-2 text-xs text-[#9A431F]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[#E3E7EC] bg-[#FFFFFF]">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F5F6F8] border-b border-[#E3E7EC] text-[10px] tabular-nums  text-slate-600">
            <tr>
              <th className="px-4 py-3">Outlet Name & Address</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Radius (KM)</th>
              <th className="px-4 py-3">Catalog Status</th>
              <th className="px-4 py-3">Accepting Orders</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E3E7EC]">
            {outlets.map((outlet) => {
              return (
                <tr key={outlet.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 space-y-0.5">
                    <div className="font-bold text-[#171A21] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#24533F]" />
                      <span>{outlet.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 max-w-xs truncate">
                      {outlet.address}
                    </div>
                  </td>

                  <td className="px-4 py-3 tabular-nums text-[11px] text-slate-600">
                    <div className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-600" />
                      <span>{outlet.phone}</span>
                    </div>
                  </td>

                  <td className="px-4 py-3 tabular-nums text-[11px] text-slate-600">
                    {outlet.deliveryRadiusKm} km
                  </td>

                  <td className="px-4 py-3">
                    {outlet.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-[#24533F] text-white">
                        <CheckCircle2 className="w-3 h-3" /> ACTIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-slate-100 text-slate-600 border border-[#E3E7EC]">
                        INACTIVE
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {outlet.isAcceptingOrders ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-[#E8F2ED] text-[#24533F] border border-[#24533F]">
                        <Radio className="w-2.5 h-2.5 animate-pulse text-[#24533F]" /> ACCEPTING
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-[#9A431F]/15 text-[#9A431F] border border-[#9A431F]/30">
                        PAUSED
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setDeliverySettingsOutlet(outlet)}
                        className="px-2.5 py-1 rounded bg-[#F5F6F8] hover:bg-black/60 text-[11px] font-semibold text-slate-600 border border-[#E3E7EC] transition-colors cursor-pointer inline-flex items-center gap-1"
                        title="Configure Delivery Radius & Location"
                      >
                        <Settings className="w-3 h-3 text-[#24533F]" />
                        <span>Delivery</span>
                      </button>
                      <button
                        onClick={() => handleOpenOverride(outlet)}
                        className="px-2.5 py-1 rounded bg-[#E8F2ED] hover:bg-[#24533F] text-[11px] font-semibold text-[#24533F] border border-[#24533F] transition-colors cursor-pointer"
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
          <div className="bg-[#FFFFFF] border border-[#24533F] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E3E7EC] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#171A21]">
                  Super Admin Operational Override
                </h3>
                <p className="text-[11px] tabular-nums text-[#24533F] mt-0.5">
                  {overrideModalOutlet.name}
                </p>
              </div>
              <button
                onClick={() => setOverrideModalOutlet(null)}
                className="text-slate-600 hover:text-[#171A21] text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Toggle 1: Catalog Active */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#F5F6F8] border border-[#E3E7EC]">
                <div>
                  <div className="font-semibold text-[#171A21]">Outlet Catalog Active (isActive)</div>
                  <div className="text-[10px] text-slate-600">Controls public search visibility</div>
                </div>
                <button
                  type="button"
                  onClick={() => setTargetIsActive(!targetIsActive)}
                  className="cursor-pointer"
                >
                  {targetIsActive ? (
                    <ToggleRight className="w-7 h-7 text-[#24533F]" />
                  ) : (
                    <ToggleLeft className="w-7 h-7 text-slate-600" />
                  )}
                </button>
              </div>

              {/* Toggle 2: Accepting Orders */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#F5F6F8] border border-[#E3E7EC]">
                <div>
                  <div className="font-semibold text-[#171A21]">Accepting Customer Orders</div>
                  <div className="text-[10px] text-slate-600">Controls cart checkout capability</div>
                </div>
                <button
                  type="button"
                  disabled={isRestaurantSuspended && !targetIsAccepting}
                  onClick={() => setTargetIsAccepting(!targetIsAccepting)}
                  className="cursor-pointer disabled:opacity-30"
                >
                  {targetIsAccepting ? (
                    <ToggleRight className="w-7 h-7 text-[#24533F]" />
                  ) : (
                    <ToggleLeft className="w-7 h-7 text-slate-600" />
                  )}
                </button>
              </div>

              {/* Mandatory Reason */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600">
                  Administrative Override Reason
                </label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Reason for changing live outlet operations (e.g. food safety audit, power outage, owner request)..."
                  rows={2}
                  className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#24533F] text-[#171A21] focus:outline-none focus:border-[#24533F]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setOverrideModalOutlet(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-[#171A21] cursor-pointer"
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
                className="px-4 py-1.5 rounded-lg bg-[#24533F] text-white text-xs font-bold hover:bg-[#24533F]/80 disabled:opacity-50 cursor-pointer"
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

