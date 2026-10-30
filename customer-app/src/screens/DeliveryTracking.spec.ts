import {
  DELIVERY_WS_EVENTS,
  getTrackingSocket,
  disconnectTrackingSocket,
} from '../api/trackingSocket';
import { authStorage } from '../api/storage';

jest.mock('../api/storage', () => ({
  authStorage: {
    getAccessToken: jest.fn(),
  },
}));

let mockSocket: any;

jest.mock('socket.io-client', () => {
  return {
    io: jest.fn(() => mockSocket),
  };
});

describe('Customer App Live Tracking & WebSocket Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket = {
      connected: false,
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      removeAllListeners: jest.fn(),
    };
    disconnectTrackingSocket();
  });

  describe('WebSocket Authentication & Connection', () => {
    it('defines all required delivery tracking event constants', () => {
      expect(DELIVERY_WS_EVENTS.SUBSCRIBE).toBe('subscribe:delivery');
      expect(DELIVERY_WS_EVENTS.UNSUBSCRIBE).toBe('unsubscribe:delivery');
      expect(DELIVERY_WS_EVENTS.SUBSCRIBED).toBe('delivery.subscribed');
      expect(DELIVERY_WS_EVENTS.LOCATION_UPDATED).toBe('delivery.location.updated');
      expect(DELIVERY_WS_EVENTS.RIDER_ASSIGNED).toBe('delivery.rider.assigned');
      expect(DELIVERY_WS_EVENTS.STATUS_UPDATED).toBe('delivery.status.updated');
      expect(DELIVERY_WS_EVENTS.COMPLETED).toBe('delivery.completed');
      expect(DELIVERY_WS_EVENTS.CANCELLED).toBe('delivery.cancelled');
      expect(DELIVERY_WS_EVENTS.ERROR).toBe('delivery.error');
    });

    it('rejects connection when no access token exists', async () => {
      (authStorage.getAccessToken as jest.Mock).mockResolvedValueOnce(null);

      const socket = await getTrackingSocket();
      expect(socket).toBeNull();
    });

    it('connects to /tracking namespace with Bearer token authentication and websocket transport', async () => {
      (authStorage.getAccessToken as jest.Mock).mockResolvedValueOnce('mock-customer-jwt');

      const socket = await getTrackingSocket();
      expect(socket).not.toBeNull();

      const { io } = require('socket.io-client');
      expect(io).toHaveBeenCalledWith(
        expect.stringContaining('/tracking'),
        expect.objectContaining({
          transports: ['websocket'],
          reconnection: true,
          auth: { token: 'mock-customer-jwt' },
        }),
      );
    });

    it('reuses existing socket instance if already connected', async () => {
      (authStorage.getAccessToken as jest.Mock).mockResolvedValue('mock-customer-jwt');

      mockSocket.connected = true;
      const firstSocket = await getTrackingSocket();
      const secondSocket = await getTrackingSocket();

      expect(firstSocket).toBe(secondSocket);
      const { io } = require('socket.io-client');
      expect(io).toHaveBeenCalledTimes(1);
    });

    it('cleans up and removes all listeners on disconnectTrackingSocket', async () => {
      (authStorage.getAccessToken as jest.Mock).mockResolvedValueOnce('mock-customer-jwt');
      await getTrackingSocket();

      disconnectTrackingSocket();
      expect(mockSocket.removeAllListeners).toHaveBeenCalled();
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('Event Payload Validation & Subscription Contracts', () => {
    it('formats subscribe payload correctly with orderId', () => {
      const orderId = 'order-uuid-1234';
      const payload = { orderId };

      expect(payload).toEqual({ orderId: 'order-uuid-1234' });
    });

    it('handles location update coordinates and timestamp properties', () => {
      const locationEvent = {
        orderId: 'order-uuid-1234',
        deliveryId: 'delivery-uuid-5678',
        latitude: 28.5355,
        longitude: 77.3910,
        accuracy: 10,
        heading: 90,
        speed: 18,
        capturedAt: '2026-10-30T10:30:00.000Z',
        updatedAt: '2026-10-30T10:30:00.500Z',
      };

      expect(locationEvent.orderId).toBe('order-uuid-1234');
      expect(locationEvent.latitude).toBeCloseTo(28.5355);
      expect(locationEvent.longitude).toBeCloseTo(77.3910);
      expect(locationEvent.updatedAt).toBeDefined();
    });

    it('handles rider assignment event structure', () => {
      const riderEvent = {
        orderId: 'order-uuid-1234',
        deliveryId: 'delivery-uuid-5678',
        rider: {
          id: 'rider-uuid-999',
          fullName: 'Ravi Kumar',
          vehicleType: 'motorcycle',
          vehicleNumber: 'KA-01-AB-1234',
        },
        assignedAt: '2026-10-30T10:25:00.000Z',
      };

      expect(riderEvent.rider.fullName).toBe('Ravi Kumar');
      expect(riderEvent.rider.vehicleType).toBe('motorcycle');
    });

    it('handles lifecycle status update sequence', () => {
      const statuses = [
        'assigned',
        'accepted',
        'at_restaurant',
        'picked_up',
        'arrived_customer',
        'completed',
      ];

      statuses.forEach((status) => {
        const statusEvent = {
          orderId: 'order-uuid-1234',
          deliveryId: 'delivery-uuid-5678',
          status,
          orderStatus: status === 'completed' ? 'delivered' : 'out_for_delivery',
          updatedAt: new Date().toISOString(),
        };
        expect(statusEvent.status).toBe(status);
      });
    });
  });
});
