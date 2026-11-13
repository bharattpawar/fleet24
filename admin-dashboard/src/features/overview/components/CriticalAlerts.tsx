import React from 'react';
import { AlertTriangle, Clock, ShieldAlert } from 'lucide-react';
import type { OverviewMetricsResponse } from '@/types/dashboard';

interface CriticalAlertsProps {
  overview?: OverviewMetricsResponse;
}

export const CriticalAlerts: React.FC<CriticalAlertsProps> = ({ overview }) => {
  if (!overview) return null;

  const alerts: Array<{
    id: string;
    level: 'warning' | 'urgent';
    title: string;
    description: string;
  }> = [];

  // Check unassigned deliveries
  if (overview.deliveries.unassignedDeliveries > 0) {
    alerts.push({
      id: 'unassigned_deliveries',
      level: 'urgent',
      title: `${overview.deliveries.unassignedDeliveries} Unassigned Deliveries`,
      description: 'Active customer orders currently have no rider assigned. Dispatch matching required.',
    });
  }

  // Check awaiting rider assignment in orders
  if (overview.orders.awaitingRiderAssignment > 0 && overview.deliveries.unassignedDeliveries === 0) {
    alerts.push({
      id: 'awaiting_assignment',
      level: 'warning',
      title: `${overview.orders.awaitingRiderAssignment} Orders Awaiting Rider`,
      description: 'Orders are confirmed/preparing in kitchens without active rider offers.',
    });
  }

  // Check pending refunds
  if (overview.financials.pendingRefundAmount > 0) {
    alerts.push({
      id: 'pending_refunds',
      level: 'warning',
      title: `₹ ${overview.financials.pendingRefundAmount.toFixed(2)} In Pending Refunds`,
      description: 'Customer refunds awaiting gateway reconciliation or banking gateway approval.',
    });
  }

  // Check pending rider verifications
  if (overview.riders.pendingVerification > 0) {
    alerts.push({
      id: 'pending_kyc',
      level: 'warning',
      title: `${overview.riders.pendingVerification} Rider KYC Applications Pending`,
      description: 'New delivery fleet partners awaiting driving license and vehicle document verification.',
    });
  }

  // Check suspended riders
  if (overview.riders.suspendedRiders > 0) {
    alerts.push({
      id: 'suspended_riders',
      level: 'warning',
      title: `${overview.riders.suspendedRiders} Suspended Riders in Fleet`,
      description: 'Rider accounts blocked from receiving dispatch assignment due to policy violations.',
    });
  }

  // Check expired assignment offers
  if (overview.deliveries.expiredOffers > 0) {
    alerts.push({
      id: 'expired_offers',
      level: 'warning',
      title: `${overview.deliveries.expiredOffers} Delivery Offers Expired Unaccepted`,
      description: 'Dispatched broadcast offers expired without rider acceptance during this period.',
    });
  }

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-[#E98755]" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#F7F6F0]">
          Critical Attention Items ({alerts.length})
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              alert.level === 'urgent'
                ? 'bg-[#E98755]/15 border-[#E98755]/40 text-[#F7F6F0]'
                : 'bg-black/30 border-[#24533F]/40 text-[#F7F6F0]'
            }`}
          >
            <div className="p-1.5 rounded-lg bg-black/40 text-[#E98755] shrink-0 mt-0.5">
              {alert.level === 'urgent' ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
            </div>

            <div className="space-y-1">
              <h3 className="text-xs font-bold text-[#F7F6F0]">{alert.title}</h3>
              <p className="text-[11px] text-[#F7F6F0]/70 leading-relaxed">
                {alert.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
