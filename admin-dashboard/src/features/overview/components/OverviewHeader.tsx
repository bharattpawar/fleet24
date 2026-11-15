import { RefreshCw } from 'lucide-react';
import type { DashboardPeriod } from '@/types/dashboard';

interface OverviewHeaderProps {
  selectedPeriod: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  lastUpdated?: Date;
  isRefreshing?: boolean;
  onRefresh: () => void;
}

const periods: { label: string; value: DashboardPeriod }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: 'last_7_days' },
  { label: 'This month', value: 'this_month' },
  { label: 'Last 30 days', value: 'last_30_days' },
];

export function OverviewHeader({ selectedPeriod, onPeriodChange, lastUpdated, isRefreshing, onRefresh }: OverviewHeaderProps) {
  return (
    <div className="admin-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold" htmlFor="overview-period">Date range</label>
        <select id="overview-period" className="admin-control" value={selectedPeriod} onChange={(event) => onPeriodChange(event.target.value as DashboardPeriod)}>
          {periods.map(({ label, value }) => <option key={value} value={value}>{label}</option>)}
        </select>
        <span className="text-xs text-slate-600">Asia/Kolkata (IST)</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-600">
          {lastUpdated ? `Last refreshed ${lastUpdated.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}` : 'Awaiting data'}
        </span>
        <button className="admin-primary" title="Refresh All Overview Data" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} /> Sync
        </button>
      </div>
    </div>
  );
}
