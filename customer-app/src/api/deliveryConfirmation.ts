import { apiRequest } from './client';

export interface ConfirmDeliveryResult {
  orderId: string;
  status: string;
  alreadyCompleted?: boolean;
}

/** Customer taps "I got my order": completes the delivery. Safe to call twice. */
export function confirmDeliveryReceived(orderId: string): Promise<ConfirmDeliveryResult> {
  return apiRequest<ConfirmDeliveryResult>(`/orders/${encodeURIComponent(orderId)}/delivery/confirm`, {
    method: 'POST',
  });
}
