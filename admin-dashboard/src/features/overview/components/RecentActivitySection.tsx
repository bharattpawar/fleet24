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
      <div className="p-6 rounded-xl bg-[#17211B] border border-[#24533F]/30 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#F7F6F0]">
            Recent Platform Activity
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
          <span>Failed to load platform activity timeline.</span>
        </div>
      </div>
    );
  }

  const events = data?.events || [];

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'order':
        return <ShoppingBag className="w-4 h-4 text-[#D9F078]" />;
      case 'refund':
        return <RotateCcw className="w-4 h-4 text-[#E98755]" />;
      case 'rider':
        return <Bike className="w-4 h-4 text-[#D9F078]" />;
      default:
        return <Clock className="w-4 h-4 text-[#F7F6F0]/60" />;
    }
  };

  return (
    <div className="p-6 rounded-xl bg-[#17211B] border border-[#24533F]/30 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#F7F6F0]">
            Recent Platform Activity
          </h2>
          <p className="text-xs text-[#F7F6F0]/50 mt-0.5">
            Operational timeline assembled from live database orders, refunds, and rider registrations
          </p>
        </div>
        <span className="text-[11px] font-mono text-[#F7F6F0]/40">
          Showing latest {events.length} events
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3 pt-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-white/5 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="p-8 text-center bg-black/20 rounded-lg border border-dashed border-[#24533F]/30">
          <Clock className="w-6 h-6 text-[#F7F6F0]/30 mx-auto mb-2" />
          <p className="text-xs text-[#F7F6F0]/70">No recent events recorded in platform audit history</p>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {events.map((evt) => {
            const date = new Date(evt.timestamp);
            const timeStr = date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
            const dateStr = date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

            return (
              <div key={evt.id} className="py-3 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-black/30 border border-[#24533F]/30 flex items-center justify-center shrink-0 mt-0.5">
                    {getSourceIcon(evt.source)}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-[#F7F6F0]">{evt.description}</p>
                    <div className="flex items-center gap-2 text-[10px] text-[#F7F6F0]/40 font-mono">
                      <span className="uppercase px-1.5 py-0.2 rounded bg-white/5 border border-white/5">
                        {evt.source}
                      </span>
                      <span>·</span>
                      <span>{evt.eventType}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 text-[11px] font-mono text-[#F7F6F0]/40">
                  <div>{timeStr}</div>
                  <div className="text-[10px] text-[#F7F6F0]/30">{dateStr}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
