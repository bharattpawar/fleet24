import {
  Optional,
  Injectable,
  Inject,
  forwardRef,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, or, ilike, sql, desc } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { inArray } from 'drizzle-orm';
import { TrackingPublisherService } from '../tracking/tracking-publisher.service';
import {
  CreateRiderProfileDto,
  UpdateRiderProfileDto,
  UpdateRiderAvailabilityDto,
  AdminVerifyRiderDto,
  AdminSuspendRiderDto,
  AdminRidersQueryDto,
} from './dto/rider-profile.dto';
import {
  UpdateRiderLocationDto,
  RiderLocationResponse,
  LocationFreshness,
} from './dto/rider-location.dto';
import { ServiceZonesService } from '../service-zones/service-zones.service';

@Injectable()
export class RidersService {
  private readonly logger = new Logger(RidersService.name);

  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    @Inject(forwardRef(() => TrackingPublisherService))
    private readonly trackingPublisher: TrackingPublisherService,
    @Optional()
    private readonly serviceZones?: ServiceZonesService,
  ) {}

  /**
   * Register/create a new rider profile for the authenticated user.
   * Auto-assigns the 'rider' role to user_roles if not already present.
   */
  async createProfile(userId: string, dto: CreateRiderProfileDto) {
    // Check if rider profile already exists
    const existingRider = await this.db.query.riders.findFirst({
      where: eq(schema.riders.userId, userId),
    });

    // A rejected applicant may correct their details and apply again.
    if (existingRider) {
      if (existingRider.verificationStatus !== 'rejected') {
        throw new ConflictException('Rider profile already exists for this user');
      }
      return this.resubmitRejectedProfile(existingRider.id, userId, dto);
    }

    // Verify user exists and is active
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.isActive) {
      throw new ForbiddenException('User account is inactive');
    }

    const dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;

    return await this.db.transaction(async (tx) => {
      // 1. Ensure user has 'rider' role in user_roles
      const existingRole = await tx.query.userRoles.findFirst({
        where: and(
          eq(schema.userRoles.userId, userId),
          eq(schema.userRoles.role, 'rider'),
        ),
      });

      if (!existingRole) {
        await tx.insert(schema.userRoles).values({
          userId,
          role: 'rider',
        });
      }

      // 2. Insert rider profile with pending verification & offline status
      const [rider] = await tx
        .insert(schema.riders)
        .values({
          userId,
          fullName: dto.fullName || user.fullName,
          vehicleType: dto.vehicleType,
          vehicleNumber: dto.vehicleNumber?.trim().toUpperCase() || null,
          licenseNumber: dto.licenseNumber?.trim().toUpperCase() || null,
          dateOfBirth,
          profileImageUrl: dto.profileImageUrl ?? null,
          verificationStatus: 'pending',
          availabilityStatus: 'offline',
          isOnline: false,
          isVerified: false,
        })
        .returning();

      // Keep the account name in step with the application when the user had none.
      if (!user.fullName && dto.fullName?.trim()) {
        await tx
          .update(schema.users)
          .set({ fullName: dto.fullName.trim(), updatedAt: new Date() })
          .where(eq(schema.users.id, userId));
      }

      this.logger.log(`Created rider profile ${rider.id} for user ${userId}`);

      return {
        ...rider,
        user: {
          id: user.id,
          phone: user.phone,
          email: user.email,
        },
      };
    });
  }

  /** Rejected applicant re-applies: details are replaced and the application goes back to pending. */
  private async resubmitRejectedProfile(riderId: string, userId: string, dto: CreateRiderProfileDto) {
    const [rider] = await this.db
      .update(schema.riders)
      .set({
        fullName: dto.fullName.trim(),
        vehicleType: dto.vehicleType,
        vehicleNumber: dto.vehicleNumber?.trim().toUpperCase() || null,
        licenseNumber: dto.licenseNumber?.trim().toUpperCase() || null,
        verificationStatus: 'pending',
        suspensionReason: null, // held the rejection reason
        updatedAt: new Date(),
      })
      .where(eq(schema.riders.id, riderId))
      .returning();

    const user = await this.db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    this.logger.log(`Rider ${riderId} (user ${userId}) re-applied after rejection`);
    return {
      ...rider,
      user: { id: userId, phone: user?.phone ?? null, email: user?.email ?? null },
    };
  }

  /**
   * Get rider profile for the authenticated user
   */
  async getProfile(userId: string) {
    const rider = await this.db.query.riders.findFirst({
      where: eq(schema.riders.userId, userId),
      with: {
        user: true,
      },
    });

    if (!rider) {
      throw new NotFoundException('Rider profile not found for this user');
    }

    return {
      id: rider.id,
      userId: rider.userId,
      fullName: rider.fullName,
      profileImageUrl: rider.profileImageUrl,
      dateOfBirth: rider.dateOfBirth,
      vehicleType: rider.vehicleType,
      vehicleNumber: rider.vehicleNumber,
      licenseNumber: rider.licenseNumber,
      verificationStatus: rider.verificationStatus,
      // Rejection reasons are stored in suspensionReason; expose them under a clear name for the app.
      rejectionReason: rider.verificationStatus === 'rejected' ? rider.suspensionReason : null,
      availabilityStatus: rider.availabilityStatus,
      isSuspended: rider.verificationStatus !== 'rejected' && !!rider.suspensionReason,
      suspensionReason: rider.suspensionReason,
      approvedAt: rider.approvedAt,
      createdAt: rider.createdAt,
      updatedAt: rider.updatedAt,
      user: {
        id: rider.user.id,
        phone: rider.user.phone,
        email: rider.user.email,
        isActive: rider.user.isActive,
      },
    };
  }

  /**
   * Update editable fields of rider profile
   */
  async updateProfile(userId: string, dto: UpdateRiderProfileDto) {
    const rider = await this.db.query.riders.findFirst({
      where: eq(schema.riders.userId, userId),
    });

    if (!rider) {
      throw new NotFoundException('Rider profile not found');
    }

    const updates: Partial<typeof schema.riders.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (dto.fullName !== undefined) updates.fullName = dto.fullName;
    if (dto.vehicleType !== undefined) updates.vehicleType = dto.vehicleType;
    if (dto.vehicleNumber !== undefined) updates.vehicleNumber = dto.vehicleNumber;
    if (dto.profileImageUrl !== undefined) updates.profileImageUrl = dto.profileImageUrl;

    const [updated] = await this.db
      .update(schema.riders)
      .set(updates)
      .where(eq(schema.riders.id, rider.id))
      .returning();

    return updated;
  }

  /**
   * Update rider availability status (online/available vs offline).
   * Enforces that rider must be approved and NOT suspended to go 'available'.
   * Enforces that rider cannot go 'offline' while they have active, in-flight deliveries.
   */
  async updateAvailability(userId: string, dto: UpdateRiderAvailabilityDto) {
    return await this.db.transaction(async (tx) => {
      const [rider] = await tx
        .select()
        .from(schema.riders)
        .where(eq(schema.riders.userId, userId))
        .for('update');

      if (!rider) {
        throw new NotFoundException('Rider profile not found');
      }

      if (dto.availabilityStatus === 'available') {
        // Must be approved
        if (rider.verificationStatus !== 'approved') {
          throw new ForbiddenException(
            `Cannot go available. Rider profile verification status is '${rider.verificationStatus}'. Must be approved.`,
          );
        }

        // Must not be suspended
        if (rider.suspensionReason) {
          throw new ForbiddenException(
            `Cannot go available. Rider is currently suspended: ${rider.suspensionReason}`,
          );
        }

        await this.assertRiderInsideServiceZone(tx, rider.id, dto);
      }

      if (dto.availabilityStatus === 'offline') {
        // Must not have active in-flight deliveries
        const activeStatuses: (
          | 'assigned'
          | 'accepted'
          | 'at_restaurant'
          | 'picked_up'
          | 'arrived_customer'
        )[] = ['assigned', 'accepted', 'at_restaurant', 'picked_up', 'arrived_customer'];

        const activeDeliveries = await tx
          .select({ id: schema.deliveries.id, status: schema.deliveries.status })
          .from(schema.deliveries)
          .where(
            and(
              eq(schema.deliveries.riderId, rider.id),
              inArray(schema.deliveries.status, activeStatuses),
            ),
          );

        if (activeDeliveries.length > 0 || rider.currentActiveOrdersCount > 0) {
          throw new BadRequestException(
            `Cannot go offline with active deliveries in progress (${activeDeliveries.length} active delivery record(s)). Please complete or reassign active orders first.`,
          );
        }
      }

      const [updated] = await tx
        .update(schema.riders)
        .set({
          availabilityStatus: dto.availabilityStatus,
          isOnline: dto.availabilityStatus === 'available',
          updatedAt: new Date(),
        })
        .where(eq(schema.riders.id, rider.id))
        .returning();

      this.logger.log(`Rider ${rider.id} availability updated to ${dto.availabilityStatus}`);

      return {
        riderId: updated.id,
        availabilityStatus: updated.availabilityStatus,
        isOnline: updated.isOnline,
        updatedAt: updated.updatedAt,
      };
    });
  }

  /**
   * Riders can only go online inside an active service zone. Uses the GPS point sent with the
   * request, or the latest stored fix if it is fresh. Skipped when no zone is configured.
   */
  private async assertRiderInsideServiceZone(
    tx: any,
    riderId: string,
    dto: UpdateRiderAvailabilityDto,
  ) {
    if (!this.serviceZones) return;
    const zones = this.serviceZones;

    let point: { latitude: unknown; longitude: unknown } | null = null;
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      point = { latitude: dto.latitude, longitude: dto.longitude };
    } else {
      const [latest] = await tx
        .select()
        .from(schema.riderLocations)
        .where(eq(schema.riderLocations.riderId, riderId))
        .limit(1);
      const freshMs = RidersService.LOCATION_FRESHNESS_THRESHOLD_SECONDS * 1000;
      const seenAt = latest ? new Date(latest.capturedAt || latest.updatedAt).getTime() : 0;
      if (latest && Date.now() - seenAt <= freshMs) {
        point = { latitude: latest.latitude, longitude: latest.longitude };
      }
    }

    const { enforced, zone } = await zones.locate(point?.latitude, point?.longitude);
    if (!enforced) return;
    if (!point) {
      throw new ForbiddenException('Turn on location to go online. We need it to check you are inside the service area.');
    }
    if (!zone) {
      throw new ForbiddenException(
        "You are outside Fleet24's service area. Move inside the delivery zone to go online.",
      );
    }

    // Store the point sent with the request so dispatch and the open pool see the rider at once.
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      const now = new Date();
      await tx
        .insert(schema.riderLocations)
        .values({
          riderId,
          latitude: dto.latitude.toFixed(7),
          longitude: dto.longitude.toFixed(7),
          capturedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.riderLocations.riderId,
          set: { latitude: dto.latitude.toFixed(7), longitude: dto.longitude.toFixed(7), capturedAt: now, updatedAt: now },
        });
    }
  }

  // ================= ADMIN WORKFLOWS =================

  /**
   * List riders with optional filtering and pagination
   */
  async adminListRiders(query: AdminRidersQueryDto) {
    const conditions = [];

    if (query.verificationStatus) {
      conditions.push(eq(schema.riders.verificationStatus, query.verificationStatus));
    }

    if (query.availabilityStatus) {
      conditions.push(eq(schema.riders.availabilityStatus, query.availabilityStatus));
    }

    if (query.search && query.search.trim()) {
      const s = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.riders.fullName, s),
          ilike(schema.riders.vehicleNumber, s),
          ilike(schema.riders.licenseNumber, s),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const [riders, totalCountResult] = await Promise.all([
      this.db.query.riders.findMany({
        where: whereClause,
        with: {
          user: true,
          approver: true,
        },
        orderBy: [desc(schema.riders.createdAt)],
        limit,
        offset,
      }),
      this.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(schema.riders)
        .where(whereClause),
    ]);

    const total = totalCountResult[0]?.count ?? 0;

    return {
      data: riders.map((r) => ({
        id: r.id,
        userId: r.userId,
        fullName: r.fullName,
        vehicleType: r.vehicleType,
        vehicleNumber: r.vehicleNumber,
        licenseNumber: r.licenseNumber,
        verificationStatus: r.verificationStatus,
        availabilityStatus: r.availabilityStatus,
        isSuspended: !!r.suspensionReason,
        suspensionReason: r.suspensionReason,
        approvedAt: r.approvedAt,
        approvedBy: r.approvedBy,
        createdAt: r.createdAt,
        user: {
          phone: r.user?.phone,
          email: r.user?.email,
          isActive: r.user?.isActive,
        },
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single rider profile details for admin
   */
  async adminGetRider(riderId: string) {
    const rider = await this.db.query.riders.findFirst({
      where: eq(schema.riders.id, riderId),
      with: {
        user: true,
        approver: true,
      },
    });

    if (!rider) {
      throw new NotFoundException(`Rider with ID ${riderId} not found`);
    }

    return rider;
  }

  /**
   * Admin approve or reject rider verification
   */
  async adminVerifyRider(adminUserId: string, riderId: string, dto: AdminVerifyRiderDto) {
    const rider = await this.db.query.riders.findFirst({
      where: eq(schema.riders.id, riderId),
    });

    if (!rider) {
      throw new NotFoundException(`Rider with ID ${riderId} not found`);
    }

    const isApproval = dto.verificationStatus === 'approved';

    const updates: Partial<typeof schema.riders.$inferInsert> = {
      verificationStatus: dto.verificationStatus,
      isVerified: isApproval,
      updatedAt: new Date(),
    };

    if (isApproval) {
      updates.approvedAt = new Date();
      updates.approvedBy = adminUserId;
      // Approving a previously rejected rider clears the old rejection reason.
      if (rider.verificationStatus === 'rejected') updates.suspensionReason = null;
    } else {
      // Rejection: reset approval info and force offline
      updates.approvedAt = null;
      updates.approvedBy = null;
      updates.availabilityStatus = 'offline';
      updates.isOnline = false;
      if (dto.rejectionReason) {
        updates.suspensionReason = dto.rejectionReason;
      }
    }

    const [updated] = await this.db
      .update(schema.riders)
      .set(updates)
      .where(eq(schema.riders.id, riderId))
      .returning();

    this.logger.log(
      `Admin ${adminUserId} set rider ${riderId} verification status to ${dto.verificationStatus}`,
    );

    return updated;
  }

  /**
   * Admin suspend rider with a mandatory reason, forcing availability offline
   */
  async adminSuspendRider(adminUserId: string, riderId: string, dto: AdminSuspendRiderDto) {
    const rider = await this.db.query.riders.findFirst({
      where: eq(schema.riders.id, riderId),
    });

    if (!rider) {
      throw new NotFoundException(`Rider with ID ${riderId} not found`);
    }

    const [updated] = await this.db
      .update(schema.riders)
      .set({
        suspensionReason: dto.suspensionReason,
        availabilityStatus: 'offline',
        isOnline: false,
        updatedAt: new Date(),
      })
      .where(eq(schema.riders.id, riderId))
      .returning();

    this.logger.warn(
      `Admin ${adminUserId} suspended rider ${riderId}. Reason: ${dto.suspensionReason}`,
    );

    return updated;
  }

  /**
   * Admin unsuspend / reinstate rider
   */
  async adminUnsuspendRider(adminUserId: string, riderId: string) {
    const rider = await this.db.query.riders.findFirst({
      where: eq(schema.riders.id, riderId),
    });

    if (!rider) {
      throw new NotFoundException(`Rider with ID ${riderId} not found`);
    }

    const [updated] = await this.db
      .update(schema.riders)
      .set({
        suspensionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.riders.id, riderId))
      .returning();

    this.logger.log(`Admin ${adminUserId} unsuspended rider ${riderId}`);

    return updated;
  }

  // ================= LOCATION TRACKING (PHASE 4.2) =================

  /**
   * Freshness threshold in seconds:
   * - fresh: <= 300 seconds (5 minutes)
   * - stale: > 300 seconds
   * - missing: no location recorded
   */
  public static readonly LOCATION_FRESHNESS_THRESHOLD_SECONDS = 300;

  /**
   * Maximum acceptable age for client-captured timestamp (10 minutes)
   * Prevents replaying excessively old GPS locations.
   */
  public static readonly MAX_GPS_CAPTURE_AGE_SECONDS = 600;

  /**
   * Maximum acceptable clock drift in the future (60 seconds)
   */
  public static readonly MAX_FUTURE_DRIFT_SECONDS = 60;

  /**
   * Determines location freshness status and elapsed age in seconds.
   */
  calculateLocationFreshness(updatedAt: Date | null | undefined): {
    freshness: LocationFreshness;
    ageSeconds: number;
  } {
    if (!updatedAt) {
      return { freshness: 'missing', ageSeconds: Infinity };
    }

    const ageSeconds = Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000));
    const freshness: LocationFreshness =
      ageSeconds <= RidersService.LOCATION_FRESHNESS_THRESHOLD_SECONDS ? 'fresh' : 'stale';

    return { freshness, ageSeconds };
  }

  /**
   * Update latest location for the authenticated rider.
   * Atomically upserts into rider_locations.
   */
  async updateLocation(userId: string, dto: UpdateRiderLocationDto): Promise<RiderLocationResponse> {
    // 1. Resolve rider profile
    const rider = await this.db.query.riders.findFirst({
      where: eq(schema.riders.userId, userId),
    });

    if (!rider) {
      throw new NotFoundException('Rider profile not found for authenticated user');
    }

    // 2. Business rule: Must be approved
    if (rider.verificationStatus !== 'approved') {
      throw new ForbiddenException(
        `Cannot update location. Rider profile verification status is '${rider.verificationStatus}'. Must be approved.`,
      );
    }

    // 3. Business rule: Must not be suspended
    if (rider.suspensionReason) {
      throw new ForbiddenException(
        `Cannot update location. Rider is currently suspended: ${rider.suspensionReason}`,
      );
    }

    // 4. Business rule: Offline riders cannot submit active location updates
    if (rider.availabilityStatus === 'offline') {
      throw new ForbiddenException(
        'Cannot update location. Rider is currently offline. Must be available or busy to transmit live location.',
      );
    }

    // 5. GPS timestamp validation
    let capturedAtDate: Date | null = null;
    if (dto.capturedAt) {
      capturedAtDate = new Date(dto.capturedAt);
      const now = Date.now();
      const capturedTime = capturedAtDate.getTime();

      if (isNaN(capturedTime)) {
        throw new BadRequestException('Invalid capturedAt timestamp format');
      }

      // Reject readings too far in the future
      if (capturedTime > now + RidersService.MAX_FUTURE_DRIFT_SECONDS * 1000) {
        throw new BadRequestException('GPS capturedAt timestamp cannot be in the future');
      }

      // Reject readings older than max allowed age (e.g. 10 minutes)
      if (now - capturedTime > RidersService.MAX_GPS_CAPTURE_AGE_SECONDS * 1000) {
        throw new BadRequestException(
          `GPS reading is too stale (older than ${RidersService.MAX_GPS_CAPTURE_AGE_SECONDS} seconds). Please acquire an updated GPS fix.`,
        );
      }
    }

    const now = new Date();

    // 6. Atomic UPSERT into rider_locations on riderId conflict
    const [savedLocation] = await this.db
      .insert(schema.riderLocations)
      .values({
        riderId: rider.id,
        latitude: String(dto.latitude),
        longitude: String(dto.longitude),
        accuracy: dto.accuracy !== undefined ? String(dto.accuracy) : null,
        heading: dto.heading !== undefined ? String(dto.heading) : null,
        speed: dto.speed !== undefined ? String(dto.speed) : null,
        capturedAt: capturedAtDate,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.riderLocations.riderId,
        set: {
          latitude: String(dto.latitude),
          longitude: String(dto.longitude),
          accuracy: dto.accuracy !== undefined ? String(dto.accuracy) : null,
          heading: dto.heading !== undefined ? String(dto.heading) : null,
          speed: dto.speed !== undefined ? String(dto.speed) : null,
          capturedAt: capturedAtDate,
          updatedAt: now,
        },
      })
      .returning();

    const { freshness, ageSeconds } = this.calculateLocationFreshness(savedLocation.updatedAt);

    // 7. Real-Time Tracking: Broadcast updated coordinates to customers of this rider's active deliveries
    // Only broadcast if the reading is fresh (<= 300 seconds)
    if (freshness === 'fresh') {
      try {
        const activeEligibleStatuses: (
          | 'assigned'
          | 'accepted'
          | 'at_restaurant'
          | 'picked_up'
          | 'arrived_customer'
        )[] = ['assigned', 'accepted', 'at_restaurant', 'picked_up', 'arrived_customer'];

        const activeDeliveries = await this.db.query.deliveries.findMany({
          where: and(
            eq(schema.deliveries.riderId, rider.id),
            inArray(schema.deliveries.status, activeEligibleStatuses),
          ),
        });

        for (const activeDelivery of activeDeliveries) {
          this.trackingPublisher.publishLocationUpdate({
            orderId: activeDelivery.orderId,
            deliveryId: activeDelivery.id,
            latitude: Number(savedLocation.latitude),
            longitude: Number(savedLocation.longitude),
            accuracy: savedLocation.accuracy !== null ? Number(savedLocation.accuracy) : null,
            heading: savedLocation.heading !== null ? Number(savedLocation.heading) : null,
            speed: savedLocation.speed !== null ? Number(savedLocation.speed) : null,
            capturedAt: savedLocation.capturedAt ? savedLocation.capturedAt.toISOString() : null,
            updatedAt: savedLocation.updatedAt.toISOString(),
          });
        }
      } catch (broadcastErr: any) {
        // Broadcasting failure must never break or roll back the successful GPS database persistence
        this.logger.error(
          `Failed to broadcast location update for rider ${rider.id}: ${broadcastErr.message}`,
        );
      }
    }

    return {
      riderId: savedLocation.riderId,
      latitude: Number(savedLocation.latitude),
      longitude: Number(savedLocation.longitude),
      accuracy: savedLocation.accuracy !== null ? Number(savedLocation.accuracy) : null,
      heading: savedLocation.heading !== null ? Number(savedLocation.heading) : null,
      speed: savedLocation.speed !== null ? Number(savedLocation.speed) : null,
      capturedAt: savedLocation.capturedAt,
      updatedAt: savedLocation.updatedAt,
      freshness,
      ageSeconds,
    };
  }

  /**
   * Get latest location of the authenticated rider.
   */
  async getLocation(userId: string): Promise<RiderLocationResponse> {
    const rider = await this.db.query.riders.findFirst({
      where: eq(schema.riders.userId, userId),
    });

    if (!rider) {
      throw new NotFoundException('Rider profile not found for authenticated user');
    }

    const location = await this.db.query.riderLocations.findFirst({
      where: eq(schema.riderLocations.riderId, rider.id),
    });

    if (!location) {
      throw new NotFoundException('No location recorded for this rider');
    }

    const { freshness, ageSeconds } = this.calculateLocationFreshness(location.updatedAt);

    return {
      riderId: location.riderId,
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


