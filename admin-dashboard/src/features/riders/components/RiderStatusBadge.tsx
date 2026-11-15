import React from 'react';
import { CheckCircle2, XCircle, Clock, Radio } from 'lucide-react';
import type { RiderVerificationStatus, RiderAvailabilityStatus } from '@/types/riders';

interface RiderStatusBadgeProps {
  type: 'verification' | 'availability' | 'suspension';
  status: RiderVerificationStatus | RiderAvailabilityStatus | boolean;
}

export const RiderStatusBadge: React.FC<RiderStatusBadgeProps> = ({ type, status }) => {
  if (type === 'suspension') {
    if (status === true) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-[#9A431F]/20 text-[#9A431F] border border-[#9A431F]/40">
          <XCircle className="w-3 h-3" /> SUSPENDED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-[#205641] text-white">
        <CheckCircle2 className="w-3 h-3" /> ACTIVE
      </span>
    );
  }

  if (type === 'verification') {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-[#205641] text-white">
            <CheckCircle2 className="w-3 h-3" /> APPROVED
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-[#9A431F]/20 text-[#9A431F] border border-[#9A431F]/40">
            <XCircle className="w-3 h-3" /> REJECTED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/30">
            <Clock className="w-3 h-3" /> PENDING KYC
          </span>
        );
    }
  }

  // Availability status
  switch (status) {
    case 'available':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-[#E8F2ED] text-[#205641] border border-[#205641]">
          <Radio className="w-2.5 h-2.5 animate-pulse text-[#205641]" /> AVAILABLE
        </span>
      );
    case 'busy':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-blue-500/20 text-blue-700 border border-blue-500/30">
          ON DELIVERY
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-slate-100 text-slate-600 border border-[#E3E7EC]">
          OFFLINE
        </span>
      );
  }
};

