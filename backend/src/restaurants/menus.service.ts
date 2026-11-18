import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc, and } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { calculateDistanceKm, isWithinDeliveryRadius } from '../common/utils/geo';
import {
  CreateMenuCategoryDto,
  UpdateMenuCategoryDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
  OutletMenuItemOverrideDto,
} from './dto/restaurant.dto';
import { AuthenticatedUserPayload } from '../auth/decorators/auth.decorators';
import { OutletAuthorizationService } from './outlet-auth.service';
import { RoutingService } from '../routing/routing.service';
import { FinancialSettingsService } from '../admin/financial-settings.service';
import { ServiceZonesService } from '../service-zones/service-zones.service';

@Injectable()
export class MenusService {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly outletAuthService: OutletAuthorizationService,
    @Optional()
    private readonly routingService?: RoutingService,
    @Optional()
    private readonly financialSettingsService?: FinancialSettingsService,
    @Optional()
    private readonly serviceZones?: ServiceZonesService,
  ) {}

  // ==========================================
  // MENU CATEGORIES
  // ==========================================

  async createCategory(
    outletId: string,
    dto: CreateMenuCategoryDto,
    user: AuthenticatedUserPayload,
  ) {
    const outlet = await this.outletAuthService.verifyOutletAccess(user, outletId);

    const [category] = await this.db
      .insert(schema.menuCategories)
      .values({
        restaurantId: outlet.restaurantId,
        name: dto.name,
        displayOrder: dto.displayOrder ?? 0,
        isActive: true,
      })
      .returning();

    return category;
  }

  async listCategoriesByOutlet(outletId: string) {
    const outlet = await this.db.query.restaurantOutlets.findFirst({
      where: eq(schema.restaurantOutlets.id, outletId),
    });

    if (!outlet) {
      throw new NotFoundException(`Outlet with ID '${outletId}' not found.`);
    }

    return this.db.query.menuCategories.findMany({
      where: and(
        eq(schema.menuCategories.restaurantId, outlet.restaurantId),
        eq(schema.menuCategories.isActive, true),
      ),
      orderBy: [schema.menuCategories.displayOrder, desc(schema.menuCategories.createdAt)],
    });
  }

  async updateCategory(
    categoryId: string,
    dto: UpdateMenuCategoryDto,
    user: AuthenticatedUserPayload,
  ) {
    const category = await this.db.query.menuCategories.findFirst({
      where: eq(schema.menuCategories.id, categoryId),
    });

    if (!category) {
      throw new NotFoundException(`Category with ID '${categoryId}' not found.`);
    }

    // Admin can update, or staff if they belong to any outlet under this restaurant
    if (!user.roles.includes('admin')) {
      const staffOutlet = await this.db.query.restaurantStaff.findFirst({
        where: and(
          eq(schema.restaurantStaff.userId, user.userId),
          eq(schema.restaurantStaff.isActive, true),
        ),
        with: {
          outlet: true,
        },
      });

      if (!staffOutlet || staffOutlet.outlet.restaurantId !== category.restaurantId) {
        throw new BadRequestException('Unauthorized to modify category for this restaurant.');
      }
    }

    const [updated] = await this.db
      .update(schema.menuCategories)
      .set({
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      })
      .where(eq(schema.menuCategories.id, categoryId))
      .returning();

    return updated;
  }

  // ==========================================
  // MENU ITEMS
  // ==========================================

  async createMenuItem(
    outletId: string,
    dto: CreateMenuItemDto,
    user: AuthenticatedUserPayload,
  ) {
    const outlet = await this.outletAuthService.verifyOutletAccess(user, outletId);

    // Verify category belongs to this restaurant
    const category = await this.db.query.menuCategories.findFirst({
      where: and(
        eq(schema.menuCategories.id, dto.categoryId),
        eq(schema.menuCategories.restaurantId, outlet.restaurantId),
      ),
    });

    if (!category) {
      throw new BadRequestException(
        `Category '${dto.categoryId}' does not belong to this restaurant.`,
      );
    }

    const [item] = await this.db
      .insert(schema.menuItems)
      .values({
        restaurantId: outlet.restaurantId,
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description || null,
        basePrice: dto.basePrice.toFixed(2),
        isVeg: dto.isVeg ?? true,
        imageUrl: dto.imageUrl || null,
        isAvailable: dto.isAvailable ?? true,
      })
      .returning();

    return item;
  }

  /**
   * Lists menu items for an outlet, merging base items with outlet-specific overrides.
   * Computes effectivePrice and effectiveIsAvailable.
   */
  async listMenuItemsForOutlet(outletId: string) {
    const outlet = await this.db.query.restaurantOutlets.findFirst({
      where: eq(schema.restaurantOutlets.id, outletId),
    });

    if (!outlet) {
      throw new NotFoundException(`Outlet with ID '${outletId}' not found.`);
    }

    // Fetch all active categories and items for this restaurant
    const items = await this.db.query.menuItems.findMany({
      where: eq(schema.menuItems.restaurantId, outlet.restaurantId),
      with: {
        category: true,
        outletOverrides: {
          where: eq(schema.outletMenuItemOverrides.outletId, outletId),
        },
      },
      orderBy: [desc(schema.menuItems.createdAt)],
    });

    return items.map((item) => {
      const override = item.outletOverrides && item.outletOverrides[0];
      const effectivePrice = override && override.customPrice ? override.customPrice : item.basePrice;
      const effectiveIsAvailable = override ? override.isAvailable : item.isAvailable;

      return {
        id: item.id,
        name: item.name,
        description: item.description,
        basePrice: item.basePrice,
        effectivePrice,
        isVeg: item.isVeg,
        imageUrl: item.imageUrl,
        isAvailable: item.isAvailable,
        effectiveIsAvailable,
        categoryId: item.categoryId,
        categoryIsActive: item.category?.isActive ?? false,
        categoryName: item.category?.name,
        isOverridden: !!override,
      };
    });
  }

  async getMenuItemById(itemId: string) {
    const item = await this.db.query.menuItems.findFirst({
      where: eq(schema.menuItems.id, itemId),
      with: {
        category: true,
      },
    });

    if (!item) {
      throw new NotFoundException(`Menu item with ID '${itemId}' not found.`);
    }

    return item;
  }

  async updateMenuItem(
    itemId: string,
    dto: UpdateMenuItemDto,
    user: AuthenticatedUserPayload,
  ) {
    const item = await this.getMenuItemById(itemId);

    // Verify ownership
    if (!user.roles.includes('admin')) {
      const isOwner = await this.db.query.restaurants.findFirst({
        where: and(
          eq(schema.restaurants.id, item.restaurantId),
          eq(schema.restaurants.ownerId, user.userId),
        ),
      });

      if (!isOwner) {
        const staff = await this.db.query.restaurantStaff.findFirst({
          where: and(
            eq(schema.restaurantStaff.userId, user.userId),
            eq(schema.restaurantStaff.isActive, true),
          ),
          with: { outlet: true },
        });

        if (!staff || staff.outlet.restaurantId !== item.restaurantId) {
          throw new BadRequestException('Unauthorized to modify menu item for this restaurant.');
        }
      }
    }

    const [updated] = await this.db
      .update(schema.menuItems)
      .set({
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.basePrice !== undefined ? { basePrice: dto.basePrice.toFixed(2) } : {}),
        ...(dto.isVeg !== undefined ? { isVeg: dto.isVeg } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
        ...(dto.isAvailable !== undefined ? { isAvailable: dto.isAvailable } : {}),
        ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.menuItems.id, itemId))
      .returning();

    return updated;
  }

  async setMenuItemAvailability(
    itemId: string,
    isAvailable: boolean,
    user: AuthenticatedUserPayload,
  ) {
    return this.updateMenuItem(itemId, { isAvailable }, user);
  }

  async setOutletMenuItemOverride(
    outletId: string,
    itemId: string,
    dto: OutletMenuItemOverrideDto,
    user: AuthenticatedUserPayload,
  ) {
    await this.outletAuthService.verifyOutletAccess(user, outletId);
    const item = await this.getMenuItemById(itemId);

    // Upsert override
    const existing = await this.db.query.outletMenuItemOverrides.findFirst({
      where: and(
        eq(schema.outletMenuItemOverrides.outletId, outletId),
        eq(schema.outletMenuItemOverrides.menuItemId, itemId),
      ),
    });

    if (existing) {
      const [updated] = await this.db
        .update(schema.outletMenuItemOverrides)
        .set({
          isAvailable: dto.isAvailable,
          customPrice: dto.customPrice !== undefined ? dto.customPrice.toFixed(2) : null,
          updatedAt: new Date(),
        })
        .where(eq(schema.outletMenuItemOverrides.id, existing.id))
        .returning();

      return updated;
    }

    const [created] = await this.db
      .insert(schema.outletMenuItemOverrides)
      .values({
        outletId,
        menuItemId: item.id,
        isAvailable: dto.isAvailable,
        customPrice: dto.customPrice !== undefined ? dto.customPrice.toFixed(2) : null,
      })
      .returning();

    return created;
  }

  // ==========================================
  // PUBLIC CUSTOMER DISCOVERY (Read-Only)
  // ==========================================

  async getPublicActiveOutlets(userLat?: number, userLon?: number) {
    // Customers outside every active service zone see no kitchens.
    if (
      this.serviceZones &&
      userLat !== undefined &&
      userLon !== undefined &&
      !(await this.serviceZones.isServiceable(userLat, userLon))
    ) {
      return [];
    }

    // Only return outlets where both restaurant and outlet are active
    const allOutlets = await this.db.query.restaurantOutlets.findMany({
      where: eq(schema.restaurantOutlets.isActive, true),
      with: {
        restaurant: true,
        operatingHours: true,
      },
    });

    // Outlets located outside every active service zone never appear in discovery.
    let outlets = allOutlets;
    if (this.serviceZones) {
      const zones = this.serviceZones;
      const keep = await Promise.all(allOutlets.map((o) => zones.isServiceable(o.latitude, o.longitude)));
      outlets = allOutlets.filter((_, i) => keep[i]);
    }

    // Determine platform max road distance from admin settings if available
    let adminMaxRoadDistanceMeters: number | undefined;
    if (this.financialSettingsService) {
      try {
        const activeSettings = await this.financialSettingsService.getActiveSettings();
        adminMaxRoadDistanceMeters =
          activeSettings.settings?.deliveryServiceability?.maxRoadDistanceMeters;
      } catch {
        // Fallback to outlet configuration or default
      }
    }

    const hasUserCoords =
      userLat !== undefined &&
      !isNaN(userLat) &&
      userLon !== undefined &&
      !isNaN(userLon);

    const eligibleOutletsWithDistance: Array<{
      outlet: typeof outlets[0];
      distanceKm?: number;
      isServiceable: boolean;
      serviceabilityStatus: 'VERIFIED' | 'UNVERIFIED';
    }> = [];

    if (hasUserCoords) {
      const candidates: Array<{
        outlet: typeof outlets[0];
        outletLat: number;
        outletLon: number;
        maxAllowedMeters: number;
      }> = [];

      // Stage 1: Fast Haversine straight-line pruning (mathematical lower bound)
      for (const o of outlets) {
        if (!o.restaurant.isActive) continue;

        if (o.latitude && o.longitude) {
          const outletLat = Number(o.latitude);
          const outletLon = Number(o.longitude);
          if (isNaN(outletLat) || isNaN(outletLon)) continue;

          let outletRadiusMeters: number | undefined;
          if (o.deliveryRadiusKm != null && o.deliveryRadiusKm !== '') {
            const parsed =
              typeof o.deliveryRadiusKm === 'number'
                ? o.deliveryRadiusKm
                : parseFloat(o.deliveryRadiusKm);
            if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
              outletRadiusMeters = Math.round(parsed * 1000);
            }
          }

          // Option A: Active Admin road-distance limit is authoritative across platform (default 3000m).
          // Individual outlet deliveryRadiusKm cannot override the platform serviceability threshold.
          const maxAllowedMeters = adminMaxRoadDistanceMeters ?? 3000;
          const maxAllowedKm = maxAllowedMeters / 1000;

          try {
            const straightLineKm = calculateDistanceKm(outletLat, outletLon, userLat, userLon);
            if (straightLineKm > maxAllowedKm + 1e-6) {
              // Physically impossible to be within road distance; prune without API call
              continue;
            }
          } catch {
            continue;
          }

          candidates.push({
            outlet: o,
            outletLat,
            outletLon,
            maxAllowedMeters,
          });
        }
      }

      // Stage 2: Bounded, chunked matrix evaluation with point-to-point cache reuse
      if (candidates.length > 0) {
        if (this.routingService && this.routingService.isAvailable()) {
          const batchItems = candidates.map((c) => ({
            id: c.outlet.id,
            origin: { latitude: c.outletLat, longitude: c.outletLon },
            destination: { latitude: userLat, longitude: userLon },
          }));

          const routeResultsMap = await this.routingService.getBatchRoutes(batchItems);

          for (const c of candidates) {
            const route = routeResultsMap.get(c.outlet.id);
            if (route && route.status === 'OK' && route.distanceMeters !== null) {
              // Authoritative road distance successfully verified
              if (route.distanceMeters <= c.maxAllowedMeters) {
                eligibleOutletsWithDistance.push({
                  outlet: c.outlet,
                  distanceKm: Math.round((route.distanceMeters / 1000) * 100) / 100,
                  isServiceable: true,
                  serviceabilityStatus: 'VERIFIED',
                });
              }
              // If route.distanceMeters > maxAllowedMeters, outlet is out of road distance; omitted from eligible delivery
            } else {
              // Google Routes failed, timed out, or unavailable:
              // NEVER represent straight-line Haversine as verified road distance!
              // Include for browsing with explicit UNVERIFIED serviceability and undefined distance
              eligibleOutletsWithDistance.push({
                outlet: c.outlet,
                distanceKm: undefined,
                isServiceable: false,
                serviceabilityStatus: 'UNVERIFIED',
              });
            }
          }
        } else {
          // Routing service unconfigured or unavailable: preserve browsing without false road distances
          for (const c of candidates) {
            eligibleOutletsWithDistance.push({
              outlet: c.outlet,
              distanceKm: undefined,
              isServiceable: false,
              serviceabilityStatus: 'UNVERIFIED',
            });
          }
        }
      }
    } else {
      // No customer coordinates provided: return active outlets for browsing
      for (const o of outlets) {
        if (!o.restaurant.isActive) continue;
        eligibleOutletsWithDistance.push({
          outlet: o,
          distanceKm: undefined,
          isServiceable: true,
          serviceabilityStatus: 'UNVERIFIED',
        });
      }
    }

    return eligibleOutletsWithDistance.map(
      ({ outlet: o, distanceKm, isServiceable, serviceabilityStatus }) => ({
        id: o.id,
        restaurantName: o.restaurant.name,
        restaurantId: o.restaurantId,
        outletName: o.name,
        slug: o.restaurant.slug,
        logoUrl: o.restaurant.logoUrl,
        address: o.address,
        distanceKm,
        isServiceable,
        serviceabilityStatus,
        latitude: o.latitude,
        longitude: o.longitude,
        deliveryRadiusKm: o.deliveryRadiusKm,
        isAcceptingOrders: o.isAcceptingOrders,
        operatingHours: o.operatingHours,
      }),
    );
  }
}
