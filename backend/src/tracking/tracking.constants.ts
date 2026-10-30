/**
 * WebSocket Delivery Tracking Event Constants & Interfaces
 */

export const DELIVERY_WS_EVENTS = {
  // Client -> Server
  SUBSCRIBE: 'subscribe:delivery',
  UNSUBSCRIBE: 'unsubscribe:delivery',

  // Server -> Client
  SUBSCRIBED: 'delivery.subscribed',
  UNSUBSCRIBED: 'delivery.unsubscribed',
  ERROR: 'delivery.error',

  // Lifecycle Events (Server -> Client)
  RIDER_ASSIGNED: 'delivery.rider.assigned',
  STATUS_UPDATED: 'delivery.status.updated',
  LOCATION_UPDATED: 'delivery.location.updated',
  COMPLETED: 'delivery.completed',
  CANCELLED: 'delivery.cancelled',
} as const;

export interface SubscribeDeliveryPayload {
  orderId: string;
}

export interface DeliveryLocationPayload {
  orderId: string;
  deliveryId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  capturedAt?: string | null;
  updatedAt: string;
}

export interface DeliveryRiderAssignedPayload {
  orderId: string;
  deliveryId: string;
  rider: {
    id: string;
    fullName: string | null;
    vehicleType: string;
    vehicleNumber: string | null;
    phone?: string | null;
  };
  assignedAt: string;
}

export interface DeliveryStatusUpdatedPayload {
  orderId: string;
  deliveryId: string;
  status: string;
  orderStatus: string;
  updatedAt: string;
  message?: string;
}

export interface DeliveryCompletedPayload {
  orderId: string;
  deliveryId: string;
  completedAt: string;
  message: string;
}

export interface DeliveryCancelledPayload {
  orderId: string;
  deliveryId?: string;
  reason?: string | null;
  cancelledAt: string;
}

export interface DeliveryErrorPayload {
  code: string;
  message: string;
  orderId?: string;
}

