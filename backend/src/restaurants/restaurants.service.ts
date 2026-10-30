import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc, and } from 'drizzle-orm';
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
import { AuthenticatedUserPayload } from '../auth/decorators/auth.decorators';
import { OutletAuthorizationService } from './outlet-auth.service';

@Injectable()
export class RestaurantsService {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly outletAuthService: OutletAuthorizationService,
  ) {}

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

    // If restaurant staff, return only outlets assigned to them
    const staffAssignments = await this.db.query.restaurantStaff.findMany({
      where: and(
        eq(schema.restaurantStaff.userId, user.userId),
        eq(schema.restaurantStaff.isActive, true),
      ),
    });

    const outletIds = staffAssignments.map((s) => s.outletId);

    if (outletIds.length === 0) {
      return [];
    }

    const outlets = [];
    for (const id of outletIds) {
      const out = await this.db.query.restaurantOutlets.findFirst({
        where: eq(schema.restaurantOutlets.id, id),
        with: {
          restaurant: true,
          operatingHours: true,
        },
      });
      if (out) outlets.push(out);
    }

    return outlets;
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
}
