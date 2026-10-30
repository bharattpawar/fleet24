import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { CheckoutDto, CancelOrderDto, OrderPaginationDto } from './dto/order.dto';
import { CartService } from './cart.service';
import { isWithinDeliveryRadius } from '../common/utils/geo';
import { PaymentsService } from '../payments/payments.service';
import { TrackingPublisherService } from '../tracking/tracking-publisher.service';
import { FinancialSettingsService } from '../admin/financial-settings.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly cartService: CartService,
    private readonly paymentsService: PaymentsService,
    private readonly trackingPublisher: TrackingPublisherService,
    private readonly financialSettingsService: FinancialSettingsService,
  ) {}

  /**
   * Generates a unique human-friendly order number (e.g. FL-20261027-4821)
   */
  generateOrderNumber(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `FL-${dateStr}-${randomSuffix}`;
  }

  /**
   * Transactional Checkout Flow
   * Validates cart, outlet status, live prices, address ownership, creates immutable snapshots,
   * records pending payment, and empties cart.
   */
  async checkout(customerId: string, dto: CheckoutDto) {
    // 1. Check idempotency if key provided
    if (dto.idempotencyKey) {
      const existingOrder = await this.db.query.orders.findFirst({
        where: eq(schema.orders.idempotencyKey, dto.idempotencyKey),
        with: {
          items: true,
          outlet: true,
        },
      });

      if (existingOrder) {
        if (existingOrder.customerId !== customerId) {
          throw new ConflictException('Idempotency key collision.');
        }
        return existingOrder;
      }
    }

    // 2. Load and validate current cart with authoritative prices
    const cart = await this.cartService.getCart(customerId);

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Your cart is empty.');
    }

    if (!cart.isOutletOperational) {
      throw new BadRequestException(
        'This restaurant outlet is currently not accepting orders or is inactive.',
      );
    }

    // Check for any unavailable items
    const unavailableItem = cart.items.find((i) => !i.isAvailable);
    if (unavailableItem) {
      throw new BadRequestException(
        `Item '${unavailableItem.name}' is currently unavailable. Please update your cart.`,
      );
    }

    // 3. Validate customer delivery address
    const address = await this.db.query.customerAddresses.findFirst({
      where: and(
        eq(schema.customerAddresses.id, dto.deliveryAddressId),
        eq(schema.customerAddresses.userId, customerId),
      ),
    });

    if (!address) {
      throw new NotFoundException(
        'Delivery address not found or does not belong to your account.',
      );
    }

    // 4. Authoritative Delivery Radius Enforcement
    const outlet = await this.db.query.restaurantOutlets.findFirst({
      where: eq(schema.restaurantOutlets.id, cart.outletId),
    });

    if (!outlet) {
      throw new NotFoundException('Restaurant outlet not found.');
    }

    if (
      outlet.latitude == null ||
      outlet.longitude == null ||
      outlet.latitude === '' ||
      outlet.longitude === ''
    ) {
      throw new BadRequestException(
        'Restaurant outlet location coordinates are not configured.',
      );
    }

    if (
      address.latitude == null ||
      address.longitude == null ||
      address.latitude === '' ||
      address.longitude === ''
    ) {
      throw new BadRequestException(
        'Selected delivery address is missing location coordinates.',
      );
    }

    let validatedDistanceKm = 0;
    try {
      const { isEligible, distanceKm } = isWithinDeliveryRadius(
        { latitude: outlet.latitude, longitude: outlet.longitude },
        { latitude: address.latitude, longitude: address.longitude },
        outlet.deliveryRadiusKm,
      );

      if (!isEligible) {
        this.logger.warn(
          `Checkout rejected: Address ${address.id} is ${distanceKm.toFixed(2)} km from outlet ${outlet.id} (max allowed: ${outlet.deliveryRadiusKm} km)`,
        );
        throw new BadRequestException(
          'This restaurant does not deliver to your selected address. Please choose another delivery address.',
        );
      }
      validatedDistanceKm = distanceKm;
    } catch (geoErr: unknown) {
      if (geoErr instanceof BadRequestException) {
        throw geoErr;
      }
      const msg = geoErr instanceof Error ? geoErr.message : 'Invalid location coordinates';
      throw new BadRequestException(`Delivery radius verification failed: ${msg}`);
    }

    // Frozen address snapshot
    const deliveryAddressSnapshot = {
      label: address.label,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      landmark: address.landmark,
      city: address.city,
      postalCode: address.postalCode,
      latitude: address.latitude,
      longitude: address.longitude,
    };

    const orderNumber = this.generateOrderNumber();

    // 5. Atomic Transaction for Order Creation with Row-Level Customer Locking
    return this.db.transaction(async (tx) => {
      // 5A. Lock customer row FOR UPDATE to eliminate concurrent checkout entitlement race conditions
      const [lockedCustomer] = await tx
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.id, customerId))
        .for('update');

      if (!lockedCustomer) {
        throw new NotFoundException('Customer account not found');
      }

      // 5B. Recalculate authoritative delivery fee under customer row lock
      const { settings } = await this.financialSettingsService.getActiveSettings();
      const cfg = settings.customerDeliveryFee;

      // Count prior eligible orders under lock (including active placed/confirmed orders)
      const eligibleStatuses = cfg.cancelledOrdersConsumeFreeQuota
        ? ['delivered', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'cancelled']
        : ['delivered', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery'];

      const [orderCountResult] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.customerId, customerId),
            inArray(schema.orders.status, eligibleStatuses as any),
          ),
        );

      const priorCount = orderCountResult?.count ?? 0;
      const feeResult = this.financialSettingsService.calculateCustomerDeliveryFee({
        settings,
        priorEligibleOrdersCount: priorCount,
        distanceKm: validatedDistanceKm,
      });

      const deliveryFee = feeResult.deliveryFee;
      const taxAmount = cart.taxAmount;
      const totalPayable = this.cartService.toMoney(cart.itemTotal + deliveryFee + taxAmount - cart.discountAmount);

      // Create master order
      const [order] = await tx
        .insert(schema.orders)
        .values({
          orderNumber,
          customerId,
          outletId: cart.outletId,
          status: 'pending_payment',
          itemTotal: cart.itemTotal.toFixed(2),
          deliveryFee: deliveryFee.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          discountAmount: cart.discountAmount.toFixed(2),
          totalPayable: totalPayable.toFixed(2),
          deliveryAddressSnapshot,
          deliveryLatitude: address.latitude,
          deliveryLongitude: address.longitude,
          customerInstructions: dto.customerInstructions || null,
          idempotencyKey: dto.idempotencyKey || null,
          placedAt: new Date(),
        })
        .returning();

      // Create frozen order item snapshots
      for (const item of cart.items) {
        await tx.insert(schema.orderItems).values({
          orderId: order.id,
          menuItemId: item.menuItemId,
          itemName: item.name,
          unitPrice: item.unitPrice.toFixed(2),
          quantity: item.quantity,
          totalPrice: item.totalPrice.toFixed(2),
        });
      }

      // Initial order status history
      await tx.insert(schema.orderStatusHistory).values({
        orderId: order.id,
        previousStatus: null,
        newStatus: 'pending_payment',
        changedByUserId: customerId,
        reason: 'Order placed by customer, awaiting payment',
      });

      // Prepare initial payment intent record (Prepaid pending payment)
      await tx.insert(schema.payments).values({
        orderId: order.id,
        provider: 'pending_gateway',
        amount: totalPayable.toFixed(2),
        currency: 'INR',
        status: 'pending',
        idempotencyKey: dto.idempotencyKey ? `pay_${dto.idempotencyKey}` : null,
      });

      // Clear customer's cart
      await tx
        .delete(schema.customerCarts)
        .where(eq(schema.customerCarts.customerId, customerId));

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        itemTotal: order.itemTotal,
        deliveryFee: order.deliveryFee,
        taxAmount: order.taxAmount,
        discountAmount: order.discountAmount,
        totalPayable: order.totalPayable,
        deliveryAddressSnapshot: order.deliveryAddressSnapshot,
        placedAt: order.placedAt,
        paymentStatus: 'pending',
        paymentInstructions: 'Prepaid order created. Awaiting payment gateway confirmation.',
      };
    });
  }

  /**
   * Retrieves order history for the authenticated customer
   */
  async listCustomerOrders(customerId: string, query: OrderPaginationDto) {
    const limit = query.limit || 20;
    const offset = ((query.page || 1) - 1) * limit;

    // Fetch orders with relations
    const customerOrders = await this.db.query.orders.findMany({
      where: eq(schema.orders.customerId, customerId),
      limit,
      offset,
      orderBy: [desc(schema.orders.createdAt)],
      with: {
        outlet: {
          with: {
            restaurant: true,
          },
        },
        items: true,
      },
    });

    // Fetch payments for these orders to attach refund details
    const orderIds = customerOrders.map((o) => o.id);
    const orderPayments =
      orderIds.length > 0
        ? await this.db.query.payments.findMany({
            where: inArray(schema.payments.orderId, orderIds),
            with: {
              refunds: true,
            },
          })
        : [];

    const paymentMap = new Map(orderPayments.map((p) => [p.orderId, p]));

    return {
      page: query.page,
      limit,
      orders: customerOrders.map((o) => {
        const payment = paymentMap.get(o.id);
        const latestRefund =
          payment?.refunds && payment.refunds.length > 0 ? payment.refunds[0] : null;

        return {
          id: o.id,
          orderNumber: o.orderNumber,
          restaurantName: o.outlet?.restaurant?.name || 'Restaurant',
          outletName: o.outlet?.name || 'Outlet',
          status: o.status,
          totalPayable: o.totalPayable,
          itemCount: o.items?.length || 0,
          createdAt: o.createdAt,
          paymentStatus: payment?.status || 'pending',
          refund: latestRefund
            ? {
                amount: latestRefund.amount,
                status: latestRefund.status,
                reason: latestRefund.reason,
                refundId: latestRefund.providerRefundId,
                createdAt: latestRefund.createdAt,
              }
            : null,
        };
      }),
    };
  }

  /**
   * Retrieves full details of a specific order
   */
  async getCustomerOrderDetails(customerId: string, orderId: string) {
    const order = await this.db.query.orders.findFirst({
      where: and(
        eq(schema.orders.id, orderId),
        eq(schema.orders.customerId, customerId),
      ),
      with: {
        outlet: {
          with: {
            restaurant: true,
          },
        },
        items: true,
        statusHistory: {
          orderBy: [desc(schema.orderStatusHistory.createdAt)],
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${orderId}' not found.`);
    }

    // Attach payment & refund details if available
    const payment = await this.db.query.payments.findFirst({
      where: eq(schema.payments.orderId, order.id),
      with: {
        refunds: true,
      },
    });

    return {
      ...order,
      payment: payment
        ? {
            id: payment.id,
            provider: payment.provider,
            amount: payment.amount,
            status: payment.status,
            paidAt: payment.paidAt,
            refunds: payment.refunds || [],
          }
        : null,
    };
  }

  /**
   * Customer Order Cancellation
   * Allowed only before preparation commences (in 'pending_payment' or 'placed' state).
   */
  async cancelOrder(customerId: string, orderId: string, dto: CancelOrderDto) {
    const order = await this.db.query.orders.findFirst({
      where: and(
        eq(schema.orders.id, orderId),
        eq(schema.orders.customerId, customerId),
      ),
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${orderId}' not found.`);
    }

    // Cancellation eligibility check
    const allowedStatuses: (typeof schema.orderStatusEnum.enumValues)[number][] = [
      'pending_payment',
      'placed',
    ];

    if (!allowedStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Order cannot be cancelled in its current state ('${order.status}'). Food preparation or delivery has commenced.`,
      );
    }

    const result = await this.db.transaction(async (tx) => {
      const [cancelledOrder] = await tx
        .update(schema.orders)
        .set({
          status: 'cancelled',
          cancellationReason: dto.reason || 'Cancelled by customer',
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(schema.orders.id, order.id), eq(schema.orders.status, order.status)))
        .returning();

      if (!cancelledOrder) {
        throw new ConflictException('Concurrent order state update detected. Please try again.');
      }

      await tx.insert(schema.orderStatusHistory).values({
        orderId: order.id,
        previousStatus: order.status,
        newStatus: 'cancelled',
        changedByUserId: customerId,
        reason: dto.reason || 'Cancelled by customer',
      });

      return {
        id: cancelledOrder.id,
        orderNumber: cancelledOrder.orderNumber,
        status: cancelledOrder.status,
        cancellationReason: cancelledOrder.cancellationReason,
        cancelledAt: cancelledOrder.cancelledAt,
        wasPaid: order.status === 'placed',
      };
    });

    // Broadcast delivery.cancelled WebSocket event
    try {
      this.trackingPublisher.publishDeliveryCancelled({
        orderId,
        reason: result.cancellationReason,
        cancelledAt: result.cancelledAt ? result.cancelledAt.toISOString() : new Date().toISOString(),
      });
    } catch (wsErr: any) {
      this.logger.warn(`Failed to broadcast cancelled event for order ${orderId}: ${wsErr?.message || wsErr}`);
    }

    // If order was in 'placed' status (paid), trigger automated refund
    if (result.wasPaid) {
      try {
        await this.paymentsService.initiateOrderRefund(
          orderId,
          result.cancellationReason || 'Customer requested order cancellation',
          customerId,
        );
      } catch (refundErr: any) {
        const msg = refundErr instanceof Error ? refundErr.message : String(refundErr);
        this.logger.error(
          `Failed to automatically trigger refund for cancelled order ${orderId}: ${msg}`,
        );
      }
    }

    return {
      id: result.id,
      orderNumber: result.orderNumber,
      status: result.status,
      cancellationReason: result.cancellationReason,
      cancelledAt: result.cancelledAt,
    };
  }
}
