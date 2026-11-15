import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { AddCartItemDto, UpdateCartItemDto } from './dto/order.dto';
import { FinancialSettingsService } from '../admin/financial-settings.service';

export interface CalculatedCartItem {
  id: string; // cart item id
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
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
  discountAmount: number;
  totalPayable: number;
}

@Injectable()
export class CartService {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    @Inject(FinancialSettingsService)
    private readonly financialSettingsService: FinancialSettingsService,
  ) {}

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
    const calculatedItems: CalculatedCartItem[] = [];

    for (const item of cart.items) {
      const menuItem = item.menuItem;
      // Find override for this specific outlet
      const override = menuItem.outletOverrides?.find((o: any) => o.outletId === cart.outletId);

      const effectivePriceStr = override?.customPrice || menuItem.basePrice;
      const effectivePrice = parseFloat(effectivePriceStr);
      const isAvailable = override ? override.isAvailable : menuItem.isAvailable;

      const itemTotal = this.toMoney(effectivePrice * item.quantity);
      subtotal += itemTotal;

      calculatedItems.push({
        id: item.id,
        menuItemId: menuItem.id,
        name: menuItem.name,
        quantity: item.quantity,
        unitPrice: effectivePrice,
        totalPrice: itemTotal,
        isAvailable,
        imageUrl: menuItem.imageUrl,
      });
    }

    const itemTotal = this.toMoney(subtotal);

    // Dynamic Delivery Fee & Free Delivery calculation based on Financial Settings
    let deliveryFee = 0.0;
    if (itemTotal > 0) {
      try {
        const { settings } = await this.financialSettingsService.getActiveSettings(client);
        const cfg = settings.customerDeliveryFee;

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

        const priorOrdersCount = orderCountResult?.count ?? 0;
        const feeResult = this.financialSettingsService.calculateCustomerDeliveryFee({
          settings,
          priorEligibleOrdersCount: priorOrdersCount,
        });

        deliveryFee = feeResult.deliveryFee;
      } catch (err) {
        // Fallback to approved baseline 30.00
        deliveryFee = 30.0;
      }
    }

    // Standard 5% GST on restaurant services
    const taxAmount = this.toMoney(itemTotal * 0.05);
    const discountAmount = 0.0;
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
      discountAmount,
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
