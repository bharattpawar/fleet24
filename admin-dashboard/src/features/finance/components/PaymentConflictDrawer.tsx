import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '@/lib/api/orders';
import {
  X,
  CreditCard,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Clock,
  Loader2,
} from 'lucide-react';

interface PaymentConflictDrawerProps {
  orderId: string | null;
  onClose: () => void;
  onRefundApproved?: () => void;
}

export const PaymentConflictDrawer: React.FC<PaymentConflictDrawerProps> = ({
  orderId,
  onClose,
  onRefundApproved,
}) => {
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: conflict, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'payment-conflict', orderId],
    queryFn: () => ordersApi.getPaymentConflictDetails(orderId!),
    enabled: !!orderId,
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      ordersApi.approveConflictRefund(orderId!, {
        reason: adminNote.trim() || undefined,
      }),
    onSuccess: () => {
      setShowConfirm(false);
      setAdminNote('');
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'payment-conflicts'] });
      refetch();
      if (onRefundApproved) onRefundApproved();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Refund approval failed';
      setActionError(msg);
    },
  });

  if (!orderId) return null;

  const formatCurrency = (val: number | string | undefined) => {
    const num = typeof val === 'string' ? parseFloat(val) : val ?? 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const isEligibleForRefund =
    conflict &&
    conflict.status === 'payment_conflict' &&
    (!conflict.refund || conflict.refund.status === 'failed');

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-[#E3E7EC] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#E3E7EC] flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Payment Conflict
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {conflict?.orderNumber || 'Loading...'}
              </span>
            </div>
            <h2 className="text-base font-bold text-[#171A21] mt-1">
              Conflict Review & Resolution
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-sm">
          {isLoading && (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-[#205641]" />
              <p className="text-xs">Loading conflict details & payment evidence...</p>
            </div>
          )}

          {isError && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              Failed to load payment conflict details. Please verify your connection or try again.
            </div>
          )}

          {conflict && (
            <>
              {/* Conflict Cause Banner */}
              <div className="p-3.5 rounded-lg bg-amber-50/70 border border-amber-200 text-amber-900 flex gap-3 items-start">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-xs text-amber-950">
                    Dual Active Fulfillment Order Detected
                  </p>
                  <p className="text-xs leading-relaxed text-amber-800">
                    This order was captured by Razorpay while the customer already had an active
                    fulfillment order. The payment is verified as captured, and this order is held
                    safely outside the kitchen/delivery queue awaiting Admin refund approval.
                  </p>
                  {conflict.conflictDetails?.conflictingActiveOrder && (
                    <div className="mt-2 pt-2 border-t border-amber-200/60 flex items-center gap-2 text-xs">
                      <span className="text-slate-500">Conflicting Active Order:</span>
                      <span className="font-mono font-bold text-slate-800">
                        #{conflict.conflictDetails.conflictingActiveOrder.orderNumber}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-bold bg-slate-200 text-slate-700">
                        {conflict.conflictDetails.conflictingActiveOrder.status}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 1. Captured Payment Evidence */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" />
                  Captured Payment Evidence
                </h3>
                <div className="grid grid-cols-2 gap-2.5 p-3 rounded-lg border border-[#E3E7EC] bg-slate-50/50 text-xs">
                  <div>
                    <span className="text-slate-500 block">Captured Total:</span>
                    <span className="font-bold text-base text-[#171A21]">
                      {formatCurrency(conflict.payment?.amount ?? conflict.totalPayable)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Gateway Provider:</span>
                    <span className="font-semibold text-slate-800 uppercase">
                      {conflict.payment?.provider || 'Razorpay'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Provider Payment ID:</span>
                    <span className="font-mono text-slate-800 select-all">
                      {conflict.payment?.providerPaymentId || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Gateway Order ID:</span>
                    <span className="font-mono text-slate-800 select-all">
                      {conflict.payment?.providerOrderId || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Capture Verified At:</span>
                    <span className="text-slate-700">{formatDate(conflict.payment?.paidAt)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Payment Record Status:</span>
                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#205641] text-white uppercase">
                      {conflict.payment?.status || 'captured'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Customer & Restaurant Context */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-[#E3E7EC] bg-slate-50/50 space-y-1">
                  <span className="text-slate-500 font-bold block uppercase text-[10px]">
                    Customer
                  </span>
                  <p className="font-semibold text-slate-800">{conflict.customer.name}</p>
                  <p className="text-slate-500 font-mono">{conflict.customer.phone}</p>
                </div>
                <div className="p-3 rounded-lg border border-[#E3E7EC] bg-slate-50/50 space-y-1">
                  <span className="text-slate-500 font-bold block uppercase text-[10px]">
                    Restaurant Outlet
                  </span>
                  <p className="font-semibold text-slate-800">{conflict.restaurant.name}</p>
                  <p className="text-slate-500">{conflict.restaurant.outletName}</p>
                </div>
              </div>

              {/* 3. Refund & Resolution State */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Refund Execution Status
                </h3>
                <div className="p-3 rounded-lg border border-[#E3E7EC] bg-slate-50/50 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Current Status:</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        conflict.authoritativeStatus === 'refund_completed'
                          ? 'bg-[#205641] text-white'
                          : conflict.authoritativeStatus === 'refund_pending'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : conflict.authoritativeStatus === 'refund_failed'
                          ? 'bg-red-100 text-red-800 border border-red-300'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {conflict.authoritativeStatus.replace('_', ' ')}
                    </span>
                  </div>

                  {conflict.refund && (
                    <div className="space-y-1 pt-1.5 border-t border-[#E3E7EC]">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Refund Amount:</span>
                        <span className="font-semibold text-slate-800">
                          {formatCurrency(conflict.refund.amount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Provider Refund ID:</span>
                        <span className="font-mono text-slate-800 select-all">
                          {conflict.refund.providerRefundId || 'Awaiting gateway ID'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Attempts / Lease:</span>
                        <span className="text-slate-700">{conflict.refund.attemptCount} attempt(s)</span>
                      </div>
                      {conflict.refund.lastErrorMessage && (
                        <div className="mt-1 p-2 rounded bg-red-50 text-red-700 text-[11px]">
                          <span className="font-bold block">Gateway Error:</span>
                          {conflict.refund.lastErrorMessage}
                        </div>
                      )}
                    </div>
                  )}

                  {conflict.conflictDetails?.approvedByAdminUserId && (
                    <div className="pt-1.5 border-t border-[#E3E7EC] text-[11px] text-slate-600">
                      <span className="text-slate-500 block">Approval Audit:</span>
                      Approved by Admin <code className="text-slate-800">{conflict.conflictDetails.approvedByAdminUserId.slice(0, 8)}...</code>{' '}
                      on {formatDate(conflict.conflictDetails.approvedAt)}
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Chronological Audit History */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Chronological Audit Trail
                </h3>
                <div className="border border-[#E3E7EC] rounded-lg divide-y divide-[#E3E7EC] bg-white max-h-48 overflow-y-auto">
                  {conflict.auditEvents && conflict.auditEvents.length > 0 ? (
                    conflict.auditEvents.map((evt) => (
                      <div key={evt.id} className="p-2.5 text-xs space-y-0.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-800">{evt.action}</span>
                          <span className="text-slate-400">{formatDate(evt.createdAt)}</span>
                        </div>
                        {evt.details && (
                          <p className="text-slate-500 text-[11px] font-mono">
                            {typeof evt.details === 'string'
                              ? evt.details
                              : JSON.stringify(evt.details)}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-slate-400 text-xs">
                      No additional audit events recorded.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Action Bar */}
        <div className="p-4 border-t border-[#E3E7EC] bg-slate-50 flex flex-col gap-3">
          {actionError && (
            <div className="p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
              {actionError}
            </div>
          )}

          {showConfirm ? (
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-300 space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-bold text-amber-950">
                  Confirm Full Refund Execution ({formatCurrency(conflict?.totalPayable)})
                </p>
                <p className="text-xs text-amber-800">
                  This action will atomically reserve a full refund and initiate an authentic Razorpay
                  refund transaction to the customer. Your Admin identity will be permanently logged.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Administrative Note (Optional):
                </label>
                <input
                  type="text"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="e.g., Confirmed duplicate order with customer"
                  className="w-full text-xs px-2.5 py-1.5 border border-[#E3E7EC] rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#205641]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                  className="px-3 py-1.5 rounded-md bg-[#205641] text-white text-xs font-bold hover:bg-[#184433] transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Confirm & Execute Full Refund</span>
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={approveMutation.isPending}
                  className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-md border border-[#E3E7EC] text-slate-700 text-xs font-medium hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Close Drawer
              </button>

              {isEligibleForRefund ? (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="px-3.5 py-1.5 rounded-md bg-[#205641] text-white text-xs font-bold hover:bg-[#184433] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Approve Full Refund</span>
                </button>
              ) : (
                <span className="text-xs text-slate-500 italic">
                  {conflict?.authoritativeStatus === 'refund_completed'
                    ? 'Refund completed'
                    : conflict?.authoritativeStatus === 'refund_pending'
                    ? 'Refund already in progress'
                    : 'Action not available'}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
