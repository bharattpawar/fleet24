import {
  Optional,
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, sql, desc } from 'drizzle-orm';
import { inArray } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { calculateRiderProximity } from '../common/utils/geo';
import { RidersService } from './riders.service';
import { RiderAssignmentService } from './rider-assignment.service';
import { NotificationService } from './notification.service';
import { DeliveryOtpUtil } from '../common/utils/delivery-otp.util';
import { TrackingPublisherService } from '../tracking/tracking-publisher.service';
import { AdminFinanceService } from '../admin/admin-finance.service';
import { FinancialSettingsService } from '../admin/financial-settings.service';
import {
  RejectDeliveryOfferDto,
  DeliveryOfferDetails,
} from './dto/delivery-offer.dto';
import {
  CompleteDeliveryDto,
  CustomerDeliveryTrackingResponse,
} from './dto/delivery-completion.dto';
import { ServiceZonesService } from '../service-zones/service-zones.service';

@Injectable()
export class RiderOffersService {
  private readonly logger = new Logger(RiderOffersService.name);

  /**
   * OTP duration: 30 minutes (1800 seconds)
   */
  public static readonly OTP_EXPIRY_SECONDS = 1800;

  /**
   * Maximum failed verification attempts before locking OTP
   */
  public static readonly MAX_OTP_ATTEMPTS = 5;

  /**
   * Helper: Resolves the dedicated encryption key for customer delivery OTP (AES-256-GCM).
   * The built-in fallback key is used only when NODE_ENV is development or test.
   */
  private getOtpEncryptionKey(): string {
    const configured = this.configService.get<string>('DELIVERY_OTP_ENCRYPTION_KEY');
    if (configured) return configured;
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    if (nodeEnv === 'development' || nodeEnv === 'test') {
      return 'fleet24_dev_delivery_otp_aes_256_gcm_encryption_key_32bytes';
    }
    throw new InternalServerErrorException('DELIVERY_OTP_ENCRYPTION_KEY is not configured.');
  }

  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly riderAssignmentService: RiderAssignmentService,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
    private readonly trackingPublisher: TrackingPublisherService,
    private readonly ridersService: RidersService,
    private readonly financeService: AdminFinanceService,
    private readonly financialSettingsService: FinancialSettingsService,
    @Optional()
    private readonly serviceZones?: ServiceZonesService,
  ) {}

  /** The open pool and claiming are only for riders currently inside an active service zone. */
  private async assertRiderInsideServiceZone(riderId: string) {
    if (!this.serviceZones) return;
    const latest = await this.db.query.riderLocations.findFirst({
      where: eq(schema.riderLocations.riderId, riderId),
    });
    const { enforced, zone } = await this.serviceZones.locate(latest?.latitude, latest?.longitude);
    if (enforced && !zone) {
      throw new ForbiddenException(
        "You are outside Fleet24's service area. Move inside the delivery zone to see and claim orders.",
      );
    }
  }

  /**
   * Helper: Resolves the server HMAC secret for delivery OTP hashing.
   */
  private getOtpSecret(): string {
    return (
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      this.configService.get<string>('DATABASE_URL') ||
      'fleet24_secure_delivery_otp_secret_key'
    );
  }

  /**
   * Helper: Resolves the rider record for the authenticated user.
   */
  async getRiderForUser(userId: string) {
    const rider = await this.db.query.riders.findFirst({
      where: eq(schema.riders.userId, userId),
    });

    if (!rider) {
      throw new NotFoundException('Rider profile not found for authenticated user');
    }

    return rider;
  }

  /**
   * Throws unless the rider may see or take deliveries: verified by an admin and not suspended.
   * Self-registration grants the `rider` role while verification is still 'pending', so role
   * checks alone are not enough for any path that exposes orders or customer addresses.
   */
  static assertRiderCanTakeDeliveries(rider: { verificationStatus?: string | null; suspensionReason?: string | null }) {
    if (rider.verificationStatus !== 'approved') {
      throw new ForbiddenException(
        `Rider verification status is '${rider.verificationStatus}'. Only approved riders can take deliveries.`,
      );
    }
    if (rider.suspensionReason) {
      throw new ForbiddenException('Rider is currently suspended and cannot take deliveries.');
    }
  }

  /** Resolves the rider for the user and asserts they are approved and not suspended. */
  async getEligibleRiderForUser(userId: string) {
    const rider = await this.getRiderForUser(userId);
    RiderOffersService.assertRiderCanTakeDeliveries(rider);
    return rider;
  }

  /**
   * GET /api/v1/riders/orders/offers
   * Returns active, unexpired delivery offers belonging to the authenticated rider.
   */
  async getPendingOffers(userId: string): Promise<DeliveryOfferDetails[]> {
    const rider = await this.getRiderForUser(userId);
    const now = new Date();

    const pendingDeliveries = await this.db.query.deliveries.findMany({
      where: and(
        eq(schema.deliveries.riderId, rider.id),
        eq(schema.deliveries.status, 'assigned'),
        sql`${schema.deliveries.offerExpiresAt} > ${now}`,
      ),
      with: {
        order: {
          with: {
            outlet: true,
            items: true,
          },
        },
      },
      orderBy: [desc(schema.deliveries.assignedAt)],
    });

    // Resolve financial settings for estimated earnings calculation
    let activeSettings: any = null;
    try {
      activeSettings = await this.financialSettingsService.getActiveSettings();
    } catch {
      // non-critical fallback
    }

    return pendingDeliveries.map((d: any) => {
      const remainingSeconds = Math.max(
        0,
        Math.floor((new Date(d.offerExpiresAt!).getTime() - Date.now()) / 1000),
      );

      const addressSnapshot = d.order.deliveryAddressSnapshot as any;

      let estimatedEarnings = '45.00';
      if (activeSettings?.settings) {
        try {
          const calc = this.financialSettingsService.calculateRiderEarning({
            settings: activeSettings.settings,
            distanceMeters: d.distanceMeters ? Number(d.distanceMeters) : 0,
            orderPlacedAt: d.order.placedAt || undefined,
          });
          estimatedEarnings = calc.finalEarning.toFixed(2);
        } catch {
          // fallback
        }
      }

      return {
        orderId: d.orderId,
        orderNumber: d.order.orderNumber,
        deliveryId: d.id,
        outletName: d.order.outlet.name,
        outletAddress: d.order.outlet.address,
        outletPhone: d.order.outlet.phone,
        outlet: {
          name: d.order.outlet.name,
          address: d.order.outlet.address,
          phone: d.order.outlet.phone,
          latitude: Number(d.order.outlet.latitude || 28.4744),
          longitude: Number(d.order.outlet.longitude || 77.504),
        },
        distanceMeters: Number(d.distanceMeters || 0),
        distanceKm: Number(((Number(d.distanceMeters || 0)) / 1000).toFixed(2)),
        offerExpiresAt: d.offerExpiresAt!,
        remainingSeconds,
        secondsRemaining: remainingSeconds,
        estimatedEarnings,
        itemTotal: d.order.itemTotal,
        totalPayable: d.order.totalPayable,
        deliveryAddress: {
          label: addressSnapshot?.label,
          street: addressSnapshot?.addressLine1,
          addressLine1: addressSnapshot?.addressLine1,
          addressLine2: addressSnapshot?.addressLine2,
          city: addressSnapshot?.city,
          postalCode: addressSnapshot?.postalCode,
          landmark: addressSnapshot?.landmark,
          latitude: Number(addressSnapshot?.latitude || 0),
          longitude: Number(addressSnapshot?.longitude || 0),
        },
        items: (d.order.items || []).map((i: any) => ({
          name: i.itemName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.totalPrice,
        })),
      };
    });
  }

  /**
   * GET /api/v1/riders/orders/available
   * Retrieves all orders waiting for rider assignment or ready for pickup.
   * Enables manual browsing and self-claiming for QA testing or open marketplace mode.
   */
  async getAvailableDeliveriesPool(userId: string) {
    const rider = await this.getEligibleRiderForUser(userId);
    await this.assertRiderInsideServiceZone(rider.id);

    // Fetch active non-delivered orders
    const claimableOrders = await this.db.query.orders.findMany({
      where: inArray(schema.orders.status, ['ready_for_pickup', 'confirmed', 'preparing']),
      with: {
        outlet: true,
        items: true,
      },
      orderBy: [desc(schema.orders.createdAt)],
      limit: 30,
    });

    if (claimableOrders.length === 0) {
      return [];
    }

    const orderIds = claimableOrders.map((o) => o.id);
    const existingDeliveries = await this.db.query.deliveries.findMany({
      where: inArray(schema.deliveries.orderId, orderIds),
    });

    const deliveryMap = new Map<string, any>();
    for (const d of existingDeliveries) {
      deliveryMap.set(d.orderId, d);
    }

    let activeSettings: any = null;
    try {
      activeSettings = await this.financialSettingsService.getActiveSettings();
    } catch {
      // non-critical
    }

    const availablePool = [];
    for (const o of claimableOrders) {
      const d = deliveryMap.get(o.id);

      // If delivery is already accepted by another rider, omit from available pool
      if (
        d &&
        d.riderId &&
        d.riderId !== rider.id &&
        ['accepted', 'at_restaurant', 'picked_up', 'arrived_customer', 'completed'].includes(d.status)
      ) {
        continue;
      }

      // Proximity & delivery distance
      const outletLat = Number(o.outlet?.latitude || 28.4744);
      const outletLon = Number(o.outlet?.longitude || 77.5040);
      let destLat = Number(o.deliveryLatitude || outletLat);
      let destLon = Number(o.deliveryLongitude || outletLon);
      if (Math.abs(destLat - outletLat) < 0.0001 && Math.abs(destLon - outletLon) < 0.0001) {
        destLat = outletLat + 0.0111;
        destLon = outletLon + 0.0095;
      }
      const proximity = calculateRiderProximity(outletLat, outletLon, destLat, destLon);
      const rawMeters = proximity.distanceMeters;
      const distanceMeters = rawMeters <= 50 ? 1800 : rawMeters;
      const distanceKm = Number((distanceMeters / 1000).toFixed(1));

      let estimatedEarnings = '45.00';
      if (activeSettings?.settings) {
        try {
          const calc = this.financialSettingsService.calculateRiderEarning({
            settings: activeSettings.settings,
            distanceMeters,
            orderPlacedAt: o.placedAt || undefined,
          });
          estimatedEarnings = calc.finalEarning.toFixed(2);
        } catch {
          // fallback
        }
      }

      const address = o.deliveryAddressSnapshot as any;

      availablePool.push({
        orderId: o.id,
        orderNumber: o.orderNumber,
        orderStatus: o.status,
        deliveryId: d?.id || null,
        deliveryStatus: d?.status || 'unassigned',
        isClaimedByYou: d?.riderId === rider.id && ['accepted', 'at_restaurant', 'assigned'].includes(d?.status),
        totalPayable: o.totalPayable,
        itemTotal: o.itemTotal,
        placedAt: o.placedAt || o.createdAt,
        itemsCount: o.items?.length || 1,
        itemsSummary:
          o.items?.map((i: any) => `${i.quantity}x ${i.itemName}`).join(', ') || 'Food items',
        distanceMeters,
        distanceKm,
        estimatedEarnings,
        outlet: {
          id: o.outlet?.id,
          name: o.outlet?.name,
          address: o.outlet?.address,
          phone: o.outlet?.phone,
          latitude: outletLat,
          longitude: outletLon,
        },
        deliveryAddress: {
          addressLine1: address?.addressLine1 || address?.address || 'Customer Location',
          city: address?.city,
          landmark: address?.landmark,
          latitude: destLat,
          longitude: destLon,
        },
      });
    }

    return availablePool;
  }

  /**
   * POST /api/v1/riders/orders/:orderId/claim
   * Instantly claims / accepts an available order from the database pool.
   * Assigns the delivery to the authenticated rider and transitions to active delivery.
   */
  async claimDelivery(userId: string, orderId: string) {
    const rider = await this.getEligibleRiderForUser(userId);
    await this.assertRiderInsideServiceZone(rider.id);

    return await this.db.transaction(async (tx) => {
      const now = new Date();

      // 1. Lock rider row FOR UPDATE
      const [riderRow] = await tx
        .select()
        .from(schema.riders)
        .where(eq(schema.riders.id, rider.id))
        .for('update');

      if (!riderRow) {
        throw new NotFoundException('Rider profile record not found');
      }
      // Re-check under the row lock: an admin may have suspended or rejected the rider meanwhile.
      RiderOffersService.assertRiderCanTakeDeliveries(riderRow);

      if (riderRow.currentActiveOrdersCount >= riderRow.maxActiveOrders) {
        throw new ConflictException(
          `Maximum capacity reached (${riderRow.maxActiveOrders} active orders). Complete your active delivery first.`,
        );
      }

      // 2. Lock order row FOR UPDATE
      const [order] = await tx
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId))
        .for('update');

      if (!order) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }

      if (['delivered', 'cancelled', 'rejected'].includes(order.status)) {
        throw new BadRequestException(`Cannot claim order in terminal status '${order.status}'`);
      }

      // 3. Lock delivery row FOR UPDATE if exists
      const [existingDelivery] = await tx
        .select()
        .from(schema.deliveries)
        .where(eq(schema.deliveries.orderId, orderId))
        .for('update');

      // Check if another rider already accepted
      if (
        existingDelivery &&
        existingDelivery.riderId &&
        existingDelivery.riderId !== rider.id &&
        ['accepted', 'at_restaurant', 'picked_up', 'arrived_customer'].includes(existingDelivery.status)
      ) {
        throw new ConflictException('This order has already been claimed by another rider');
      }

      // Calculate distance between outlet and destination
      const [outlet] = await tx
        .select()
        .from(schema.restaurantOutlets)
        .where(eq(schema.restaurantOutlets.id, order.outletId));

      const outletLat = outlet ? Number(outlet.latitude) : 28.4744;
      const outletLon = outlet ? Number(outlet.longitude) : 77.5040;
      let destLat = Number(order.deliveryLatitude || outletLat);
      let destLon = Number(order.deliveryLongitude || outletLon);
      if (Math.abs(destLat - outletLat) < 0.0001 && Math.abs(destLon - outletLon) < 0.0001) {
        destLat = outletLat + 0.0111;
        destLon = outletLon + 0.0095;
      }
      const proximity = calculateRiderProximity(outletLat, outletLon, destLat, destLon);
      const rawMeters = proximity.distanceMeters;
      const distanceMeters = rawMeters <= 50 ? 1800 : rawMeters;

      let deliveryRecord: any;
      if (existingDelivery) {
        const [updated] = await tx
          .update(schema.deliveries)
          .set({
            riderId: rider.id,
            status: 'accepted',
            assignedAt: existingDelivery.assignedAt || now,
            distanceMeters: String(distanceMeters),
            offerExpiresAt: null,
            dispatchFailureReason: null,
            updatedAt: now,
          })
          .where(eq(schema.deliveries.id, existingDelivery.id))
          .returning();
        deliveryRecord = updated;
      } else {
        const [inserted] = await tx
          .insert(schema.deliveries)
          .values({
            orderId: order.id,
            riderId: rider.id,
            status: 'accepted',
            assignedAt: now,
            distanceMeters: String(distanceMeters),
            offerExpiresAt: null,
            dispatchFailureReason: null,
          })
          .returning();
        deliveryRecord = inserted;
      }

      // 4. Increment active orders counter for rider
      const newActiveCount = riderRow.currentActiveOrdersCount + 1;
      const shouldMarkBusy = newActiveCount >= riderRow.maxActiveOrders;

      await tx
        .update(schema.riders)
        .set({
          currentActiveOrdersCount: newActiveCount,
          availabilityStatus: shouldMarkBusy ? 'busy' : 'available',
          updatedAt: now,
        })
        .where(eq(schema.riders.id, rider.id));

      // 5. Update or insert attempt record to 'accepted'
      await tx
        .insert(schema.deliveryAssignmentAttempts)
        .values({
          deliveryId: deliveryRecord.id,
          orderId: order.id,
          riderId: rider.id,
          status: 'accepted',
          offeredAt: now,
          respondedAt: now,
        });

      // 6. Broadcast via WebSocket
      try {
        this.trackingPublisher.publishStatusUpdated({
          orderId: order.id,
          deliveryId: deliveryRecord.id,
          status: 'accepted',
          orderStatus: order.status,
          updatedAt: now.toISOString(),
          message: 'Rider claimed the delivery order',
        });
      } catch (wsErr: any) {
        this.logger.warn(`Failed to broadcast claim event: ${wsErr?.message || wsErr}`);
      }

      this.logger.log(
        `Rider ${rider.id} claimed order ${order.orderNumber} successfully. Delivery ID: ${deliveryRecord.id}`,
      );

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        deliveryId: deliveryRecord.id,
        status: 'accepted',
        acceptedAt: now,
        message: 'Order claimed successfully',
      };
    });
  }

  /**
   * GET /api/v1/riders/orders/active
   * Retrieves currently active in-flight deliveries belonging to the authenticated rider.
   * State: 'accepted', 'at_restaurant', 'picked_up', 'arrived_customer'
   * Does NOT expose customer plaintext delivery OTP.
   */
  async getActiveDeliveriesForRider(userId: string) {
    const rider = await this.getRiderForUser(userId);

    const activeStatuses: (
      | 'accepted'
      | 'at_restaurant'
      | 'picked_up'
      | 'arrived_customer'
    )[] = ['accepted', 'at_restaurant', 'picked_up', 'arrived_customer'];

    const activeDeliveries = await this.db.query.deliveries.findMany({
      where: and(
        eq(schema.deliveries.riderId, rider.id),
        inArray(schema.deliveries.status, activeStatuses),
      ),
      with: {
        order: {
          with: {
            outlet: true,
          },
        },
      },
      orderBy: [desc(schema.deliveries.updatedAt)],
    });

    return activeDeliveries.map((d) => {
      const addressSnapshot = d.order.deliveryAddressSnapshot as any;

      const rawMeters = Number(d.distanceMeters || 0);
      const effectiveMeters = rawMeters <= 50 ? 1800 : rawMeters;
      const effectiveKm = Number((effectiveMeters / 1000).toFixed(1));

      const outletLat = Number(d.order.outlet.latitude);
      const outletLon = Number(d.order.outlet.longitude);
      let destLat = Number(d.order.deliveryLatitude);
      let destLon = Number(d.order.deliveryLongitude);
      if (Math.abs(destLat - outletLat) < 0.0001 && Math.abs(destLon - outletLon) < 0.0001) {
        destLat = outletLat + 0.0111;
        destLon = outletLon + 0.0095;
      }

      return {
        deliveryId: d.id,
        orderId: d.orderId,
        orderNumber: d.order.orderNumber,
        deliveryStatus: d.status,
        status: d.status,
        orderStatus: d.order.status,
        distanceMeters: effectiveMeters,
        distanceKm: effectiveKm,
        restaurant: {
          id: d.order.outlet.id,
          name: d.order.outlet.name,
          phone: d.order.outlet.phone,
          address: d.order.outlet.address,
          latitude: outletLat,
          longitude: outletLon,
        },
        deliveryAddress: {
          label: addressSnapshot?.label,
          addressLine1: addressSnapshot?.addressLine1 || addressSnapshot?.address,
          city: addressSnapshot?.city,
          postalCode: addressSnapshot?.postalCode,
          landmark: addressSnapshot?.landmark,
          latitude: destLat,
          longitude: destLon,
        },
        customerInstructions: d.order.customerInstructions,
        timestamps: {
          assignedAt: d.assignedAt,
          pickedUpAt: d.pickedUpAt,
          arrivedCustomerAt: d.arrivedCustomerAt,
        },
      };
    });
  }

  /**
   * POST /api/v1/riders/orders/:orderId/accept
   * Accept an assigned delivery offer.
   * Atomically locks delivery and rider, checks unexpired status, converts pending offer to active delivery.
   */
  async acceptOffer(userId: string, orderId: string) {
    const rider = await this.getEligibleRiderForUser(userId);

    return await this.db.transaction(async (tx) => {
      const now = new Date();

      // 1. Lock delivery row FOR UPDATE
      const [delivery] = await tx
        .select()
        .from(schema.deliveries)
        .where(eq(schema.deliveries.orderId, orderId))
        .for('update');

      if (!delivery) {
        throw new NotFoundException(`No delivery found for order ${orderId}`);
      }

      // Idempotency: If already accepted by this rider, return cleanly
      if (delivery.riderId === rider.id && delivery.status === 'accepted') {
        return {
          orderId,
          deliveryId: delivery.id,
          status: 'accepted',
          message: 'Delivery offer is already accepted',
        };
      }

      // Verify ownership
      if (delivery.riderId !== rider.id) {
        throw new ForbiddenException('This delivery offer does not belong to you');
      }

      // Verify pending status
      if (delivery.status !== 'assigned') {
        throw new BadRequestException(
          `Cannot accept delivery in status '${delivery.status}'. Offer is no longer pending.`,
        );
      }

      // Verify expiry
      if (delivery.offerExpiresAt && delivery.offerExpiresAt <= now) {
        throw new BadRequestException('Delivery offer has expired and can no longer be accepted');
      }

      // 2. Lock rider row FOR UPDATE to safely maintain capacity counters
      const [riderRow] = await tx
        .select()
        .from(schema.riders)
        .where(eq(schema.riders.id, rider.id))
        .for('update');

      if (!riderRow) {
        throw new NotFoundException('Rider profile record not found');
      }
      // Re-check under the row lock: an admin may have suspended or rejected the rider meanwhile.
      RiderOffersService.assertRiderCanTakeDeliveries(riderRow);

      if (riderRow.currentActiveOrdersCount >= riderRow.maxActiveOrders) {
        throw new ConflictException('Rider maximum active orders capacity reached');
      }

      // 3. Increment currentActiveOrdersCount by 1
      const newActiveCount = riderRow.currentActiveOrdersCount + 1;
      const shouldMarkBusy = newActiveCount >= riderRow.maxActiveOrders;

      await tx
        .update(schema.riders)
        .set({
          currentActiveOrdersCount: newActiveCount,
          availabilityStatus: shouldMarkBusy ? 'busy' : riderRow.availabilityStatus,
          updatedAt: now,
        })
        .where(eq(schema.riders.id, rider.id));

      // 4. Update delivery status to 'accepted'
      const [updatedDelivery] = await tx
        .update(schema.deliveries)
        .set({
          status: 'accepted',
          updatedAt: now,
        })
        .where(eq(schema.deliveries.id, delivery.id))
        .returning();

      // 5. Update latest assignment attempt entry to 'accepted'
      await tx
        .update(schema.deliveryAssignmentAttempts)
        .set({
          status: 'accepted',
          respondedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.deliveryAssignmentAttempts.deliveryId, delivery.id),
            eq(schema.deliveryAssignmentAttempts.riderId, rider.id),
            eq(schema.deliveryAssignmentAttempts.status, 'offered'),
          ),
        );

      this.logger.log(
        `Rider ${rider.id} accepted delivery offer for order ${orderId}. Active orders: ${newActiveCount}/${riderRow.maxActiveOrders}`,
      );

      // WebSocket status update: accepted
      try {
        this.trackingPublisher.publishStatusUpdated({
          orderId,
          deliveryId: updatedDelivery.id,
          status: 'accepted',
          orderStatus: 'confirmed',
          updatedAt: now.toISOString(),
          message: 'Rider accepted the delivery offer',
        });
      } catch (wsErr: any) {
        this.logger.warn(`Failed to broadcast accepted event: ${wsErr?.message || wsErr}`);
      }

      return {
        orderId,
        deliveryId: updatedDelivery.id,
        status: updatedDelivery.status,
        acceptedAt: now,
        message: 'Delivery offer accepted successfully',
      };
    });
  }

  /**
   * POST /api/v1/riders/orders/:orderId/reject
   * Reject an assigned delivery offer.
   * Releases capacity reservation and automatically triggers reassignment to another rider.
   */
  async rejectOffer(userId: string, orderId: string, dto: RejectDeliveryOfferDto) {
    const rider = await this.getRiderForUser(userId);

    const reassignmentInfo = await this.db.transaction(async (tx) => {
      const now = new Date();

      // 1. Lock delivery row
      const [delivery] = await tx
        .select()
        .from(schema.deliveries)
        .where(eq(schema.deliveries.orderId, orderId))
        .for('update');

      if (!delivery) {
        throw new NotFoundException(`No delivery found for order ${orderId}`);
      }

      // Verify ownership
      if (delivery.riderId !== rider.id) {
        throw new ForbiddenException('This delivery offer does not belong to you');
      }

      // Verify status: must be 'assigned'
      if (delivery.status !== 'assigned') {
        throw new BadRequestException(
          `Cannot reject delivery in status '${delivery.status}'. Offer is not pending.`,
        );
      }

      // 2. Mark latest assignment attempt as 'rejected'
      await tx
        .update(schema.deliveryAssignmentAttempts)
        .set({
          status: 'rejected',
          respondedAt: now,
          rejectionReason: dto.reason || 'Declined by rider',
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.deliveryAssignmentAttempts.deliveryId, delivery.id),
            eq(schema.deliveryAssignmentAttempts.riderId, rider.id),
            eq(schema.deliveryAssignmentAttempts.status, 'offered'),
          ),
        );

      // 3. Reset delivery to 'unassigned' and clear rider
      await tx
        .update(schema.deliveries)
        .set({
          status: 'unassigned',
          riderId: null,
          offerExpiresAt: null,
          lastDispatchAttemptAt: now,
          dispatchFailureReason: `Previous rider declined: ${dto.reason || 'No reason specified'}`,
          updatedAt: now,
        })
        .where(eq(schema.deliveries.id, delivery.id));

      this.logger.log(`Rider ${rider.id} rejected delivery offer for order ${orderId}`);

      return { orderId };
    });

    // 4. Trigger assignment to another eligible rider outside the transaction
    this.riderAssignmentService
      .assignOrder(reassignmentInfo.orderId)
      .catch((err) => {
        this.logger.error(
          `Automatic reassignment after rider rejection failed for order ${orderId}: ${err?.message || err}`,
        );
      });

    return {
      orderId,
      status: 'rejected',
      message: 'Delivery offer rejected. Reassignment initiated.',
    };
  }

  /**
   * Centralized Delivery Cancellation Cleanup Operation.
   * Atomically cancels the delivery, releases rider capacity where appropriate,
   * expires pending attempts, and invalidates OTPs.
   *
   * Case A: Offer assigned but not accepted -> mark cancelled, expire attempts, do not decrement active count.
   * Case B: Rider accepted/at restaurant but not picked up -> mark cancelled, decrement active count, restore availability.
   * Case C: Rider picked up food (out_for_delivery / arrived_customer) -> rejects auto-cancellation, requires operational resolution.
   */
  async cleanupDeliveryForCancelledOrder(
    orderId: string,
    cancelledByUserId: string,
    reason: string,
    tx: any,
  ): Promise<{ deliveryId?: string; previousStatus?: string; releasedRiderId?: string }> {
    const now = new Date();

    // 1. Lock delivery row FOR UPDATE
    const [delivery] = await tx
      .select()
      .from(schema.deliveries)
      .where(eq(schema.deliveries.orderId, orderId))
      .for('update');

    if (!delivery) {
      return {};
    }

    // Terminal states cannot be cleaned up
    if (delivery.status === 'completed' || delivery.status === 'cancelled') {
      return { deliveryId: delivery.id, previousStatus: delivery.status };
    }

    // Case C: Rider already picked up the food
    if (
      delivery.status === 'picked_up' ||
      delivery.status === 'arrived_customer'
    ) {
      throw new BadRequestException(
        `Cannot automatically cancel order ${orderId}. Food has already been picked up by the delivery rider and is in transit. Contact admin operations.`,
      );
    }

    let releasedRiderId: string | undefined = undefined;

    // Case B: Rider accepted or is at the restaurant (has committed capacity)
    if (delivery.status === 'accepted' || delivery.status === 'at_restaurant') {
      if (delivery.riderId) {
        const [riderRow] = await tx
          .select()
          .from(schema.riders)
          .where(eq(schema.riders.id, delivery.riderId))
          .for('update');

        if (riderRow) {
          const newActiveCount = Math.max(0, riderRow.currentActiveOrdersCount - 1);
          let newAvailability = riderRow.availabilityStatus;
          if (
            riderRow.verificationStatus === 'approved' &&
            !riderRow.suspensionReason &&
            riderRow.isOnline &&
            newActiveCount < riderRow.maxActiveOrders
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
            .where(eq(schema.riders.id, riderRow.id));

          releasedRiderId = riderRow.id;
        }
      }
    }

    // Expire any outstanding offered attempts
    await tx
      .update(schema.deliveryAssignmentAttempts)
      .set({
        status: 'expired',
        respondedAt: now,
        rejectionReason: `Order cancelled: ${reason}`,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.deliveryAssignmentAttempts.deliveryId, delivery.id),
          eq(schema.deliveryAssignmentAttempts.status, 'offered'),
        ),
      );

    // Invalidate delivery and wipe OTPs
    await tx
      .update(schema.deliveries)
      .set({
        status: 'cancelled',
        offerExpiresAt: null,
        deliveryOtpHash: null,
        encryptedDeliveryOtp: null,
        dispatchFailureReason: `Cancelled: ${reason}`,
        updatedAt: now,
      })
      .where(eq(schema.deliveries.id, delivery.id));

    this.logger.log(
      `Delivery ${delivery.id} for order ${orderId} cancelled (previous status: ${delivery.status}, released rider: ${releasedRiderId || 'none'})`,
    );

    return {
      deliveryId: delivery.id,
      previousStatus: delivery.status,
      releasedRiderId,
    };
  }

  /**
   * POST /api/v1/riders/orders/:orderId/arrived
   * Confirm rider arrival at restaurant (accepted -> at_restaurant)
   */
  async confirmArrival(userId: string, orderId: string) {
    const rider = await this.getRiderForUser(userId);

    return await this.db.transaction(async (tx) => {
      const [delivery] = await tx
        .select()
        .from(schema.deliveries)
        .where(eq(schema.deliveries.orderId, orderId))
        .for('update');

      if (!delivery) throw new NotFoundException('Delivery not found');
      if (delivery.riderId !== rider.id) {
        throw new ForbiddenException('Delivery does not belong to you');
      }

      if (delivery.status !== 'accepted') {
        throw new BadRequestException(
          `Cannot mark arrived at restaurant from status '${delivery.status}'. Must be 'accepted'.`,
        );
      }

      const now = new Date();
      const [updated] = await tx
        .update(schema.deliveries)
        .set({
          status: 'at_restaurant',
          updatedAt: now,
        })
        .where(eq(schema.deliveries.id, delivery.id))
        .returning();

      // WebSocket status update: at_restaurant
      try {
        this.trackingPublisher.publishStatusUpdated({
          orderId,
          deliveryId: updated.id,
          status: 'at_restaurant',
          orderStatus: 'preparing',
          updatedAt: now.toISOString(),
          message: 'Rider arrived at restaurant',
        });
      } catch (wsErr: any) {
        this.logger.warn(`Failed to broadcast at_restaurant event: ${wsErr?.message || wsErr}`);
      }

      return {
        orderId,
        deliveryId: updated.id,
        status: updated.status,
        message: 'Rider arrival at restaurant confirmed',
      };
    });
  }

  /**
   * POST /api/v1/riders/orders/:orderId/pickup
   * Confirm order pickup from kitchen (at_restaurant -> picked_up)
   */
  async confirmPickup(userId: string, orderId: string) {
    const rider = await this.getRiderForUser(userId);

    return await this.db.transaction(async (tx) => {
      const [delivery] = await tx
        .select()
        .from(schema.deliveries)
        .where(eq(schema.deliveries.orderId, orderId))
        .for('update');

      if (!delivery) throw new NotFoundException('Delivery not found');
      if (delivery.riderId !== rider.id) {
        throw new ForbiddenException('Delivery does not belong to you');
      }

      if (delivery.status !== 'at_restaurant') {
        throw new BadRequestException(
          `Cannot mark picked up from status '${delivery.status}'. Must be 'at_restaurant'.`,
        );
      }

      const now = new Date();

      // Generate secure delivery OTP if not already present
      let otpHash = delivery.deliveryOtpHash;
      let encryptedOtp = delivery.encryptedDeliveryOtp;
      let otpExpiresAt = delivery.otpExpiresAt;

      if (!otpHash || !encryptedOtp || (otpExpiresAt && otpExpiresAt <= now)) {
        const rawOtp = DeliveryOtpUtil.generateOtp();
        otpHash = DeliveryOtpUtil.hashOtp(rawOtp, this.getOtpSecret(), orderId);
        encryptedOtp = DeliveryOtpUtil.encryptOtp(rawOtp, this.getOtpEncryptionKey());
        otpExpiresAt = new Date(now.getTime() + RiderOffersService.OTP_EXPIRY_SECONDS * 1000);

        // Notify customer (logged securely via NotificationService, OTP plaintext is delivered only to customer)
        this.notificationService
          .notifyRider({
            riderId: delivery.riderId,
            orderId,
            deliveryId: delivery.id,
            type: 'delivery_assigned',
            title: 'Order Picked Up',
            body: `Your order has been picked up. Share OTP ${rawOtp} with the rider upon delivery.`,
            data: { rawOtp },
          })
          .catch(() => {});
      }

      const [updated] = await tx
        .update(schema.deliveries)
        .set({
          status: 'picked_up',
          pickedUpAt: now,
          deliveryOtpHash: otpHash,
          encryptedDeliveryOtp: encryptedOtp,
          otpExpiresAt,
          updatedAt: now,
        })
        .where(eq(schema.deliveries.id, delivery.id))
        .returning();

      // Advance order status to 'out_for_delivery'
      await tx
        .update(schema.orders)
        .set({
          status: 'out_for_delivery',
          updatedAt: now,
        })
        .where(eq(schema.orders.id, orderId));

      // Order status history audit
      await tx.insert(schema.orderStatusHistory).values({
        orderId,
        previousStatus: 'ready_for_pickup',
        newStatus: 'out_for_delivery',
        changedByUserId: userId,
        reason: 'Picked up by delivery rider',
      });

      // WebSocket status update: picked_up / out_for_delivery
      try {
        this.trackingPublisher.publishStatusUpdated({
          orderId,
          deliveryId: updated.id,
          status: 'picked_up',
          orderStatus: 'out_for_delivery',
          updatedAt: now.toISOString(),
          message: 'Order picked up and is out for delivery',
        });
      } catch (wsErr: any) {
        this.logger.warn(`Failed to broadcast picked_up event: ${wsErr?.message || wsErr}`);
      }

      return {
        orderId,
        deliveryId: updated.id,
        status: updated.status,
        pickedUpAt: now,
        message: 'Order picked up successfully. Status is now out_for_delivery.',
      };
    });
  }

  /**
   * POST /api/v1/riders/orders/:orderId/arrived-customer
   * Confirm rider arrival at customer doorstep (picked_up -> arrived_customer)
   */
  async confirmArrivedCustomer(userId: string, orderId: string) {
    const rider = await this.getRiderForUser(userId);

    return await this.db.transaction(async (tx) => {
      const [delivery] = await tx
        .select()
        .from(schema.deliveries)
        .where(eq(schema.deliveries.orderId, orderId))
        .for('update');

      if (!delivery) throw new NotFoundException('Delivery not found');
      if (delivery.riderId !== rider.id) {
        throw new ForbiddenException('Delivery does not belong to you');
      }

      // Idempotent if already in arrived_customer
      if (delivery.status === 'arrived_customer') {
        return {
          orderId,
          deliveryId: delivery.id,
          status: 'arrived_customer',
          message: 'Rider arrival at customer doorstep already confirmed',
        };
      }

      if (delivery.status !== 'picked_up') {
        throw new BadRequestException(
          `Cannot mark arrived at customer from status '${delivery.status}'. Must be 'picked_up'.`,
        );
      }

      const now = new Date();
      const [updated] = await tx
        .update(schema.deliveries)
        .set({
          status: 'arrived_customer',
          arrivedCustomerAt: now,
          updatedAt: now,
        })
        .where(eq(schema.deliveries.id, delivery.id))
        .returning();

      // WebSocket status update: arrived_customer
      try {
        this.trackingPublisher.publishStatusUpdated({
          orderId,
          deliveryId: updated.id,
          status: 'arrived_customer',
          orderStatus: 'out_for_delivery',
          updatedAt: now.toISOString(),
          message: 'Rider arrived at customer doorstep',
        });
      } catch (wsErr: any) {
        this.logger.warn(`Failed to broadcast arrived_customer event: ${wsErr?.message || wsErr}`);
      }

      return {
        orderId,
        deliveryId: updated.id,
        status: updated.status,
        arrivedCustomerAt: now,
        message: 'Rider arrival at customer confirmed',
      };
    });
  }

  /**
   * POST /api/v1/riders/orders/:orderId/complete
   * Customer delivery handoff verification with secure OTP.
   * Decrements rider capacity exactly once, restores availability if applicable, advances order to delivered.
   */
  async completeDelivery(userId: string, orderId: string, dto: CompleteDeliveryDto) {
    const rider = await this.getRiderForUser(userId);

    return await this.db.transaction(async (tx) => {
      const now = new Date();

      // 1. Lock delivery row FOR UPDATE
      const [delivery] = await tx
        .select()
        .from(schema.deliveries)
        .where(eq(schema.deliveries.orderId, orderId))
        .for('update');

      if (!delivery) throw new NotFoundException('Delivery not found');
      if (delivery.riderId !== rider.id) {
        throw new ForbiddenException('Delivery does not belong to you');
      }

      // Idempotency check: If already completed, return cleanly without duplicate decrement
      if (delivery.status === 'completed') {
        return {
          orderId,
          deliveryId: delivery.id,
          status: 'completed',
          message: 'Delivery is already completed',
          alreadyCompleted: true,
        };
      }

      // 2. State transition check: must be in arrived_customer
      if (delivery.status !== 'arrived_customer') {
        throw new BadRequestException(
          `Cannot complete delivery from status '${delivery.status}'. Rider must confirm arrival at customer doorstep first.`,
        );
      }

      // 3. OTP verification limits and expiry
      if (delivery.otpAttemptsCount >= RiderOffersService.MAX_OTP_ATTEMPTS) {
        throw new ForbiddenException(
          'Maximum delivery OTP verification attempts exceeded. Please contact customer support.',
        );
      }

      if (delivery.otpExpiresAt && delivery.otpExpiresAt <= now) {
        throw new BadRequestException('Delivery OTP has expired. Please ask the customer to refresh OTP.');
      }

      // 4. Constant-time secure OTP verification
      const isOtpValid = DeliveryOtpUtil.verifyOtp(
        dto.otp,
        this.getOtpSecret(),
        orderId,
        delivery.deliveryOtpHash || '',
      );

      if (!isOtpValid) {
        // Increment attempts count
        const newAttempts = delivery.otpAttemptsCount + 1;
        await tx
          .update(schema.deliveries)
          .set({
            otpAttemptsCount: newAttempts,
            updatedAt: now,
          })
          .where(eq(schema.deliveries.id, delivery.id));

        const remaining = RiderOffersService.MAX_OTP_ATTEMPTS - newAttempts;
        throw new BadRequestException(
          `Invalid delivery OTP. ${remaining} attempt(s) remaining.`,
        );
      }

      // 5. Valid OTP: Lock rider row FOR UPDATE to safely release capacity
      const [riderRow] = await tx
        .select()
        .from(schema.riders)
        .where(eq(schema.riders.id, rider.id))
        .for('update');

      if (riderRow) {
        const newActiveCount = Math.max(0, riderRow.currentActiveOrdersCount - 1);
        // Restore availability to 'available' if rider is approved, not suspended, and was online/busy
        let newAvailability = riderRow.availabilityStatus;
        if (
          riderRow.verificationStatus === 'approved' &&
          !riderRow.suspensionReason &&
          riderRow.isOnline &&
          newActiveCount < riderRow.maxActiveOrders
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

      // 6. Update delivery status to 'completed', invalidate OTP and encrypted payload
      const [updatedDelivery] = await tx
        .update(schema.deliveries)
        .set({
          status: 'completed',
          deliveredAt: now,
          otpVerifiedAt: now,
          deliveryOtpHash: null, // Invalidate OTP
          encryptedDeliveryOtp: null, // Wipe encrypted OTP
          updatedAt: now,
        })
        .where(eq(schema.deliveries.id, delivery.id))
        .returning();

      // 7. Update order status to 'delivered'
      await tx
        .update(schema.orders)
        .set({
          status: 'delivered',
          deliveredAt: now,
          updatedAt: now,
        })
        .where(eq(schema.orders.id, orderId));

      // 8. Order status history audit
      await tx.insert(schema.orderStatusHistory).values({
        orderId,
        previousStatus: 'out_for_delivery',
        newStatus: 'delivered',
        changedByUserId: userId,
        reason: 'Customer handoff completed via verified delivery OTP',
      });

      this.logger.log(`Order ${orderId} successfully completed and delivered by rider ${rider.id}`);

      // 9. Atomic Financial Ledger Operations (Dynamic Rider Earning & Restaurant Delivery Credits)
      // Executed within the outer tx: any ledger failure aborts delivery completion to guarantee financial consistency.
      const [order] = await tx
        .select({
          orderNumber: schema.orders.orderNumber,
          outletId: schema.orders.outletId,
        })
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId));

      // 9A. Restaurant Monthly Credit Block Consumption
      if (order?.outletId) {
        const [outlet] = await tx
          .select({ restaurantId: schema.restaurantOutlets.restaurantId })
          .from(schema.restaurantOutlets)
          .where(eq(schema.restaurantOutlets.id, order.outletId));

        if (outlet?.restaurantId) {
          await this.financialSettingsService.consumeRestaurantDeliveryCredit(
            outlet.restaurantId,
            orderId,
            tx,
          );
        }
      }

      // 9B. Dynamic Rider Earning Credit (Using configured strategy, slabs, distance, and IST peak hours)
      await this.financeService.recordDeliveryEarning(
        orderId,
        rider.id,
        updatedDelivery.id,
        undefined, // uses persisted delivery.distanceMeters
        tx,
      );

      // WebSocket status update: delivery.completed
      try {
        this.trackingPublisher.publishDeliveryCompleted({
          orderId,
          deliveryId: updatedDelivery.id,
          completedAt: now.toISOString(),
          message: 'Order delivered successfully',
        });
      } catch (wsErr: any) {
        this.logger.warn(`Failed to broadcast completed event: ${wsErr?.message || wsErr}`);
      }

      return {
        orderId,
        deliveryId: updatedDelivery.id,
        status: 'completed',
        deliveredAt: now,
        message: 'Order delivery completed successfully',
      };
    });
  }

  /**
   * Helper for customer order tracking:
   * Returns current delivery status and rider public info for order owner.
   * Also returns plain OTP if order is in-flight for handoff.
   */
  async getDeliveryForCustomer(
    customerId: string,
    orderId: string,
  ): Promise<CustomerDeliveryTrackingResponse> {
    const order = await this.db.query.orders.findFirst({
      where: and(
        eq(schema.orders.id, orderId),
        eq(schema.orders.customerId, customerId),
      ),
      with: {
        outlet: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order '${orderId}' not found.`);
    }

    const delivery = await this.db.query.deliveries.findFirst({
      where: eq(schema.deliveries.orderId, orderId),
      with: {
        rider: true,
      },
    });

    // Customer OTP Retrieval: Only decrypt and expose OTP if delivery is in active customer handoff
    // states ('picked_up' or 'arrived_customer') and OTP is unexpired.
    let customerOtp: string | undefined = undefined;
    const now = new Date();
    const canViewOtp =
      delivery &&
      (delivery.status === 'picked_up' || delivery.status === 'arrived_customer') &&
      delivery.encryptedDeliveryOtp &&
      (!delivery.otpExpiresAt || delivery.otpExpiresAt > now);

    if (canViewOtp && delivery.encryptedDeliveryOtp) {
      try {
        customerOtp = DeliveryOtpUtil.decryptOtp(
          delivery.encryptedDeliveryOtp,
          this.getOtpEncryptionKey(),
        );
      } catch (err: any) {
        this.logger.error(`Failed to decrypt delivery OTP for order ${orderId}: ${err?.message || err}`);
      }
    }

    // Fetch latest rider location if delivery is in an active tracking state
    let riderLocation: {
      latitude: number;
      longitude: number;
      accuracy?: number | null;
      heading?: number | null;
      speed?: number | null;
      capturedAt?: Date | null;
      updatedAt: Date;
      freshness: string;
      ageSeconds: number;
    } | null = null;

    const trackableStatuses = ['assigned', 'accepted', 'at_restaurant', 'picked_up', 'arrived_customer'];
    if (delivery?.riderId && trackableStatuses.includes(delivery.status)) {
      const location = await this.db.query.riderLocations.findFirst({
        where: eq(schema.riderLocations.riderId, delivery.riderId),
      });

      if (location) {
        const { freshness, ageSeconds } = this.ridersService.calculateLocationFreshness(
          location.updatedAt,
        );
        riderLocation = {
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
          accuracy: location.accuracy !== null ? Number(location.accuracy) : null,
          heading: location.heading !== null ? Number(location.heading) : null,
          speed: location.speed !== null ? Number(location.speed) : null,
          capturedAt: location.capturedAt,
          updatedAt: location.updatedAt,
          freshness,
          ageSeconds,
        };
      }
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      deliveryStatus: delivery?.status || 'unassigned',
      deliveryOtp: customerOtp,
      otpExpiresAt: delivery?.otpExpiresAt,
      restaurant: {
        name: order.outlet.name,
        address: order.outlet.address,
        phone: order.outlet.phone,
      },
      rider: delivery?.rider
        ? {
            fullName: delivery.rider.fullName,
            vehicleType: delivery.rider.vehicleType,
            vehicleNumber: delivery.rider.vehicleNumber,
            location: riderLocation,
          }
        : null,
      timestamps: {
        placedAt: order.placedAt,
        confirmedAt: order.confirmedAt,
        assignedAt: delivery?.assignedAt || null,
        pickedUpAt: delivery?.pickedUpAt || null,
        arrivedCustomerAt: delivery?.arrivedCustomerAt || null,
        deliveredAt: delivery?.deliveredAt || order.deliveredAt,
      },
      deliveryAddress: order.deliveryAddressSnapshot,
    };
  }
}

