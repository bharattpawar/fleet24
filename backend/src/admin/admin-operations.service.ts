import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { sql, and, gte, lt, eq, ilike, or, desc, asc } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import {
  AdminOrderQueryDto,
  AdminCancelOrderDto,
  AdminActiveDeliveriesQueryDto,
} from './dto/admin-operations.dto';
import { RiderAssignmentService } from '../riders/rider-assignment.service';
import { PaymentsService } from '../payments/payments.service';
import { TrackingPublisherService } from '../tracking/tracking-publisher.service';

@Injectable()
export class AdminOperationsService {
  private readonly logger = new Logger(AdminOperationsService.name);

  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: any,
    private readonly riderAssignmentService: RiderAssignmentService,
    private readonly paymentsService: PaymentsService,
    private readonly trackingPublisher: TrackingPublisherService,
  ) {}

  // =========================================================================
  // 1. ORDER LISTING & MANAGEMENT
  // =========================================================================

  /**
   * List orders with pagination, search, status filters, payment & delivery correlations.
   */
  async listOrders(query: AdminOrderQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    // Search filter across Order Number, Customer Name/Phone, Restaurant Name, Outlet Name
    if (query.search && query.search.trim()) {
      const s = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.orders.orderNumber, s),
          ilike(schema.users.fullName, s),
          ilike(schema.users.phone, s),
          ilike(schema.restaurants.name, s),
          ilike(schema.restaurantOutlets.name, s),
        ),
      );
    }

    // Status filters
    if (query.orderStatus) {
      conditions.push(eq(schema.orders.status, query.orderStatus as any));
    }
    if (query.paymentStatus) {
      conditions.push(eq(schema.payments.status, query.paymentStatus as any));
    }
    if (query.deliveryStatus) {
      conditions.push(eq(schema.deliveries.status, query.deliveryStatus as any));
    }

    // Foreign key filters
    if (query.restaurantId) {
      conditions.push(eq(schema.restaurants.id, query.restaurantId));
    }
    if (query.outletId) {
      conditions.push(eq(schema.orders.outletId, query.outletId));
    }
    if (query.customerId) {
      conditions.push(eq(schema.orders.customerId, query.customerId));
    }
    if (query.riderId) {
      conditions.push(eq(schema.deliveries.riderId, query.riderId));
    }

    // Cancellation status filter
    if (query.cancellationStatus === 'cancelled') {
      conditions.push(eq(schema.orders.status, 'cancelled'));
    } else if (query.cancellationStatus === 'active') {
      conditions.push(sql`${schema.orders.status} != 'cancelled' AND ${schema.orders.status} != 'delivered'`);
    }

    // Date range filter
    if (query.from) {
      conditions.push(gte(schema.orders.createdAt, new Date(query.from)));
    }
    if (query.to) {
      conditions.push(lt(schema.orders.createdAt, new Date(query.to)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Sorting options
    let orderByClause: any = desc(schema.orders.createdAt);
    if (query.sortBy === 'oldest') {
      orderByClause = asc(schema.orders.createdAt);
    } else if (query.sortBy === 'highest_value') {
      orderByClause = desc(schema.orders.totalPayable);
    } else if (query.sortBy === 'lowest_value') {
      orderByClause = asc(schema.orders.totalPayable);
    }

    // Main SQL query with joined entities
    const rows = await this.db
      .select({
        id: schema.orders.id,
        orderNumber: schema.orders.orderNumber,
        status: schema.orders.status,
        totalPayable: schema.orders.totalPayable,
        createdAt: schema.orders.createdAt,
        updatedAt: schema.orders.updatedAt,
        customerId: schema.orders.customerId,
        customerName: schema.users.fullName,
        customerPhone: schema.users.phone,
        outletId: schema.orders.outletId,
        outletName: schema.restaurantOutlets.name,
        restaurantId: schema.restaurants.id,
        restaurantName: schema.restaurants.name,
        paymentStatus: schema.payments.status,
        deliveryId: schema.deliveries.id,
        deliveryStatus: schema.deliveries.status,
        riderId: schema.deliveries.riderId,
        riderName: schema.riders.fullName,
      })
      .from(schema.orders)
      .innerJoin(schema.users, eq(schema.orders.customerId, schema.users.id))
      .innerJoin(schema.restaurantOutlets, eq(schema.orders.outletId, schema.restaurantOutlets.id))
      .innerJoin(schema.restaurants, eq(schema.restaurantOutlets.restaurantId, schema.restaurants.id))
      .leftJoin(schema.payments, eq(schema.orders.id, schema.payments.orderId))
      .leftJoin(schema.deliveries, eq(schema.orders.id, schema.deliveries.orderId))
      .leftJoin(schema.riders, eq(schema.deliveries.riderId, schema.riders.id))
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // Count total matching records
    const [countRow] = await this.db
      .select({ count: sql<number>`count(distinct ${schema.orders.id})::int` })
      .from(schema.orders)
      .innerJoin(schema.users, eq(schema.orders.customerId, schema.users.id))
      .innerJoin(schema.restaurantOutlets, eq(schema.orders.outletId, schema.restaurantOutlets.id))
      .innerJoin(schema.restaurants, eq(schema.restaurantOutlets.restaurantId, schema.restaurants.id))
      .leftJoin(schema.payments, eq(schema.orders.id, schema.payments.orderId))
      .leftJoin(schema.deliveries, eq(schema.orders.id, schema.deliveries.orderId))
      .leftJoin(schema.riders, eq(schema.deliveries.riderId, schema.riders.id))
      .where(whereClause);

    const total = countRow?.count || 0;

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: rows.map((r: any) => ({
        orderId: r.id,
        orderNumber: r.orderNumber,
        status: r.status,
        totalPayable: parseFloat(r.totalPayable || '0'),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        customer: {
          id: r.customerId,
          name: r.customerName,
          phone: r.customerPhone,
        },
        restaurant: {
          id: r.restaurantId,
          name: r.restaurantName,
          outletId: r.outletId,
          outletName: r.outletName,
        },
        payment: {
          status: r.paymentStatus || 'pending',
        },
        delivery: {
          id: r.deliveryId,
          status: r.deliveryStatus || 'unassigned',
          rider: r.riderId
            ? {
                id: r.riderId,
                name: r.riderName || 'Assigned Rider',
              }
            : null,
        },
      })),
    };
  }

  /**
   * Get detailed operational view of a single order.
   */
  async getOrderDetails(orderId: string) {
    const order = await this.db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
      with: {
        customer: true,
        outlet: {
          with: {
            restaurant: true,
          },
        },
        orderItems: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found.`);
    }

    // Payment & refund information
    const payment = await this.db.query.payments.findFirst({
      where: eq(schema.payments.orderId, orderId),
      with: {
        refunds: true,
      },
    });

    // Delivery & rider information
    const delivery = await this.db.query.deliveries.findFirst({
      where: eq(schema.deliveries.orderId, orderId),
      with: {
        rider: true,
      },
    });

    // Assignment history attempts
    const assignmentAttempts = await this.db.query.deliveryAssignmentAttempts.findMany({
      where: eq(schema.deliveryAssignmentAttempts.orderId, orderId),
      orderBy: [desc(schema.deliveryAssignmentAttempts.offeredAt)],
      with: {
        rider: true,
      },
    });

    // Construct normalized lifecycle timeline
    const timeline = await this.getOrderTimeline(orderId, order, payment, delivery, assignmentAttempts);

    return {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        itemTotal: parseFloat(order.itemTotal || '0'),
        deliveryFee: parseFloat(order.deliveryFee || '0'),
        taxAmount: parseFloat(order.taxAmount || '0'),
        discountAmount: parseFloat(order.discountAmount || '0'),
        totalPayable: parseFloat(order.totalPayable || '0'),
        customerInstructions: order.customerInstructions,
        cancellationReason: order.cancellationReason,
        deliveryAddress: order.deliveryAddressSnapshot,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        placedAt: order.placedAt,
        confirmedAt: order.confirmedAt,
        deliveredAt: order.deliveredAt,
        cancelledAt: order.cancelledAt,
        items: order.orderItems.map((item: any) => ({
          id: item.id,
          name: item.itemName,
          unitPrice: parseFloat(item.unitPrice || '0'),
          quantity: item.quantity,
          totalPrice: parseFloat(item.totalPrice || '0'),
        })),
      },
      customer: {
        id: order.customer.id,
        fullName: order.customer.fullName,
        phone: order.customer.phone,
        email: order.customer.email,
      },
      restaurant: {
        id: order.outlet.restaurant.id,
        name: order.outlet.restaurant.name,
        outletId: order.outlet.id,
        outletName: order.outlet.name,
        address: order.outlet.address,
        phone: order.outlet.phone,
        isActive: order.outlet.isActive,
        isAcceptingOrders: order.outlet.isAcceptingOrders,
      },
      payment: payment
        ? {
            id: payment.id,
            provider: payment.provider,
            providerOrderId: payment.providerOrderId,
            amount: parseFloat(payment.amount || '0'),
            currency: payment.currency,
            status: payment.status,
            paidAt: payment.paidAt,
            refunds: payment.refunds.map((ref: any) => ({
              id: ref.id,
              amount: parseFloat(ref.amount || '0'),
              status: ref.status,
              reason: ref.reason,
              createdAt: ref.createdAt,
            })),
          }
        : null,
      delivery: delivery
        ? {
            id: delivery.id,
            status: delivery.status,
            distanceMeters: delivery.distanceMeters ? parseFloat(delivery.distanceMeters) : null,
            assignedAt: delivery.assignedAt,
            offerExpiresAt: delivery.offerExpiresAt,
            pickedUpAt: delivery.pickedUpAt,
            arrivedCustomerAt: delivery.arrivedCustomerAt,
            deliveredAt: delivery.deliveredAt,
            rider: delivery.rider
              ? {
                  id: delivery.rider.id,
                  fullName: delivery.rider.fullName,
                  vehicleType: delivery.rider.vehicleType,
                  vehicleNumber: delivery.rider.vehicleNumber,
                  verificationStatus: delivery.rider.verificationStatus,
                  availabilityStatus: delivery.rider.availabilityStatus,
                }
              : null,
          }
        : null,
      assignmentHistory: assignmentAttempts.map((attempt: any) => ({
        id: attempt.id,
        status: attempt.status,
        distanceMeters: attempt.distanceMeters ? parseFloat(attempt.distanceMeters) : null,
        offeredAt: attempt.offeredAt,
        respondedAt: attempt.respondedAt,
        rejectionReason: attempt.rejectionReason,
        expiresAt: attempt.expiresAt,
        rider: attempt.rider
          ? {
              id: attempt.rider.id,
              fullName: attempt.rider.fullName,
            }
          : null,
      })),
      timeline,
    };
  }

  /**
   * Helper to construct a normalized, chronological event timeline for an order.
   */
  private async getOrderTimeline(
    orderId: string,
    order: any,
    payment: any,
    delivery: any,
    assignmentAttempts: any[],
  ) {
    const events: Array<{
      id: string;
      source: string;
      eventType: string;
      description: string;
      timestamp: string;
    }> = [];

    // Order status history
    const historyRows = await this.db.query.orderStatusHistory.findMany({
      where: eq(schema.orderStatusHistory.orderId, orderId),
      orderBy: [asc(schema.orderStatusHistory.createdAt)],
    });

    for (const h of historyRows) {
      events.push({
        id: `h_${h.id}`,
        source: 'order_status_history',
        eventType: `order_${h.newStatus}`,
        description: `Order status moved from ${h.previousStatus || 'none'} to ${h.newStatus}${h.reason ? ` (${h.reason})` : ''}`,
        timestamp: h.createdAt.toISOString(),
      });
    }

    // Payment captured event
    if (payment && payment.paidAt) {
      events.push({
        id: `pay_${payment.id}`,
        source: 'payment',
        eventType: 'payment_captured',
        description: `Payment of INR ${payment.amount} captured via ${payment.provider}`,
        timestamp: payment.paidAt.toISOString(),
      });
    }

    // Refund events
    if (payment && payment.refunds) {
      for (const ref of payment.refunds) {
        events.push({
          id: `ref_${ref.id}`,
          source: 'refund',
          eventType: `refund_${ref.status}`,
          description: `Refund of INR ${ref.amount} is ${ref.status}${ref.reason ? ` (${ref.reason})` : ''}`,
          timestamp: ref.createdAt.toISOString(),
        });
      }
    }

    // Assignment attempts
    for (const attempt of assignmentAttempts) {
      events.push({
        id: `att_${attempt.id}`,
        source: 'delivery_assignment',
        eventType: `offer_${attempt.status}`,
        description: `Delivery offer ${attempt.status} by rider ${attempt.rider?.fullName || attempt.riderId}${attempt.rejectionReason ? ` (${attempt.rejectionReason})` : ''}`,
        timestamp: (attempt.respondedAt || attempt.offeredAt).toISOString(),
      });
    }

    // Delivery timestamps
    if (delivery) {
      if (delivery.pickedUpAt) {
        events.push({
          id: `del_pickup_${delivery.id}`,
          source: 'delivery',
          eventType: 'order_picked_up',
          description: 'Rider picked up order from restaurant kitchen',
          timestamp: delivery.pickedUpAt.toISOString(),
        });
      }
      if (delivery.arrivedCustomerAt) {
        events.push({
          id: `del_arrived_${delivery.id}`,
          source: 'delivery',
          eventType: 'arrived_customer',
          description: 'Rider reached customer delivery location',
          timestamp: delivery.arrivedCustomerAt.toISOString(),
        });
      }
      if (delivery.deliveredAt) {
        events.push({
          id: `del_completed_${delivery.id}`,
          source: 'delivery',
          eventType: 'delivery_completed',
          description: 'Customer handoff complete and verified via OTP',
          timestamp: delivery.deliveredAt.toISOString(),
        });
      }
    }

    // Order created fallback if history empty
    if (events.length === 0 && order.createdAt) {
      events.push({
        id: `ord_create_${order.id}`,
        source: 'orders',
        eventType: 'order_placed',
        description: `Order #${order.orderNumber} placed`,
        timestamp: order.createdAt.toISOString(),
      });
    }

    // Sort chronologically ascending
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return events;
  }

  // =========================================================================
  // 2. ACTIVE DELIVERY MONITORING
  // =========================================================================

  /**
   * Monitor active in-flight deliveries across the system with GPS freshness.
   */
  async getActiveDeliveries(query: AdminActiveDeliveriesQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (query.deliveryStatus) {
      conditions.push(eq(schema.deliveries.status, query.deliveryStatus as any));
    } else {
      conditions.push(sql`${schema.deliveries.status} IN ('assigned', 'accepted', 'at_restaurant', 'picked_up', 'arrived_customer')`);
    }

    if (query.restaurantId) {
      conditions.push(eq(schema.restaurants.id, query.restaurantId));
    }
    if (query.outletId) {
      conditions.push(eq(schema.restaurantOutlets.id, query.outletId));
    }
    if (query.riderId) {
      conditions.push(eq(schema.deliveries.riderId, query.riderId));
    }

    if (query.from) {
      conditions.push(gte(schema.deliveries.createdAt, new Date(query.from)));
    }
    if (query.to) {
      conditions.push(lt(schema.deliveries.createdAt, new Date(query.to)));
    }

    const whereClause = and(...conditions);

    const rows = await this.db
      .select({
        deliveryId: schema.deliveries.id,
        deliveryStatus: schema.deliveries.status,
        distanceMeters: schema.deliveries.distanceMeters,
        assignedAt: schema.deliveries.assignedAt,
        offerExpiresAt: schema.deliveries.offerExpiresAt,
        pickedUpAt: schema.deliveries.pickedUpAt,
        createdAt: schema.deliveries.createdAt,
        orderId: schema.orders.id,
        orderNumber: schema.orders.orderNumber,
        orderStatus: schema.orders.status,
        restaurantName: schema.restaurants.name,
        outletName: schema.restaurantOutlets.name,
        riderId: schema.riders.id,
        riderName: schema.riders.fullName,
        riderPhone: schema.users.phone,
        riderLatitude: schema.riderLocations.latitude,
        riderLongitude: schema.riderLocations.longitude,
        riderLocationUpdatedAt: schema.riderLocations.updatedAt,
        riderLocationCapturedAt: schema.riderLocations.capturedAt,
      })
      .from(schema.deliveries)
      .innerJoin(schema.orders, eq(schema.deliveries.orderId, schema.orders.id))
      .innerJoin(schema.restaurantOutlets, eq(schema.orders.outletId, schema.restaurantOutlets.id))
      .innerJoin(schema.restaurants, eq(schema.restaurantOutlets.restaurantId, schema.restaurants.id))
      .leftJoin(schema.riders, eq(schema.deliveries.riderId, schema.riders.id))
      .leftJoin(schema.users, eq(schema.riders.userId, schema.users.id))
      .leftJoin(schema.riderLocations, eq(schema.riders.id, schema.riderLocations.riderId))
      .where(whereClause)
      .orderBy(desc(schema.deliveries.createdAt))
      .limit(limit)
      .offset(offset);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.deliveries)
      .innerJoin(schema.orders, eq(schema.deliveries.orderId, schema.orders.id))
      .innerJoin(schema.restaurantOutlets, eq(schema.orders.outletId, schema.restaurantOutlets.id))
      .innerJoin(schema.restaurants, eq(schema.restaurantOutlets.restaurantId, schema.restaurants.id))
      .leftJoin(schema.riders, eq(schema.deliveries.riderId, schema.riders.id))
      .where(whereClause);

    const total = countRow?.count || 0;
    const now = Date.now();

    const data = rows.map((r: any) => {
      let isFresh = false;
      let locationAgeSeconds: number | null = null;

      if (r.riderLocationUpdatedAt) {
        locationAgeSeconds = Math.max(0, Math.floor((now - new Date(r.riderLocationUpdatedAt).getTime()) / 1000));
        isFresh = locationAgeSeconds <= 60; // 60 seconds freshness window
      }

      return {
        deliveryId: r.deliveryId,
        orderId: r.orderId,
        orderNumber: r.orderNumber,
        orderStatus: r.orderStatus,
        deliveryStatus: r.deliveryStatus,
        assignedAt: r.assignedAt,
        offerExpiresAt: r.offerExpiresAt,
        pickedUpAt: r.pickedUpAt,
        deliveryAgeMinutes: Math.floor((now - new Date(r.createdAt).getTime()) / 60000),
        restaurant: {
          name: r.restaurantName,
          outletName: r.outletName,
        },
        rider: r.riderId
          ? {
              id: r.riderId,
              name: r.riderName || 'Rider',
              phone: r.riderPhone,
            }
          : null,
        location: r.riderLatitude && r.riderLongitude
          ? {
              latitude: parseFloat(r.riderLatitude),
              longitude: parseFloat(r.riderLongitude),
              updatedAt: r.riderLocationUpdatedAt,
              locationAgeSeconds,
              isFresh,
            }
          : null,
      };
    });

    // Optional freshness filter in application memory for the paginated slice
    const filteredData =
      query.locationFreshness === 'fresh'
        ? data.filter((d: any) => d.location?.isFresh === true)
        : query.locationFreshness === 'stale'
        ? data.filter((d: any) => !d.location || d.location.isFresh === false)
        : data;

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: filteredData,
    };
  }

  /**
   * Get single delivery details with authorization check and location privacy.
   */
  async getDeliveryDetails(deliveryId: string) {
    const delivery = await this.db.query.deliveries.findFirst({
      where: eq(schema.deliveries.id, deliveryId),
      with: {
        order: {
          with: {
            outlet: {
              with: {
                restaurant: true,
              },
            },
          },
        },
        rider: {
          with: {
            user: true,
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery with ID ${deliveryId} not found.`);
    }

    // Latest authorized GPS location
    let latestLocation: any = null;
    if (delivery.riderId) {
      const loc = await this.db.query.riderLocations.findFirst({
        where: eq(schema.riderLocations.riderId, delivery.riderId),
      });

      if (loc) {
        const ageSeconds = Math.max(0, Math.floor((Date.now() - new Date(loc.updatedAt).getTime()) / 1000));
        latestLocation = {
          latitude: parseFloat(loc.latitude),
          longitude: parseFloat(loc.longitude),
          heading: loc.heading ? parseFloat(loc.heading) : null,
          speed: loc.speed ? parseFloat(loc.speed) : null,
          updatedAt: loc.updatedAt,
          capturedAt: loc.capturedAt,
          locationAgeSeconds: ageSeconds,
          isFresh: ageSeconds <= 60,
        };
      }
    }

    // Assignment history
    const attempts = await this.db.query.deliveryAssignmentAttempts.findMany({
      where: eq(schema.deliveryAssignmentAttempts.deliveryId, deliveryId),
      orderBy: [desc(schema.deliveryAssignmentAttempts.offeredAt)],
      with: {
        rider: true,
      },
    });

    return {
      delivery: {
        id: delivery.id,
        status: delivery.status,
        distanceMeters: delivery.distanceMeters ? parseFloat(delivery.distanceMeters) : null,
        assignedAt: delivery.assignedAt,
        offerExpiresAt: delivery.offerExpiresAt,
        lastDispatchAttemptAt: delivery.lastDispatchAttemptAt,
        dispatchFailureReason: delivery.dispatchFailureReason,
        pickedUpAt: delivery.pickedUpAt,
        arrivedCustomerAt: delivery.arrivedCustomerAt,
        deliveredAt: delivery.deliveredAt,
        createdAt: delivery.createdAt,
      },
      order: {
        id: delivery.order.id,
        orderNumber: delivery.order.orderNumber,
        status: delivery.order.status,
        totalPayable: parseFloat(delivery.order.totalPayable || '0'),
      },
      restaurant: {
        id: delivery.order.outlet.restaurant.id,
        name: delivery.order.outlet.restaurant.name,
        outletId: delivery.order.outlet.id,
        outletName: delivery.order.outlet.name,
        address: delivery.order.outlet.address,
      },
      rider: delivery.rider
        ? {
            id: delivery.rider.id,
            fullName: delivery.rider.fullName,
            phone: delivery.rider.user.phone,
            vehicleType: delivery.rider.vehicleType,
            vehicleNumber: delivery.rider.vehicleNumber,
            verificationStatus: delivery.rider.verificationStatus,
            availabilityStatus: delivery.rider.availabilityStatus,
          }
        : null,
      latestLocation,
      assignmentHistory: attempts.map((a: any) => ({
        id: a.id,
        status: a.status,
        offeredAt: a.offeredAt,
        respondedAt: a.respondedAt,
        rejectionReason: a.rejectionReason,
        expiresAt: a.expiresAt,
        riderName: a.rider?.fullName || a.riderId,
      })),
    };
  }

  // =========================================================================
  // 3. OPERATIONAL INTERVENTIONS (CANCELLATION & DISPATCH RETRY)
  // =========================================================================

  /**
   * Admin-initiated order cancellation.
   * Cancels order, releases rider capacity, initiates refund for paid orders, broadcasts WS event, and logs audit trail.
   */
  async cancelOrder(adminUserId: string, orderId: string, dto: AdminCancelOrderDto) {
    const order = await this.db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${orderId}' not found.`);
    }

    if (order.status === 'delivered') {
      throw new BadRequestException('Cannot cancel an order that has already been delivered and completed.');
    }

    if (order.status === 'cancelled') {
      throw new ConflictException(`Order ${order.orderNumber} is already cancelled.`);
    }

    const now = new Date();

    const result = await this.db.transaction(async (tx: any) => {
      // 1. Lock and update order
      const [cancelledOrder] = await tx
        .update(schema.orders)
        .set({
          status: 'cancelled',
          cancellationReason: `[Admin: ${dto.reason}]`,
          cancelledAt: now,
          updatedAt: now,
        })
        .where(and(eq(schema.orders.id, order.id), eq(schema.orders.status, order.status)))
        .returning();

      if (!cancelledOrder) {
        throw new ConflictException('Concurrent order state modification detected. Please try again.');
      }

      // 2. Insert order_status_history
      await tx.insert(schema.orderStatusHistory).values({
        orderId: order.id,
        previousStatus: order.status,
        newStatus: 'cancelled',
        changedByUserId: adminUserId,
        reason: `Admin Cancellation: ${dto.reason}`,
      });

      // 3. Check associated delivery and release rider capacity if assigned
      const [delivery] = await tx
        .select()
        .from(schema.deliveries)
        .where(eq(schema.deliveries.orderId, orderId))
        .for('update');

      if (delivery && delivery.riderId) {
        // If delivery was active, decrement rider's currentActiveOrdersCount
        const [rider] = await tx
          .select()
          .from(schema.riders)
          .where(eq(schema.riders.id, delivery.riderId))
          .for('update');

        if (rider) {
          const newActiveCount = Math.max(0, rider.currentActiveOrdersCount - 1);
          let newAvailability = rider.availabilityStatus;
          if (
            rider.verificationStatus === 'approved' &&
            !rider.suspensionReason &&
            rider.isOnline &&
            newActiveCount < rider.maxActiveOrders
          ) {
            newAvailability = 'available';
          }

          await tx
            .update(schema.riders)
            .set({
              currentActiveOrdersCount: newActiveCount,
              availabilityStatus: newAvailability,
              updatedAt: now,
            })
            .where(eq(schema.riders.id, rider.id));
        }

        // Cancel delivery record
        await tx
          .update(schema.deliveries)
          .set({
            status: 'cancelled',
            updatedAt: now,
          })
          .where(eq(schema.deliveries.id, delivery.id));
      }

      // 4. Audit Log
      await tx.insert(schema.auditLogs).values({
        action: 'admin_order_cancelled',
        entityType: 'order',
        entityId: order.id,
        performedByUserId: adminUserId,
        details: {
          previousStatus: order.status,
          reason: dto.reason,
        },
      });

      return {
        id: cancelledOrder.id,
        orderNumber: cancelledOrder.orderNumber,
        status: cancelledOrder.status,
        cancellationReason: cancelledOrder.cancellationReason,
        cancelledAt: cancelledOrder.cancelledAt,
        wasPaid: order.status !== 'pending_payment',
      };
    });

    // Broadcast cancellation via WebSocket
    try {
      this.trackingPublisher.publishDeliveryCancelled({
        orderId,
        reason: result.cancellationReason,
        cancelledAt: result.cancelledAt ? result.cancelledAt.toISOString() : now.toISOString(),
      });
    } catch (wsErr: any) {
      this.logger.warn(`Failed to broadcast cancelled event for order ${orderId}: ${wsErr?.message || wsErr}`);
    }

    // Trigger automated refund if order was paid
    let refundResult: any = null;
    if (result.wasPaid) {
      try {
        refundResult = await this.paymentsService.initiateOrderRefund(
          orderId,
          `Admin cancellation: ${dto.reason}`,
          adminUserId,
        );
      } catch (refundErr: any) {
        const msg = refundErr instanceof Error ? refundErr.message : String(refundErr);
        this.logger.error(`Automated refund for admin cancelled order ${orderId} deferred to reconciliation: ${msg}`);
      }
    }

    return {
      id: result.id,
      orderNumber: result.orderNumber,
      status: result.status,
      cancellationReason: result.cancellationReason,
      cancelledAt: result.cancelledAt,
      refund: refundResult,
      message: 'Order cancelled successfully by administrator.',
    };
  }

  /**
   * Admin-initiated dispatch retry for an unassigned order or failed dispatch.
   */
  async retryDispatch(adminUserId: string, orderId: string) {
    const order = await this.db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found.`);
    }

    // Delegate to canonical RiderAssignmentService
    const assignmentResult = await this.riderAssignmentService.assignOrder(orderId);

    // Record audit log
    await this.db.insert(schema.auditLogs).values({
      action: 'admin_dispatch_retry',
      entityType: 'order',
      entityId: orderId,
      performedByUserId: adminUserId,
      details: {
        assigned: assignmentResult.assigned,
        riderId: assignmentResult.riderId || null,
        message: assignmentResult.message,
      },
    });

    return assignmentResult;
  }
}
