import React from 'react';
import type { OrderStatus, PaymentStatus, DeliveryStatus } from '@/types/orders';

interface OrderStatusBadgeProps {
  type: 'order' | 'payment' | 'delivery';
  status: OrderStatus | PaymentStatus | DeliveryStatus;
}

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ type, status }) => {
  if (type === 'payment') {
    switch (status) {
      case 'captured':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#24533F] text-[#D9F078]">
            PAID
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#E98755]/20 text-[#E98755] border border-[#E98755]/40">
            REFUNDED
          </span>
        );
      case 'partially_refunded':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            PARTIAL REFUND
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
            FAILED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-white/5 text-[#F7F6F0]/40 border border-white/5">
            PENDING
          </span>
        );
    }
  }

  if (type === 'delivery') {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#24533F] text-[#D9F078]">
            DELIVERED
          </span>
        );
      case 'assigned':
      case 'accepted':
      case 'at_restaurant':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            ASSIGNED
          </span>
        );
      case 'picked_up':
      case 'arrived_customer':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#D9F078]/20 text-[#D9F078] border border-[#D9F078]/40">
            IN TRANSIT
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-white/5 text-[#F7F6F0]/40 border border-white/5">
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            UNASSIGNED
          </span>
        );
    }
  }

  // Order status
  switch (status) {
    case 'delivered':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#24533F] text-[#D9F078]">
          DELIVERED
        </span>
      );
    case 'out_for_delivery':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D9F078]/20 text-[#D9F078] border border-[#D9F078]/30">
          OUT FOR DELIVERY
        </span>
      );
    case 'ready_for_pickup':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
          READY AT OUTLET
        </span>
      );
    case 'preparing':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
          IN KITCHEN
        </span>
      );
    case 'confirmed':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
          CONFIRMED
        </span>
      );
    case 'placed':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-[#F7F6F0]/80 border border-white/10">
          PLACED
        </span>
      );
    case 'cancelled':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#E98755]/20 text-[#E98755] border border-[#E98755]/40">
          CANCELLED
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/30">
          REJECTED BY OUTLET
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/5 text-[#F7F6F0]/40 border border-white/5">
          PENDING PAYMENT
        </span>
      );
  }
};

