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
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-[#24533F] text-white">
            PAID
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-[#9A431F]/20 text-[#9A431F] border border-[#9A431F]/40">
            REFUNDED
          </span>
        );
      case 'partially_refunded':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-amber-500/20 text-amber-700 border border-amber-500/30">
            PARTIAL REFUND
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-red-500/20 text-red-700 border border-red-500/30">
            FAILED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-slate-100 text-slate-600 border border-[#E3E7EC]">
            PENDING
          </span>
        );
    }
  }

  if (type === 'delivery') {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-[#24533F] text-white">
            DELIVERED
          </span>
        );
      case 'assigned':
      case 'accepted':
      case 'at_restaurant':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-blue-500/20 text-blue-700 border border-blue-500/30">
            ASSIGNED
          </span>
        );
      case 'picked_up':
      case 'arrived_customer':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-[#24533F]/20 text-[#24533F] border border-[#24533F]/40">
            IN TRANSIT
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-slate-100 text-slate-600 border border-[#E3E7EC]">
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] tabular-nums font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/30">
            UNASSIGNED
          </span>
        );
    }
  }

  // Order status
  switch (status) {
    case 'delivered':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] tabular-nums font-bold bg-[#24533F] text-white">
          DELIVERED
        </span>
      );
    case 'out_for_delivery':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] tabular-nums font-bold bg-[#24533F]/20 text-[#24533F] border border-[#24533F]/30">
          OUT FOR DELIVERY
        </span>
      );
    case 'ready_for_pickup':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] tabular-nums font-bold bg-blue-500/20 text-blue-700 border border-blue-500/30">
          READY AT OUTLET
        </span>
      );
    case 'preparing':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] tabular-nums font-bold bg-amber-500/20 text-amber-700 border border-amber-500/30">
          IN KITCHEN
        </span>
      );
    case 'confirmed':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] tabular-nums font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
          CONFIRMED
        </span>
      );
    case 'placed':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] tabular-nums font-bold bg-slate-100 text-slate-600 border border-[#E3E7EC]">
          PLACED
        </span>
      );
    case 'cancelled':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] tabular-nums font-bold bg-[#9A431F]/20 text-[#9A431F] border border-[#9A431F]/40">
          CANCELLED
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] tabular-nums font-bold bg-red-500/20 text-red-700 border border-red-500/30">
          REJECTED BY OUTLET
        </span>
      );
    case 'payment_conflict':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] tabular-nums font-bold bg-amber-500/20 text-amber-800 border border-amber-500/40">
          PAYMENT CONFLICT
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] tabular-nums font-bold bg-slate-100 text-slate-600 border border-[#E3E7EC]">
          PENDING PAYMENT
        </span>
      );
  }
};

