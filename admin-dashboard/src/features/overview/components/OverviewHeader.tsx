import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { DashboardPeriod } from '@/types/dashboard';

interface OverviewHeaderProps {
  adminName: string;
  adminPhone?: string;
  selectedPeriod: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  lastUpdated?: Date;
  isRefreshing?: boolean;
  onRefresh: () => void;
}

const PERIOD_OPTIONS: Array<{ label: string; value: DashboardPeriod }> = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: 'last_7_days' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Last 30 Days', value: 'last_30_days' },
];

export const OverviewHeader: React.FC<OverviewHeaderProps> = ({
  adminName,
  adminPhone,
  selectedPeriod,
  onPeriodChange,
  lastUpdated,
  isRefreshing,
  onRefresh,
}) => {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#24533F]/30">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-[#F7F6F0]">
            Platform Overview
          </h1>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#24533F]/50 text-[#D9F078] border border-[#24533F]">
            Asia/Kolkata (IST)
          </span>
        </div>
        <p className="text-xs text-[#F7F6F0]/60 mt-1">
          Welcome back, <span className="font-semibold text-[#D9F078]">{adminName}</span>
          {adminPhone ? ` (${adminPhone})` : ''} · Platform Super Admin Operations
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Period Selector Tabs */}
        <div className="flex items-center bg-[#17211B] border border-[#24533F]/40 rounded-lg p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onPeriodChange(opt.value)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                selectedPeriod === opt.value
                  ? 'bg-[#24533F] text-[#D9F078] shadow-sm font-semibold'
                  : 'text-[#F7F6F0]/60 hover:text-[#F7F6F0] hover:bg-white/5'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Refresh Action & Timestamp */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-[#24533F]/30">
          {lastUpdated && (
            <span className="text-[11px] font-mono text-[#F7F6F0]/40 hidden sm:inline">
              Refreshed: {lastUpdated.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
            </span>
          )}

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh All Overview Data"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#24533F]/40 border border-[#24533F] text-xs font-medium text-[#D9F078] hover:bg-[#24533F]/60 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>
    </div>
  );
};
