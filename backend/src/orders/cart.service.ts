import {
  Optional,
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { AddCartItemDto, UpdateCartItemDto } from './dto/order.dto';
import { FinancialSettingsService } from '../admin/financial-settings.service';
import { calculateDistanceKm } from '../common/utils/geo';
import { isUsableLocation } from '../users/address-location.util';
import { DeliveryEtaSettings, estimateDeliveryEta } from '../common/utils/delivery-eta';
import { RoutingService } from '../routing/routing.service';
import { computeTaxes, type TaxBreakdown } from '../common/utils/taxes';
import type { FinancialSettingsPayload } from '../database/schema/financial-settings';
import { applyDishDiscount, dishDiscountLabel } from '../common/utils/discounts';
import { PromotionsService, type CouponEvaluation } from '../promotions/promotions.service';

export interface CalculatedCartItem {
  id: string; // cart item id
  menuItemId: string;
  name: string;
  quantity: number;
  /** Price the customer pays per unit, after the restaurant's dish discount. */
  unitPrice: number;
  /** Price before the dish discount (equal to unitPrice when there is none). */
  originalUnitPrice: number;
  /** e.g. "20% OFF" when the restaurant discounts this dish. */
  discountLabel: string | null;
  totalPrice: number;
  isAvailable: boolean;
  imageUrl: string | null;
}

export interface CalculatedCartSummary {
  cartId: string;
  outletId: string;
  restaurantName: string;
  outletName: string;
  isOutletOperational: boolean;
  items: CalculatedCartItem[];
  itemCount: number;
  itemTotal: number;
  deliveryFee: number;
  taxAmount: number;
  /** Split of taxAmount, with the GST rates the admin set. */
  taxes: TaxBreakdown;
  /** Coupon discount (admin coupon codes). */
  discountAmount: number;
  /** Coupon the customer applied; `applied: false` with a message when it does not apply now. */
  promo: CouponEvaluation | null;
  /** What the customer saves on restaurant dish discounts. */
  dishSavings: number;
  totalPayable: number;
}

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    @Inject(FinancialSettingsService)
    private readonly financialSettingsService: FinancialSettingsService,
    @Optional()
    private readonly routingService?: RoutingService,
    @Optional()
    private readonly promotionsService?: PromotionsService,
  ) {}

  /**
   * GET /cart/delivery-estimate?addressId=...
   * Delivery time for the current cart's outlet to one of the customer's saved addresses:
   * prep + pickup handling plus road travel time, never below the platform minimum.
   */
  async getDeliveryEstimate(customerId: string, addressId: string) {
    const cart = await this.db.query.customerCarts.findFirst({
      where: eq(schema.customerCarts.customerId, customerId),
    });
    if (!cart?.outletId) {
      return { deliveryEta: null, reason: 'EMPTY_CART' as const };
    }

    const address = await this.db.query.customerAddresses.findFirst({
      where: and(eq(schema.customerAddresses.id, addressId), eq(schema.customerAddresses.userId, customerId)),
    });
    if (!address) {
      throw new NotFoundException('Delivery address not found.');
    }
    if (!isUsableLocation(address.latitude, address.longitude)) {
      return { deliveryEta: null, reason: 'LOCATION_NOT_CONFIRMED' as const };
    }

    const outlet = await this.db.query.restaurantOutlets.findFirst({
      where: eq(schema.restaurantOutlets.id, cart.outletId),
    });
    if (!outlet || !isUsableLocation(outlet.latitude, outlet.longitude)) {
      return { deliveryEta: null, reason: 'OUTLET_LOCATION_MISSING' as const };
    }

    const origin = { latitude: Number(outlet.latitude), longitude: Number(outlet.longitude) };
    const destination = { latitude: Number(address.latitude), longitude: Number(address.longitude) };

    let travelSeconds: number | null = null;
    let roadDistanceMeters: number | null = null;
    if (this.routingService?.isAvailable()) {
      try {
        const route = await this.routingService.getRoute({ origin, destination });
        if (route.status === 'OK') {
          travelSeconds = route.durationSeconds;
          roadDistanceMeters = route.distanceMeters;
        }
      } catch {
        // fall back to the straight-line estimate below
      }
    }

    let settings: DeliveryEtaSettings | undefined;
    try {
      const active = await this.financialSettingsService.getActiveSettings();
      settings = active.settings?.deliveryServiceability;
    } catch {
      settings = undefined;
    }

    const straightLineMeters =
      calculateDistanceKm(origin.latitude, origin.longitude, destination.latitude, destination.longitude) * 1000;

    return {
      deliveryEta: estimateDeliveryEta({ travelSeconds, straightLineMeters, settings }),
      roadDistanceMeters,
      reason: null,
    };
  }

  /**
   * Helper to resolve decimal currency rounding safely without floating point artifacts
   */
  toMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Retrieves and calculates the customer's current cart with live authoritative pricing.
   * Accepts an optional transactional client to ensure consistent reads within transaction boundaries.
   */
  async getCart(customerId: string, client: any = this.db): Promise<CalculatedCartSummary | null> {
    const cart = await client.query.customerCarts.findFirst({
      where: eq(schema.customerCarts.customerId, customerId),
      with: {
        outlet: {
          with: {
            restaurant: true,
          },
        },
        items: {
          with: {
            menuItem: {
              with: {
                outletOverrides: true,
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return null;
    }

    const isOutletOperational =
      cart.outlet.isActive &&
      cart.outlet.restaurant.isActive &&
      cart.outlet.isAcceptingOrders;

    let subtotal = 0;
    let dishSavings = 0;
    const calculatedItems: CalculatedCartItem[] = [];

    for (const item of cart.items) {
      const menuItem = item.menuItem;
      // Find override for this specific outlet
      const override = menuItem.outletOverrides?.find((o: any) => o.outletId === cart.outletId);

      const effectivePriceStr = override?.customPrice || menuItem.basePrice;
      const originalPrice = parseFloat(effectivePriceStr);
      const effectivePrice = applyDishDiscount(originalPrice, menuItem.discountType, menuItem.discountValue);
      const isAvailable = override ? override.isAvailable : menuItem.isAvailable;

      const itemTotal = this.toMoney(effectivePrice * item.quantity);
      subtotal += itemTotal;
      dishSavings += (originalPrice - effectivePrice) * item.quantity;

      calculatedItems.push({
        id: item.id,
        menuItemId: menuItem.id,
        name: menuItem.name,
        quantity: item.quantity,
        unitPrice: effectivePrice,
        originalUnitPrice: originalPrice,
        discountLabel: effectivePrice < originalPrice
          ? dishDiscountLabel(menuItem.discountType, menuItem.discountValue)
          : null,
        totalPrice: itemTotal,
        isAvailable,
        imageUrl: menuItem.imageUrl,
      });
    }

    const itemTotal = this.toMoney(subtotal);

    // Dynamic Delivery Fee & Free Delivery calculation based on Financial Settings
    let deliveryFee = 0.0;
    let activeSettings: FinancialSettingsPayload | null = null;
    if (itemTotal > 0) {
      try {
        const { settings } = await this.financialSettingsService.getActiveSettings(client);
        activeSettings = settings;
      } catch {
        this.logger.warn('Could not read financial settings for cart pricing. Using defaults.');
        activeSettings = FinancialSettingsService.DEFAULT_SETTINGS;
      }

      let priorEligibleOrdersCount: number;
      try {
        const cfg = activeSettings.customerDeliveryFee;

        // Count prior eligible orders for this customer (Delivered or actively confirmed/preparing orders)
        // Orders with pending_payment do NOT permanently consume quota; however active checkouts are guarded during atomic checkout creation.
        const eligibleStatuses = cfg.cancelledOrdersConsumeFreeQuota
          ? ['delivered', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'cancelled']
          : ['delivered', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery'];

        const [orderCountResult] = await client
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.orders)
          .where(
            and(
              eq(schema.orders.customerId, customerId),
              inArray(schema.orders.status, eligibleStatuses as any),
            ),
          );

        priorEligibleOrdersCount = orderCountResult?.count ?? 0;
      } catch {
        this.logger.warn('Could not check the cart free delivery quota. Using the standard default fee.');
        activeSettings = FinancialSettingsService.DEFAULT_SETTINGS;
        priorEligibleOrdersCount = activeSettings.customerDeliveryFee.freeOrderThresholdCount;
      }

      deliveryFee = this.financialSettingsService.calculateCustomerDeliveryFee({
        settings: activeSettings,
        priorEligibleOrdersCount,
      }).deliveryFee;
    }

    // Admin coupon, re-checked on every read (dates, limits, minimum order)
    let promo: CouponEvaluation | null = null;
    if (cart.promotionId && this.promotionsService) {
      promo = await this.promotionsService.evaluate({
        promotionId: cart.promotionId,
        customerId,
        itemTotal,
        client,
      });
    }
    const discountAmount = promo?.applied ? promo.discountAmount : 0;

    // GST on food (after the coupon) and on the delivery fee, at the rates set by the admin
    const taxes = computeTaxes({ itemTotal, deliveryFee, discountAmount, settings: activeSettings });
    const taxAmount = taxes.taxAmount;
    const totalPayable = this.toMoney(itemTotal + deliveryFee + taxAmount - discountAmount);

    return {
      cartId: cart.id,
      outletId: cart.outletId,
      restaurantName: cart.outlet.restaurant.name,
      outletName: cart.outlet.name,
      isOutletOperational,
      items: calculatedItems,
      itemCount: calculatedItems.reduce((acc, curr) => acc + curr.quantity, 0),
      itemTotal,
      deliveryFee,
      taxAmount,
      taxes,
      discountAmount,
      promo,
      dishSavings: this.toMoney(dishSavings),
      totalPayable,
    };
  }

  /**
   * Adds an item to the customer's cart. Enforces single-outlet constraint.
   */
  async addItem(customerId: string, dto: AddCartItemDto) {
    // 1. Verify outlet and parent restaurant are active and accepting orders
    const outlet = await this.db.query.restaurantOutlets.findFirst({
      where: eq(schema.restaurantOutlets.id, dto.outletId),
      with: { restaurant: true },
    });

    if (!outlet) {
      throw new NotFoundException(`Outlet '${dto.outletId}' not found.`);
    }

    if (!outlet.isActive || !outlet.restaurant.isActive) {
      throw new BadRequestException('This restaurant outlet is currently inactive.');
    }

    if (!outlet.isAcceptingOrders) {
      throw new BadRequestException('This outlet is currently not accepting orders.');
    }

    // 2. Verify menu item belongs to this outlet's restaurant and is available
    const menuItem = await this.db.query.menuItems.findFirst({
      where: and(
        eq(schema.menuItems.id, dto.menuItemId),
        eq(schema.menuItems.restaurantId, outlet.restaurantId),
      ),
      with: {
        outletOverrides: {
          where: eq(schema.outletMenuItemOverrides.outletId, dto.outletId),
        },
      },
    });

    if (!menuItem) {
      throw new NotFoundException(`Menu item '${dto.menuItemId}' does not belong to this outlet.`);
    }

    const override = menuItem.outletOverrides?.[0];
    const isAvailable = override ? override.isAvailable : menuItem.isAvailable;

    if (!isAvailable) {
      throw new BadRequestException(`'${menuItem.name}' is currently unavailable.`);
    }

    // 3. Check existing cart
    let cart = await this.db.query.customerCarts.findFirst({
      where: eq(schema.customerCarts.customerId, customerId),
    });

    if (cart && cart.outletId !== dto.outletId) {
      throw new ConflictException({
        message: 'Your cart contains items from another outlet. Clear your cart before switching outlets.',
        currentOutletId: cart.outletId,
        newOutletId: dto.outletId,
      });
    }

    if (!cart) {
      const [newCart] = await this.db
        .insert(schema.customerCarts)
        .values({
          customerId,
          outletId: dto.outletId,
        })
        .returning();
      cart = newCart;
    }

    // 4. Upsert cart item
    const existingItem = await this.db.query.cartItems.findFirst({
      where: and(
        eq(schema.cartItems.cartId, cart.id),
        eq(schema.cartItems.menuItemId, dto.menuItemId),
      ),
    });

    if (existingItem) {
      const newQuantity = existingItem.quantity + dto.quantity;
      if (newQuantity > 50) {
        throw new BadRequestException('Maximum quantity of 50 exceeded for this item.');
      }

      await this.db
        .update(schema.cartItems)
        .set({
          quantity: newQuantity,
          updatedAt: new Date(),
        })
        .where(eq(schema.cartItems.id, existingItem.id));
    } else {
      await this.db.insert(schema.cartItems).values({
        cartId: cart.id,
        menuItemId: dto.menuItemId,
        quantity: dto.quantity,
      });
    }

    return this.getCart(customerId);
  }

  /**
   * Updates an item's quantity in the cart
   */
  async updateItemQuantity(customerId: string, cartItemId: string, dto: UpdateCartItemDto) {
    const cart = await this.db.query.customerCarts.findFirst({
      where: eq(schema.customerCarts.customerId, customerId),
    });

    if (!cart) {
      throw new NotFoundException('Cart not found.');
    }

    const item = await this.db.query.cartItems.findFirst({
      where: and(
        eq(schema.cartItems.id, cartItemId),
        eq(schema.cartItems.cartId, cart.id),
      ),
    });

    if (!item) {
      throw new NotFoundException('Item not found in your cart.');
    }

    await this.db
      .update(schema.cartItems)
      .set({
        quantity: dto.quantity,
        updatedAt: new Date(),
      })
      .where(eq(schema.cartItems.id, item.id));

    return this.getCart(customerId);
  }

  /**
   * Removes an item from the cart. Deletes cart if empty.
   */
  async removeItem(customerId: string, cartItemId: string) {
    const cart = await this.db.query.customerCarts.findFirst({
      where: eq(schema.customerCarts.customerId, customerId),
    });

    if (!cart) {
      throw new NotFoundException('Cart not found.');
    }

    await this.db
      .delete(schema.cartItems)
      .where(and(eq(schema.cartItems.id, cartItemId), eq(schema.cartItems.cartId, cart.id)));

    // Check remaining items count
    const remaining = await this.db.query.cartItems.findFirst({
      where: eq(schema.cartItems.cartId, cart.id),
    });

    if (!remaining) {
      await this.db.delete(schema.customerCarts).where(eq(schema.customerCarts.id, cart.id));
      return null;
    }

    return this.getCart(customerId);
  }

  /** Applies an admin coupon code to the cart. Rejects codes that cannot be used now. */
  async applyPromoCode(customerId: string, code: string) {
    if (!this.promotionsService) throw new BadRequestException('Coupons are not available.');
    const cart = await this.db.query.customerCarts.findFirst({
      where: eq(schema.customerCarts.customerId, customerId),
    });
    if (!cart) throw new BadRequestException('Add items to your cart first.');
    const promo = await this.promotionsService.findByCode(code);
    if (!promo) throw new NotFoundException('This coupon code does not exist.');

    const summary = await this.getCart(customerId);
    const check = await this.promotionsService.evaluate({
      promotionId: promo.id,
      customerId,
      itemTotal: summary?.itemTotal ?? 0,
    });
    if (!check?.applied) throw new BadRequestException(check?.message ?? 'This coupon cannot be used.');

    await this.db
      .update(schema.customerCarts)
      .set({ promotionId: promo.id, updatedAt: new Date() })
      .where(eq(schema.customerCarts.id, cart.id));
    return this.getCart(customerId);
  }

  /** Removes the coupon from the cart. */
  async removePromoCode(customerId: string) {
    await this.db
      .update(schema.customerCarts)
      .set({ promotionId: null, updatedAt: new Date() })
      .where(eq(schema.customerCarts.customerId, customerId));
    return this.getCart(customerId);
  }

  /**
   * Clears the customer's entire cart
   */
  async clearCart(customerId: string) {
    await this.db
      .delete(schema.customerCarts)
      .where(eq(schema.customerCarts.customerId, customerId));

    return { message: 'Cart cleared successfully' };
  }
}
