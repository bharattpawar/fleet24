import { io, Socket } from 'socket.io-client';
import { authStorage } from './storage';
import { SOCKET_URL } from './client';

export const TRACKING_NAMESPACE = '/tracking';

export const RESTAURANT_WS_EVENTS = {
  SUBSCRIBE_OUTLET: 'subscribe:outlet',
  UNSUBSCRIBE_OUTLET: 'unsubscribe:outlet',
  OUTLET_SUBSCRIBED: 'outlet.subscribed',
  OUTLET_UNSUBSCRIBED: 'outlet.unsubscribed',
  ORDER_CREATED: 'order.created',
  STATUS_UPDATED: 'delivery.status.updated',
  ERROR: 'delivery.error',
} as const;

export interface OrderCreatedSocketPayload {
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

let socketInstance: Socket | null = null;
let currentConnectedToken: string | null = null;

/**
 * Returns or initializes a shared Socket.IO instance connected to the `/tracking` namespace.
 * Authenticates with the restaurant staff JWT token from SecureStore.
 */
export async function getRestaurantSocket(): Promise<Socket> {
  const token = await authStorage.getAccessToken();

  if (socketInstance && currentConnectedToken === token && socketInstance.connected) {
    return socketInstance;
  }

  // Disconnect previous instance if token changed
  if (socketInstance) {
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    socketInstance = null;
  }

  currentConnectedToken = token;

  socketInstance = io(`${SOCKET_URL}${TRACKING_NAMESPACE}`, {
    auth: {
      token: token || undefined,
    },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1500,
    timeout: 10000,
  });

  return socketInstance;
}

export function disconnectRestaurantSocket(): void {
  if (socketInstance) {
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    socketInstance = null;
    currentConnectedToken = null;
  }
}

