import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, inArray, sql, gte, lte } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { getIstParts } from '../common/utils/ist-date.util';
import {
  RestaurantUpdatableStatus,
  UpdateRestaurantOrderStatusDto,
  RestaurantOrdersQueryDto,
} from './dto/restaurant-order.dto';
import { PaymentsService } from '../payments/payments.service';
import { RiderAssignmentService } from '../riders/rider-assignment.service';
import { RiderOffersService } from '../riders/rider-offers.service';

@Injectable()
export class RestaurantOrdersService {
  private readonly logger = new Logger(RestaurantOrdersService.name);

  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    @Inject(forwardRef(() => RiderAssignmentService))
    private readonly riderAssignmentService: RiderAssignmentService,
    @Inject(forwardRef(() => RiderOffersService))
    private readonly riderOffersService: RiderOffersService,
  ) {}

  /**
   * Helper to verify staff authorization over outlet(s).
   * Admins have access to all outlets.
   * Restaurant staff only have access to their assigned active outlets.
   */
  async getAuthorizedOutletIds(
    userId: string,
    roles: string[],
    requestedOutletId?: string,
  ): Promise<string[]> {
    // 1. Direct Restaurant Ownership: Outlets belonging to restaurants owned by user
    const ownedRestaurants = await this.db.query.restaurants.findMany({
      where: eq(schema.restaurants.ownerId, userId),
      with: {
        outlets: {
          columns: { id: true },
        },
      },
    });

    const ownedOutletIds = ownedRestaurants.flatMap((r) => r.outlets.map((o) => o.id));

    // 2. Active Staff Assignments
    const staffAssignments = await this.db.query.restaurantStaff.findMany({
      where: and(
        eq(schema.restaurantStaff.userId, userId),
        eq(schema.restaurantStaff.isActive, true),
      ),
      columns: { outletId: true },
    });

    const staffOutletIds = staffAssignments.map((s) => s.outletId);

    const combinedOutletIds = Array.from(new Set([...ownedOutletIds, ...staffOutletIds]));

    if (combinedOutletIds.length > 0) {
      if (requestedOutletId) {
        if (!combinedOutletIds.includes(requestedOutletId)) {
          throw new ForbiddenException(
            'You are not authorized to manage orders for this outlet.',
          );
        }
        return [requestedOutletId];
      }
      return combinedOutletIds;
    }

    // 3. Fallback for root admin if user possesses admin role
    if (roles.includes('admin')) {
      if (requestedOutletId) return [requestedOutletId];
      const allOutlets = await this.db.query.restaurantOutlets.findMany({
        columns: { id: true },
      });
      return allOutlets.map((o) => o.id);
    }

    throw new ForbiddenException(
      'Access denied. You are neither a registered restaurant owner nor assigned staff to any active outlet.',
    );
  }

  /**
   * List orders for authorized outlet(s)
   */
  async listOrdersForRestaurant(
    userId: string,
    roles: string[],
    query: RestaurantOrdersQueryDto,
  ) {
    const authorizedOutletIds = await this.getAuthorizedOutletIds(
      userId,
      roles,
      query.outletId,
    );

    if (authorizedOutletIds.length === 0) {
      return [];
    }

    const conditions = [inArray(schema.orders.outletId, authorizedOutletIds)];

    if (query.status) {
      conditions.push(
        eq(
          schema.orders.status,
          query.status as (typeof schema.orderStatusEnum.enumValues)[number],
        ),
      );
    }

    return this.db.query.orders.findMany({
      where: and(...conditions),
      orderBy: [desc(schema.orders.createdAt)],
      with: {
        items: true,
        outlet: true,
        customer: {
          columns: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
        statusHistory: {
          orderBy: [desc(schema.orderStatusHistory.createdAt)],
        },
      },
    });
  }

  /**
   * Get specific order details for authorized restaurant staff
   */
  async getOrderDetails(userId: string, roles: string[], orderId: string) {
    const order = await this.db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
      with: {
        items: true,
        outlet: true,
        customer: {
          columns: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
        statusHistory: {
          orderBy: [desc(schema.orderStatusHistory.createdAt)],
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order '${orderId}' not found.`);
    }

    // Verify outlet access
    await this.getAuthorizedOutletIds(userId, roles, order.outletId);

    return order;
  }

  /**
   * Validates state transition lifecycle for restaurants:
   * pending_payment -> (Must be paid before entering restaurant workflow)
   * placed -> confirmed | rejected
   * confirmed -> preparing
   * preparing -> ready_for_pickup
   * rejected / cancelled / ready_for_pickup -> No further restaurant transitions
   */
  validateStatusTransition(
    currentStatus: string,
    targetStatus: RestaurantUpdatableStatus,
  ) {
    // 1. Unpaid orders cannot be accepted or modified by restaurant
    if (currentStatus === 'pending_payment') {
      throw new BadRequestException(
        'Order is awaiting customer payment. Restaurants cannot accept unpaid orders.',
      );
    }

    // 2. Closed / Terminal states cannot be altered
    if (
      currentStatus === 'cancelled' ||
      currentStatus === 'rejected' ||
      currentStatus === 'delivered'
    ) {
      throw new BadRequestException(
        `Order is in terminal status '${currentStatus}' and cannot be updated.`,
      );
    }

    // 3. Strict lifecycle validation
    const allowedTransitions: Record<string, RestaurantUpdatableStatus[]> = {
      placed: [
        RestaurantUpdatableStatus.CONFIRMED,
        RestaurantUpdatableStatus.REJECTED,
      ],
      confirmed: [RestaurantUpdatableStatus.PREPARING],
      preparing: [RestaurantUpdatableStatus.READY_FOR_PICKUP],
    };

    const validTargets = allowedTransitions[currentStatus] || [];
    if (!validTargets.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid status transition from '${currentStatus}' to '${targetStatus}'.`,
      );
    }
  }

  /**
   * Updates order status with strict transaction isolation, audit logging,
   * idempotency on repeated identical requests, and authorization verification.
   */
  async updateOrderStatus(
    userId: string,
    roles: string[],
    orderId: string,
    dto: UpdateRestaurantOrderStatusDto,
  ) {
    const result = await this.db.transaction(async (tx) => {
      // 1. Lock the order row first: a customer cancel, admin cancel or a second kitchen device may be
      //    changing it right now, and the decision below must be made on the latest committed status.
      await tx
        .select({ id: schema.orders.id })
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId))
        .for('update');

      const order = await tx.query.orders.findFirst({
        where: eq(schema.orders.id, orderId),
        with: {
          outlet: true,
        },
      });

      if (!order) {
        throw new NotFoundException(`Order '${orderId}' not found.`);
      }

      // 2. Check authorization for this specific outlet
      await this.getAuthorizedOutletIds(userId, roles, order.outletId);

      // 3. Idempotency check: If already in target status, return cleanly without duplicating audit history
      if (order.status === dto.status) {
        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          previousStatus: order.status,
          currentStatus: order.status,
          updatedAt: order.updatedAt,
          reason: dto.reason || null,
          wasRejected: false,
          isDuplicate: true,
          message: `Order is already in status '${order.status}'.`,
        };
      }

      // 4. Validate lifecycle transition rules
      this.validateStatusTransition(order.status, dto.status);

      // 5. If rejecting, ensure reason is provided and note payment status
      let reasonText = dto.reason;
      if (dto.status === RestaurantUpdatableStatus.REJECTED) {
        if (!reasonText || reasonText.trim().length === 0) {
          reasonText = 'Rejected by restaurant kitchen';
        }
      } else {
        reasonText = reasonText || `Order transitioned to ${dto.status} by kitchen`;
      }

      // 6. Update master order status atomically
      const [updatedOrder] = await tx
        .update(schema.orders)
        .set({
          status: dto.status,
          updatedAt: new Date(),
        })
        .where(and(eq(schema.orders.id, orderId), eq(schema.orders.status, order.status)))
        .returning();

      if (!updatedOrder) {
        throw new ConflictException('This order was just updated by someone else. Refresh and try again.');
      }

      // 7. Insert status audit trail entry
      await tx.insert(schema.orderStatusHistory).values({
        orderId: order.id,
        previousStatus: order.status,
        newStatus: dto.status,
        changedByUserId: userId,
        reason: reasonText,
      });

      // 7A. If rejected by restaurant, clean up any associated delivery assignment and release rider capacity
      if (dto.status === RestaurantUpdatableStatus.REJECTED) {
        await this.riderOffersService.cleanupDeliveryForCancelledOrder(
          order.id,
          userId,
          reasonText,
          tx,
        );
      }

      this.logger.log(
        `Order ${order.orderNumber} transitioned from ${order.status} to ${dto.status} by user ${userId}`,
      );

      return {
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        previousStatus: order.status,
        currentStatus: updatedOrder.status,
        updatedAt: updatedOrder.updatedAt,
        reason: reasonText,
        wasRejected: dto.status === RestaurantUpdatableStatus.REJECTED,
        isDuplicate: false,
        message: undefined,
      };
    });

    if (result.isDuplicate) {
      return {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        previousStatus: result.previousStatus,
        currentStatus: result.currentStatus,
        message: result.message,
      };
    }

    // 8. Automated Refund Trigger for Rejected Orders (Outside long-running DB transaction)
    let refundResult: any = null;
    if (result.wasRejected) {
      try {
        refundResult = await this.paymentsService.initiateOrderRefund(
          orderId,
          result.reason || 'Rejected by restaurant kitchen',
          userId,
        );
      } catch (refundErr: any) {
        const msg = refundErr instanceof Error ? refundErr.message : String(refundErr);
        this.logger.error(
          `Failed to automatically trigger refund for rejected order ${orderId}: ${msg}`,
        );
      }
    }

    // 9. Automatic Rider Assignment Trigger for confirmed or ready_for_pickup orders
    // When restaurant kitchen confirms or marks order ready, trigger dispatch engine
    let assignmentResult: any = null;
    if (
      dto.status === RestaurantUpdatableStatus.CONFIRMED ||
      dto.status === RestaurantUpdatableStatus.READY_FOR_PICKUP
    ) {
      try {
        assignmentResult = await this.riderAssignmentService.assignOrder(orderId);
      } catch (dispatchErr: any) {
        const msg = dispatchErr instanceof Error ? dispatchErr.message : String(dispatchErr);
        this.logger.error(
          `Automatic rider assignment failed for order ${orderId}: ${msg}`,
        );
      }
    }

    return {
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      previousStatus: result.previousStatus,
      currentStatus: result.currentStatus,
      updatedAt: result.updatedAt,
      reason: result.reason,
      refund: refundResult,
      assignment: assignmentResult,
    };
  }

  /**
   * Operational dashboard overview for a specific authorized outlet.
   * Uses SQL aggregation to count active and completed orders for the current IST day.
   */
  async getOrdersOverview(
    userId: string,
    roles: string[],
    outletId: string,
  ) {
    // Verify outlet access
    await this.getAuthorizedOutletIds(userId, roles, outletId);

    // Calculate IST calendar day boundaries in UTC
    const istParts = getIstParts(new Date());
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const startOfDayUtc = new Date(
      Date.UTC(istParts.year, istParts.month - 1, istParts.day, 0, 0, 0, 0) -
        IST_OFFSET_MS,
    );
    const endOfDayUtc = new Date(
      Date.UTC(istParts.year, istParts.month - 1, istParts.day + 1, 0, 0, 0, 0) -
        IST_OFFSET_MS -
        1,
    );

    // 1. Aggregate status counts
    const statusCountsRaw = await this.db
      .select({
        status: schema.orders.status,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.orders)
      .where(eq(schema.orders.outletId, outletId))
      .groupBy(schema.orders.status);

    const countsMap: Record<string, number> = {};
    for (const row of statusCountsRaw) {
      countsMap[row.status] = row.count;
    }

    // 2. Count orders completed/delivered today in IST
    const [completedTodayResult] = await this.db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.outletId, outletId),
          eq(schema.orders.status, 'delivered'),
          gte(schema.orders.deliveredAt, startOfDayUtc),
          lte(schema.orders.deliveredAt, endOfDayUtc),
        ),
      );

    // 3. Fetch recent 5 orders for operational activity
    const recentOrders = await this.db.query.orders.findMany({
      where: eq(schema.orders.outletId, outletId),
      orderBy: [desc(schema.orders.createdAt)],
      limit: 5,
      with: {
        items: true,
        customer: {
          columns: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    return {
      outletId,
      timestamp: new Date().toISOString(),
      counts: {
        newOrders: countsMap['placed'] || 0,
        confirmed: countsMap['confirmed'] || 0,
        preparing: countsMap['preparing'] || 0,
        readyForPickup: countsMap['ready_for_pickup'] || 0,
        outForDelivery: countsMap['out_for_delivery'] || 0,
        completedToday: completedTodayResult?.count || 0,
      },
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        itemTotal: o.itemTotal,
        totalPayable: o.totalPayable,
        itemCount: o.items.reduce((acc, it) => acc + it.quantity, 0),
        itemsSummary: o.items.map((it) => `${it.quantity}x ${it.itemName}`).join(', '),
        customerName: o.customer?.fullName || 'Customer',
        createdAt: o.createdAt,
      })),
    };
  }
}
