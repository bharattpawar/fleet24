import {
  Optional,
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { isUsableLocation } from '../users/address-location.util';
import { ServiceZonesService } from '../service-zones/service-zones.service';
import { estimateDeliveryEta } from '../common/utils/delivery-eta';
import { calculateDistanceKm } from '../common/utils/geo';
import { CheckoutDto, CancelOrderDto, OrderPaginationDto } from './dto/order.dto';
import { CartService } from './cart.service';
import { PaymentsService } from '../payments/payments.service';
import { TrackingPublisherService } from '../tracking/tracking-publisher.service';
import { FinancialSettingsService } from '../admin/financial-settings.service';
import { RiderOffersService } from '../riders/rider-offers.service';
import { RoutingService } from '../routing/routing.service';

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
    private readonly riderOffersService: RiderOffersService,
    private readonly routingService: RoutingService,
    @Optional()
    private readonly serviceZones?: ServiceZonesService,
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
        return {
          id: existingOrder.id,
          orderNumber: existingOrder.orderNumber,
          status: existingOrder.status,
          itemTotal: existingOrder.itemTotal,
          deliveryFee: existingOrder.deliveryFee,
          taxAmount: existingOrder.taxAmount,
          discountAmount: existingOrder.discountAmount,
          totalPayable: existingOrder.totalPayable,
          deliveryAddressSnapshot: existingOrder.deliveryAddressSnapshot,
          placedAt: existingOrder.placedAt,
          items: existingOrder.items,
          outlet: existingOrder.outlet,
        };
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

    if (!isUsableLocation(address.latitude, address.longitude)) {
      throw new BadRequestException(
        'Please confirm this delivery address on the map before placing the order.',
      );
    }

    if (this.serviceZones) {
      await this.serviceZones.assertServiceable(
        address.latitude,
        address.longitude,
        "We don't deliver to this address yet. Fleet24 currently delivers only inside its service areas.",
      );
      await this.serviceZones.assertServiceable(
        outlet.latitude,
        outlet.longitude,
        'This restaurant is outside our current service areas and cannot take orders.',
      );
    }

    const outletLat = Number(outlet.latitude);
    const outletLon = Number(outlet.longitude);
    const destLat = Number(address.latitude);
    const destLon = Number(address.longitude);

    if (isNaN(outletLat) || isNaN(outletLon) || isNaN(destLat) || isNaN(destLon)) {
      throw new BadRequestException('Delivery radius verification failed: Invalid location coordinates');
    }

    let outletRadiusMeters: number | undefined;
    if (outlet.deliveryRadiusKm != null && outlet.deliveryRadiusKm !== '') {
      const parsedRadius =
        typeof outlet.deliveryRadiusKm === 'number'
          ? outlet.deliveryRadiusKm
          : parseFloat(outlet.deliveryRadiusKm);
      if (isNaN(parsedRadius) || !isFinite(parsedRadius) || parsedRadius <= 0) {
        throw new BadRequestException(
          `Delivery radius verification failed: Invalid configured delivery radius: '${outlet.deliveryRadiusKm}'.`,
        );
      }
      outletRadiusMeters = Math.round(parsedRadius * 1000);
    }

    // Resolve authoritative admin financial and serviceability settings
    const activeSettings = await this.financialSettingsService.getActiveSettings();
    const adminMaxRoadDistanceMeters =
      activeSettings.settings?.deliveryServiceability?.maxRoadDistanceMeters;

    // Option A: Active Admin road-distance limit is authoritative across platform (default 3000m).
    // Individual outlet deliveryRadiusKm cannot override the platform serviceability threshold.
    const maxRoadDistanceMeters = adminMaxRoadDistanceMeters ?? 3000;

    const maxDistanceKm = maxRoadDistanceMeters / 1000;

    // Stage 1: Fast Haversine straight-line pruning (mathematical lower bound: D_straight <= D_road)
    let straightLineKm = 0;
    try {
      straightLineKm = this.routingService.getStraightLineDistanceKm(
        { latitude: outletLat, longitude: outletLon },
        { latitude: destLat, longitude: destLon },
      );
    } catch (geoErr: unknown) {
      const msg = geoErr instanceof Error ? geoErr.message : 'Invalid location coordinates';
      throw new BadRequestException(`Delivery radius verification failed: ${msg}`);
    }

    if (straightLineKm > maxDistanceKm + 1e-6) {
      this.logger.warn(
        `Checkout rejected (Stage 1 straight-line): Address ${address.id} is ${straightLineKm.toFixed(2)} km from outlet ${outlet.id} (max allowed: ${maxDistanceKm.toFixed(1)} km)`,
      );
      throw new BadRequestException(
        'This restaurant does not deliver to your selected address. Please choose another delivery address.',
      );
    }

    // Stage 2: Authoritative Google Routes Road-Distance Verification
    let routeResult;
    try {
      routeResult = await this.routingService.getRoute({
        origin: { latitude: outletLat, longitude: outletLon },
        destination: { latitude: destLat, longitude: destLon },
      });
    } catch (routeErr: unknown) {
      this.logger.error(
        `Checkout routing request threw an unexpected error: ${routeErr instanceof Error ? routeErr.message : String(routeErr)}`,
      );
      throw new BadRequestException(
        'Unable to calculate delivery route to your address at this time. Please try again or choose another address.',
      );
    }

    if (routeResult.status !== 'OK' || routeResult.distanceMeters === null) {
      this.logger.error(
        `Checkout routing failed: status=${routeResult.status}, error=${routeResult.errorMessage}`,
      );
      throw new BadRequestException(
        'Unable to calculate delivery route to your address at this time. Please try again or choose another address.',
      );
    }

    if (routeResult.distanceMeters > maxRoadDistanceMeters) {
      this.logger.warn(
        `Checkout rejected (Stage 2 road distance): Address ${address.id} road distance is ${(routeResult.distanceMeters / 1000).toFixed(2)} km from outlet ${outlet.id} (max allowed: ${maxDistanceKm.toFixed(1)} km)`,
      );
      throw new BadRequestException(
        'This restaurant does not deliver to your selected address. Please choose another delivery address.',
      );
    }

    const validatedDistanceMeters = routeResult.distanceMeters;
    const validatedDistanceKm = validatedDistanceMeters / 1000;

    // Frozen immutable address & routing snapshot
    const deliveryAddressSnapshot = {
      label: address.label,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      landmark: address.landmark,
      city: address.city,
      postalCode: address.postalCode,
      latitude: address.latitude,
      longitude: address.longitude,
      roadDistanceMeters: validatedDistanceMeters,
      durationSeconds: routeResult.durationSeconds,
      // Delivery time promised at checkout, kept with the order so it does not change later.
      deliveryEta: estimateDeliveryEta({
        travelSeconds: routeResult.durationSeconds,
        straightLineMeters:
          calculateDistanceKm(outletLat, outletLon, Number(address.latitude), Number(address.longitude)) * 1000,
        settings: activeSettings.settings?.deliveryServiceability,
      }),
      policyVersionId: activeSettings.versionId,
      policyVersionNumber: activeSettings.versionNumber,
      routingProvider: routeResult.provider,
    };

    const orderNumber = this.generateOrderNumber();

    // 5. Atomic Transaction for Order Creation with Row-Level Customer Locking
    try {
      return await this.db.transaction(async (tx) => {
        // 5A. Lock customer row FOR UPDATE to eliminate concurrent checkout entitlement race conditions
        const [lockedCustomer] = await tx
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.id, customerId))
          .for('update');

        if (!lockedCustomer) {
          throw new NotFoundException('Customer account not found');
        }

        // 5B. Priority 2: Re-check idempotency key under the customer lock before processing cart
        if (dto.idempotencyKey) {
          const existingOrder = await tx.query.orders.findFirst({
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
            return {
              id: existingOrder.id,
              orderNumber: existingOrder.orderNumber,
              status: existingOrder.status,
              itemTotal: existingOrder.itemTotal,
              deliveryFee: existingOrder.deliveryFee,
              taxAmount: existingOrder.taxAmount,
              discountAmount: existingOrder.discountAmount,
              totalPayable: existingOrder.totalPayable,
              deliveryAddressSnapshot: existingOrder.deliveryAddressSnapshot,
              placedAt: existingOrder.placedAt,
              items: existingOrder.items,
              outlet: existingOrder.outlet,
              paymentStatus: 'pending',
              paymentInstructions: 'Prepaid order created. Awaiting payment gateway confirmation.',
            };
          }
        }

        // 5C. Authoritative Customer Concurrency Invariant: One Active Order Per Customer
        // A customer may only have one order occupying active fulfillment ('placed', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery').
        const [activeOrder] = await tx
          .select({
            id: schema.orders.id,
            orderNumber: schema.orders.orderNumber,
            status: schema.orders.status,
            placedAt: schema.orders.placedAt,
            totalPayable: schema.orders.totalPayable,
          })
          .from(schema.orders)
          .where(
            and(
              eq(schema.orders.customerId, customerId),
              inArray(schema.orders.status, [...schema.ACTIVE_FULFILLMENT_ORDER_STATUSES]),
            ),
          )
          .limit(1);

        if (activeOrder) {
          throw new ConflictException({
            statusCode: HttpStatus.CONFLICT,
            error: 'Conflict',
            code: 'ACTIVE_ORDER_IN_PROGRESS',
            message: `You already have an active order #${activeOrder.orderNumber} (${activeOrder.status}). You can place another order once it is delivered or cancelled.`,
            activeOrder: {
              id: activeOrder.id,
              orderNumber: activeOrder.orderNumber,
              status: activeOrder.status,
              placedAt: activeOrder.placedAt,
              totalPayable: activeOrder.totalPayable,
            },
          });
        }

        // 5D. Priority 1: Re-read authoritative cart state using transactional connection
        // Detects when the cart has already been consumed by another concurrent checkout
        const txCart = await this.cartService.getCart(customerId, tx);
        if (!txCart || txCart.items.length === 0) {
          throw new BadRequestException('Your cart is empty or has already been checked out.');
        }

        if (!txCart.isOutletOperational) {
          throw new BadRequestException(
            'This restaurant outlet is currently not accepting orders or is inactive.',
          );
        }

        const unavailableItem = txCart.items.find((i) => !i.isAvailable);
        if (unavailableItem) {
          throw new BadRequestException(
            `Item '${unavailableItem.name}' is currently unavailable. Please update your cart.`,
          );
        }

        if (txCart.outletId !== cart.outletId) {
          throw new BadRequestException('Cart items have changed. Please review your cart.');
        }

        // 5D. Verify policy version consistency within the transaction boundary under shared lock
        // If an Admin published or scheduled a new policy version during the external Google call,
        // re-verify distance eligibility under the newly active policy using the transactional connection.
        const currentActiveSettings = await this.financialSettingsService.getActiveSettings(tx, {
          lock: 'for_share',
        });
        let effectiveSettings = activeSettings;

        if (currentActiveSettings.versionId !== activeSettings.versionId) {
          this.logger.warn(
            `Checkout detected concurrent policy version update: from ${activeSettings.versionId} (v${activeSettings.versionNumber}) to ${currentActiveSettings.versionId} (v${currentActiveSettings.versionNumber}). Re-evaluating eligibility.`,
          );

          const currentMaxRoadDistanceMeters =
            currentActiveSettings.settings?.deliveryServiceability?.maxRoadDistanceMeters ?? 3000;

          if (validatedDistanceMeters > currentMaxRoadDistanceMeters) {
            throw new BadRequestException(
              `Delivery settings have been updated and this address (${(validatedDistanceMeters / 1000).toFixed(1)} km) is no longer within the allowed delivery limit (${(currentMaxRoadDistanceMeters / 1000).toFixed(1)} km). Please choose another delivery address.`,
            );
          }

          effectiveSettings = currentActiveSettings;
          deliveryAddressSnapshot.policyVersionId = currentActiveSettings.versionId;
          deliveryAddressSnapshot.policyVersionNumber = currentActiveSettings.versionNumber;
        }

        // 5E. Recalculate authoritative delivery fee using effective settings under customer row lock
        const cfg = effectiveSettings.settings.customerDeliveryFee;

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
          settings: effectiveSettings.settings,
          priorEligibleOrdersCount: priorCount,
          distanceKm: validatedDistanceKm,
        });

        const deliveryFee = feeResult.deliveryFee;
        const taxAmount = txCart.taxAmount;
        const totalPayable = this.cartService.toMoney(
          txCart.itemTotal + deliveryFee + taxAmount - txCart.discountAmount,
        );

        // Create master order
        const [order] = await tx
          .insert(schema.orders)
          .values({
            orderNumber,
            customerId,
            outletId: txCart.outletId,
            status: 'pending_payment',
            itemTotal: txCart.itemTotal.toFixed(2),
            deliveryFee: deliveryFee.toFixed(2),
            taxAmount: taxAmount.toFixed(2),
            discountAmount: txCart.discountAmount.toFixed(2),
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
        for (const item of txCart.items) {
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
    } catch (err: any) {
      // Priority 2: Safely handle concurrent same-key idempotency collisions
      // If a concurrent transaction committed with the exact same idempotency key,
      // PostgreSQL throws 23505 (unique_violation) on orders_idempotency_key_idx.
      const rawKey = dto.idempotencyKey;
      const isIdempotencyKeyViolation =
        err?.code === '23505' &&
        !!rawKey &&
        ((typeof err?.detail === 'string' && err.detail.includes('idempotency_key')) ||
          (typeof err?.constraint === 'string' && err.constraint.includes('idempotency_key')) ||
          (typeof err?.message === 'string' && err.message.includes('idempotency_key')));

      if (isIdempotencyKeyViolation && rawKey) {
        this.logger.warn(
          `Idempotency collision caught on unique constraint for key ${rawKey}. Resolving committed order.`,
        );

        const existingOrder = await this.db.query.orders.findFirst({
          where: eq(schema.orders.idempotencyKey, rawKey),
          with: {
            items: true,
            outlet: true,
          },
        });

        if (existingOrder) {
          if (existingOrder.customerId !== customerId) {
            throw new ConflictException('Idempotency key collision.');
          }
          return {
            id: existingOrder.id,
            orderNumber: existingOrder.orderNumber,
            status: existingOrder.status,
            itemTotal: existingOrder.itemTotal,
            deliveryFee: existingOrder.deliveryFee,
            taxAmount: existingOrder.taxAmount,
            discountAmount: existingOrder.discountAmount,
            totalPayable: existingOrder.totalPayable,
            deliveryAddressSnapshot: existingOrder.deliveryAddressSnapshot,
            placedAt: existingOrder.placedAt,
            items: existingOrder.items,
            outlet: existingOrder.outlet,
            paymentStatus: 'pending',
            paymentInstructions: 'Prepaid order created. Awaiting payment gateway confirmation.',
          };
        }
      }

      throw err;
    }
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

      // Cleanup associated delivery and release rider capacity slot if assigned/accepted
      await this.riderOffersService.cleanupDeliveryForCancelledOrder(
        order.id,
        customerId,
        dto.reason || 'Cancelled by customer',
        tx,
      );

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

  /**
   * Retrieves the currently active fulfillment order for the customer, if any.
   * Active fulfillment orders are in status 'placed', 'confirmed', 'preparing', 'ready_for_pickup', or 'out_for_delivery'.
   */
  async getActiveCustomerOrder(customerId: string) {
    const activeOrder = await this.db.query.orders.findFirst({
      where: and(
        eq(schema.orders.customerId, customerId),
        inArray(schema.orders.status, [...schema.ACTIVE_FULFILLMENT_ORDER_STATUSES]),
      ),
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

    if (!activeOrder) {
      return {
        hasActiveOrder: false,
        activeOrder: null,
      };
    }

    return {
      hasActiveOrder: true,
      activeOrder: {
        id: activeOrder.id,
        orderNumber: activeOrder.orderNumber,
        status: activeOrder.status,
        placedAt: activeOrder.placedAt,
        totalPayable: activeOrder.totalPayable,
        itemTotal: activeOrder.itemTotal,
        deliveryFee: activeOrder.deliveryFee,
        restaurantName: activeOrder.outlet?.restaurant?.name || 'Restaurant',
        outletName: activeOrder.outlet?.name || 'Outlet',
        itemCount: activeOrder.items?.length || 0,
      },
    };
  }
}
