/**
 * WebSocket Delivery Tracking & Kitchen Notification Event Constants & Interfaces
 */

export const DELIVERY_WS_EVENTS = {
  // Client -> Server (Customer / Rider Tracking)
  SUBSCRIBE: 'subscribe:delivery',
  UNSUBSCRIBE: 'unsubscribe:delivery',

  // Client -> Server (Restaurant Kitchen Outlet Channel)
  SUBSCRIBE_OUTLET: 'subscribe:outlet',
  UNSUBSCRIBE_OUTLET: 'unsubscribe:outlet',

  // Server -> Client
  SUBSCRIBED: 'delivery.subscribed',
  UNSUBSCRIBED: 'delivery.unsubscribed',
  OUTLET_SUBSCRIBED: 'outlet.subscribed',
  OUTLET_UNSUBSCRIBED: 'outlet.unsubscribed',
  ERROR: 'delivery.error',

  // Lifecycle Events (Server -> Client)
  RIDER_ASSIGNED: 'delivery.rider.assigned',
  STATUS_UPDATED: 'delivery.status.updated',
  LOCATION_UPDATED: 'delivery.location.updated',
  COMPLETED: 'delivery.completed',
  CANCELLED: 'delivery.cancelled',
  OFFER_CREATED: 'delivery.offer.created',

  // Restaurant Kitchen Notification Events
  ORDER_CREATED: 'order.created',
} as const;

export interface DeliveryOfferCreatedPayload {
  orderId: string;
  orderNumber: string;
  deliveryId: string;
  riderId: string;
  distanceMeters: number;
  offerExpiresAt: string;
  expiresInSeconds: number;
}

export interface SubscribeDeliveryPayload {
  orderId: string;
}

export interface SubscribeOutletPayload {
  outletId: string;
}

export interface OrderCreatedPayload {
  orderId: string;
  orderNumber: string;
  outletId: string;
  createdAt: string;
  itemCount: number;
  totalAmount: string;
  currency: string;
  status: 'placed';
  items?: Array<{
    name: string;
    quantity: number;
  }>;
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
