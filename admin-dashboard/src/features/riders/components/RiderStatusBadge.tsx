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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#E98755]/20 text-[#E98755] border border-[#E98755]/40">
          <XCircle className="w-3 h-3" /> SUSPENDED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#24533F] text-[#D9F078]">
        <CheckCircle2 className="w-3 h-3" /> ACTIVE
      </span>
    );
  }

  if (type === 'verification') {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#24533F] text-[#D9F078]">
            <CheckCircle2 className="w-3 h-3" /> APPROVED
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#E98755]/20 text-[#E98755] border border-[#E98755]/40">
            <XCircle className="w-3 h-3" /> REJECTED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" /> PENDING KYC
          </span>
        );
    }
  }

  // Availability status
  switch (status) {
    case 'available':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#24533F]/40 text-[#D9F078] border border-[#24533F]">
          <Radio className="w-2.5 h-2.5 animate-pulse text-[#D9F078]" /> AVAILABLE
        </span>
      );
    case 'busy':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
          ON DELIVERY
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-white/5 text-[#F7F6F0]/40 border border-white/5">
          OFFLINE
        </span>
      );
  }
};

