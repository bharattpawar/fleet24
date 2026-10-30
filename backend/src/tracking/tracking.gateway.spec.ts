import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TrackingGateway, AuthenticatedSocket } from './tracking.gateway';
import { TrackingPublisherService } from './tracking-publisher.service';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import { RidersService } from '../riders/riders.service';
import { DELIVERY_WS_EVENTS } from './tracking.constants';

describe('TrackingGateway & TrackingPublisherService', () => {
  let gateway: TrackingGateway;
  let publisher: TrackingPublisherService;
  let mockDb: any;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockRidersService: any;
  let mockServer: any;

  beforeEach(async () => {
    mockDb = {
      query: {
        orders: {
          findFirst: jest.fn(),
        },
        deliveries: {
          findFirst: jest.fn(),
        },
      },
    };

    mockJwtService = {
      verifyAsync: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('jwt-secret-key'),
    };

    mockRidersService = {
      calculateLocationFreshness: jest.fn().mockReturnValue({ freshness: 'fresh', ageSeconds: 10 }),
    };

    mockServer = {
      to: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      socketsLeave: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackingGateway,
        TrackingPublisherService,
        { provide: DRIZZLE_CONNECTION, useValue: mockDb },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RidersService, useValue: mockRidersService },
      ],
    }).compile();

    gateway = module.get<TrackingGateway>(TrackingGateway);
    publisher = module.get<TrackingPublisherService>(TrackingPublisherService);
    gateway.server = mockServer as any;
  });

  describe('WebSocket Authentication (handleConnection)', () => {
    it('accepts valid JWT and sets user payload', async () => {
      const mockSocket: Partial<AuthenticatedSocket> = {
        id: 'socket-123',
        handshake: {
          auth: { token: 'valid-jwt-token' },
          headers: {},
        } as any,
        emit: jest.fn(),
        disconnect: jest.fn(),
      };

      mockJwtService.verifyAsync.mockResolvedValueOnce({
        userId: 'user-customer-1',
        sessionId: 'session-1',
        roles: ['customer'],
      });

      await gateway.handleConnection(mockSocket as AuthenticatedSocket);

      expect(mockSocket.user).toBeDefined();
      expect(mockSocket.user?.userId).toBe('user-customer-1');
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });

    it('rejects connection when token is missing', async () => {
      const mockSocket: Partial<AuthenticatedSocket> = {
        id: 'socket-456',
        handshake: {
          auth: {},
          headers: {},
        } as any,
        emit: jest.fn(),
        disconnect: jest.fn(),
      };

      await gateway.handleConnection(mockSocket as AuthenticatedSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        DELIVERY_WS_EVENTS.ERROR,
        expect.objectContaining({ code: 'UNAUTHENTICATED' }),
      );
      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });

    it('rejects connection when JWT verification fails', async () => {
      const mockSocket: Partial<AuthenticatedSocket> = {
        id: 'socket-789',
        handshake: {
          auth: { token: 'expired-or-tampered-token' },
          headers: {},
        } as any,
        emit: jest.fn(),
        disconnect: jest.fn(),
      };

      mockJwtService.verifyAsync.mockRejectedValueOnce(new Error('jwt expired'));

      await gateway.handleConnection(mockSocket as AuthenticatedSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        DELIVERY_WS_EVENTS.ERROR,
        expect.objectContaining({ code: 'AUTHENTICATION_FAILED' }),
      );
      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('Subscription Authorization (handleSubscribe)', () => {
    it('allows customer to subscribe to their own active delivery', async () => {
      const mockSocket: Partial<AuthenticatedSocket> = {
        id: 'socket-123',
        user: {
          userId: 'customer-1',
          sessionId: 'session-1',
          phone: '+919999988888',
          roles: ['customer'],
        },
        join: jest.fn().mockResolvedValueOnce(undefined),
        emit: jest.fn(),
      };

      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: 'order-100',
        customerId: 'customer-1',
      });

      mockDb.query.deliveries.findFirst.mockResolvedValueOnce({
        id: 'delivery-200',
        orderId: 'order-100',
        status: 'out_for_delivery', // trackable status
      });

      // Need to test eligible statuses
      // Eligible: assigned, accepted, at_restaurant, picked_up, arrived_customer
      mockDb.query.deliveries.findFirst.mockReset();
      mockDb.query.deliveries.findFirst.mockResolvedValueOnce({
        id: 'delivery-200',
        orderId: 'order-100',
        status: 'picked_up',
      });

      await gateway.handleSubscribe(mockSocket as AuthenticatedSocket, { orderId: 'order-100' });

      expect(mockSocket.join).toHaveBeenCalledWith('delivery:order-100');
      expect(mockSocket.emit).toHaveBeenCalledWith(
        DELIVERY_WS_EVENTS.SUBSCRIBED,
        expect.objectContaining({
          orderId: 'order-100',
          deliveryId: 'delivery-200',
          deliveryStatus: 'picked_up',
        }),
      );
    });

    it('rejects subscription if client has rider role only', async () => {
      const mockSocket: Partial<AuthenticatedSocket> = {
        id: 'socket-rider',
        user: {
          userId: 'rider-user-1',
          sessionId: 'session-2',
          phone: '+919876543210',
          roles: ['rider'],
        },
        join: jest.fn(),
        emit: jest.fn(),
      };

      await gateway.handleSubscribe(mockSocket as AuthenticatedSocket, { orderId: 'order-100' });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        DELIVERY_WS_EVENTS.ERROR,
        expect.objectContaining({ code: 'FORBIDDEN_ROLE' }),
      );
      expect(mockSocket.join).not.toHaveBeenCalled();
    });

    it('rejects subscription if customer does not own the order', async () => {
      const mockSocket: Partial<AuthenticatedSocket> = {
        id: 'socket-wrong-customer',
        user: {
          userId: 'customer-attacker',
          sessionId: 'session-3',
          phone: '+919999900000',
          roles: ['customer'],
        },
        join: jest.fn(),
        emit: jest.fn(),
      };

      mockDb.query.orders.findFirst.mockResolvedValueOnce(null);

      await gateway.handleSubscribe(mockSocket as AuthenticatedSocket, { orderId: 'order-100' });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        DELIVERY_WS_EVENTS.ERROR,
        expect.objectContaining({ code: 'ORDER_NOT_FOUND' }),
      );
      expect(mockSocket.join).not.toHaveBeenCalled();
    });

    it('rejects subscription if delivery is in completed or terminal state', async () => {
      const mockSocket: Partial<AuthenticatedSocket> = {
        id: 'socket-customer',
        user: {
          userId: 'customer-1',
          sessionId: 'session-1',
          phone: '+919999988888',
          roles: ['customer'],
        },
        join: jest.fn(),
        emit: jest.fn(),
      };

      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: 'order-100',
        customerId: 'customer-1',
      });

      mockDb.query.deliveries.findFirst.mockResolvedValueOnce({
        id: 'delivery-200',
        orderId: 'order-100',
        status: 'completed',
      });

      await gateway.handleSubscribe(mockSocket as AuthenticatedSocket, { orderId: 'order-100' });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        DELIVERY_WS_EVENTS.ERROR,
        expect.objectContaining({ code: 'DELIVERY_NOT_TRACKABLE' }),
      );
      expect(mockSocket.join).not.toHaveBeenCalled();
    });
  });

  describe('Location Broadcasting and Throttling', () => {
    it('broadcasts location to delivery room and throttles rapid duplicates', () => {
      const locationPayload = {
        orderId: 'order-100',
        deliveryId: 'delivery-200',
        latitude: 28.5355,
        longitude: 77.3910,
        accuracy: 10,
        heading: 90,
        speed: 15,
        capturedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // First broadcast succeeds
      const firstResult = publisher.publishLocationUpdate(locationPayload);
      expect(firstResult).toBe(true);
      expect(mockServer.to).toHaveBeenCalledWith('delivery:order-100');
      expect(mockServer.emit).toHaveBeenCalledWith(
        DELIVERY_WS_EVENTS.LOCATION_UPDATED,
        locationPayload,
      );

      // Rapid identical broadcast within 2 seconds is throttled
      const secondResult = publisher.publishLocationUpdate(locationPayload);
      expect(secondResult).toBe(false);
    });
  });

  describe('Lifecycle Events Broadcasting', () => {
    it('broadcasts rider assignment', () => {
      publisher.publishRiderAssigned({
        orderId: 'order-100',
        deliveryId: 'delivery-200',
        rider: {
          id: 'rider-1',
          fullName: 'John Rider',
          vehicleType: 'motorcycle',
          vehicleNumber: 'KA-01-1234',
        },
        assignedAt: new Date().toISOString(),
      });

      expect(mockServer.to).toHaveBeenCalledWith('delivery:order-100');
      expect(mockServer.emit).toHaveBeenCalledWith(
        DELIVERY_WS_EVENTS.RIDER_ASSIGNED,
        expect.objectContaining({ orderId: 'order-100' }),
      );
    });

    it('broadcasts status update', () => {
      publisher.publishStatusUpdated({
        orderId: 'order-100',
        deliveryId: 'delivery-200',
        status: 'at_restaurant',
        orderStatus: 'preparing',
        updatedAt: new Date().toISOString(),
      });

      expect(mockServer.to).toHaveBeenCalledWith('delivery:order-100');
      expect(mockServer.emit).toHaveBeenCalledWith(
        DELIVERY_WS_EVENTS.STATUS_UPDATED,
        expect.objectContaining({ status: 'at_restaurant' }),
      );
    });

    it('broadcasts completion and clears room sockets', () => {
      publisher.publishDeliveryCompleted({
        orderId: 'order-100',
        deliveryId: 'delivery-200',
        completedAt: new Date().toISOString(),
        message: 'Delivered',
      });

      expect(mockServer.to).toHaveBeenCalledWith('delivery:order-100');
      expect(mockServer.emit).toHaveBeenCalledWith(
        DELIVERY_WS_EVENTS.COMPLETED,
        expect.objectContaining({ orderId: 'order-100' }),
      );
      expect(mockServer.in).toHaveBeenCalledWith('delivery:order-100');
      expect(mockServer.socketsLeave).toHaveBeenCalledWith('delivery:order-100');
    });

    it('broadcasts cancellation and clears room sockets', () => {
      publisher.publishDeliveryCancelled({
        orderId: 'order-100',
        deliveryId: 'delivery-200',
        reason: 'Customer cancelled',
        cancelledAt: new Date().toISOString(),
      });

      expect(mockServer.to).toHaveBeenCalledWith('delivery:order-100');
      expect(mockServer.emit).toHaveBeenCalledWith(
        DELIVERY_WS_EVENTS.CANCELLED,
        expect.objectContaining({ orderId: 'order-100' }),
      );
      expect(mockServer.in).toHaveBeenCalledWith('delivery:order-100');
      expect(mockServer.socketsLeave).toHaveBeenCalledWith('delivery:order-100');
    });
  });
});

