import type { RevenueAnalyticsResponse } from '@/types/dashboard';

const money = (value: number) => value.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

export function RevenueAnalyticsSection({ data, isLoading, isError, onRetry }: {
  data?: RevenueAnalyticsResponse;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const series = data?.dailyPaymentSeries ?? [];
  const hasActivity = series.some((entry) => entry.transactionCount > 0 || entry.capturedAmount > 0)
    || Boolean(data?.summary.processedRefundAmount);
  const max = Math.max(1, ...series.map((entry) => entry.capturedAmount));
  const cashflow = [
    ['Gross captured', data?.summary.grossCapturedAmount],
    ['Processed refunds', data?.summary.processedRefundAmount],
    ['Net retained', data?.summary.netCollectedAmount],
  ] as const;

  return (
    <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]" aria-label="Revenue and cashflow">
      <div className="admin-panel min-w-0 p-5">
        <h2 className="text-base font-bold">Revenue</h2>
        <p className="mt-1 text-xs text-slate-600">Daily gross captured · IST</p>
        {isError ? (
          <p role="alert" className="mt-5 text-sm">Could not load revenue. <button className="admin-control" onClick={onRetry}>Retry</button></p>
        ) : isLoading ? (
          <p role="status" className="mt-5 text-sm text-slate-600">Loading revenue…</p>
        ) : !hasActivity ? (
          <p className="mt-4 rounded-lg bg-[#F5F6F8] p-5 text-sm text-slate-600">No activity in this date range</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <div className="flex gap-2" style={{ minWidth: series.length * 26 }}>
              {series.map((entry, index) => (
                <div key={entry.date} className="min-w-0 flex-1 text-center" title={`${entry.date}: ${money(entry.capturedAmount)}`}>
                  <div className="flex h-36 items-end justify-center border-b border-[#E3E7EC]">
                    <div className="w-full max-w-8 rounded-t bg-[#205641]" style={{ height: `${100 * entry.capturedAmount / max}%` }} />
                  </div>
                  <span className="mt-2 block whitespace-nowrap text-[10px] text-slate-600">
                    {(series.length <= 10 || index % 4 === 0) && entry.date.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="admin-panel p-5">
        <h2 className="text-base font-bold">Cashflow</h2>
        <p className="mt-1 text-xs text-slate-600">Selected period · INR</p>
        <dl className="mt-3 divide-y divide-[#E3E7EC]">
          {cashflow.map(([label, amount]) => (
            <div key={label} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
              <dt className="text-slate-600">{label}</dt>
              <dd className="font-bold">{amount == null ? '—' : money(amount)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
