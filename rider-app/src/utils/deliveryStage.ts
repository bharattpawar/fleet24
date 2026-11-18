/** The rider's next step for an active delivery, and the button text for it. */
export type DeliveryStageAction = 'arrive_restaurant' | 'pickup' | 'arrive_customer' | 'mark_delivered';

export interface DeliveryStageStep {
  action: DeliveryStageAction;
  label: string;
}

/**
 * No OTP: at the customer's door the rider marks the order delivered, or the customer taps
 * "I got my order" in their app. Either one completes it.
 */
export function nextDeliveryStep(status: string | undefined | null): DeliveryStageStep | null {
  switch ((status || 'accepted').toLowerCase()) {
    case 'assigned':
    case 'accepted':
      return { action: 'arrive_restaurant', label: 'CONFIRM ARRIVAL AT RESTAURANT' };
    case 'at_restaurant':
      return { action: 'pickup', label: 'CONFIRM FOOD PICKED UP' };
    case 'picked_up':
      return { action: 'arrive_customer', label: 'CONFIRM ARRIVAL AT CUSTOMER' };
    case 'arrived_customer':
      return { action: 'mark_delivered', label: 'MARK DELIVERED' };
    default:
      return null;
  }
}
