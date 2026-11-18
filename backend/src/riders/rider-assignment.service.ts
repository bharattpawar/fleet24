import {
  Optional,
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, sql } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { calculateRiderProximity, DEFAULT_RIDER_PICKUP_RADIUS_METERS } from '../common/utils/geo';
import { FinancialSettingsService } from '../admin/financial-settings.service';
import { NotificationService } from './notification.service';
import { TrackingPublisherService } from '../tracking/tracking-publisher.service';
import { ServiceZonesService } from '../service-zones/service-zones.service';

export interface CandidateRider {
  riderId: string;
  userId: string;
  fullName: string | null;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  distanceKm: number;
  currentActiveOrdersCount: number;
  maxActiveOrders: number;
  effectiveCapacity: number;
}

export interface AssignmentResult {
  assigned: boolean;
  orderId: string;
  orderNumber: string;
  deliveryId?: string;
  riderId?: string;
  distanceMeters?: number;
  offerExpiresAt?: Date;
  status: string;
  message?: string;
  candidatesCount: number;
}

@Injectable()
export class RiderAssignmentService {
  private readonly logger = new Logger(RiderAssignmentService.name);

  /**
   * Offer expiry window: 60 seconds in production; 300 seconds (5 mins) in development mode for easy testing.
   */
  public static readonly OFFER_EXPIRY_SECONDS = process.env.NODE_ENV === 'production' ? 60 : 300;

  /**
   * Stale GPS threshold: 300 seconds (5 minutes)
   */
  public static readonly MAX_LOCATION_AGE_SECONDS = 300;

  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly notificationService: NotificationService,
    private readonly trackingPublisher: TrackingPublisherService,
    @Optional()
    private readonly serviceZones?: ServiceZonesService,
    @Optional()
    private readonly financialSettingsService?: FinancialSettingsService,
  ) {}

  /** Admin-set rider search radius around the restaurant (Delivery Serviceability settings). */
  async getRiderPickupRadiusMeters(): Promise<number> {
    try {
      const active = await this.financialSettingsService?.getActiveSettings();
      const value = Number(active?.settings?.deliveryServiceability?.riderPickupRadiusMeters);
      if (Number.isFinite(value) && value > 0) return value;
    } catch {
      // fall back to the default below
    }
    return DEFAULT_RIDER_PICKUP_RADIUS_METERS;
  }

  /**
   * Evaluates location freshness:
   * In production: strictly MAX_LOCATION_AGE_SECONDS (300s).
   * Only when NODE_ENV=development: relaxed for local QA and emulator testing (never in test, staging or production).
   */
  isLocationFresh(
    updatedAt: Date | null | undefined,
    capturedAt: Date | null | undefined,
    maxAgeSeconds: number = RiderAssignmentService.MAX_LOCATION_AGE_SECONDS,
  ): boolean {
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      // In development, always accept recorded location for QA and multi-device testing
      return true;
    }

    if (!updatedAt) return false;

    const now = Date.now();
    const serverAgeSeconds = Math.max(0, Math.floor((now - new Date(updatedAt).getTime()) / 1000));
    if (serverAgeSeconds > maxAgeSeconds) {
      return false;
    }

    if (capturedAt) {
      const gpsAgeSeconds = Math.max(0, Math.floor((now - new Date(capturedAt).getTime()) / 1000));
      if (gpsAgeSeconds > maxAgeSeconds) {
        return false;
      }
    }

    return true;
  }

  /**
   * Finds the best eligible rider candidate for a restaurant outlet within 3 KM.
   * Ranking:
   * 1. Shortest distance (ascending)
   * 2. Lower active delivery count (ascending)
   * 3. Deterministic tie-breaker (riderId ascending)
   */
  async findBestCandidateRider(
    outletLat: number,
    outletLon: number,
    orderIdOrTx?: string | any,
    maybeTx?: any,
  ): Promise<{ bestCandidate: CandidateRider | null; candidatesCount: number }> {
    const orderId = typeof orderIdOrTx === 'string' ? orderIdOrTx : undefined;
    const tx = typeof orderIdOrTx === 'object' && orderIdOrTx !== null ? orderIdOrTx : maybeTx;
    const dbClient = tx || this.db;

    const isDev = process.env.NODE_ENV === 'development';
    const pickupRadiusMeters = await this.getRiderPickupRadiusMeters();
    // Geographic bounding box pre-filter sized from the admin radius (+15% margin; relaxed in dev)
    const radiusDegLat = (pickupRadiusMeters / 111_320) * 1.15;
    const radiusDegLon = radiusDegLat / Math.max(Math.cos((outletLat * Math.PI) / 180), 0.2);
    const latDelta = isDev ? 50.0 : radiusDegLat;
    const lonDelta = isDev ? 50.0 : radiusDegLon;
    const minLat = outletLat - latDelta;
    const maxLat = outletLat + latDelta;
    const minLon = outletLon - lonDelta;
    const maxLon = outletLon + lonDelta;

    const now = new Date();

    // If orderId is provided, retrieve riders who already rejected or expired for this order
    // In dev mode, do NOT exclude riders so a single QA rider never gets permanently locked out
    const excludedRiderIds: string[] = [];
    if (orderId && !isDev) {
      const pastAttempts = await dbClient
        .select({ riderId: schema.deliveryAssignmentAttempts.riderId })
        .from(schema.deliveryAssignmentAttempts)
        .where(
          and(
            eq(schema.deliveryAssignmentAttempts.orderId, orderId),
            sql`${schema.deliveryAssignmentAttempts.status} IN ('rejected', 'expired')`,
          ),
        );
      for (const a of pastAttempts) {
        if (a.riderId) excludedRiderIds.push(a.riderId);
      }
    }

    // Query active available riders with their latest locations
    // Excludes offline, unapproved, suspended riders
    const rawRiders = await dbClient
      .select({
        riderId: schema.riders.id,
        userId: schema.riders.userId,
        fullName: schema.riders.fullName,
        verificationStatus: schema.riders.verificationStatus,
        availabilityStatus: schema.riders.availabilityStatus,
        suspensionReason: schema.riders.suspensionReason,
        currentActiveOrdersCount: schema.riders.currentActiveOrdersCount,
        maxActiveOrders: schema.riders.maxActiveOrders,
        latitude: schema.riderLocations.latitude,
        longitude: schema.riderLocations.longitude,
        capturedAt: schema.riderLocations.capturedAt,
        updatedAt: schema.riderLocations.updatedAt,
      })
      .from(schema.riders)
      .innerJoin(
        schema.riderLocations,
        eq(schema.riders.id, schema.riderLocations.riderId),
      )
      .where(
        and(
          eq(schema.riders.verificationStatus, 'approved'),
          eq(schema.riders.availabilityStatus, 'available'),
          sql`${schema.riders.suspensionReason} IS NULL`,
          sql`${schema.riderLocations.latitude}::numeric >= ${minLat} AND ${schema.riderLocations.latitude}::numeric <= ${maxLat}`,
          sql`${schema.riderLocations.longitude}::numeric >= ${minLon} AND ${schema.riderLocations.longitude}::numeric <= ${maxLon}`,
          excludedRiderIds.length > 0
            ? sql`${schema.riders.id} NOT IN ${excludedRiderIds}`
            : sql`TRUE`,
        ),
      );

    if (!rawRiders || rawRiders.length === 0) {
      return { bestCandidate: null, candidatesCount: 0 };
    }

    // Check active pending offers to calculate real capacity reservations
    // A pending offer that has not expired reserves 1 slot of delivery capacity
    const riderIds = rawRiders.map((r: any) => r.riderId);
    const activeOffers = await dbClient
      .select({
        riderId: schema.deliveries.riderId,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.deliveries)
      .where(
        and(
          sql`${schema.deliveries.riderId} IN ${riderIds}`,
          eq(schema.deliveries.status, 'assigned'),
          sql`(${schema.deliveries.offerExpiresAt} IS NULL OR ${schema.deliveries.offerExpiresAt} > ${now})`,
        ),
      )
      .groupBy(schema.deliveries.riderId);

    const pendingOfferMap = new Map<string, number>();
    for (const offer of activeOffers) {
      if (offer.riderId) {
        pendingOfferMap.set(offer.riderId, offer.count);
      }
    }

    const eligibleCandidates: CandidateRider[] = [];

    for (const r of rawRiders) {
      // 1. Freshness check (In dev mode, relaxed to 24h for smooth local testing)
      const maxAgeSec = isDev ? 86400 : RiderAssignmentService.MAX_LOCATION_AGE_SECONDS;
      if (!this.isLocationFresh(r.updatedAt, r.capturedAt, maxAgeSec)) {
        continue;
      }

      // 2. Capacity check (active orders count + pending offer reservations < maxActiveOrders)
      const pendingOffersCount = pendingOfferMap.get(r.riderId) || 0;
      const totalCommitted = r.currentActiveOrdersCount + pendingOffersCount;
      if (totalCommitted >= r.maxActiveOrders) {
        continue;
      }

      // 3. Exact Haversine proximity check (within the admin rider search radius in prod; relaxed in dev)
      const proximity = calculateRiderProximity(
        r.latitude,
        r.longitude,
        outletLat,
        outletLon,
        pickupRadiusMeters,
      );

      if (!isDev && !proximity.isWithinRadius) {
        continue;
      }

      // 4. Riders outside every active service zone get no offers.
      if (this.serviceZones && !(await this.serviceZones.isServiceable(r.latitude, r.longitude))) {
        continue;
      }

      eligibleCandidates.push({
        riderId: r.riderId,
        userId: r.userId,
        fullName: r.fullName,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        distanceMeters: proximity.distanceMeters,
        distanceKm: proximity.distanceKm,
        currentActiveOrdersCount: r.currentActiveOrdersCount,
        maxActiveOrders: r.maxActiveOrders,
        effectiveCapacity: r.maxActiveOrders - totalCommitted,
      });
    }

    if (eligibleCandidates.length === 0) {
      return { bestCandidate: null, candidatesCount: 0 };
    }

    // 4. Rank candidates:
    // Priority 1: Shortest distance
    // Priority 2: Lower active delivery count
    // Priority 3: Deterministic tie-breaker on riderId
    eligibleCandidates.sort((a, b) => {
      if (Math.abs(a.distanceMeters - b.distanceMeters) > 1e-4) {
        return a.distanceMeters - b.distanceMeters;
      }
      if (a.currentActiveOrdersCount !== b.currentActiveOrdersCount) {
        return a.currentActiveOrdersCount - b.currentActiveOrdersCount;
      }
      return a.riderId.localeCompare(b.riderId);
    });

    return {
      bestCandidate: eligibleCandidates[0],
      candidatesCount: eligibleCandidates.length,
    };
  }

  /**
   * Main assignment transaction for an order.
   * Lock order with FOR UPDATE to prevent concurrent assignment races.
   */
  async assignOrder(orderId: string): Promise<AssignmentResult> {
    this.logger.log(`Attempting automatic rider assignment for order ${orderId}`);

    return await this.db.transaction(async (tx) => {
      // 1. Row-level lock on the order
      const [order] = await tx
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId))
        .for('update');

      if (!order) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      // 2. Eligibility checks for order dispatch
      // - Must not be unpaid
      if (order.status === 'pending_payment') {
        throw new BadRequestException(`Cannot assign rider to unpaid order in status '${order.status}'`);
      }

      // - Must not be cancelled or rejected
      if (order.status === 'cancelled' || order.status === 'rejected') {
        throw new BadRequestException(
          `Cannot assign rider to order in terminal status '${order.status}'`,
        );
      }

      // - Must not already be completed/delivered
      if (order.status === 'delivered') {
        throw new BadRequestException(`Order ${order.orderNumber} is already delivered`);
      }

      // 3. Check existing delivery record with row lock
      const existingDeliveries = await tx
        .select()
        .from(schema.deliveries)
        .where(eq(schema.deliveries.orderId, orderId))
        .for('update');

      const existingDelivery = existingDeliveries[0] || null;

      // Idempotency: If delivery already has an active accepted rider or valid pending offer, do not duplicate
      if (existingDelivery) {
        const now = new Date();
        const hasValidActiveOffer =
          existingDelivery.status === 'assigned' &&
          existingDelivery.riderId &&
          (!existingDelivery.offerExpiresAt || existingDelivery.offerExpiresAt > now);

        const hasAcceptedOrInTransitRider =
          ['at_restaurant', 'picked_up', 'arrived_customer', 'completed'].includes(
            existingDelivery.status,
          );

        if (hasValidActiveOffer || hasAcceptedOrInTransitRider) {
          this.logger.log(
            `Order ${order.orderNumber} already has active delivery assignment (${existingDelivery.status}, rider: ${existingDelivery.riderId})`,
          );
          return {
            assigned: true,
            orderId: order.id,
            orderNumber: order.orderNumber,
            deliveryId: existingDelivery.id,
            riderId: existingDelivery.riderId || undefined,
            distanceMeters: existingDelivery.distanceMeters ? Number(existingDelivery.distanceMeters) : undefined,
            offerExpiresAt: existingDelivery.offerExpiresAt || undefined,
            status: existingDelivery.status,
            message: 'Order already has an active assignment',
            candidatesCount: 1,
          };
        }
      }

      // 4. Retrieve restaurant outlet coordinates
      const [outlet] = await tx
        .select({
          id: schema.restaurantOutlets.id,
          latitude: schema.restaurantOutlets.latitude,
          longitude: schema.restaurantOutlets.longitude,
          name: schema.restaurantOutlets.name,
          address: schema.restaurantOutlets.address,
          phone: schema.restaurantOutlets.phone,
        })
        .from(schema.restaurantOutlets)
        .where(eq(schema.restaurantOutlets.id, order.outletId));

      if (!outlet || !outlet.latitude || !outlet.longitude) {
        throw new BadRequestException(
          `Restaurant outlet for order ${order.orderNumber} has missing GPS coordinates`,
        );
      }

      const outletLat = Number(outlet.latitude);
      const outletLon = Number(outlet.longitude);

      // 5. Run matching algorithm to pick best eligible candidate
      const { bestCandidate, candidatesCount } = await this.findBestCandidateRider(
        outletLat,
        outletLon,
        orderId,
        tx,
      );

      const now = new Date();

      // 6. Handle Scenario: No eligible rider available
      if (!bestCandidate) {
        const failureReason =
          candidatesCount === 0
            ? 'No approved, online riders within 3 KM with available capacity'
            : 'Candidates filtered out due to capacity or proximity';

        this.logger.warn(
          `No eligible rider found for order ${order.orderNumber} at outlet "${outlet.name}". ${failureReason}`,
        );

        if (existingDelivery) {
          await tx
            .update(schema.deliveries)
            .set({
              status: 'unassigned',
              riderId: null,
              lastDispatchAttemptAt: now,
              dispatchFailureReason: failureReason,
              updatedAt: now,
            })
            .where(eq(schema.deliveries.id, existingDelivery.id));
        } else {
          await tx.insert(schema.deliveries).values({
            orderId: order.id,
            status: 'unassigned',
            lastDispatchAttemptAt: now,
            dispatchFailureReason: failureReason,
          });
        }

        return {
          assigned: false,
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: 'unassigned',
          message: failureReason,
          candidatesCount: 0,
        };
      }

      // 7. Calculate authoritative Restaurant Outlet -> Customer Delivery Address trip distance
      // NOTE: Straight-line Haversine distance is used for the Greater Noida pilot.
      // This is the delivery trip distance used by the financial earning engine to compensate riders.
      // Rider-to-restaurant proximity distance is logged separately in deliveryAssignmentAttempts.
      if (!order.deliveryLatitude || !order.deliveryLongitude) {
        throw new BadRequestException(
          `Order ${order.orderNumber} is missing delivery destination coordinates`,
        );
      }

      const destLat = Number(order.deliveryLatitude);
      const destLon = Number(order.deliveryLongitude);

      if (isNaN(destLat) || isNaN(destLon)) {
        throw new BadRequestException(
          `Order ${order.orderNumber} contains invalid delivery destination coordinates`,
        );
      }

      const deliveryTripProximity = calculateRiderProximity(
        outletLat,
        outletLon,
        destLat,
        destLon,
      );

      // Pay on the road distance measured at checkout when available (same rule as claim).
      const checkoutRoadMeters = Number((order.deliveryAddressSnapshot as any)?.roadDistanceMeters);
      const deliveryTripDistanceMeters =
        Number.isFinite(checkoutRoadMeters) && checkoutRoadMeters > 0
          ? checkoutRoadMeters
          : deliveryTripProximity.distanceMeters;

      // 8. Successful Assignment: Create or update delivery assignment
      const offerExpiresAt = new Date(
        now.getTime() + RiderAssignmentService.OFFER_EXPIRY_SECONDS * 1000,
      );

      let deliveryRecord;
      if (existingDelivery) {
        const [updated] = await tx
          .update(schema.deliveries)
          .set({
            riderId: bestCandidate.riderId,
            status: 'assigned',
            distanceMeters: String(deliveryTripDistanceMeters.toFixed(2)),
            assignedAt: now,
            offerExpiresAt,
            lastDispatchAttemptAt: now,
            dispatchFailureReason: null,
            updatedAt: now,
          })
          .where(eq(schema.deliveries.id, existingDelivery.id))
          .returning();
        deliveryRecord = updated;
      } else {
        const [created] = await tx
          .insert(schema.deliveries)
          .values({
            orderId: order.id,
            riderId: bestCandidate.riderId,
            status: 'assigned',
            distanceMeters: String(deliveryTripDistanceMeters.toFixed(2)),
            assignedAt: now,
            offerExpiresAt,
            lastDispatchAttemptAt: now,
            dispatchFailureReason: null,
          })
          .returning();
        deliveryRecord = created;
      }

      // 9. Record audit attempt entry (stores rider-to-restaurant proximity distance for dispatch audit)
      await tx.insert(schema.deliveryAssignmentAttempts).values({
        orderId: order.id,
        deliveryId: deliveryRecord.id,
        riderId: bestCandidate.riderId,
        status: 'offered',
        distanceMeters: String(bestCandidate.distanceMeters.toFixed(2)),
        offeredAt: now,
        expiresAt: offerExpiresAt,
      });

      this.logger.log(
        `Assigned order ${order.orderNumber} to rider ${bestCandidate.riderId} (${bestCandidate.fullName || 'Rider'}) at distance ${bestCandidate.distanceMeters.toFixed(1)}m. Offer expires at ${offerExpiresAt.toISOString()}`,
      );

      // 9. Dispatch push notification to rider (non-blocking)
      this.notificationService
        .notifyRider({
          riderId: bestCandidate.riderId,
          orderId: order.id,
          deliveryId: deliveryRecord.id,
          type: 'offer_created',
          title: 'New Delivery Offer',
          body: `New delivery order ${order.orderNumber} available. Tap to accept within ${RiderAssignmentService.OFFER_EXPIRY_SECONDS}s.`,
          data: {
            orderNumber: order.orderNumber,
            distanceMeters: bestCandidate.distanceMeters,
            offerExpiresAt: offerExpiresAt.toISOString(),
          },
        })
        .catch((err) => {
          this.logger.warn(`Failed to dispatch offer notification to rider: ${err?.message || err}`);
        });

      // 9A. Real-time Rider Private WebSocket Notification: New Offer Available
      try {
        const orderItemsList = await tx
          .select({
            name: schema.orderItems.itemName,
            quantity: schema.orderItems.quantity,
          })
          .from(schema.orderItems)
          .where(eq(schema.orderItems.orderId, order.id));

        const addressSnapshot = order.deliveryAddressSnapshot as any;

        // Same formula and distance as the rider's offer list and payout (admin Financial Settings)
        const estimatedEarnings = this.financialSettingsService
          ? await this.financialSettingsService.estimateRiderEarning({
              distanceMeters: deliveryTripDistanceMeters,
              orderPlacedAt: order.placedAt ?? undefined,
              client: tx,
            })
          : null;

        this.trackingPublisher.publishOfferCreated(bestCandidate.riderId, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          deliveryId: deliveryRecord.id,
          riderId: bestCandidate.riderId,
          distanceMeters: Number(deliveryRecord.distanceMeters),
          distanceKm: Number(((Number(deliveryRecord.distanceMeters || 0)) / 1000).toFixed(2)),
          offerExpiresAt: offerExpiresAt.toISOString(),
          expiresInSeconds: RiderAssignmentService.OFFER_EXPIRY_SECONDS,
          secondsRemaining: RiderAssignmentService.OFFER_EXPIRY_SECONDS,
          estimatedEarnings,
          outlet: {
            name: outlet.name,
            address: outlet.address || outlet.name,
            phone: outlet.phone || '',
            latitude: outletLat,
            longitude: outletLon,
          },
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
          items: orderItemsList,
        });
      } catch (wsOfferErr: any) {
        this.logger.warn(`Failed to broadcast offer to rider room: ${wsOfferErr?.message || wsOfferErr}`);
      }

      // 10. Real-time Customer WebSocket notification: Rider Assigned
      try {
        this.trackingPublisher.publishRiderAssigned({
          orderId: order.id,
          deliveryId: deliveryRecord.id,
          rider: {
            id: bestCandidate.riderId,
            fullName: bestCandidate.fullName,
            vehicleType: 'motorcycle',
            vehicleNumber: null,
          },
          assignedAt: now.toISOString(),
        });
      } catch (wsErr: any) {
        this.logger.warn(`Failed to broadcast rider assigned event: ${wsErr?.message || wsErr}`);
      }

      return {
        assigned: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        deliveryId: deliveryRecord.id,
        riderId: bestCandidate.riderId,
        distanceMeters: Number(deliveryRecord.distanceMeters),
        offerExpiresAt: deliveryRecord.offerExpiresAt || undefined,
        status: deliveryRecord.status,
        message: 'Rider offer dispatched successfully',
        candidatesCount,
      };
    });
  }
}

