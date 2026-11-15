import { Bike, IndianRupee, ShoppingBag, Store } from 'lucide-react';
import type { OverviewMetricsResponse } from '@/types/dashboard';

export function KpiCards({ data, isLoading, isError, onRetry }: {
  data?: OverviewMetricsResponse;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isError) return <div className="admin-panel p-4 text-sm" role="alert">Could not load overview metrics. <button className="admin-control" onClick={onRetry}>Retry</button></div>;

  const metrics = [
    { label: 'Total orders', scope: 'Selected period', value: data?.orders.totalOrders.toLocaleString('en-IN'), icon: ShoppingBag },
    { label: 'Gross captured', scope: 'Selected period', value: data && Number(data.financials.totalCapturedAmount).toLocaleString('en-IN', { style: 'currency', currency: 'INR' }), icon: IndianRupee },
    { label: 'Riders available or busy', scope: 'Current', value: data && data.riders.availableRiders + data.riders.busyRiders, icon: Bike },
    { label: 'Outlets accepting orders', scope: 'Current', value: data?.restaurants.acceptingOrdersOutlets, icon: Store },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {metrics.map(({ label, scope, value, icon: Icon }) => (
        <div key={label} className="admin-panel p-4 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold">{label}</p>
            <span className="rounded-lg bg-[#E8F2ED] text-[#205641] p-2 shrink-0"><Icon size={16} /></span>
          </div>
          <p className="mt-2 text-xl md:text-2xl font-bold break-words">{isLoading ? '…' : value ?? '—'}</p>
          <p className="mt-1 text-xs text-slate-600">{scope}</p>
        </div>
      ))}
    </div>
  );
}
