import { Link } from 'react-router-dom';
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
  readOnly?: boolean;
  onClose: () => void;
}

export const OrderDetailDrawer: React.FC<OrderDetailDrawerProps> = ({
  orderId,
  onClose,
  readOnly = false,
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

  const formatIst = (value: string) => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

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
      <div className="w-full max-w-2xl bg-[#FFFFFF] h-full shadow-2xl border-l border-[#E3E7EC] flex flex-col overflow-hidden">
        {/* Drawer Header */}
        <div className="p-6 border-b border-[#E3E7EC] flex items-center justify-between shrink-0 bg-[#F5F6F8]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#24533F] border border-[#24533F]/20 flex items-center justify-center text-[#24533F] font-bold">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#171A21]">
                  {isLoading ? 'Loading Order...' : `#${order?.orderNumber}`}
                </h2>
                {order && <OrderStatusBadge type="order" status={order.status} />}
              </div>
              <div className="text-[11px] tabular-nums text-slate-600 mt-0.5">
                {order && new Date(order.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-600 hover:text-[#171A21] rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Error Banner */}
        {actionError && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-[#9A431F]/15 border border-[#9A431F]/30 flex items-center gap-2 text-xs text-[#9A431F]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {order && <Link className="mx-6 my-2 self-start text-sm text-[#24533F] underline" to={`/finance/ledger?orderId=${orderId}`}>View ledger entries</Link>}
        {/* Action Controls Bar */}
        {!isLoading && order && (
          <div className="px-6 py-3 bg-[#F5F6F8] border-b border-[#E3E7EC] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              {!readOnly && isDispatchRetryEligible && (
                <button
                  disabled={retryDispatchMutation.isPending}
                  onClick={() => retryDispatchMutation.mutate()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#24533F] text-white text-xs font-bold hover:bg-[#24533F]/80 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{retryDispatchMutation.isPending ? 'Retrying...' : 'Retry Dispatch Matching'}</span>
                </button>
              )}

              {!readOnly && isCancellable && (
                <button
                  onClick={() => setCancelModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#9A431F]/15 text-[#9A431F] border border-[#9A431F]/40 text-xs font-semibold hover:bg-[#9A431F]/25 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Administrative Cancel & Refund</span>
                </button>
              )}
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-600">Order total</span>
              <div className="tabular-nums text-sm font-bold text-[#24533F]">
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
                <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-6 rounded-xl bg-[#9A431F]/15 border border-[#9A431F]/30 text-xs text-[#9A431F]">
              Failed to load order details from backend.
            </div>
          ) : order ? (
            <>
              {/* Restaurant & Customer Dual Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Outlet */}
                <div className="p-4 rounded-xl bg-[#F5F6F8] border border-[#E3E7EC] space-y-2">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-[#24533F]" />
                    <span className="font-bold text-[#171A21]  text-[11px]">
                      Kitchen Outlet
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-[#171A21]">{order.restaurant.name}</div>
                    <div className="text-[#24533F] text-[11px] font-medium">{order.restaurant.outletName}</div>
                    <div className="text-slate-600 text-[11px] mt-1">{order.restaurant.address}</div>
                  </div>
                </div>

                {/* Customer */}
                <div className="p-4 rounded-xl bg-[#F5F6F8] border border-[#E3E7EC] space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[#24533F]" />
                    <span className="font-bold text-[#171A21]  text-[11px]">
                      Customer Destination
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-[#171A21]">{order.customer.fullName || 'Anonymous User'}</div>
                    <div className="tabular-nums text-slate-600 text-[11px]">{order.customer.phone}</div>
                    <div className="text-slate-600 text-[11px] mt-1 flex items-start gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#9A431F] shrink-0 mt-0.5" />
                      <span>{order.deliveryAddress?.addressLine || 'Deliver to Pin Location'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div className="rounded-xl border border-[#E3E7EC] bg-[#F5F6F8] overflow-hidden">
                <div className="p-3 bg-[#F5F6F8] border-b border-[#E3E7EC] text-[11px] font-bold  text-slate-600">
                  Ordered Items ({order.items?.length || 0})
                </div>
                <div className="divide-y divide-[#E3E7EC] p-2">
                  {order.items?.map((item) => (
                    <div key={item.id} className="py-2 px-2 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-[#171A21]">{item.name}</span>
                        <span className="text-[#24533F] tabular-nums ml-2">× {item.quantity}</span>
                      </div>
                      <div className="tabular-nums text-slate-600">
                        {formatCurrency(item.totalPrice)}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Cost Breakdown */}
                <div className="bg-[#F5F6F8] p-4 border-t border-[#E3E7EC] space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-slate-600">
                    <span>Item Subtotal</span>
                    <span className="tabular-nums text-[#171A21]">{formatCurrency(order.itemSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Delivery Charge</span>
                    <span className="tabular-nums text-[#171A21]">{formatCurrency(order.deliveryCharge)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Packaging & Taxes</span>
                    <span className="tabular-nums text-[#171A21]">
                      {formatCurrency((order.packagingCharge || 0) + (order.taxes || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#171A21] font-bold pt-2 border-t border-[#E3E7EC] text-xs">
                    <span>Total Charged</span>
                    <span className="tabular-nums text-[#24533F]">{formatCurrency(order.totalPayable)}</span>
                  </div>
                </div>
              </div>

              {/* Payment & Refunds Section */}
              <div className="p-4 rounded-xl bg-[#F5F6F8] border border-[#E3E7EC] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-[#24533F]" />
                    <span className="font-bold  text-[11px] text-[#171A21]">
                      Payment & Settlement Ledger
                    </span>
                  </div>
                  {order.payment && <OrderStatusBadge type="payment" status={order.payment.status} />}
                </div>

                {order.payment ? (
                  <div className="space-y-3 text-xs">
                    <dl className="grid grid-cols-2 gap-2">
                      <dt>{['captured', 'refunded', 'partially_refunded'].includes(order.payment.status) ? 'Captured amount' : 'Payment amount'}</dt>
                      <dd>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: order.payment.currency }).format(order.payment.amount)}</dd>
                      <dt>Payment record</dt><dd><Link className="text-[#24533F] underline" to={`/finance/payments?record=${order.payment.id}`}>Open payment</Link></dd>
                      <dt>Provider</dt><dd>{order.payment.provider}</dd>
                      <dt>Currency</dt><dd>{order.payment.currency}</dd>
                      <dt>Paid at (IST)</dt><dd>{order.payment.paidAt ? formatIst(order.payment.paidAt) : '—'}</dd>
                      <dt>Provider order reference</dt><dd className="break-all">{order.payment.providerOrderId || '—'}</dd>
                      <dt>Provider payment reference</dt><dd className="break-all">{order.payment.providerPaymentId || '—'}</dd>
                    </dl>
                    {order.payment.refunds.length > 0 && (
                      <div className="border-t border-[#E3E7EC] pt-2">
                        <h3 className="font-bold">Refunds</h3>
                        {order.payment.refunds.map((refund) => (
                          <div key={refund.id} className="mt-2 rounded-lg border border-[#E3E7EC] p-2">
                            <p className="font-semibold">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: order.payment!.currency }).format(refund.amount)} · {refund.status}</p>
                            <p>{refund.reason}</p>
                            <Link className="text-[#24533F] underline" to={`/finance/refunds?record=${refund.id}`}>Open refund</Link>
                            <p>Created {formatIst(refund.createdAt)} IST</p>
                            {refund.providerRefundId && <p className="break-all">Provider reference {refund.providerRefundId}</p>}
                            {refund.isManualReviewRequired && <p className="font-semibold text-amber-800">Manual review required</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-600">No payment record</p>
                )}
              </div>

              {/* Order Status History Timeline */}
              {order.timeline && order.timeline.length > 0 && (
                <div className="p-4 rounded-xl bg-[#F5F6F8] border border-[#E3E7EC] space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#24533F]" />
                    <span className="font-bold  text-[11px] text-[#171A21]">
                      Lifecycle State Timeline
                    </span>
                  </div>
                  <div className="space-y-2 border-l border-[#E3E7EC] pl-3 ml-1.5">
                    {order.timeline.map((evt) => (
                      <div key={evt.id} className="relative space-y-0.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-[#24533F]">{evt.eventType.replaceAll('_', ' ')}</span>
                          <span className="tabular-nums text-slate-600">
                            {new Date(evt.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
                          </span>
                        </div>
                        {evt.description && <p className="text-[11px] text-slate-600">{evt.description}</p>}
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
            <div className="bg-[#FFFFFF] border border-[#9A431F] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2 text-[#9A431F]">
                <RotateCcw className="w-5 h-5" />
                <h3 className="text-sm font-bold">Cancel Order & Release Fleet</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Cancelling this order will release the assigned delivery rider's capacity, notify the kitchen, and automatically initiate a customer refund if payment was already captured.
              </p>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600">
                  Mandatory Cancellation Reason
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason (e.g. restaurant unable to prepare, customer address unreachable)..."
                  rows={3}
                  className="w-full text-xs p-2 rounded-lg bg-[#F5F6F8] border border-[#9A431F]/40 text-[#171A21] focus:outline-none focus:border-[#9A431F]"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setCancelModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-[#171A21] cursor-pointer"
                >
                  Keep Order
                </button>
                <button
                  disabled={!cancelReason.trim() || cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate(cancelReason)}
                  className="px-4 py-1.5 rounded-lg bg-[#9A431F] text-black text-xs font-bold hover:bg-[#9A431F]/80 disabled:opacity-50 cursor-pointer"
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
