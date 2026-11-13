import React from 'react';
import { IndianRupee, AlertCircle, ArrowDownRight, ArrowUpRight, Clock } from 'lucide-react';
import type { RevenueAnalyticsResponse } from '@/types/dashboard';

interface RevenueAnalyticsSectionProps {
  data?: RevenueAnalyticsResponse;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export const RevenueAnalyticsSection: React.FC<RevenueAnalyticsSectionProps> = ({
  data,
  isLoading,
  isError,
  onRetry,
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val);
  };

  if (isError) {
    return (
      <div className="p-6 rounded-xl bg-[#17211B] border border-[#24533F]/30 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#F7F6F0]">
            Revenue & Settlements Performance
          </h2>
          <button
            onClick={onRetry}
            className="text-xs font-semibold text-[#D9F078] hover:underline cursor-pointer"
          >
            Retry
          </button>
        </div>
        <div className="p-4 rounded-lg bg-[#E98755]/10 border border-[#E98755]/20 flex items-center gap-2 text-xs text-[#E98755]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Failed to retrieve revenue metrics from backend API.</span>
        </div>
      </div>
    );
  }

  const series = data?.dailyPaymentSeries || [];
  const maxCaptured = Math.max(...series.map((s) => s.capturedAmount), 1);

  return (
    <div className="p-6 rounded-xl bg-[#17211B] border border-[#24533F]/30 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#24533F]/20 pb-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#F7F6F0]">
            Revenue Analytics & Cashflow
          </h2>
          <p className="text-xs text-[#F7F6F0]/50 mt-0.5">
            Breakdown of gross customer payments, processed refunds, and net retained money
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/30 border border-white/5 text-[#F7F6F0]/60">
            Currency: INR (₹)
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-black/20 border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#F7F6F0]/60">
            <span>Gross Captured</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#D9F078]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#F7F6F0]">
            {isLoading ? '...' : formatCurrency(data?.summary.grossCapturedAmount || 0)}
          </div>
          <p className="text-[10px] text-[#F7F6F0]/40">
            {data?.paymentStatusBreakdown.captured || 0} successful transactions
          </p>
        </div>

        <div className="p-4 rounded-lg bg-black/20 border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#F7F6F0]/60">
            <span>Processed Refunds</span>
            <ArrowDownRight className="w-3.5 h-3.5 text-[#E98755]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#E98755]">
            {isLoading ? '...' : formatCurrency(data?.summary.processedRefundAmount || 0)}
          </div>
          <p className="text-[10px] text-[#F7F6F0]/40">
            {data?.refundStatusBreakdown.processed || 0} completed refunds
          </p>
        </div>

        <div className="p-4 rounded-lg bg-black/20 border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#F7F6F0]/60">
            <span>Net Money Retained</span>
            <IndianRupee className="w-3.5 h-3.5 text-[#D9F078]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#D9F078]">
            {isLoading ? '...' : formatCurrency(data?.summary.netCollectedAmount || 0)}
          </div>
          <p className="text-[10px] text-[#F7F6F0]/40">
            Gross Captured minus Processed Refunds
          </p>
        </div>
      </div>

      {/* Daily Time Series Bar Visualization */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#F7F6F0]/60 uppercase tracking-wider">
            Daily Collections (Asia/Kolkata)
          </span>
          <span className="text-[11px] font-mono text-[#F7F6F0]/40">
            {series.length} data point{series.length !== 1 ? 's' : ''} in range
          </span>
        </div>

        {isLoading ? (
          <div className="h-36 flex items-center justify-center bg-black/20 rounded-lg">
            <span className="text-xs font-mono text-[#F7F6F0]/40 animate-pulse">
              Aggregating financial ledger...
            </span>
          </div>
        ) : series.length === 0 ? (
          <div className="h-36 flex flex-col items-center justify-center bg-black/20 rounded-lg border border-dashed border-[#24533F]/30 p-4 text-center">
            <Clock className="w-6 h-6 text-[#F7F6F0]/30 mb-2" />
            <p className="text-xs text-[#F7F6F0]/70 font-medium">No transactions recorded for this period</p>
            <p className="text-[11px] text-[#F7F6F0]/40 mt-0.5">
              Select another reporting period or wait for live customer checkouts.
            </p>
          </div>
        ) : (
          <div className="space-y-2 bg-black/20 p-4 rounded-lg">
            <div className="flex items-end gap-2 h-36 pt-4 pb-2">
              {series.map((item) => {
                const heightPercent = Math.max(Math.round((item.capturedAmount / maxCaptured) * 100), 4);
                return (
                  <div
                    key={item.date}
                    className="flex-1 flex flex-col items-center h-full justify-end group relative"
                  >
                    {/* Tooltip */}
                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-[#17211B] border border-[#24533F] rounded px-2 py-1 text-[10px] font-mono text-[#F7F6F0] shadow-xl whitespace-nowrap pointer-events-none z-10">
                      <div>{item.date}</div>
                      <div className="text-[#D9F078] font-bold">{formatCurrency(item.capturedAmount)}</div>
                      <div className="text-[#F7F6F0]/50">{item.transactionCount} payments</div>
                    </div>

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full max-w-[32px] bg-[#24533F] group-hover:bg-[#D9F078] rounded-t transition-colors cursor-pointer"
                    />

                    {/* Date label */}
                    <span className="text-[9px] font-mono text-[#F7F6F0]/40 mt-1 truncate max-w-[40px]">
                      {item.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Honest Note on Settlement Status */}
      <div className="p-3 rounded-lg bg-[#24533F]/20 border border-[#24533F]/30 text-[11px] text-[#F7F6F0]/70">
        <span className="font-semibold text-[#D9F078]">Ledger Rule:</span>{' '}
        {data?.summary.fleet24CommissionNote ||
          'Gross volume represents payments captured via payment gateway. Commission splits, delivery charges, and restaurant payouts are verified during weekly settlement cycles.'}
      </div>
    </div>
  );
};
