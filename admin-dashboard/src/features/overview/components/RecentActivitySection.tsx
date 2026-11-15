import React from 'react';
import { 
  ShoppingBag, 
  RotateCcw, 
  Bike, 
  Clock, 
  AlertCircle 
} from 'lucide-react';
import type { RecentActivityResponse } from '@/types/dashboard';

interface RecentActivitySectionProps {
  data?: RecentActivityResponse;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export const RecentActivitySection: React.FC<RecentActivitySectionProps> = ({
  data,
  isLoading,
  isError,
  onRetry,
}) => {
  if (isError) {
    return (
      <div className="p-6 rounded-xl bg-[#FFFFFF] border border-[#E3E7EC] space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold  text-[#171A21]">
            Recent Platform Activity
          </h2>
          <button
            onClick={onRetry}
            className="text-xs font-semibold text-[#205641] hover:underline cursor-pointer"
          >
            Retry
          </button>
        </div>
        <div className="p-4 rounded-lg bg-[#9A431F]/10 border border-[#9A431F]/20 flex items-center gap-2 text-xs text-[#9A431F]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Failed to load platform activity timeline.</span>
        </div>
      </div>
    );
  }

  const events = data?.events || [];

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'order':
        return <ShoppingBag className="w-4 h-4 text-[#205641]" />;
      case 'refund':
        return <RotateCcw className="w-4 h-4 text-[#9A431F]" />;
      case 'rider':
        return <Bike className="w-4 h-4 text-[#205641]" />;
      default:
        return <Clock className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="p-6 rounded-xl bg-[#FFFFFF] border border-[#E3E7EC] space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold  text-[#171A21]">
            Recent Platform Activity
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Operational timeline assembled from live database orders, refunds, and rider registrations
          </p>
        </div>
        <span className="text-[11px] tabular-nums text-slate-600">
          Showing latest {events.length} events
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3 pt-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="p-8 text-center bg-[#F5F6F8] rounded-lg border border-dashed border-[#E3E7EC]">
          <Clock className="w-6 h-6 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-600">No recent events recorded in platform audit history</p>
        </div>
      ) : (
        <div className="divide-y divide-[#E3E7EC]">
          {events.map((evt) => {
            const date = new Date(evt.timestamp);
            const timeStr = date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
            const dateStr = date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

            return (
              <div key={evt.id} className="py-3 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#F5F6F8] border border-[#E3E7EC] flex items-center justify-center shrink-0 mt-0.5">
                    {getSourceIcon(evt.source)}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-[#171A21]">{evt.description}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-600 tabular-nums">
                      <span className="uppercase px-1.5 py-0.2 rounded bg-slate-100 border border-[#E3E7EC]">
                        {evt.source}
                      </span>
                      <span>·</span>
                      <span>{evt.eventType}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 text-[11px] tabular-nums text-slate-600">
                  <div>{timeStr}</div>
                  <div className="text-[10px] text-slate-600">{dateStr}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
