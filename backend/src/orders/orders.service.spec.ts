import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CartService } from './cart.service';
import { OrdersService } from './orders.service';
import { PaymentsService } from '../payments/payments.service';
import { TrackingPublisherService } from '../tracking/tracking-publisher.service';
import { FinancialSettingsService } from '../admin/financial-settings.service';
import { RiderOffersService } from '../riders/rider-offers.service';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import { RoutingService } from '../routing/routing.service';
import { calculateDistanceKm } from '../common/utils/geo';

describe('Cart & Orders Management (Unit Tests)', () => {
  let cartService: CartService;
  let ordersService: OrdersService;
  let routingService: RoutingService;
  let mockDb: any;
  let mockFinancialSettingsService: any;
  let mockRoutingService: any;
  let mockActiveOrdersInTx: any[] = [];

  const customerId = 'cust-uuid-1';
  const outletId = 'outlet-uuid-1';
  const menuItemId = 'item-uuid-1';

  beforeEach(async () => {
    mockActiveOrdersInTx = [];
    mockDb = {
      query: {
        customerCarts: {
          findFirst: jest.fn(),
        },
        cartItems: {
          findFirst: jest.fn(),
        },
        restaurantOutlets: {
          findFirst: jest.fn(),
        },
        menuItems: {
          findFirst: jest.fn(),
        },
        customerAddresses: {
          findFirst: jest.fn(),
        },
        orders: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
      },
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn(),
        }),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn(),
          }),
        }),
      }),
      select: jest.fn().mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockImplementation(() => ({
            for: jest.fn().mockResolvedValue([{ id: 'cust-uuid-1' }]),
            limit: jest.fn().mockImplementation(() => Promise.resolve(mockActiveOrdersInTx)),
            then: (resolve: any) => resolve([{ count: 0 }]),
          })),
        }),
      })),
      delete: jest.fn().mockReturnValue({
        where: jest.fn(),
      }),
      transaction: jest.fn(async (cb) => cb(mockDb)),
    };

    const mockPaymentsService = {
      initiateOrderRefund: jest.fn().mockResolvedValue({
        id: 'refund-1',
        amount: '250.00',
        status: 'pending',
      }),
    };

    mockFinancialSettingsService = {
      getActiveSettings: jest.fn().mockResolvedValue({
        versionId: 'test-v1',
        versionNumber: 1,
        settings: {
          customerDeliveryFee: {
            freeOrderThresholdCount: 0,
            baseDeliveryFeeAfterFree: 30.0,
            cancelledOrdersConsumeFreeQuota: false,
          },
          deliveryServiceability: {
            maxRoadDistanceMeters: 3000,
          },
        },
      }),
      calculateCustomerDeliveryFee: jest.fn().mockReturnValue({
        isFreeDelivery: false,
        deliveryFee: 30.0,
        reason: 'Standard customer delivery fee',
      }),
    };

    mockRoutingService = {
      getStraightLineDistanceKm: jest.fn((origin, dest) => {
        return calculateDistanceKm(origin.latitude, origin.longitude, dest.latitude, dest.longitude);
      }),
      getRoute: jest.fn(async ({ origin, destination }) => {
        const straight = calculateDistanceKm(
          origin.latitude,
          origin.longitude,
          destination.latitude,
          destination.longitude,
        );
        const distanceMeters = Math.round(straight * 1000);
        return {
          distanceMeters,
          durationSeconds: Math.round(distanceMeters / 10),
          provider: 'google',
          status: 'OK',
          calculatedAt: new Date(),
          cached: false,
        };
      }),
      getBatchRoutes: jest.fn(async (items: any[]) => {
        const resMap = new Map();
        for (const item of items) {
          const straight = calculateDistanceKm(
            item.origin.latitude,
            item.origin.longitude,
            item.destination.latitude,
            item.destination.longitude,
          );
          const distanceMeters = Math.round(straight * 1000);
          resMap.set(item.id, {
            distanceMeters,
            durationSeconds: Math.round(distanceMeters / 10),
            provider: 'google',
            status: 'OK',
            calculatedAt: new Date(),
            cached: false,
          });
        }
        return resMap;
      }),
      isAvailable: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        OrdersService,
        { provide: DRIZZLE_CONNECTION, useValue: mockDb },
        { provide: PaymentsService, useValue: mockPaymentsService },
        {
          provide: TrackingPublisherService,
          useValue: {
            publishDeliveryCancelled: jest.fn(),
          },
        },
        {
          provide: FinancialSettingsService,
          useValue: mockFinancialSettingsService,
        },
        {
          provide: RiderOffersService,
          useValue: {
            cleanupDeliveryForCancelledOrder: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: RoutingService,
          useValue: mockRoutingService,
        },
      ],
    }).compile();

    cartService = module.get<CartService>(CartService);
    ordersService = module.get<OrdersService>(OrdersService);
    routingService = module.get<RoutingService>(RoutingService);
  });

  describe('CartService', () => {
    it('should reject adding item from different outlet if cart has items from another outlet', async () => {
      // Mock outlet is valid
      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: 'outlet-uuid-2',
        isActive: true,
        isAcceptingOrders: true,
        restaurant: { isActive: true },
        restaurantId: 'rest-1',
      });

      // Mock item is valid
      mockDb.query.menuItems.findFirst.mockResolvedValueOnce({
        id: 'item-2',
        name: 'Burger',
        isAvailable: true,
      });

      // Existing cart belongs to outlet-uuid-1
      mockDb.query.customerCarts.findFirst.mockResolvedValueOnce({
        id: 'cart-1',
        customerId,
        outletId: 'outlet-uuid-1',
      });

      await expect(
        cartService.addItem(customerId, {
          outletId: 'outlet-uuid-2',
          menuItemId: 'item-2',
          quantity: 1,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject adding unavailable item', async () => {
      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        isActive: true,
        isAcceptingOrders: true,
        restaurant: { isActive: true },
      });

      mockDb.query.menuItems.findFirst.mockResolvedValueOnce({
        id: menuItemId,
        name: 'Special Biryani',
        isAvailable: false, // Unavailable
      });

      await expect(
        cartService.addItem(customerId, {
          outletId,
          menuItemId,
          quantity: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accurately calculate cart item totals, delivery fee, and GST', async () => {
      mockDb.query.customerCarts.findFirst.mockResolvedValueOnce({
        id: 'cart-1',
        outletId,
        outlet: {
          name: 'Pari Chowk Outlet',
          isActive: true,
          isAcceptingOrders: true,
          restaurant: { name: 'Haldiram', isActive: true },
        },
        items: [
          {
            id: 'cart-item-1',
            quantity: 2,
            menuItem: {
              id: 'menu-item-1',
              name: 'Chole Bhature',
              basePrice: '150.00',
              isAvailable: true,
              outletOverrides: [],
            },
          },
        ],
      });

      const summary = await cartService.getCart(customerId);

      expect(summary).not.toBeNull();
      expect(summary?.itemTotal).toBe(300.0); // 150 * 2
      expect(summary?.deliveryFee).toBe(30.0);
      expect(summary?.taxAmount).toBe(15.0); // 5% of 300
      expect(summary?.totalPayable).toBe(345.0); // 300 + 30 + 15
    });
  });

  describe('OrdersService - Checkout', () => {
    const validCart = {
      cartId: 'cart-1',
      outletId,
      restaurantName: 'Amritsari Kulcha',
      outletName: 'Knowledge Park III',
      isOutletOperational: true,
      items: [
        {
          id: 'c-1',
          menuItemId: 'm-1',
          name: 'Kulcha Thali',
          quantity: 1,
          unitPrice: 200,
          totalPrice: 200,
          isAvailable: true,
          imageUrl: null,
        },
      ],
      itemCount: 1,
      itemTotal: 200,
      deliveryFee: 30,
      taxAmount: 10,
      taxes: { foodGstPercent: 5, deliveryFeeGstPercent: 0, foodTax: 10, deliveryFeeTax: 0, taxAmount: 10 },
      discountAmount: 0,
      totalPayable: 240,
    };

    // Pari Chowk coordinates
    const outletLatitude = '28.4682000';
    const outletLongitude = '77.5117000';

    it('should reject checkout if customer cart is empty', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValueOnce(null);

      await expect(
        ordersService.checkout(customerId, { deliveryAddressId: 'addr-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject checkout if delivery address does not belong to customer', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValueOnce(validCart);

      // Address not found for this user
      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce(null);

      await expect(
        ordersService.checkout(customerId, { deliveryAddressId: 'foreign-address-id' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('1. Address within 3 km: checkout succeeds', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValue(validCart);

      // Knowledge Park III (~2.2 km from Pari Chowk)
      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce({
        id: 'addr-kp3',
        userId: customerId,
        label: 'Hostel',
        addressLine1: 'Room 312, Boys Hostel',
        city: 'Greater Noida',
        postalCode: '201306',
        latitude: '28.4744000',
        longitude: '77.4912000',
      });

      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: outletLatitude,
        longitude: outletLongitude,
        deliveryRadiusKm: '3.00',
      });

      mockRoutingService.getRoute.mockResolvedValueOnce({
        distanceMeters: 2200,
        durationSeconds: 300,
        provider: 'google',
        status: 'OK',
        calculatedAt: new Date(),
        cached: false,
      });

      let insertedOrderPayload: any = null;
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockImplementation((payload) => {
          if (payload.orderNumber) {
            insertedOrderPayload = payload;
          }
          return {
            returning: jest.fn().mockResolvedValue([
              {
                id: 'order-created-1',
                orderNumber: 'FL-20261030-5555',
                status: 'pending_payment',
                totalPayable: '240.00',
                itemTotal: '200.00',
                deliveryFee: '30.00',
                taxAmount: '10.00',
                discountAmount: '0.00',
                deliveryAddressSnapshot: payload.deliveryAddressSnapshot,
                placedAt: new Date(),
              },
            ]),
          };
        }),
      });

      const res = await ordersService.checkout(customerId, { deliveryAddressId: 'addr-kp3' });
      expect(res.id).toBe('order-created-1');
      expect(mockDb.insert).toHaveBeenCalled();

      // Strengthened assertions: Verify actual values inserted into database
      expect(insertedOrderPayload).not.toBeNull();
      expect(insertedOrderPayload.itemTotal).toBe('200.00');
      expect(insertedOrderPayload.deliveryFee).toBe('30.00');
      expect(insertedOrderPayload.taxAmount).toBe('10.00');
      expect(insertedOrderPayload.discountAmount).toBe('0.00');
      expect(insertedOrderPayload.totalPayable).toBe('240.00');
      expect(insertedOrderPayload.deliveryAddressSnapshot).toMatchObject({
        roadDistanceMeters: 2200,
        durationSeconds: 300,
        policyVersionId: 'test-v1',
        routingProvider: 'google',
      });
      expect(mockDb.delete).toHaveBeenCalled(); // Cart consumed after successful commit
    });

    it('charges the GST rates the admin set on food and on the delivery fee', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValue(validCart);
      mockFinancialSettingsService.getActiveSettings.mockResolvedValue({
        versionId: 'test-v1',
        versionNumber: 1,
        settings: {
          customerDeliveryFee: { freeOrderThresholdCount: 0, baseDeliveryFeeAfterFree: 30.0, cancelledOrdersConsumeFreeQuota: false },
          deliveryServiceability: { maxRoadDistanceMeters: 3000 },
          taxes: { foodGstPercent: 12, deliveryFeeGstPercent: 18 },
        },
      });
      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce({
        id: 'addr-kp3',
        userId: customerId,
        label: 'Hostel',
        addressLine1: 'Room 312, Boys Hostel',
        city: 'Greater Noida',
        postalCode: '201306',
        latitude: '28.4744000',
        longitude: '77.4912000',
      });
      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: outletLatitude,
        longitude: outletLongitude,
        deliveryRadiusKm: '3.00',
      });
      mockRoutingService.getRoute.mockResolvedValueOnce({
        distanceMeters: 2200,
        durationSeconds: 300,
        provider: 'google',
        status: 'OK',
        calculatedAt: new Date(),
        cached: false,
      });

      let insertedPayload: any = null;
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockImplementation((payload) => {
          if (payload.orderNumber) insertedPayload = payload;
          return {
            returning: jest.fn().mockResolvedValue([
              { id: 'order-gst', orderNumber: 'FL-GST', status: 'pending_payment', deliveryAddressSnapshot: payload.deliveryAddressSnapshot, placedAt: new Date() },
            ]),
          };
        }),
      });

      await ordersService.checkout(customerId, { deliveryAddressId: 'addr-kp3' });
      // 12% of 200 = 24, 18% of 30 = 5.40
      expect(insertedPayload.taxAmount).toBe('29.40');
      expect(insertedPayload.totalPayable).toBe('259.40');
    });

    it('2. Address beyond 3 km: checkout rejected with clear error', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValue(validCart);

      // Sector Chi V (~3.8 km from Pari Chowk)
      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce({
        id: 'addr-chi5',
        userId: customerId,
        label: 'Apartment',
        addressLine1: 'Flat 504, Tower Emerald',
        city: 'Greater Noida',
        postalCode: '201310',
        latitude: '28.4412000',
        longitude: '77.5358000',
      });

      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: outletLatitude,
        longitude: outletLongitude,
        deliveryRadiusKm: '3.00',
      });

      await expect(
        ordersService.checkout(customerId, { deliveryAddressId: 'addr-chi5' }),
      ).rejects.toThrow(
        'This restaurant does not deliver to your selected address. Please choose another delivery address.',
      );

      // Should not insert order or delete cart
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('3. Option A Enforcement: outlet configured with 5 km radius is strictly bounded by active admin 3 km limit, rejecting 3.8 km address', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValue(validCart);

      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce({
        id: 'addr-chi5',
        userId: customerId,
        label: 'Apartment',
        addressLine1: 'Flat 504, Tower Emerald',
        city: 'Greater Noida',
        postalCode: '201310',
        latitude: '28.4412000',
        longitude: '77.5358000',
      });

      // Configured for 5.00 km radius in outlet record
      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: outletLatitude,
        longitude: outletLongitude,
        deliveryRadiusKm: '5.00',
      });

      // Under Option A, active admin threshold (3000m) is authoritative;
      // 3.8 km straight-line is pruned in Stage 1, preventing outlet override
      await expect(
        ordersService.checkout(customerId, { deliveryAddressId: 'addr-chi5' }),
      ).rejects.toThrow(
        'This restaurant does not deliver to your selected address. Please choose another delivery address.',
      );

      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('3b. Option A Admin expansion: when admin publishes 5000m road limit, 3.8 km address is allowed with verified road distance', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValue(validCart);

      mockFinancialSettingsService.getActiveSettings.mockResolvedValue({
        versionId: 'policy-5km-v1',
        versionNumber: 1,
        settings: {
          customerDeliveryFee: { freeOrderThresholdCount: 0, baseDeliveryFeeAfterFree: 30.0, cancelledOrdersConsumeFreeQuota: false },
          deliveryServiceability: { maxRoadDistanceMeters: 5000 },
        },
      });

      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce({
        id: 'addr-chi5',
        userId: customerId,
        label: 'Apartment',
        addressLine1: 'Flat 504, Tower Emerald',
        city: 'Greater Noida',
        postalCode: '201310',
        latitude: '28.4412000',
        longitude: '77.5358000',
      });

      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: outletLatitude,
        longitude: outletLongitude,
        deliveryRadiusKm: '5.00',
      });

      mockRoutingService.getRoute.mockResolvedValueOnce({
        distanceMeters: 3800,
        durationSeconds: 480,
        provider: 'google',
        status: 'OK',
        calculatedAt: new Date(),
        cached: false,
      });

      let insertedPayload: any = null;
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockImplementation((payload) => {
          if (payload.orderNumber) insertedPayload = payload;
          return {
            returning: jest.fn().mockResolvedValue([
              {
                id: 'order-created-2',
                orderNumber: 'FL-20261030-5556',
                status: 'pending_payment',
                totalPayable: '240.00',
                itemTotal: '200.00',
                deliveryFee: '30.00',
                taxAmount: '10.00',
                discountAmount: '0.00',
                deliveryAddressSnapshot: payload.deliveryAddressSnapshot,
                placedAt: new Date(),
              },
            ]),
          };
        }),
      });

      const res = await ordersService.checkout(customerId, { deliveryAddressId: 'addr-chi5' });
      expect(res.id).toBe('order-created-2');
      expect(insertedPayload.deliveryAddressSnapshot.roadDistanceMeters).toBe(3800);
      expect(insertedPayload.deliveryAddressSnapshot.policyVersionId).toBe('policy-5km-v1');
    });

    it('4. Missing customer coordinates: checkout rejected', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValueOnce(validCart);

      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce({
        id: 'addr-no-coord',
        userId: customerId,
        latitude: null,
        longitude: null,
      });

      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: outletLatitude,
        longitude: outletLongitude,
        deliveryRadiusKm: '3.00',
      });

      await expect(
        ordersService.checkout(customerId, { deliveryAddressId: 'addr-no-coord' }),
      ).rejects.toThrow('Selected delivery address is missing location coordinates.');
    });

    it('5. Missing outlet coordinates: checkout rejected', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValueOnce(validCart);

      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce({
        id: 'addr-kp3',
        userId: customerId,
        latitude: '28.4744000',
        longitude: '77.4912000',
      });

      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: null,
        longitude: null,
        deliveryRadiusKm: '3.00',
      });

      await expect(
        ordersService.checkout(customerId, { deliveryAddressId: 'addr-kp3' }),
      ).rejects.toThrow('Restaurant outlet location coordinates are not configured.');
    });

    it('6. Invalid outlet delivery radius: checkout rejected', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValueOnce(validCart);

      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce({
        id: 'addr-kp3',
        userId: customerId,
        latitude: '28.4744000',
        longitude: '77.4912000',
      });

      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: outletLatitude,
        longitude: outletLongitude,
        deliveryRadiusKm: 'invalid-radius',
      });

      await expect(
        ordersService.checkout(customerId, { deliveryAddressId: 'addr-kp3' }),
      ).rejects.toThrow('Delivery radius verification failed: Invalid configured delivery radius');
    });

    it('should handle idempotency key and return existing order without double charging', async () => {
      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: 'existing-order-uuid',
        orderNumber: 'FL-20261027-1234',
        customerId,
        idempotencyKey: 'idemp-key-1',
        status: 'pending_payment',
        totalPayable: '345.00',
      });

      const order = await ordersService.checkout(customerId, {
        deliveryAddressId: 'addr-1',
        idempotencyKey: 'idemp-key-1',
      });

      expect(order.id).toBe('existing-order-uuid');
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('OrdersService - Order Cancellation', () => {
    it('should reject cancellation of an order already in preparation or delivery', async () => {
      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: 'order-1',
        customerId,
        status: 'preparing', // Ineligible
      });

      await expect(
        ordersService.cancelOrder(customerId, 'order-1', { reason: 'Changed my mind' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow cancellation in pending_payment status', async () => {
      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: 'order-1',
        customerId,
        status: 'pending_payment',
      });

      mockDb.update.mockReturnValueOnce({
        set: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            returning: jest.fn().mockResolvedValueOnce([
              {
                id: 'order-1',
                orderNumber: 'FL-20261027-9999',
                status: 'cancelled',
                cancellationReason: 'Cancelled by customer',
              },
            ]),
          }),
        }),
      });

      const res = await ordersService.cancelOrder(customerId, 'order-1', {});
      expect(res.status).toBe('cancelled');
    });
  });

  describe('Phase 2: Customer Serviceability & Road-Distance Checkout Verification', () => {
    const validCart = {
      cartId: 'cart-p2',
      outletId,
      restaurantName: 'Biryani Express',
      outletName: 'Pari Chowk Outlet',
      isOutletOperational: true,
      items: [
        {
          id: 'ci-1',
          menuItemId,
          name: 'Hyderabadi Biryani',
          quantity: 1,
          unitPrice: 300,
          totalPrice: 300,
          isAvailable: true,
          imageUrl: null,
        },
      ],
      itemCount: 1,
      itemTotal: 300,
      deliveryFee: 30,
      taxAmount: 15,
      taxes: { foodGstPercent: 5, deliveryFeeGstPercent: 0, foodTax: 15, deliveryFeeTax: 0, taxAmount: 15 },
      discountAmount: 0,
      totalPayable: 345,
    };

    const outletLat = '28.4682000';
    const outletLon = '77.5117000';

    it('Stage 1 Pruning: skips Google Routes API call when straight-line distance exceeds threshold', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValueOnce(validCart);

      // Customer address > 4.5 km straight-line away
      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce({
        id: 'addr-far-away',
        userId: customerId,
        latitude: '28.4200000',
        longitude: '77.5300000',
      });

      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: outletLat,
        longitude: outletLon,
        deliveryRadiusKm: '3.00',
      });

      await expect(
        ordersService.checkout(customerId, { deliveryAddressId: 'addr-far-away' }),
      ).rejects.toThrow('This restaurant does not deliver to your selected address. Please choose another delivery address.');

      // Zero Google Routes calls should be made!
      expect(mockRoutingService.getRoute).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('Stage 2 Road Check: rejects checkout when straight-line is <= 3 km but actual road distance exceeds 3000m', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValueOnce(validCart);

      // Address is ~2.2 km straight-line
      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce({
        id: 'addr-winding-road',
        userId: customerId,
        latitude: '28.4744000',
        longitude: '77.4912000',
      });

      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: outletLat,
        longitude: outletLon,
        deliveryRadiusKm: '3.00',
      });

      // But road distance has a major detour/flyover making it 3,450 meters (> 3000m)
      mockRoutingService.getRoute.mockResolvedValueOnce({
        distanceMeters: 3450,
        durationSeconds: 450,
        provider: 'google',
        status: 'OK',
        calculatedAt: new Date(),
        cached: false,
      });

      await expect(
        ordersService.checkout(customerId, { deliveryAddressId: 'addr-winding-road' }),
      ).rejects.toThrow('This restaurant does not deliver to your selected address. Please choose another delivery address.');

      expect(mockRoutingService.getRoute).toHaveBeenCalledTimes(1);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('Stage 2 Success: creates order with frozen deliveryAddressSnapshot including roadDistanceMeters, durationSeconds, policyVersionId, policyVersionNumber, routingProvider', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValue(validCart);

      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce({
        id: 'addr-nearby',
        userId: customerId,
        label: 'Home',
        addressLine1: 'Flat 101, Alpha 1',
        city: 'Greater Noida',
        postalCode: '201308',
        latitude: '28.4744000',
        longitude: '77.4912000',
      });

      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: outletLat,
        longitude: outletLon,
        deliveryRadiusKm: '3.00',
      });

      // Road distance is 2,250m (<= 3000m)
      mockRoutingService.getRoute.mockResolvedValueOnce({
        distanceMeters: 2250,
        durationSeconds: 320,
        provider: 'google',
        status: 'OK',
        calculatedAt: new Date(),
        cached: true,
      });

      let insertedOrderPayload: any = null;
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockImplementation((payload) => {
          if (payload.orderNumber) {
            insertedOrderPayload = payload;
          }
          return {
            returning: jest.fn().mockResolvedValue([
              {
                id: 'order-p2-success',
                orderNumber: 'FL-20261114-1111',
                status: 'pending_payment',
                totalPayable: '345.00',
                itemTotal: '300.00',
                deliveryFee: '30.00',
                taxAmount: '15.00',
                discountAmount: '0.00',
                placedAt: new Date(),
              },
            ]),
          };
        }),
      });

      const res = await ordersService.checkout(customerId, { deliveryAddressId: 'addr-nearby' });
      expect(res.id).toBe('order-p2-success');

      // Verify authoritative snapshot was frozen with road distance and policy metadata
      expect(insertedOrderPayload).toBeDefined();
      expect(insertedOrderPayload.deliveryAddressSnapshot).toMatchObject({
        label: 'Home',
        addressLine1: 'Flat 101, Alpha 1',
        latitude: '28.4744000',
        longitude: '77.4912000',
        roadDistanceMeters: 2250,
        durationSeconds: 320,
        policyVersionId: 'test-v1',
        policyVersionNumber: 1,
        routingProvider: 'google',
      });

      // Verify calculateCustomerDeliveryFee received authoritative road distance in km
      expect(mockFinancialSettingsService.calculateCustomerDeliveryFee).toHaveBeenCalledWith(
        expect.objectContaining({
          distanceKm: 2.25,
        }),
      );
    });

    it('Service Outage Handling: rejects checkout safely when Google Routes is unavailable without approving delivery', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValueOnce(validCart);

      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce({
        id: 'addr-nearby',
        userId: customerId,
        latitude: '28.4744000',
        longitude: '77.4912000',
      });

      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: outletLat,
        longitude: outletLon,
        deliveryRadiusKm: '3.00',
      });

      // Provider outage
      mockRoutingService.getRoute.mockResolvedValueOnce({
        distanceMeters: null,
        durationSeconds: null,
        provider: 'google',
        status: 'ROUTING_UNAVAILABLE',
        calculatedAt: new Date(),
        cached: false,
        errorMessage: 'Google Routes service is currently unreachable',
      });

      await expect(
        ordersService.checkout(customerId, { deliveryAddressId: 'addr-nearby' }),
      ).rejects.toThrow('Unable to calculate delivery route to your address at this time. Please try again or choose another address.');

      // Must never create unverified order
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('Admin Dynamic Setting: allows checkout when admin expands maxRoadDistanceMeters to 4000m', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValue(validCart);

      // Admin configured 4,000 meters in active financial settings
      mockFinancialSettingsService.getActiveSettings.mockResolvedValue({
        versionId: 'version-expanded-4km',
        versionNumber: 2,
        settings: {
          deliveryServiceability: {
            maxRoadDistanceMeters: 4000,
          },
          customerDeliveryFee: {
            freeOrderThresholdCount: 0,
            baseDeliveryFeeAfterFree: 30.0,
            cancelledOrdersConsumeFreeQuota: false,
          },
        },
      });

      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce({
        id: 'addr-3500m',
        userId: customerId,
        latitude: '28.4744000',
        longitude: '77.4912000',
      });

      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: outletLat,
        longitude: outletLon,
      });

      // Road distance is 3,500m (which would fail 3000m, but passes 4000m)
      mockRoutingService.getRoute.mockResolvedValueOnce({
        distanceMeters: 3500,
        durationSeconds: 400,
        provider: 'google',
        status: 'OK',
        calculatedAt: new Date(),
        cached: false,
      });

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            {
              id: 'order-4km-accepted',
              orderNumber: 'FL-20261114-4444',
              status: 'pending_payment',
              totalPayable: '345.00',
            },
          ]),
        }),
      });

      const res = await ordersService.checkout(customerId, { deliveryAddressId: 'addr-3500m' });
      expect(res.id).toBe('order-4km-accepted');
    });

    it('Concurrent Policy Update: rejects checkout inside transaction if admin lowered distance limit during routing call', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValue(validCart);

      // Initial active settings when checkout begins: 3000m allowed (version 1)
      mockFinancialSettingsService.getActiveSettings
        .mockResolvedValueOnce({
          versionId: 'policy-v1',
          versionNumber: 1,
          settings: {
            deliveryServiceability: { maxRoadDistanceMeters: 3000 },
            customerDeliveryFee: { freeOrderThresholdCount: 0, baseDeliveryFeeAfterFree: 30.0, cancelledOrdersConsumeFreeQuota: false },
          },
        })
        // Concurrent update inside transaction: Admin reduced limit to 2000m (version 2)
        .mockResolvedValueOnce({
          versionId: 'policy-v2-restricted',
          versionNumber: 2,
          settings: {
            deliveryServiceability: { maxRoadDistanceMeters: 2000 },
            customerDeliveryFee: { freeOrderThresholdCount: 0, baseDeliveryFeeAfterFree: 30.0, cancelledOrdersConsumeFreeQuota: false },
          },
        });

      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce({
        id: 'addr-2500m',
        userId: customerId,
        latitude: '28.4744000',
        longitude: '77.4912000',
      });

      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: outletLat,
        longitude: outletLon,
      });

      // Road distance is 2,500m (passed v1 limit of 3000m, but fails v2 limit of 2000m)
      mockRoutingService.getRoute.mockResolvedValueOnce({
        distanceMeters: 2500,
        durationSeconds: 300,
        provider: 'google',
        status: 'OK',
        calculatedAt: new Date(),
        cached: false,
      });

      await expect(
        ordersService.checkout(customerId, { deliveryAddressId: 'addr-2500m' }),
      ).rejects.toThrow('Delivery settings have been updated and this address (2.5 km) is no longer within the allowed delivery limit (2.0 km). Please choose another delivery address.');

      // Order must not be inserted!
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('Concurrent Policy Update: commits with updated snapshot version if compliant with newly promoted policy', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValue(validCart);

      // Initial active settings when checkout begins: 3000m allowed (version 1)
      mockFinancialSettingsService.getActiveSettings
        .mockResolvedValueOnce({
          versionId: 'policy-v1',
          versionNumber: 1,
          settings: {
            deliveryServiceability: { maxRoadDistanceMeters: 3000 },
            customerDeliveryFee: { freeOrderThresholdCount: 0, baseDeliveryFeeAfterFree: 30.0, cancelledOrdersConsumeFreeQuota: false },
          },
        })
        // Concurrent update inside transaction: Admin published version 2 (still allows 3000m)
        .mockResolvedValueOnce({
          versionId: 'policy-v2-promoted',
          versionNumber: 2,
          settings: {
            deliveryServiceability: { maxRoadDistanceMeters: 3000 },
            customerDeliveryFee: { freeOrderThresholdCount: 0, baseDeliveryFeeAfterFree: 35.0, cancelledOrdersConsumeFreeQuota: false },
          },
        });

      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce({
        id: 'addr-1800m',
        userId: customerId,
        label: 'Home',
        addressLine1: 'Alpha 1 Block B',
        latitude: '28.4744000',
        longitude: '77.4912000',
      });

      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: outletLat,
        longitude: outletLon,
      });

      mockRoutingService.getRoute.mockResolvedValueOnce({
        distanceMeters: 1800,
        durationSeconds: 220,
        provider: 'google',
        status: 'OK',
        calculatedAt: new Date(),
        cached: false,
      });

      let insertedPayload: any = null;
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockImplementation((p) => {
          if (p.orderNumber) insertedPayload = p;
          return {
            returning: jest.fn().mockResolvedValue([
              {
                id: 'order-concurrent-success',
                orderNumber: 'FL-20261114-8888',
                status: 'pending_payment',
                totalPayable: '345.00',
              },
            ]),
          };
        }),
      });

      const res = await ordersService.checkout(customerId, { deliveryAddressId: 'addr-1800m' });
      expect(res.id).toBe('order-concurrent-success');

      // Verify that snapshot accurately records the effective version that was active at commit
      expect(insertedPayload.deliveryAddressSnapshot).toMatchObject({
        policyVersionId: 'policy-v2-promoted',
        policyVersionNumber: 2,
        roadDistanceMeters: 1800,
      });
    });
  });

  describe('Phase 2 Stage B: Boundary, Concurrency & Idempotency Hardening', () => {
    const outletLat = 28.4682;
    const outletLon = 77.5117;

    const validCart = {
      cartId: 'cart-1',
      outletId,
      restaurantName: 'Amritsari Kulcha',
      outletName: 'Knowledge Park III',
      isOutletOperational: true,
      items: [
        {
          id: 'cart-item-1',
          menuItemId,
          name: 'Paneer Kulcha',
          quantity: 2,
          unitPrice: 100.0,
          totalPrice: 200.0,
          isAvailable: true,
          imageUrl: null,
        },
      ],
      itemCount: 2,
      itemTotal: 200.0,
      deliveryFee: 30.0,
      taxAmount: 10.0,
      taxes: { foodGstPercent: 5, deliveryFeeGstPercent: 0, foodTax: 10.0, deliveryFeeTax: 0, taxAmount: 10.0 },
      discountAmount: 0.0,
      totalPayable: 240.0,
    };

    it('Boundary: road distance 2999 meters is allowed (within 3000m limit)', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValue(validCart);

      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce({
        id: 'addr-2999m',
        userId: customerId,
        label: 'Home',
        addressLine1: 'Boundary Road 2999',
        latitude: '28.4744000',
        longitude: '77.4912000',
      });

      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: outletLat,
        longitude: outletLon,
      });

      mockRoutingService.getRoute.mockResolvedValueOnce({
        distanceMeters: 2999,
        durationSeconds: 360,
        provider: 'google',
        status: 'OK',
        calculatedAt: new Date(),
        cached: false,
      });

      let insertedPayload: any = null;
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockImplementation((p) => {
          if (p.orderNumber) insertedPayload = p;
          return {
            returning: jest.fn().mockResolvedValue([
              { id: 'order-2999m', orderNumber: 'FL-20261114-2999', status: 'pending_payment' },
            ]),
          };
        }),
      });

      const res = await ordersService.checkout(customerId, { deliveryAddressId: 'addr-2999m' });
      expect(res.id).toBe('order-2999m');
      expect(insertedPayload.deliveryAddressSnapshot.roadDistanceMeters).toBe(2999);
    });

    it('Boundary: road distance exactly 3000 meters is allowed (exact threshold boundary)', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValue(validCart);

      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce({
        id: 'addr-3000m',
        userId: customerId,
        label: 'Home',
        addressLine1: 'Boundary Road 3000',
        latitude: '28.4744000',
        longitude: '77.4912000',
      });

      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: outletLat,
        longitude: outletLon,
      });

      mockRoutingService.getRoute.mockResolvedValueOnce({
        distanceMeters: 3000,
        durationSeconds: 370,
        provider: 'google',
        status: 'OK',
        calculatedAt: new Date(),
        cached: false,
      });

      let insertedPayload: any = null;
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockImplementation((p) => {
          if (p.orderNumber) insertedPayload = p;
          return {
            returning: jest.fn().mockResolvedValue([
              { id: 'order-3000m', orderNumber: 'FL-20261114-3000', status: 'pending_payment' },
            ]),
          };
        }),
      });

      const res = await ordersService.checkout(customerId, { deliveryAddressId: 'addr-3000m' });
      expect(res.id).toBe('order-3000m');
      expect(insertedPayload.deliveryAddressSnapshot.roadDistanceMeters).toBe(3000);
    });

    it('Boundary: road distance 3001 meters is rejected (exceeds threshold by 1 meter)', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValue(validCart);

      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce({
        id: 'addr-3001m',
        userId: customerId,
        label: 'Home',
        addressLine1: 'Boundary Road 3001',
        latitude: '28.4744000',
        longitude: '77.4912000',
      });

      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: outletLat,
        longitude: outletLon,
      });

      mockRoutingService.getRoute.mockResolvedValueOnce({
        distanceMeters: 3001,
        durationSeconds: 375,
        provider: 'google',
        status: 'OK',
        calculatedAt: new Date(),
        cached: false,
      });

      await expect(
        ordersService.checkout(customerId, { deliveryAddressId: 'addr-3001m' }),
      ).rejects.toThrow('This restaurant does not deliver to your selected address. Please choose another delivery address.');

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('Boundary: straight-line 2500m, road distance 3001m: Stage 1 passes but Stage 2 detour rejected', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValue(validCart);

      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce({
        id: 'addr-detour',
        userId: customerId,
        label: 'Detour Home',
        addressLine1: 'River Overpass 1',
        latitude: '28.4744000',
        longitude: '77.4912000',
      });

      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: outletLat,
        longitude: outletLon,
      });

      // Straight line mock: 2500m (<= 3000m)
      mockRoutingService.getStraightLineDistanceKm.mockReturnValueOnce(2.5);

      // Google road distance: 3001m (> 3000m)
      mockRoutingService.getRoute.mockResolvedValueOnce({
        distanceMeters: 3001,
        durationSeconds: 400,
        provider: 'google',
        status: 'OK',
        calculatedAt: new Date(),
        cached: false,
      });

      await expect(
        ordersService.checkout(customerId, { deliveryAddressId: 'addr-detour' }),
      ).rejects.toThrow('This restaurant does not deliver to your selected address. Please choose another delivery address.');

      expect(mockRoutingService.getRoute).toHaveBeenCalledTimes(1);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('Priority 1 Stale Cart: rejects checkout when cart was consumed/emptied during route calculation', async () => {
      // Step 1: Pre-check outside transaction finds valid cart
      jest.spyOn(cartService, 'getCart')
        .mockResolvedValueOnce(validCart) // Initial read outside tx
        .mockResolvedValueOnce(null);      // Transactional re-read inside tx under customer lock

      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce({
        id: 'addr-valid',
        userId: customerId,
        latitude: '28.4744000',
        longitude: '77.4912000',
      });

      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: outletLat,
        longitude: outletLon,
      });

      mockRoutingService.getRoute.mockResolvedValueOnce({
        distanceMeters: 2000,
        durationSeconds: 250,
        provider: 'google',
        status: 'OK',
        calculatedAt: new Date(),
      });

      await expect(
        ordersService.checkout(customerId, { deliveryAddressId: 'addr-valid' }),
      ).rejects.toThrow('Your cart is empty or has already been checked out.');

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('Priority 2 Idempotency: returns existing order when idempotency key is matched under customer lock without re-inserting', async () => {
      // Idempotency key not found in pre-check (simulates parallel arrival)
      mockDb.query.orders.findFirst
        .mockResolvedValueOnce(null) // Pre-check outside tx
        .mockResolvedValueOnce({    // Under customer lock inside tx
          id: 'existing-order-tx',
          orderNumber: 'FL-20261114-1111',
          customerId,
          idempotencyKey: 'idemp-tx-1',
          status: 'pending_payment',
          totalPayable: '240.00',
          itemTotal: '200.00',
          deliveryFee: '30.00',
          taxAmount: '10.00',
          discountAmount: '0.00',
          deliveryAddressSnapshot: {},
          placedAt: new Date(),
        });

      jest.spyOn(cartService, 'getCart').mockResolvedValue(validCart);

      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce({
        id: 'addr-valid',
        userId: customerId,
        latitude: '28.4744000',
        longitude: '77.4912000',
      });

      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: outletLat,
        longitude: outletLon,
      });

      mockRoutingService.getRoute.mockResolvedValueOnce({
        distanceMeters: 2000,
        durationSeconds: 250,
        provider: 'google',
        status: 'OK',
        calculatedAt: new Date(),
      });

      const res = await ordersService.checkout(customerId, {
        deliveryAddressId: 'addr-valid',
        idempotencyKey: 'idemp-tx-1',
      });

      expect(res.id).toBe('existing-order-tx');
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('Priority 2 Idempotency: recovers cleanly when concurrent transaction triggers 23505 unique constraint on idempotency_key', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValue(validCart);

      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce({
        id: 'addr-valid',
        userId: customerId,
        latitude: '28.4744000',
        longitude: '77.4912000',
      });

      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: outletLat,
        longitude: outletLon,
      });

      mockRoutingService.getRoute.mockResolvedValueOnce({
        distanceMeters: 2000,
        durationSeconds: 250,
        provider: 'google',
        status: 'OK',
        calculatedAt: new Date(),
      });

      // Simulate PostgreSQL 23505 unique constraint violation on orders_idempotency_key_idx
      const pgUniqueError: any = new Error('duplicate key value violates unique constraint "orders_idempotency_key_idx"');
      pgUniqueError.code = '23505';
      pgUniqueError.constraint = 'orders_idempotency_key_idx';

      mockDb.transaction.mockRejectedValueOnce(pgUniqueError);

      // findFirst in catch block resolves the committed order from the winning transaction
      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: 'order-winner-23505',
        orderNumber: 'FL-20261114-WINNER',
        customerId,
        idempotencyKey: 'concurrent-key-1',
        status: 'pending_payment',
        totalPayable: '240.00',
        itemTotal: '200.00',
        deliveryFee: '30.00',
        taxAmount: '10.00',
        discountAmount: '0.00',
        deliveryAddressSnapshot: {},
        placedAt: new Date(),
      });

      const res = await ordersService.checkout(customerId, {
        deliveryAddressId: 'addr-valid',
        idempotencyKey: 'concurrent-key-1',
      });

      expect(res.id).toBe('order-winner-23505');
      expect(res.orderNumber).toBe('FL-20261114-WINNER');
    });

    it('Priority 2 Idempotency: throws ConflictException if 23505 unique constraint caught belongs to another customer', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValue(validCart);

      mockDb.query.customerAddresses.findFirst.mockResolvedValueOnce({
        id: 'addr-valid',
        userId: customerId,
        latitude: '28.4744000',
        longitude: '77.4912000',
      });

      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: outletLat,
        longitude: outletLon,
      });

      mockRoutingService.getRoute.mockResolvedValueOnce({
        distanceMeters: 2000,
        durationSeconds: 250,
        provider: 'google',
        status: 'OK',
        calculatedAt: new Date(),
      });

      const pgUniqueError: any = new Error('duplicate key value violates unique constraint "orders_idempotency_key_idx"');
      pgUniqueError.code = '23505';
      pgUniqueError.constraint = 'orders_idempotency_key_idx';

      mockDb.transaction.mockRejectedValueOnce(pgUniqueError);

      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: 'order-other-customer',
        customerId: 'different-customer-uuid',
        idempotencyKey: 'concurrent-key-stolen',
      });

      await expect(
        ordersService.checkout(customerId, {
          deliveryAddressId: 'addr-valid',
          idempotencyKey: 'concurrent-key-stolen',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Stage 1: One Active Order Per Customer Enforcement', () => {
    const customerId = 'cust-uuid-1';
    const outletId = 'outlet-uuid-1';
    const outletLat = '28.4720000';
    const outletLon = '77.4880000';

    const validCart = {
      id: 'cart-uuid-1',
      customerId,
      outletId,
      restaurantName: 'Haldiram',
      outletName: 'Express Outlet',
      isOutletOperational: true,
      items: [
        {
          id: 'cart-item-1',
          menuItemId: 'menu-1',
          name: 'Paneer Butter Masala',
          unitPrice: 250.0,
          quantity: 1,
          totalPrice: 250.0,
          isAvailable: true,
        },
      ],
      itemTotal: 250.0,
      deliveryFee: 30.0,
      taxAmount: 12.5,
      taxes: { foodGstPercent: 5, deliveryFeeGstPercent: 0, foodTax: 12.5, deliveryFeeTax: 0, taxAmount: 12.5 },
      discountAmount: 0.0,
      totalPayable: 292.5,
      itemCount: 1,
    };

    beforeEach(() => {
      mockActiveOrdersInTx = [];
      jest.spyOn(cartService, 'getCart').mockResolvedValue(validCart as any);

      mockDb.query.customerAddresses.findFirst.mockResolvedValue({
        id: 'addr-valid',
        userId: customerId,
        latitude: '28.4744000',
        longitude: '77.4912000',
        label: 'Home',
        addressLine1: '123 Test St',
        city: 'Noida',
        postalCode: '201301',
      });

      mockDb.query.restaurantOutlets.findFirst.mockResolvedValue({
        id: outletId,
        latitude: outletLat,
        longitude: outletLon,
      });

      mockRoutingService.getRoute.mockResolvedValue({
        distanceMeters: 1500,
        durationSeconds: 180,
        provider: 'google',
        status: 'OK',
        calculatedAt: new Date(),
      });

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            {
              id: 'order-new-1',
              orderNumber: 'FL-20261114-NEW',
              status: 'pending_payment',
              itemTotal: '250.00',
              deliveryFee: '30.00',
              taxAmount: '12.50',
              discountAmount: '0.00',
              totalPayable: '292.50',
              placedAt: new Date(),
            },
          ]),
        }),
      });
    });

    it.each([
      'placed',
      'confirmed',
      'preparing',
      'ready_for_pickup',
      'out_for_delivery',
    ])('rejects checkout with 409 ACTIVE_ORDER_IN_PROGRESS when customer already has order in %s status', async (activeStatus) => {
      // Set active order to be returned by limit in tx.select
      mockActiveOrdersInTx = [
        {
          id: 'active-order-uuid',
          orderNumber: 'FL-20261114-ACTIVE',
          status: activeStatus,
          placedAt: new Date(),
          totalPayable: '350.00',
        },
      ];

      try {
        await ordersService.checkout(customerId, {
          deliveryAddressId: 'addr-valid',
        });
        fail('Should have thrown ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        const res = err.getResponse();
        expect(res.statusCode).toBe(409);
        expect(res.code).toBe('ACTIVE_ORDER_IN_PROGRESS');
        expect(res.activeOrder.orderNumber).toBe('FL-20261114-ACTIVE');
        expect(res.activeOrder.status).toBe(activeStatus);
      }
    });

    it.each([
      'delivered',
      'cancelled',
      'rejected',
    ])('allows checkout when prior order is in terminal status %s', async (terminalStatus) => {
      // No active order found
      mockActiveOrdersInTx = [];

      const res = await ordersService.checkout(customerId, {
        deliveryAddressId: 'addr-valid',
      });

      expect(res.id).toBe('order-new-1');
      expect(res.status).toBe('pending_payment');
    });

    it('allows checkout when prior order is pending_payment with uncaptured payment', async () => {
      // No active fulfillment order
      mockActiveOrdersInTx = [];

      const res = await ordersService.checkout(customerId, {
        deliveryAddressId: 'addr-valid',
      });

      expect(res.id).toBe('order-new-1');
      expect(res.status).toBe('pending_payment');
    });

    it('preserves same-key idempotency even when matching order is active in placed status', async () => {
      const activeExistingOrder = {
        id: 'existing-placed-order',
        orderNumber: 'FL-20261114-PLACED',
        customerId,
        status: 'placed',
        itemTotal: '250.00',
        deliveryFee: '30.00',
        taxAmount: '12.50',
        discountAmount: '0.00',
        totalPayable: '292.50',
        deliveryAddressSnapshot: {},
        placedAt: new Date(),
        items: [],
        outlet: { id: outletId },
      };

      mockDb.query.orders.findFirst.mockResolvedValueOnce(activeExistingOrder);

      const res = await ordersService.checkout(customerId, {
        deliveryAddressId: 'addr-valid',
        idempotencyKey: 'idemp-placed-retry-key',
      });

      expect(res.id).toBe('existing-placed-order');
      expect(res.orderNumber).toBe('FL-20261114-PLACED');
      expect(res.status).toBe('placed');
    });

    describe('getActiveCustomerOrder query', () => {
      it('returns hasActiveOrder: true with order summary when an active order exists', async () => {
        mockDb.query.orders.findFirst.mockResolvedValueOnce({
          id: 'active-ord-1',
          orderNumber: 'FL-20261114-ACTIVE',
          status: 'preparing',
          placedAt: new Date(),
          totalPayable: '420.00',
          itemTotal: '380.00',
          deliveryFee: '40.00',
          outlet: {
            name: 'Kolkata Biryani Hub',
            restaurant: { name: 'Kolkata Biryani' },
          },
          items: [{ id: 'item-1' }, { id: 'item-2' }],
        });

        const res = await ordersService.getActiveCustomerOrder(customerId);

        expect(res.hasActiveOrder).toBe(true);
        expect(res.activeOrder).toBeDefined();
        expect(res.activeOrder?.orderNumber).toBe('FL-20261114-ACTIVE');
        expect(res.activeOrder?.status).toBe('preparing');
        expect(res.activeOrder?.restaurantName).toBe('Kolkata Biryani');
        expect(res.activeOrder?.itemCount).toBe(2);
      });

      it('returns hasActiveOrder: false and activeOrder: null when no active fulfillment order exists', async () => {
        mockDb.query.orders.findFirst.mockResolvedValueOnce(null);

        const res = await ordersService.getActiveCustomerOrder(customerId);

        expect(res.hasActiveOrder).toBe(false);
        expect(res.activeOrder).toBeNull();
      });
    });
  });
});
