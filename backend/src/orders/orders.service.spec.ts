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

describe('Cart & Orders Management (Unit Tests)', () => {
  let cartService: CartService;
  let ordersService: OrdersService;
  let mockDb: any;
  let mockFinancialSettingsService: any;

  const customerId = 'cust-uuid-1';
  const outletId = 'outlet-uuid-1';
  const menuItemId = 'item-uuid-1';

  beforeEach(async () => {
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
        },
      }),
      calculateCustomerDeliveryFee: jest.fn().mockReturnValue({
        isFreeDelivery: false,
        deliveryFee: 30.0,
        reason: 'Standard customer delivery fee',
      }),
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
      ],
    }).compile();

    cartService = module.get<CartService>(CartService);
    ordersService = module.get<OrdersService>(OrdersService);
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
      jest.spyOn(cartService, 'getCart').mockResolvedValueOnce(validCart);

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

      mockDb.insert().values().returning.mockResolvedValueOnce([
        {
          id: 'order-created-1',
          orderNumber: 'FL-20261030-5555',
          status: 'pending_payment',
          totalPayable: '240.00',
          itemTotal: '200.00',
          deliveryFee: '30.00',
          taxAmount: '10.00',
          discountAmount: '0.00',
          deliveryAddressSnapshot: {},
          placedAt: new Date(),
        },
      ]);

      const res = await ordersService.checkout(customerId, { deliveryAddressId: 'addr-kp3' });
      expect(res.id).toBe('order-created-1');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('2. Address beyond 3 km: checkout rejected with clear error', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValueOnce(validCart);

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

    it('3. Outlet with different configured radius (5 km): 3.8 km address is allowed', async () => {
      jest.spyOn(cartService, 'getCart').mockResolvedValueOnce(validCart);

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

      // Configured for 5.00 km radius
      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: outletId,
        latitude: outletLatitude,
        longitude: outletLongitude,
        deliveryRadiusKm: '5.00',
      });

      mockDb.insert().values().returning.mockResolvedValueOnce([
        {
          id: 'order-created-2',
          orderNumber: 'FL-20261030-5556',
          status: 'pending_payment',
          totalPayable: '240.00',
          itemTotal: '200.00',
          deliveryFee: '30.00',
          taxAmount: '10.00',
          discountAmount: '0.00',
          deliveryAddressSnapshot: {},
          placedAt: new Date(),
        },
      ]);

      const res = await ordersService.checkout(customerId, { deliveryAddressId: 'addr-chi5' });
      expect(res.id).toBe('order-created-2');
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
});
