import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { AuthenticatedUserPayload } from '../auth/decorators/auth.decorators';
import {
  DELIVERY_WS_EVENTS,
  SubscribeDeliveryPayload,
  DeliveryLocationPayload,
  DeliveryRiderAssignedPayload,
  DeliveryStatusUpdatedPayload,
  DeliveryCompletedPayload,
  DeliveryCancelledPayload,
} from './tracking.constants';
import { RidersService } from '../riders/riders.service';

export interface AuthenticatedSocket extends Socket {
  user?: AuthenticatedUserPayload;
}

@Injectable()
@WebSocketGateway({
  namespace: '/tracking',
  cors: {
    origin: '*', // Dynamic origin matching also supported via cors options or socket handshake
    credentials: true,
  },
})
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(TrackingGateway.name);

  @WebSocketServer()
  server!: Server;

  /**
   * Tracks active throttled broadcasts per delivery { deliveryId: { lastBroadcastAt, lastLat, lastLng } }
   */
  private readonly broadcastThrottles = new Map<
    string,
    { lastBroadcastAt: number; lastLat: number; lastLng: number }
  >();

  /**
   * Minimum interval in milliseconds between location broadcasts to the same delivery room (e.g. 2000ms = 2s)
   */
  public static readonly MIN_BROADCAST_INTERVAL_MS = 2000;

  /**
   * Minimum movement in meters to trigger a broadcast if interval has not elapsed (e.g. 5 meters)
   */
  public static readonly MIN_MOVEMENT_METERS = 5;

  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => RidersService))
    private readonly ridersService: RidersService,
  ) {}

  /**
   * Room name convention for an order's delivery tracking
   */
  static getDeliveryRoom(orderId: string): string {
    return `delivery:${orderId}`;
  }

  /**
   * Authenticate socket during initial handshake.
   * Token can be supplied in socket.handshake.auth.token or Authorization header.
   */
  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
        client.handshake.query?.token;

      if (!token || typeof token !== 'string') {
        this.logger.warn(`[TrackingGateway] Connection rejected: Missing authentication token (socket: ${client.id})`);
        client.emit(DELIVERY_WS_EVENTS.ERROR, {
          code: 'UNAUTHENTICATED',
          message: 'Authentication token is required to establish connection',
        });
        client.disconnect(true);
        return;
      }

      const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
      const payload = await this.jwtService.verifyAsync<AuthenticatedUserPayload>(token, {
        secret,
      });

      if (!payload || !payload.userId || !Array.isArray(payload.roles)) {
        this.logger.warn(`[TrackingGateway] Connection rejected: Malformed JWT payload (socket: ${client.id})`);
        client.emit(DELIVERY_WS_EVENTS.ERROR, {
          code: 'INVALID_TOKEN',
          message: 'Token payload missing required identifiers',
        });
        client.disconnect(true);
        return;
      }

      // Attach verified user payload to the socket instance
      client.user = payload;
      this.logger.log(
        `[TrackingGateway] Socket connected: ${client.id} (user: ${payload.userId}, roles: ${payload.roles.join(',')})`,
      );
    } catch (err: any) {
      this.logger.warn(`[TrackingGateway] Connection rejected: ${err.message} (socket: ${client.id})`);
      client.emit(DELIVERY_WS_EVENTS.ERROR, {
        code: 'AUTHENTICATION_FAILED',
        message: 'Invalid or expired authentication token',
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.user) {
      this.logger.log(`[TrackingGateway] Socket disconnected: ${client.id} (user: ${client.user.userId})`);
    }
  }

  /**
   * Subscribe customer to real-time updates for their active order.
   * Enforces strict authorization and eligibility checks.
   */
  @SubscribeMessage(DELIVERY_WS_EVENTS.SUBSCRIBE)
  async handleSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SubscribeDeliveryPayload,
  ) {
    if (!client.user) {
      client.emit(DELIVERY_WS_EVENTS.ERROR, {
        code: 'UNAUTHENTICATED',
        message: 'Must authenticate before subscribing to delivery tracking',
      });
      return;
    }

    const { orderId } = data || {};
    if (!orderId || typeof orderId !== 'string') {
      client.emit(DELIVERY_WS_EVENTS.ERROR, {
        code: 'INVALID_ORDER_ID',
        message: 'Valid orderId is required to subscribe',
      });
      return;
    }

    // Role check: Only customers (order owners) can join tracking rooms
    if (!client.user.roles.includes('customer')) {
      client.emit(DELIVERY_WS_EVENTS.ERROR, {
        code: 'FORBIDDEN_ROLE',
        message: 'Only customers may subscribe to live order tracking',
        orderId,
      });
      return;
    }

    // Database verification: Verify order ownership and active delivery state
    const order = await this.db.query.orders.findFirst({
      where: and(
        eq(schema.orders.id, orderId),
        eq(schema.orders.customerId, client.user.userId),
      ),
    });

    if (!order) {
      client.emit(DELIVERY_WS_EVENTS.ERROR, {
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found or does not belong to you',
        orderId,
      });
      return;
    }

    // Retrieve associated delivery record
    const delivery = await this.db.query.deliveries.findFirst({
      where: eq(schema.deliveries.orderId, orderId),
    });

    if (!delivery) {
      client.emit(DELIVERY_WS_EVENTS.ERROR, {
        code: 'DELIVERY_UNASSIGNED',
        message: 'No delivery assignment exists for this order yet',
        orderId,
      });
      return;
    }

    // Check eligible tracking states:
    // assigned, accepted, at_restaurant, picked_up, arrived_customer
    const eligibleStatuses = ['assigned', 'accepted', 'at_restaurant', 'picked_up', 'arrived_customer'];
    if (!eligibleStatuses.includes(delivery.status)) {
      client.emit(DELIVERY_WS_EVENTS.ERROR, {
        code: 'DELIVERY_NOT_TRACKABLE',
        message: `Delivery in status '${delivery.status}' is not eligible for live tracking`,
        orderId,
      });
      return;
    }

    // Join room
    const room = TrackingGateway.getDeliveryRoom(orderId);
    await client.join(room);

    this.logger.log(
      `[TrackingGateway] User ${client.user.userId} joined room ${room} (delivery: ${delivery.id}, status: ${delivery.status})`,
    );

    client.emit(DELIVERY_WS_EVENTS.SUBSCRIBED, {
      orderId,
      deliveryId: delivery.id,
      deliveryStatus: delivery.status,
      room,
    });
  }

  /**
   * Unsubscribe from order tracking
   */
  @SubscribeMessage(DELIVERY_WS_EVENTS.UNSUBSCRIBE)
  async handleUnsubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SubscribeDeliveryPayload,
  ) {
    const { orderId } = data || {};
    if (orderId) {
      const room = TrackingGateway.getDeliveryRoom(orderId);
      await client.leave(room);
      client.emit(DELIVERY_WS_EVENTS.UNSUBSCRIBED, { orderId, room });
    }
  }

  // ================= BROADCASTING HELPERS =================

  /**
   * Broadcasts rider GPS location update to the active delivery room with throttling & freshness protection.
   */
  broadcastLocationUpdate(payload: DeliveryLocationPayload): boolean {
    if (!this.server) {
      return false;
    }

    const { orderId, deliveryId, latitude, longitude } = payload;
    const now = Date.now();

    // Throttling logic per deliveryId
    const throttle = this.broadcastThrottles.get(deliveryId);
    if (throttle) {
      const elapsed = now - throttle.lastBroadcastAt;
      const isMoved =
        Math.abs(throttle.lastLat - latitude) > 0.00005 ||
        Math.abs(throttle.lastLng - longitude) > 0.00005;

      // Suppress if too frequent and no significant movement
      if (elapsed < TrackingGateway.MIN_BROADCAST_INTERVAL_MS && !isMoved) {
        return false;
      }
    }

    // Update throttle record
    this.broadcastThrottles.set(deliveryId, {
      lastBroadcastAt: now,
      lastLat: latitude,
      lastLng: longitude,
    });

    const room = TrackingGateway.getDeliveryRoom(orderId);
    this.server.to(room).emit(DELIVERY_WS_EVENTS.LOCATION_UPDATED, payload);
    return true;
  }

  /**
   * Broadcasts rider assignment to the delivery room.
   */
  broadcastRiderAssigned(payload: DeliveryRiderAssignedPayload) {
    if (!this.server) return;
    const room = TrackingGateway.getDeliveryRoom(payload.orderId);
    this.server.to(room).emit(DELIVERY_WS_EVENTS.RIDER_ASSIGNED, payload);
  }

  /**
   * Broadcasts delivery status update (e.g. accepted, at_restaurant, picked_up, arrived_customer).
   */
  broadcastStatusUpdated(payload: DeliveryStatusUpdatedPayload) {
    if (!this.server) return;
    const room = TrackingGateway.getDeliveryRoom(payload.orderId);
    this.server.to(room).emit(DELIVERY_WS_EVENTS.STATUS_UPDATED, payload);
  }

  /**
   * Broadcasts delivery completed and kicks sockets out of the tracking room.
   */
  broadcastCompleted(payload: DeliveryCompletedPayload) {
    if (!this.server) return;
    const room = TrackingGateway.getDeliveryRoom(payload.orderId);
    this.server.to(room).emit(DELIVERY_WS_EVENTS.COMPLETED, payload);

    // Clean up throttling state
    this.broadcastThrottles.delete(payload.deliveryId);

    // Evict all sockets from this completed room to prevent stale eavesdropping
    this.server.in(room).socketsLeave(room);
  }

  /**
   * Broadcasts delivery cancellation and closes the tracking room.
   */
  broadcastCancelled(payload: DeliveryCancelledPayload) {
    if (!this.server) return;
    const room = TrackingGateway.getDeliveryRoom(payload.orderId);
    this.server.to(room).emit(DELIVERY_WS_EVENTS.CANCELLED, payload);

    if (payload.deliveryId) {
      this.broadcastThrottles.delete(payload.deliveryId);
    }

    this.server.in(room).socketsLeave(room);
  }
}
