import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '@/lib/api/orders';
import { OrderStatusBadge } from './OrderStatusBadge';
import { 
  X, 
  ShoppingBag, 
  Store, 
  User, 
  MapPin, 
  IndianRupee, 
  Clock, 
  RotateCcw, 
  Send, 
  AlertCircle 
} from 'lucide-react';

interface OrderDetailDrawerProps {
  orderId: string;
  onClose: () => void;
}

export const OrderDetailDrawer: React.FC<OrderDetailDrawerProps> = ({
  orderId,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['admin', 'order', orderId],
    queryFn: () => ordersApi.getOrderDetails(orderId),
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => ordersApi.cancelOrder(orderId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'deliveries', 'active'] });
      setCancelModalOpen(false);
      setCancelReason('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.message || err?.message || 'Failed to cancel order');
    },
  });

  const retryDispatchMutation = useMutation({
    mutationFn: () => ordersApi.retryDispatch(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'deliveries', 'active'] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err?.response?.data?.message || err?.message || 'Dispatch retry failed');
    },
  });

  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const isCancellable = order && order.status !== 'delivered' && order.status !== 'cancelled';
  const isDispatchRetryEligible =
    order &&
    ['confirmed', 'preparing', 'ready_for_pickup'].includes(order.status) &&
    (!order.delivery || order.delivery.status === 'unassigned');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-end z-50">
      <div className="w-full max-w-2xl bg-[#17211B] h-full shadow-2xl border-l border-[#24533F]/40 flex flex-col overflow-hidden">
        {/* Drawer Header */}
        <div className="p-6 border-b border-[#24533F]/30 flex items-center justify-between shrink-0 bg-[#121915]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#24533F] border border-[#D9F078]/20 flex items-center justify-center text-[#D9F078] font-bold">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#F7F6F0]">
                  {isLoading ? 'Loading Order...' : `#${order?.orderNumber}`}
                </h2>
                {order && <OrderStatusBadge type="order" status={order.status} />}
              </div>
              <div className="text-[11px] font-mono text-[#F7F6F0]/40 mt-0.5">
                {order && new Date(order.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#F7F6F0]/50 hover:text-[#F7F6F0] rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Error Banner */}
        {actionError && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-[#E98755]/15 border border-[#E98755]/30 flex items-center gap-2 text-xs text-[#E98755]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Action Controls Bar */}
        {!isLoading && order && (
          <div className="px-6 py-3 bg-black/20 border-b border-[#24533F]/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              {isDispatchRetryEligible && (
                <button
                  disabled={retryDispatchMutation.isPending}
                  onClick={() => retryDispatchMutation.mutate()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#24533F] text-[#D9F078] text-xs font-bold hover:bg-[#24533F]/80 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{retryDispatchMutation.isPending ? 'Retrying...' : 'Retry Dispatch Matching'}</span>
                </button>
              )}

              {isCancellable && (
                <button
                  onClick={() => setCancelModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E98755]/15 text-[#E98755] border border-[#E98755]/40 text-xs font-semibold hover:bg-[#E98755]/25 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Administrative Cancel & Refund</span>
                </button>
              )}
            </div>

            <div className="text-right">
              <span className="text-[10px] text-[#F7F6F0]/40 uppercase">Total Payable</span>
              <div className="font-mono text-sm font-bold text-[#D9F078]">
                {formatCurrency(order.totalPayable)}
              </div>
            </div>
          </div>
        )}

        {/* Drawer Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-white/5 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-6 rounded-xl bg-[#E98755]/15 border border-[#E98755]/30 text-xs text-[#E98755]">
              Failed to load order details from backend.
            </div>
          ) : order ? (
            <>
              {/* Restaurant & Customer Dual Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Outlet */}
                <div className="p-4 rounded-xl bg-black/20 border border-[#24533F]/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-[#D9F078]" />
                    <span className="font-bold text-[#F7F6F0] uppercase tracking-wider text-[11px]">
                      Kitchen Outlet
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-[#F7F6F0]">{order.restaurant.name}</div>
                    <div className="text-[#D9F078] text-[11px] font-medium">{order.restaurant.outletName}</div>
                    <div className="text-[#F7F6F0]/50 text-[11px] mt-1">{order.restaurant.outletAddress}</div>
                  </div>
                </div>

                {/* Customer */}
                <div className="p-4 rounded-xl bg-black/20 border border-[#24533F]/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[#D9F078]" />
                    <span className="font-bold text-[#F7F6F0] uppercase tracking-wider text-[11px]">
                      Customer Destination
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-[#F7F6F0]">{order.customer.fullName || 'Anonymous User'}</div>
                    <div className="font-mono text-[#F7F6F0]/70 text-[11px]">{order.customer.phone}</div>
                    <div className="text-[#F7F6F0]/50 text-[11px] mt-1 flex items-start gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#E98755] shrink-0 mt-0.5" />
                      <span>{order.deliveryAddress?.addressLine || 'Deliver to Pin Location'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div className="rounded-xl border border-[#24533F]/30 bg-black/20 overflow-hidden">
                <div className="p-3 bg-black/30 border-b border-[#24533F]/20 text-[11px] font-bold uppercase tracking-wider text-[#F7F6F0]/60">
                  Ordered Items ({order.items?.length || 0})
                </div>
                <div className="divide-y divide-white/5 p-2">
                  {order.items?.map((item) => (
                    <div key={item.id} className="py-2 px-2 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-[#F7F6F0]">{item.name}</span>
                        <span className="text-[#D9F078] font-mono ml-2">× {item.quantity}</span>
                      </div>
                      <div className="font-mono text-[#F7F6F0]/80">
                        {formatCurrency(item.totalPrice)}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Cost Breakdown */}
                <div className="bg-black/40 p-4 border-t border-[#24533F]/20 space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-[#F7F6F0]/60">
                    <span>Item Subtotal</span>
                    <span className="font-mono text-[#F7F6F0]">{formatCurrency(order.itemSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-[#F7F6F0]/60">
                    <span>Delivery Charge</span>
                    <span className="font-mono text-[#F7F6F0]">{formatCurrency(order.deliveryCharge)}</span>
                  </div>
                  <div className="flex justify-between text-[#F7F6F0]/60">
                    <span>Packaging & Taxes</span>
                    <span className="font-mono text-[#F7F6F0]">
                      {formatCurrency((order.packagingCharge || 0) + (order.taxes || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#F7F6F0] font-bold pt-2 border-t border-white/5 text-xs">
                    <span>Total Charged</span>
                    <span className="font-mono text-[#D9F078]">{formatCurrency(order.totalPayable)}</span>
                  </div>
                </div>
              </div>

              {/* Payment & Refunds Section */}
              <div className="p-4 rounded-xl bg-black/20 border border-[#24533F]/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-[#D9F078]" />
                    <span className="font-bold uppercase tracking-wider text-[11px] text-[#F7F6F0]">
                      Payment & Settlement Ledger
                    </span>
                  </div>
                  {order.payment && <OrderStatusBadge type="payment" status={order.payment.status} />}
                </div>

                {order.payment ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-[#F7F6F0]/70">
                      <span>Gateway Reference:</span>
                      <span className="font-mono text-[#F7F6F0]">{order.payment.gatewayPaymentId || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-[#F7F6F0]/70">
                      <span>Method:</span>
                      <span className="font-mono uppercase text-[#F7F6F0]">{order.payment.method}</span>
                    </div>
                    {order.payment.refunds && order.payment.refunds.length > 0 && (
                      <div className="pt-2 border-t border-white/5 space-y-1">
                        <span className="text-[10px] font-bold uppercase text-[#E98755]">
                          Processed Refunds:
                        </span>
                        {order.payment.refunds.map((ref) => (
                          <div key={ref.id} className="flex justify-between font-mono text-[11px] text-[#E98755]">
                            <span>{ref.reason}</span>
                            <span>{formatCurrency(ref.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-[#F7F6F0]/40 text-xs">No captured payment record attached.</div>
                )}
              </div>

              {/* Order Status History Timeline */}
              {order.timeline && order.timeline.length > 0 && (
                <div className="p-4 rounded-xl bg-black/20 border border-[#24533F]/30 space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#D9F078]" />
                    <span className="font-bold uppercase tracking-wider text-[11px] text-[#F7F6F0]">
                      Lifecycle State Timeline
                    </span>
                  </div>
                  <div className="space-y-2 border-l border-[#24533F]/50 pl-3 ml-1.5">
                    {order.timeline.map((evt, idx) => (
                      <div key={idx} className="relative space-y-0.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold uppercase text-[#D9F078]">{evt.status}</span>
                          <span className="font-mono text-[#F7F6F0]/40">
                            {new Date(evt.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
                          </span>
                        </div>
                        {evt.reason && <p className="text-[11px] text-[#F7F6F0]/60">{evt.reason}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Modal: Administrative Cancellation */}
        {cancelModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-60">
            <div className="bg-[#17211B] border border-[#E98755] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2 text-[#E98755]">
                <RotateCcw className="w-5 h-5" />
                <h3 className="text-sm font-bold">Cancel Order & Release Fleet</h3>
              </div>
              <p className="text-xs text-[#F7F6F0]/70 leading-relaxed">
                Cancelling this order will release the assigned delivery rider's capacity, notify the kitchen, and automatically initiate a customer refund if payment was already captured.
              </p>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#F7F6F0]/60">
                  Mandatory Cancellation Reason
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason (e.g. restaurant unable to prepare, customer address unreachable)..."
                  rows={3}
                  className="w-full text-xs p-2 rounded-lg bg-black/30 border border-[#E98755]/40 text-[#F7F6F0] focus:outline-none focus:border-[#E98755]"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setCancelModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-[#F7F6F0]/60 hover:text-[#F7F6F0] cursor-pointer"
                >
                  Keep Order
                </button>
                <button
                  disabled={!cancelReason.trim() || cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate(cancelReason)}
                  className="px-4 py-1.5 rounded-lg bg-[#E98755] text-black text-xs font-bold hover:bg-[#E98755]/80 disabled:opacity-50 cursor-pointer"
                >
                  {cancelMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

