import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import { authStorage } from './storage';
import { DEV_LAN_IP, DEV_PORT } from './client';

/**
 * Derives the WebSocket base server URL matching client.ts environment detection:
 * - EXPO_PUBLIC_SOCKET_URL takes precedence in Staging & Production builds.
 * - Android Emulator: http://10.0.2.2:4000
 * - Web: http://localhost:4000
 * - iOS Device / Expo Go: http://172.20.10.2:4000
 */
export const WS_BASE_URL = (() => {
  if (process.env.EXPO_PUBLIC_SOCKET_URL) {
    return process.env.EXPO_PUBLIC_SOCKET_URL;
  }
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEV_PORT}`;
  }
  if (Platform.OS === 'web') {
    return `http://localhost:${DEV_PORT}`;
  }
  return `http://${DEV_LAN_IP}:${DEV_PORT}`;
})();

export const WS_TRACKING_NAMESPACE = '/tracking';

// WebSocket event definitions matching backend TrackingGateway
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

export interface DeliveryLocationEvent {
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

export interface DeliveryRiderAssignedEvent {
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

export interface DeliveryStatusUpdatedEvent {
  orderId: string;
  deliveryId: string;
  status: string;
  orderStatus: string;
  updatedAt: string;
  message?: string;
}

export interface DeliveryCompletedEvent {
  orderId: string;
  deliveryId: string;
  completedAt: string;
  message: string;
}

export interface DeliveryCancelledEvent {
  orderId: string;
  deliveryId?: string;
  reason?: string | null;
  cancelledAt: string;
}

export interface DeliveryErrorEvent {
  code: string;
  message: string;
  orderId?: string;
}

let socketInstance: Socket | null = null;
let isConnecting = false;

/**
 * Returns or initializes a shared singleton authenticated Socket.IO client instance
 * connected to the /tracking namespace.
 */
export async function getTrackingSocket(): Promise<Socket | null> {
  const token = await authStorage.getAccessToken();
  if (!token) {
    disconnectTrackingSocket();
    return null;
  }

  if (socketInstance && socketInstance.connected) {
    return socketInstance;
  }

  if (socketInstance && !socketInstance.connected && isConnecting) {
    return socketInstance;
  }

  if (socketInstance) {
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    socketInstance = null;
  }

  isConnecting = true;
  const fullWsUrl = `${WS_BASE_URL}${WS_TRACKING_NAMESPACE}`;

  socketInstance = io(fullWsUrl, {
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    auth: {
      token,
    },
    extraHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });

  socketInstance.on('connect', () => {
    isConnecting = false;
  });

  socketInstance.on('connect_error', () => {
    isConnecting = false;
  });

  socketInstance.on('disconnect', () => {
    isConnecting = false;
  });

  return socketInstance;
}

/**
 * Disconnects and cleans up the active tracking socket
 */
export function disconnectTrackingSocket() {
  if (socketInstance) {
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    socketInstance = null;
    isConnecting = false;
  }
}

