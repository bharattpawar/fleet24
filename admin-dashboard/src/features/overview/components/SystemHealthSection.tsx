import React from 'react';
import { Server, Database, Layers, CheckCircle2, AlertCircle } from 'lucide-react';
import type { SystemHealthResponse, SystemReadinessResponse } from '@/types/dashboard';

interface SystemHealthSectionProps {
  health?: SystemHealthResponse;
  readiness?: SystemReadinessResponse;
  isHealthLoading: boolean;
  isReadinessLoading: boolean;
  isHealthError: boolean;
  isReadinessError: boolean;
  onRefresh: () => void;
}

export const SystemHealthSection: React.FC<SystemHealthSectionProps> = ({
  health,
  readiness,
  isHealthLoading,
  isReadinessLoading,
  isHealthError,
  isReadinessError,
  onRefresh,
}) => {
  const formatUptime = (seconds?: number) => {
    if (!seconds) return '0m';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#F7F6F0]">
            System Diagnostics & Availability
          </h2>
          <p className="text-xs text-[#F7F6F0]/50 mt-0.5">
            Real infrastructure health queried via NestJS liveness and PostgreSQL ping probes
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="text-xs font-semibold text-[#D9F078] hover:underline cursor-pointer"
        >
          Ping Systems
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* API Gateway */}
        <div className="p-5 rounded-xl bg-[#17211B] border border-[#24533F]/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#F7F6F0]/50">
              API Gateway
            </span>
            <Server className="w-4 h-4 text-[#D9F078]" />
          </div>

          <div className="flex items-center gap-2">
            {isHealthLoading ? (
              <span className="text-xs font-mono text-[#F7F6F0]/40 animate-pulse">Checking...</span>
            ) : isHealthError ? (
              <>
                <AlertCircle className="w-5 h-5 text-[#E98755]" />
                <span className="text-base font-bold text-[#E98755]">Unreachable</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5 text-[#D9F078]" />
                <span className="text-base font-bold text-[#F7F6F0] uppercase">
                  {health?.status || 'ONLINE'}
                </span>
              </>
            )}
          </div>

          <div className="pt-2 border-t border-[#24533F]/20 flex items-center justify-between text-[11px] font-mono text-[#F7F6F0]/40">
            <span>Uptime:</span>
            <span>{isHealthLoading ? '...' : formatUptime(health?.uptime)}</span>
          </div>
        </div>

        {/* PostgreSQL Database */}
        <div className="p-5 rounded-xl bg-[#17211B] border border-[#24533F]/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#F7F6F0]/50">
              PostgreSQL Core
            </span>
            <Database className="w-4 h-4 text-[#24533F]" />
          </div>

          <div className="flex items-center gap-2">
            {isReadinessLoading ? (
              <span className="text-xs font-mono text-[#F7F6F0]/40 animate-pulse">Pinging...</span>
            ) : isReadinessError || !readiness?.database?.connected ? (
              <>
                <AlertCircle className="w-5 h-5 text-[#E98755]" />
                <span className="text-base font-bold text-[#E98755]">Degraded / Disconnected</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5 text-[#D9F078]" />
                <span className="text-base font-bold text-[#F7F6F0]">Connected</span>
              </>
            )}
          </div>

          <div className="pt-2 border-t border-[#24533F]/20 flex items-center justify-between text-[11px] font-mono text-[#F7F6F0]/40">
            <span>Ping Latency:</span>
            <span>
              {isReadinessLoading
                ? '...'
                : readiness?.database?.latencyMs !== undefined
                ? `${readiness.database.latencyMs} ms`
                : 'N/A'}
            </span>
          </div>
        </div>

        {/* WebSocket Dispatch Gateway */}
        <div className="p-5 rounded-xl bg-[#17211B] border border-[#24533F]/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#F7F6F0]/50">
              WebSocket Gateway
            </span>
            <Layers className="w-4 h-4 text-[#D9F078]" />
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D9F078] animate-pulse" />
            <span className="text-base font-bold text-[#F7F6F0]">/tracking</span>
          </div>

          <div className="pt-2 border-t border-[#24533F]/20 flex items-center justify-between text-[11px] font-mono text-[#F7F6F0]/40">
            <span>Namespace:</span>
            <span>Socket.IO Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
