import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '@/lib/api/orders';
import { PaymentConflictDrawer } from './components/PaymentConflictDrawer';
import type { ConflictFilterStatus } from '@/types/orders';
import {
  Search,
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

export const PaymentConflictsScreen: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState<ConflictFilterStatus>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'payment-conflicts', { filterStatus, search: searchTerm, page }],
    queryFn: () =>
      ordersApi.listPaymentConflicts({
        filterStatus,
        search: searchTerm.trim() || undefined,
        page,
        limit: 15,
      }),
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const statusTabs: Array<{ label: string; value: ConflictFilterStatus }> = [
    { label: 'All Conflicts', value: 'all' },
    { label: 'Pending Review', value: 'pending_review' },
    { label: 'Refund Pending', value: 'refund_pending' },
    { label: 'Refund Failed', value: 'refund_failed' },
    { label: 'Refund Completed', value: 'refund_completed' },
  ];

  // Calculate authoritative summary metrics from backend metrics payload, falling back to dataset calculation
  const totalCount = data?.metrics?.total ?? data?.total ?? 0;
  const items = data?.data || [];
  const pendingReviewCount = data?.metrics?.pendingReview ?? items.filter((i) => i.authoritativeStatus === 'pending_review').length;
  const refundPendingCount = data?.metrics?.refundPending ?? items.filter((i) => i.authoritativeStatus === 'refund_pending').length;
  const refundFailedCount = data?.metrics?.refundFailed ?? items.filter((i) => i.authoritativeStatus === 'refund_failed').length;
  const refundCompletedCount = data?.metrics?.refundCompleted ?? items.filter((i) => i.authoritativeStatus === 'refund_completed').length;

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-10">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[#E3E7EC]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#171A21] flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <span>Payment Conflict Queue</span>
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Authoritative Review of Captured Payments with Conflicting Active Fulfillment Orders · Explicit Admin Refund Authorization
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#E8F2ED] border border-[#205641] text-xs font-semibold text-[#205641] hover:bg-[#d8e8df] transition-colors disabled:opacity-50 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* 2. Operational Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3 rounded-lg border border-[#E3E7EC] bg-white shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Records
          </span>
          <p className="text-lg font-bold text-[#171A21] mt-0.5">{totalCount}</p>
        </div>

        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 shadow-xs">
          <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block">
            Pending Review
          </span>
          <p className="text-lg font-bold text-amber-900 mt-0.5">{pendingReviewCount}</p>
        </div>

        <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 shadow-xs">
          <span className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider block">
            Refund In Flight
          </span>
          <p className="text-lg font-bold text-blue-900 mt-0.5">{refundPendingCount}</p>
        </div>

        <div className="p-3 rounded-lg border border-red-200 bg-red-50/50 shadow-xs">
          <span className="text-[11px] font-semibold text-red-800 uppercase tracking-wider block">
            Refund Failed
          </span>
          <p className="text-lg font-bold text-red-900 mt-0.5">{refundFailedCount}</p>
        </div>

        <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
            Refund Completed
          </span>
          <p className="text-lg font-bold text-emerald-900 mt-0.5">{refundCompletedCount}</p>
        </div>
      </div>

      {/* 3. Filter Tabs & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center bg-white border border-[#E3E7EC] rounded-lg p-1 shadow-xs">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setFilterStatus(tab.value);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                filterStatus === tab.value
                  ? 'bg-[#205641] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#171A21] hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search order, customer, payment ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#E3E7EC] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#205641] text-slate-800 placeholder-slate-400 shadow-xs"
          />
        </div>
      </div>

      {/* 4. Conflict Table */}
      <div className="bg-white border border-[#E3E7EC] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-[#E3E7EC] text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Order / Conflict</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Restaurant</th>
                <th className="py-3 px-4">Captured Amount</th>
                <th className="py-3 px-4">Payment Reference</th>
                <th className="py-3 px-4">Authoritative Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E7EC] text-slate-700">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#205641]" />
                    <span>Loading payment conflicts from backend...</span>
                  </td>
                </tr>
              )}

              {isError && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-red-600 bg-red-50/50">
                    <p className="font-semibold">Unable to load payment conflicts</p>
                    <p className="text-[11px] text-red-500 mt-1">Please verify network connectivity or credentials.</p>
                  </td>
                </tr>
              )}

              {!isLoading && !isError && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2 opacity-80" />
                    <p className="font-semibold text-slate-700">No payment conflicts in this view</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {filterStatus === 'all'
                        ? 'All captured payments are fulfilling normally.'
                        : `No records matching status '${filterStatus}'.`}
                    </p>
                  </td>
                </tr>
              )}

              {!isLoading &&
                !isError &&
                items.map((row) => {
                  return (
                    <tr
                      key={row.orderId}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      onClick={() => setSelectedOrderId(row.orderId)}
                    >
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900 group-hover:text-[#205641] transition-colors">
                          #{row.orderNumber}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {formatDate(row.conflictDetails?.detectedAt || row.createdAt)}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{row.customer.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{row.customer.phone}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{row.restaurant.name}</div>
                        <div className="text-[11px] text-slate-400">{row.restaurant.outletName}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {formatCurrency(row.payment?.amount ?? row.totalPayable)}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase">
                          {row.payment?.status || 'captured'}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-800 select-all">
                          {row.payment?.providerPaymentId || '—'}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase">
                          {row.payment?.provider || 'Razorpay'}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            row.authoritativeStatus === 'refund_completed'
                              ? 'bg-[#205641] text-white'
                              : row.authoritativeStatus === 'refund_pending'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : row.authoritativeStatus === 'refund_failed'
                              ? 'bg-red-100 text-red-800 border border-red-300'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {row.authoritativeStatus.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrderId(row.orderId);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-[#E8F2ED] hover:text-[#205641] font-semibold text-[11px] transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Review</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {data && data.totalPages > 1 && (
          <div className="p-3 border-t border-[#E3E7EC] bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {data.page} of {data.totalPages} ({data.total} total conflicts)
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-[#E3E7EC] bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer text-xs"
              >
                Previous
              </button>
              <button
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                className="px-2.5 py-1 rounded border border-[#E3E7EC] bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer text-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Conflict Review & Refund Approval Drawer */}
      <PaymentConflictDrawer
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        onRefundApproved={() => refetch()}
      />
    </div>
  );
};
