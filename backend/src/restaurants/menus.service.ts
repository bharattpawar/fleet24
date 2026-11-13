import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc, and } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { isWithinDeliveryRadius } from '../common/utils/geo';
import {
  CreateMenuCategoryDto,
  UpdateMenuCategoryDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
  OutletMenuItemOverrideDto,
} from './dto/restaurant.dto';
import { AuthenticatedUserPayload } from '../auth/decorators/auth.decorators';
import { OutletAuthorizationService } from './outlet-auth.service';

@Injectable()
export class MenusService {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly outletAuthService: OutletAuthorizationService,
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
    // Only return outlets where both restaurant and outlet are active
    const outlets = await this.db.query.restaurantOutlets.findMany({
      where: eq(schema.restaurantOutlets.isActive, true),
      with: {
        restaurant: true,
        operatingHours: true,
      },
    });

    return outlets
      .filter((o) => {
        if (!o.restaurant.isActive) return false;
        // If customer coordinates provided, enforce delivery radius eligibility
        if (
          userLat !== undefined &&
          !isNaN(userLat) &&
          userLon !== undefined &&
          !isNaN(userLon) &&
          o.latitude &&
          o.longitude
        ) {
          try {
            const { isEligible } = isWithinDeliveryRadius(
              { latitude: o.latitude, longitude: o.longitude },
              { latitude: userLat, longitude: userLon },
              o.deliveryRadiusKm,
            );
            return isEligible;
          } catch {
            return false;
          }
        }
        return true;
      })
      .map((o) => ({
        id: o.id,
        restaurantName: o.restaurant.name,
        outletName: o.name,
        slug: o.restaurant.slug,
        logoUrl: o.restaurant.logoUrl,
        address: o.address,
        latitude: o.latitude,
        longitude: o.longitude,
        deliveryRadiusKm: o.deliveryRadiusKm,
        isAcceptingOrders: o.isAcceptingOrders,
        operatingHours: o.operatingHours,
      }));
  }
}
