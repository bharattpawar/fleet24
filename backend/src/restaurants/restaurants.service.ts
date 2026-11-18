import {
  Optional,
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc, and, inArray, gte, lte, sql } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import {
  CreateRestaurantDto,
  UpdateRestaurantDto,
  CreateOutletDto,
  UpdateOutletDto,
  PaginationQueryDto,
  OperatingHourDayDto,
} from './dto/restaurant.dto';
import {
  RestaurantSettlementQueryDto,
  RestaurantFinancialSummaryQueryDto,
} from './dto/restaurant-finance.dto';
import { AuthenticatedUserPayload } from '../auth/decorators/auth.decorators';
import { OutletAuthorizationService } from './outlet-auth.service';
import { ServiceZonesService } from '../service-zones/service-zones.service';

@Injectable()
export class RestaurantsService {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly outletAuthService: OutletAuthorizationService,
    @Optional()
    private readonly serviceZones?: ServiceZonesService,
  ) {}

  private async assertOutletInServiceZone(latitude: unknown, longitude: unknown) {
    await this.serviceZones?.assertServiceable(
      latitude,
      longitude,
      'This outlet location is outside every active service area. Add or extend a service area first.',
    );
  }

  /**
   * Helper to slugify a name if not explicitly provided
   */
  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // ==========================================
  // RESTAURANT MANAGEMENT (Admin Only)
  // ==========================================

  async createRestaurant(dto: CreateRestaurantDto, user: AuthenticatedUserPayload) {
    const slug = dto.slug || this.generateSlug(dto.name);

    // Check slug uniqueness
    const existing = await this.db.query.restaurants.findFirst({
      where: eq(schema.restaurants.slug, slug),
    });

    if (existing) {
      throw new ConflictException(`Restaurant with slug '${slug}' already exists.`);
    }

    const [restaurant] = await this.db
      .insert(schema.restaurants)
      .values({
        name: dto.name,
        slug,
        description: dto.description || null,
        logoUrl: dto.logoUrl || null,
        ownerId: dto.ownerId || null,
        isActive: true,
      })
      .returning();

    // Log admin audit
    await this.db.insert(schema.auditLogs).values({
      action: 'restaurant_created',
      entityType: 'restaurant',
      entityId: restaurant.id,
      performedByUserId: user.userId,
      details: { name: restaurant.name, slug: restaurant.slug },
    });

    return restaurant;
  }

  async listRestaurants(query: PaginationQueryDto) {
    const limit = query.limit || 20;
    const offset = ((query.page || 1) - 1) * limit;

    const items = await this.db.query.restaurants.findMany({
      limit,
      offset,
      orderBy: [desc(schema.restaurants.createdAt)],
      with: {
        outlets: true,
      },
    });

    return {
      page: query.page,
      limit,
      items,
    };
  }

  async getRestaurantById(restaurantId: string) {
    const restaurant = await this.db.query.restaurants.findFirst({
      where: eq(schema.restaurants.id, restaurantId),
      with: {
        outlets: true,
      },
    });

    if (!restaurant) {
      throw new NotFoundException(`Restaurant with ID '${restaurantId}' not found.`);
    }

    return restaurant;
  }

  async updateRestaurant(
    restaurantId: string,
    dto: UpdateRestaurantDto,
    user: AuthenticatedUserPayload,
  ) {
    const existing = await this.getRestaurantById(restaurantId);

    const [updated] = await this.db
      .update(schema.restaurants)
      .set({
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
        ...(dto.ownerId !== undefined ? { ownerId: dto.ownerId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.restaurants.id, existing.id))
      .returning();

    await this.db.insert(schema.auditLogs).values({
      action: 'restaurant_updated',
      entityType: 'restaurant',
      entityId: existing.id,
      performedByUserId: user.userId,
      details: dto,
    });

    return updated;
  }

  async updateRestaurantStatus(
    restaurantId: string,
    isActive: boolean,
    user: AuthenticatedUserPayload,
  ) {
    const existing = await this.getRestaurantById(restaurantId);

    const [updated] = await this.db
      .update(schema.restaurants)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(schema.restaurants.id, existing.id))
      .returning();

    await this.db.insert(schema.auditLogs).values({
      action: isActive ? 'restaurant_activated' : 'restaurant_deactivated',
      entityType: 'restaurant',
      entityId: existing.id,
      performedByUserId: user.userId,
      details: { isActive },
    });

    return updated;
  }

  // ==========================================
  // OUTLET MANAGEMENT
  // ==========================================

  async createOutlet(
    restaurantId: string,
    dto: CreateOutletDto,
    user: AuthenticatedUserPayload,
  ) {
    const restaurant = await this.getRestaurantById(restaurantId);
    await this.assertOutletInServiceZone(dto.latitude, dto.longitude);

    const [outlet] = await this.db
      .insert(schema.restaurantOutlets)
      .values({
        restaurantId: restaurant.id,
        name: dto.name,
        phone: dto.phone,
        address: dto.address,
        latitude: dto.latitude.toString(),
        longitude: dto.longitude.toString(),
        deliveryRadiusKm: dto.deliveryRadiusKm ? dto.deliveryRadiusKm.toFixed(2) : '3.00',
        isAcceptingOrders: true,
        isActive: true,
      })
      .returning();

    await this.db.insert(schema.auditLogs).values({
      action: 'outlet_created',
      entityType: 'outlet',
      entityId: outlet.id,
      performedByUserId: user.userId,
      details: { restaurantId: restaurant.id, name: outlet.name },
    });

    return outlet;
  }

  async listOutlets(user: AuthenticatedUserPayload) {
    // If admin, can view all outlets
    if (user.roles.includes('admin')) {
      return this.db.query.restaurantOutlets.findMany({
        with: {
          restaurant: true,
          operatingHours: true,
        },
        orderBy: [desc(schema.restaurantOutlets.createdAt)],
      });
    }

    // 1. Check if user is owner of any restaurants
    const ownedRestaurants = await this.db.query.restaurants.findMany({
      where: eq(schema.restaurants.ownerId, user.userId),
      with: {
        outlets: {
          with: {
            restaurant: true,
            operatingHours: true,
          },
        },
      },
    });

    const outletMap = new Map<string, any>();

    for (const rest of ownedRestaurants) {
      for (const outlet of rest.outlets || []) {
        outletMap.set(outlet.id, outlet);
      }
    }

    // 2. Add staff-assigned outlets
    const staffAssignments = await this.db.query.restaurantStaff.findMany({
      where: and(
        eq(schema.restaurantStaff.userId, user.userId),
        eq(schema.restaurantStaff.isActive, true),
      ),
    });

    for (const assignment of staffAssignments) {
      if (!outletMap.has(assignment.outletId)) {
        const out = await this.db.query.restaurantOutlets.findFirst({
          where: eq(schema.restaurantOutlets.id, assignment.outletId),
          with: {
            restaurant: true,
            operatingHours: true,
          },
        });
        if (out) outletMap.set(out.id, out);
      }
    }

    return Array.from(outletMap.values());
  }

  async getOutletDetails(outletId: string, user: AuthenticatedUserPayload) {
    await this.outletAuthService.verifyOutletAccess(user, outletId);

    const outlet = await this.db.query.restaurantOutlets.findFirst({
      where: eq(schema.restaurantOutlets.id, outletId),
      with: {
        restaurant: true,
        operatingHours: true,
      },
    });

    return outlet;
  }

  async updateOutlet(
    outletId: string,
    dto: UpdateOutletDto,
    user: AuthenticatedUserPayload,
  ) {
    await this.outletAuthService.verifyOutletAccess(user, outletId);
    if (dto.latitude !== undefined || dto.longitude !== undefined) {
      if (dto.latitude === undefined || dto.longitude === undefined) {
        throw new BadRequestException('latitude and longitude must be updated together.');
      }
      await this.assertOutletInServiceZone(dto.latitude, dto.longitude);
    }

    const [updated] = await this.db
      .update(schema.restaurantOutlets)
      .set({
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.phone ? { phone: dto.phone } : {}),
        ...(dto.address ? { address: dto.address } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude.toString() } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude.toString() } : {}),
        ...(dto.deliveryRadiusKm !== undefined
          ? { deliveryRadiusKm: dto.deliveryRadiusKm.toFixed(2) }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.restaurantOutlets.id, outletId))
      .returning();

    return updated;
  }

  async updateOrderAcceptance(
    outletId: string,
    isAcceptingOrders: boolean,
    user: AuthenticatedUserPayload,
  ) {
    await this.outletAuthService.verifyOutletAccess(user, outletId);

    const [updated] = await this.db
      .update(schema.restaurantOutlets)
      .set({
        isAcceptingOrders,
        updatedAt: new Date(),
      })
      .where(eq(schema.restaurantOutlets.id, outletId))
      .returning();

    await this.db.insert(schema.auditLogs).values({
      action: isAcceptingOrders ? 'outlet_orders_resumed' : 'outlet_orders_paused',
      entityType: 'outlet',
      entityId: outletId,
      performedByUserId: user.userId,
      details: { isAcceptingOrders },
    });

    return updated;
  }

  // ==========================================
  // OPERATING HOURS
  // ==========================================

  async getOutletOperatingHours(outletId: string, user: AuthenticatedUserPayload) {
    await this.outletAuthService.verifyOutletAccess(user, outletId);

    return this.db.query.outletOperatingHours.findMany({
      where: eq(schema.outletOperatingHours.outletId, outletId),
      orderBy: [schema.outletOperatingHours.dayOfWeek],
    });
  }

  async saveOutletOperatingHours(
    outletId: string,
    days: OperatingHourDayDto[],
    user: AuthenticatedUserPayload,
  ) {
    await this.outletAuthService.verifyOutletAccess(user, outletId);

    // Business rule check: ensure open_time < close_time when not closed
    for (const d of days) {
      if (!d.isClosed && d.openTime >= d.closeTime) {
        throw new BadRequestException(
          `Day ${d.dayOfWeek}: openTime (${d.openTime}) must be earlier than closeTime (${d.closeTime}).`,
        );
      }
    }

    // Upsert days inside a transaction
    return this.db.transaction(async (tx) => {
      // Clear existing schedule and replace with provided days
      await tx
        .delete(schema.outletOperatingHours)
        .where(eq(schema.outletOperatingHours.outletId, outletId));

      const inserted = [];
      for (const d of days) {
        const [row] = await tx
          .insert(schema.outletOperatingHours)
          .values({
            outletId,
            dayOfWeek: d.dayOfWeek,
            openTime: d.openTime,
            closeTime: d.closeTime,
            isClosed: d.isClosed || false,
          })
          .returning();
        inserted.push(row);
      }

      await tx.insert(schema.auditLogs).values({
        action: 'operating_hours_updated',
        entityType: 'outlet',
        entityId: outletId,
        performedByUserId: user.userId,
        details: { daysCount: days.length, timezone: 'Asia/Kolkata' },
      });

      return inserted;
    });
  }

  // ==========================================
  // RESTAURANT PARTNER PROFILE & FINANCIALS
  // ==========================================

  /**
   * Helper to resolve all restaurant IDs authorized for the authenticated user.
   * - Admins have access to all restaurants.
   * - Restaurant staff have access only to restaurants for which they hold active outlet assignments.
   */
  async getAuthorizedRestaurantIds(user: AuthenticatedUserPayload): Promise<string[]> {
    // 1. Check if user is the direct Owner of any restaurants
    const ownedRestaurants = await this.db.query.restaurants.findMany({
      where: eq(schema.restaurants.ownerId, user.userId),
      columns: { id: true },
    });
    const ownedRestaurantIds = ownedRestaurants.map((r) => r.id);

    // 2. Check if user has active restaurant_staff assignments
    const assignments = await this.db.query.restaurantStaff.findMany({
      where: and(
        eq(schema.restaurantStaff.userId, user.userId),
        eq(schema.restaurantStaff.isActive, true),
      ),
      with: {
        outlet: {
          columns: {
            restaurantId: true,
          },
        },
      },
    });

    const staffRestaurantIds = assignments
      .map((a: any) => a.outlet?.restaurantId)
      .filter((id): id is string => Boolean(id));

    const combinedRestaurantIds = Array.from(new Set([...ownedRestaurantIds, ...staffRestaurantIds]));

    if (combinedRestaurantIds.length > 0) {
      return combinedRestaurantIds;
    }

    // 3. Fallback for root admin if user possesses admin role
    if (user.roles && user.roles.includes('admin')) {
      const all = await this.db.query.restaurants.findMany({
        columns: { id: true },
      });
      return all.map((r) => r.id);
    }

    throw new ForbiddenException(
      'Access denied. You are neither a registered restaurant owner nor assigned staff to any active outlet.',
    );
  }

  /**
   * GET /api/v1/restaurant/profile
   * Returns authenticated staff / owner member details and all authorized outlets.
   */
  async getRestaurantStaffProfile(user: AuthenticatedUserPayload) {
    const userRecord = await this.db.query.users.findFirst({
      where: eq(schema.users.id, user.userId),
    });

    if (!userRecord) {
      throw new NotFoundException('User profile not found.');
    }

    // 1. Check if user owns any restaurants
    const ownedRestaurants = await this.db.query.restaurants.findMany({
      where: eq(schema.restaurants.ownerId, user.userId),
      with: {
        outlets: true,
      },
      orderBy: [desc(schema.restaurants.createdAt)],
    });

    // 2. Check active staff assignments
    const staffAssignments = await this.db.query.restaurantStaff.findMany({
      where: and(
        eq(schema.restaurantStaff.userId, user.userId),
        eq(schema.restaurantStaff.isActive, true),
      ),
      with: {
        outlet: {
          with: {
            restaurant: true,
          },
        },
      },
    });

    const isOwner = ownedRestaurants.length > 0;
    const isStaff = staffAssignments.length > 0;
    const isAdmin = Boolean(user.roles && user.roles.includes('admin'));

    if (!isOwner && !isStaff && !isAdmin) {
      throw new ForbiddenException(
        'Access denied. You are not registered as a restaurant owner or active staff member.',
      );
    }

    // Determine primary designation and resolved role
    let primaryDesignation = 'Staff Member';
    let userRole = 'staff';
    let brandName = 'Fleet24 Kitchen';

    const authorizedOutlets: Array<{
      outletId: string;
      outletName: string;
      address: string;
      phone: string;
      isAcceptingOrders: boolean;
      isActive: boolean;
      deliveryRadiusKm: string;
      designation: string;
      role: 'owner' | 'manager' | 'staff' | 'admin';
      restaurant: {
        id: string;
        name: string;
        slug: string;
        verificationStatus: string;
        isActive: boolean;
      };
    }> = [];

    // Add owned outlets first
    if (isOwner) {
      primaryDesignation = 'Owner';
      userRole = 'owner';
      brandName = ownedRestaurants[0].name;

      for (const rest of ownedRestaurants) {
        for (const outlet of rest.outlets || []) {
          authorizedOutlets.push({
            outletId: outlet.id,
            outletName: outlet.name,
            address: outlet.address,
            phone: outlet.phone,
            isAcceptingOrders: outlet.isAcceptingOrders,
            isActive: outlet.isActive,
            deliveryRadiusKm: outlet.deliveryRadiusKm,
            designation: 'Owner',
            role: 'owner',
            restaurant: {
              id: rest.id,
              name: rest.name,
              slug: rest.slug,
              verificationStatus: rest.verificationStatus,
              isActive: rest.isActive,
            },
          });
        }
      }
    }

    // Add staff assigned outlets (avoid duplicates if user is both owner and staff of same outlet)
    if (isStaff) {
      if (!isOwner) {
        primaryDesignation = staffAssignments[0]?.designation || 'Staff Member';
        userRole = staffAssignments[0]?.designation?.toLowerCase().includes('manager') ? 'manager' : 'staff';
        brandName = staffAssignments[0]?.outlet?.restaurant?.name || 'Fleet24 Kitchen';
      }

      for (const assignment of staffAssignments) {
        if (!authorizedOutlets.some((o) => o.outletId === assignment.outletId)) {
          authorizedOutlets.push({
            outletId: assignment.outlet.id,
            outletName: assignment.outlet.name,
            address: assignment.outlet.address,
            phone: assignment.outlet.phone,
            isAcceptingOrders: assignment.outlet.isAcceptingOrders,
            isActive: assignment.outlet.isActive,
            deliveryRadiusKm: assignment.outlet.deliveryRadiusKm,
            designation: assignment.designation,
            role: assignment.designation?.toLowerCase().includes('manager') ? 'manager' : 'staff',
            restaurant: {
              id: assignment.outlet.restaurant.id,
              name: assignment.outlet.restaurant.name,
              slug: assignment.outlet.restaurant.slug,
              verificationStatus: assignment.outlet.restaurant.verificationStatus,
              isActive: assignment.outlet.restaurant.isActive,
            },
          });
        }
      }
    }

    // If root admin without specific ownership or staff assignment, load all outlets for administration
    if (!isOwner && !isStaff && isAdmin) {
      primaryDesignation = 'Platform Administrator';
      userRole = 'admin';
      const allOutlets = await this.db.query.restaurantOutlets.findMany({
        with: {
          restaurant: true,
        },
        orderBy: [desc(schema.restaurantOutlets.createdAt)],
      });

      brandName = allOutlets[0]?.restaurant?.name || 'Fleet24 Network';

      for (const outlet of allOutlets) {
        authorizedOutlets.push({
          outletId: outlet.id,
          outletName: outlet.name,
          address: outlet.address,
          phone: outlet.phone,
          isAcceptingOrders: outlet.isAcceptingOrders,
          isActive: outlet.isActive,
          deliveryRadiusKm: outlet.deliveryRadiusKm,
          designation: 'Admin',
          role: 'admin',
          restaurant: {
            id: outlet.restaurant.id,
            name: outlet.restaurant.name,
            slug: outlet.restaurant.slug,
            verificationStatus: outlet.restaurant.verificationStatus,
            isActive: outlet.restaurant.isActive,
          },
        });
      }
    }

    return {
      staff: {
        id: userRecord.id,
        name: userRecord.fullName === 'Fleet24 User' && isOwner
          ? `${brandName} (Owner)`
          : userRecord.fullName,
        email: userRecord.email,
        phone: userRecord.phone,
        roles: user.roles,
        designation: primaryDesignation,
        resolvedRole: userRole,
        restaurantName: brandName,
        isOwner,
      },
      authorizedOutlets,
    };
  }

  /**
   * GET /api/v1/restaurant/settlements
   * Returns settlement records only for authorized restaurants.
   */
  async getRestaurantSettlements(
    user: AuthenticatedUserPayload,
    query: RestaurantSettlementQueryDto,
  ) {
    const authorizedRestaurantIds = await this.getAuthorizedRestaurantIds(user);

    // If caller requests a specific restaurant, ensure it is within their authorized list
    let targetRestaurantIds: string[] = authorizedRestaurantIds;
    if (query.restaurantId) {
      if (!authorizedRestaurantIds.includes(query.restaurantId)) {
        throw new ForbiddenException(
          'Access denied. You are not authorized to view settlements for this restaurant.',
        );
      }
      targetRestaurantIds = [query.restaurantId];
    }

    if (targetRestaurantIds.length === 0) {
      return {
        items: [],
        pagination: {
          page: query.page ?? 1,
          limit: query.limit ?? 20,
          total: 0,
          totalPages: 1,
        },
      };
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: any[] = [
      inArray(schema.restaurantSettlements.restaurantId, targetRestaurantIds),
    ];

    if (query.status && query.status !== 'all') {
      conditions.push(eq(schema.restaurantSettlements.status, query.status as any));
    }
    if (query.from) {
      conditions.push(gte(schema.restaurantSettlements.createdAt, new Date(query.from)));
    }
    if (query.to) {
      conditions.push(lte(schema.restaurantSettlements.createdAt, new Date(query.to)));
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.restaurantSettlements)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    const items = await this.db
      .select({
        id: schema.restaurantSettlements.id,
        restaurantId: schema.restaurantSettlements.restaurantId,
        settlementReference: schema.restaurantSettlements.settlementReference,
        periodStart: schema.restaurantSettlements.periodStart,
        periodEnd: schema.restaurantSettlements.periodEnd,
        grossOrderAmount: schema.restaurantSettlements.grossOrderAmount,
        commissionAmount: schema.restaurantSettlements.commissionAmount,
        taxAmount: schema.restaurantSettlements.taxAmount,
        refundDeductions: schema.restaurantSettlements.refundDeductions,
        netPayableAmount: schema.restaurantSettlements.netPayableAmount,
        currency: schema.restaurantSettlements.currency,
        status: schema.restaurantSettlements.status,
        approvedAt: schema.restaurantSettlements.approvedAt,
        settledAt: schema.restaurantSettlements.settledAt,
        failureReason: schema.restaurantSettlements.failureReason,
        createdAt: schema.restaurantSettlements.createdAt,
      })
      .from(schema.restaurantSettlements)
      .where(whereClause)
      .orderBy(desc(schema.restaurantSettlements.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * GET /api/v1/restaurant/finance/summary
   * Provides current payable balance, previous completed settlement, pending liability,
   * and delivery credit quota details for authorized restaurant(s).
   */
  async getRestaurantFinancialSummary(
    user: AuthenticatedUserPayload,
    query: RestaurantFinancialSummaryQueryDto,
  ) {
    const authorizedRestaurantIds = await this.getAuthorizedRestaurantIds(user);

    let targetRestaurantIds: string[] = authorizedRestaurantIds;
    if (query.restaurantId) {
      if (!authorizedRestaurantIds.includes(query.restaurantId)) {
        throw new ForbiddenException(
          'Access denied. You are not authorized to view financial summary for this restaurant.',
        );
      }
      targetRestaurantIds = [query.restaurantId];
    }

    // 1. Total settled disbursements across authorized restaurants
    const [settledResult] = await this.db
      .select({
        totalSettledAmount: sql<string>`coalesce(sum(net_payable_amount), 0.00)::text`,
      })
      .from(schema.restaurantSettlements)
      .where(
        and(
          inArray(schema.restaurantSettlements.restaurantId, targetRestaurantIds),
          eq(schema.restaurantSettlements.status, 'settled'),
        ),
      );

    // 2. Pending settlements awaiting approval or processing
    const [pendingResult] = await this.db
      .select({
        pendingSettlementAmount: sql<string>`coalesce(sum(net_payable_amount), 0.00)::text`,
        pendingCount: sql<number>`count(*)::int`,
      })
      .from(schema.restaurantSettlements)
      .where(
        and(
          inArray(schema.restaurantSettlements.restaurantId, targetRestaurantIds),
          inArray(schema.restaurantSettlements.status, ['pending', 'approved', 'processing']),
        ),
      );

    // 3. Most recent completed settlement payout
    const previousSettlement = await this.db.query.restaurantSettlements.findFirst({
      where: and(
        inArray(schema.restaurantSettlements.restaurantId, targetRestaurantIds),
        eq(schema.restaurantSettlements.status, 'settled'),
      ),
      orderBy: [desc(schema.restaurantSettlements.settledAt)],
    });

    // 4. Current monthly delivery credits
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const creditBlocks = await this.db.query.restaurantMonthlyDeliveryCredits.findMany({
      where: and(
        inArray(schema.restaurantMonthlyDeliveryCredits.restaurantId, targetRestaurantIds),
        eq(schema.restaurantMonthlyDeliveryCredits.periodMonthYear, yearMonth),
      ),
    });

    let totalAllocatedCredits = 0;
    let totalUsedCredits = 0;
    let totalAdditionalDeliveries = 0;
    let totalAdditionalCharges = 0;

    for (const block of creditBlocks) {
      totalAllocatedCredits += block.allocatedCredits || 0;
      totalUsedCredits += block.usedCredits || 0;
      totalAdditionalDeliveries += block.additionalDeliveriesCount || 0;
      const fee = parseFloat(block.additionalPerDeliveryFee || '25.00');
      totalAdditionalCharges += (block.additionalDeliveriesCount || 0) * fee;
    }

    const pendingAmount = parseFloat(pendingResult?.pendingSettlementAmount || '0.00');
    const settledAmount = parseFloat(settledResult?.totalSettledAmount || '0.00');

    return {
      financialSummary: {
        currency: 'INR',
        // Total pending settlement liability calculated from delivered orders & generated settlement records
        currentPayableBalance: pendingAmount.toFixed(2),
        // Cumulative completed disbursements
        totalSettledAmount: settledAmount.toFixed(2),
        // Pending settlements awaiting disbursement
        pendingSettlementAmount: pendingAmount.toFixed(2),
        pendingSettlementCount: pendingResult?.pendingCount ?? 0,
        // Details of most recent bank payout
        previousSettlement: previousSettlement
          ? {
              id: previousSettlement.id,
              settlementReference: previousSettlement.settlementReference,
              amount: previousSettlement.netPayableAmount,
              settledAt: previousSettlement.settledAt,
              status: previousSettlement.status,
            }
          : null,
      },
      deliveryCredits: {
        periodMonthYear: yearMonth,
        allocatedCredits: totalAllocatedCredits,
        usedCredits: totalUsedCredits,
        remainingCredits: Math.max(0, totalAllocatedCredits - totalUsedCredits),
        additionalDeliveriesCount: totalAdditionalDeliveries,
        additionalCharges: totalAdditionalCharges.toFixed(2),
      },
    };
  }
}
