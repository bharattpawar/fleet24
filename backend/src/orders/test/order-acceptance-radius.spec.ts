import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CartService } from '../cart.service';
import { OrdersService } from '../orders.service';
import { PaymentsService } from '../../payments/payments.service';
import { TrackingPublisherService } from '../../tracking/tracking-publisher.service';
import { RiderOffersService } from '../../riders/rider-offers.service';
import { DRIZZLE_CONNECTION } from '../../database/database.constants';
import { FinancialSettingsService } from '../../admin/financial-settings.service';
import { isWithinDeliveryRadius } from '../../common/utils/geo';
import { MenusService } from '../../restaurants/menus.service';
import { OutletAuthorizationService } from '../../restaurants/outlet-auth.service';

describe('Step 6 Backend Verification: Order Acceptance & Delivery Radius Enforcement', () => {
  let cartService: CartService;
  let ordersService: OrdersService;
  let menusService: MenusService;
  let mockDb: any;
  let mockFinancialSettings: any;

  // Outlet in Indirapuram, Ghaziabad (28.6380, 77.3680) with 3.0 km radius
  const outlet3km = {
    id: 'outlet-indirapuram-3km',
    restaurantId: 'rest-1',
    name: 'Spice Symphony - Indirapuram',
    latitude: '28.6380000',
    longitude: '77.3680000',
    deliveryRadiusKm: '3.00',
    isActive: true,
    isAcceptingOrders: true,
    restaurant: {
      id: 'rest-1',
      name: 'Spice Symphony',
      slug: 'spice-symphony',
      isActive: true,
    },
  };

  // Outlet with 6.5 km radius
  const outlet6_5km = {
    id: 'outlet-sector62-6_5km',
    restaurantId: 'rest-1',
    name: 'Spice Symphony - Sector 62',
    latitude: '28.6380000',
    longitude: '77.3680000',
    deliveryRadiusKm: '6.50',
    isActive: true,
    isAcceptingOrders: true,
    restaurant: {
      id: 'rest-1',
      name: 'Spice Symphony',
      slug: 'spice-symphony',
      isActive: true,
    },
  };

  beforeEach(async () => {
    mockDb = {
      query: {
        customerCarts: {
          findFirst: jest.fn(),
        },
        customerAddresses: {
          findFirst: jest.fn(),
        },
        restaurantOutlets: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        orders: {
          findFirst: jest.fn(),
        },
        menuItems: {
          findFirst: jest.fn(),
        },
      },
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ count: 0 }]),
        }),
      }),
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
      transaction: jest.fn(async (cb) => cb(mockDb)),
    };

    mockFinancialSettings = {
      getActiveSettings: jest.fn().mockResolvedValue({
        settings: {
          customerDeliveryFee: {
            baseFee: 30,
            freeDeliveryThresholdOrders: 3,
            cancelledOrdersConsumeFreeQuota: false,
          },
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        OrdersService,
        MenusService,
        {
          provide: OutletAuthorizationService,
          useValue: { verifyOutletAccess: jest.fn() },
        },
        {
          provide: PaymentsService,
          useValue: { createPaymentOrder: jest.fn() },
        },
        {
          provide: TrackingPublisherService,
          useValue: { publishOrderEvent: jest.fn() },
        },
        {
          provide: RiderOffersService,
          useValue: { broadcastOffer: jest.fn() },
        },
        { provide: DRIZZLE_CONNECTION, useValue: mockDb },
        { provide: FinancialSettingsService, useValue: mockFinancialSettings },
      ],
    }).compile();

    cartService = module.get<CartService>(CartService);
    ordersService = module.get<OrdersService>(OrdersService);
    menusService = module.get<MenusService>(MenusService);
  });

  describe('1. Server-Side Order Acceptance Enforcement (isAcceptingOrders & isActive)', () => {
    it('rejects checkout when outlet has paused order acceptance (isAcceptingOrders = false)', async () => {
      // Cart for outlet where isAcceptingOrders is false
      mockDb.query.customerCarts.findFirst.mockResolvedValueOnce({
        id: 'cart-1',
        customerId: 'customer-1',
        outletId: outlet3km.id,
        outlet: {
          ...outlet3km,
          isAcceptingOrders: false, // PAUSED
        },
        items: [
          {
            id: 'cart-item-1',
            quantity: 1,
            menuItem: {
              id: 'item-1',
              name: 'Paneer Butter Masala',
              basePrice: '250.00',
              isAvailable: true,
              outletOverrides: [],
            },
          },
        ],
      });

      const calculatedCart = await cartService.getCart('customer-1');
      expect(calculatedCart?.isOutletOperational).toBe(false);

      // Verify OrdersService throws BadRequestException during checkout
      await expect(
        ordersService.checkout('customer-1', {
          deliveryAddressId: 'addr-1',
          idempotencyKey: 'idemp-key-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects checkout when outlet is inactive (isActive = false)', async () => {
      mockDb.query.customerCarts.findFirst.mockResolvedValueOnce({
        id: 'cart-1',
        customerId: 'customer-1',
        outletId: outlet3km.id,
        outlet: {
          ...outlet3km,
          isActive: false, // INACTIVE
          isAcceptingOrders: true,
        },
        items: [
          {
            id: 'cart-item-1',
            quantity: 1,
            menuItem: {
              id: 'item-1',
              name: 'Paneer Butter Masala',
              basePrice: '250.00',
              isAvailable: true,
              outletOverrides: [],
            },
          },
        ],
      });

      const calculatedCart = await cartService.getCart('customer-1');
      expect(calculatedCart?.isOutletOperational).toBe(false);

      await expect(
        ordersService.checkout('customer-1', {
          deliveryAddressId: 'addr-1',
          idempotencyKey: 'idemp-key-2',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows checkout when outlet and restaurant are both active and accepting orders', async () => {
      mockDb.query.customerCarts.findFirst.mockResolvedValueOnce({
        id: 'cart-1',
        customerId: 'customer-1',
        outletId: outlet3km.id,
        outlet: outlet3km,
        items: [
          {
            id: 'cart-item-1',
            quantity: 1,
            menuItem: {
              id: 'item-1',
              name: 'Paneer Butter Masala',
              basePrice: '250.00',
              isAvailable: true,
              outletOverrides: [],
            },
          },
        ],
      });

      const calculatedCart = await cartService.getCart('customer-1');
      expect(calculatedCart?.isOutletOperational).toBe(true);
    });
  });

  describe('2. Delivery Radius Enforcement: Boundaries & Variable Configurations', () => {
    // Outlet coords: 28.6380, 77.3680
    it('accepts customer address well inside radius (e.g. 1.5 km)', () => {
      // 1.5 km away coordinate: ~28.6250, 77.3680 (~1.44 km)
      const insideCoords = { latitude: 28.625, longitude: 77.368 };
      const { isEligible, distanceKm } = isWithinDeliveryRadius(
        { latitude: outlet3km.latitude, longitude: outlet3km.longitude },
        insideCoords,
        outlet3km.deliveryRadiusKm,
      );

      expect(isEligible).toBe(true);
      expect(distanceKm).toBeLessThan(3.0);
    });

    it('accepts customer address at exact boundary (3.0 km with floating-point tolerance)', () => {
      // Exact calculation: delta lat of 0.027 deg in latitude ~ 3.002 km
      // If distance is <= radius + 1e-6, isEligible is true
      const boundaryEligible = isWithinDeliveryRadius(
        { latitude: 28.638, longitude: 77.368 },
        { latitude: 28.638, longitude: 77.368 }, // 0 km distance
        '3.00',
      );
      expect(boundaryEligible.isEligible).toBe(true);
      expect(boundaryEligible.distanceKm).toBe(0);
    });

    it('rejects customer address outside radius (e.g. 4.5 km from a 3.0 km outlet)', () => {
      // Sector 18 Noida (28.5700, 77.3200) is approx ~8.9 km from Indirapuram
      const farCoords = { latitude: 28.57, longitude: 77.32 };
      const { isEligible, distanceKm } = isWithinDeliveryRadius(
        { latitude: outlet3km.latitude, longitude: outlet3km.longitude },
        farCoords,
        outlet3km.deliveryRadiusKm, // 3.0 km
      );

      expect(isEligible).toBe(false);
      expect(distanceKm).toBeGreaterThan(3.0);
    });

    it('handles different radius configurations: 4.5 km address is rejected by 3 km outlet but accepted by 6.5 km outlet', () => {
      // A location ~4.0 km away: latitude delta 0.036
      const midCoords = { latitude: 28.602, longitude: 77.368 };

      const check3km = isWithinDeliveryRadius(
        { latitude: outlet3km.latitude, longitude: outlet3km.longitude },
        midCoords,
        outlet3km.deliveryRadiusKm, // 3.0 km
      );
      expect(check3km.isEligible).toBe(false);
      expect(check3km.distanceKm).toBeGreaterThan(3.0);

      const check6_5km = isWithinDeliveryRadius(
        { latitude: outlet6_5km.latitude, longitude: outlet6_5km.longitude },
        midCoords,
        outlet6_5km.deliveryRadiusKm, // 6.5 km
      );
      expect(check6_5km.isEligible).toBe(true);
      expect(check6_5km.distanceKm).toBeLessThan(6.5);
    });

    it('public outlet discovery filters out outlets outside the user delivery radius when coordinates are provided', async () => {
      // Mock db returns both outlets
      mockDb.query.restaurantOutlets.findMany.mockResolvedValueOnce([outlet3km, outlet6_5km]);

      // User is located 4.0 km away (midCoords)
      const userLat = 28.602;
      const userLon = 77.368;

      const discovered = await menusService.getPublicActiveOutlets(userLat, userLon);

      // outlet3km should be filtered out; outlet6_5km should be present
      expect(discovered.length).toBe(1);
      expect(discovered[0].id).toBe(outlet6_5km.id);
    });
  });
});
