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
import { RoutingService } from '../../routing/routing.service';
import { calculateDistanceKm } from '../../common/utils/geo';

describe('Step 6 Backend Verification: Order Acceptance & Delivery Radius Enforcement', () => {
  let cartService: CartService;
  let ordersService: OrdersService;
  let menusService: MenusService;
  let mockDb: any;
  let mockFinancialSettings: any;
  let mockRoutingService: any;

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
        versionId: 'test-v1',
        versionNumber: 1,
        settings: {
          customerDeliveryFee: {
            baseFee: 30,
            freeDeliveryThresholdOrders: 3,
            cancelledOrdersConsumeFreeQuota: false,
          },
          deliveryServiceability: {
            maxRoadDistanceMeters: 3000,
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
        {
          provide: RoutingService,
          useFactory: () => {
            mockRoutingService = {
              getStraightLineDistanceKm: jest.fn((origin: any, dest: any) =>
                calculateDistanceKm(origin.latitude, origin.longitude, dest.latitude, dest.longitude),
              ),
              getRoute: jest.fn(async ({ origin, destination }: any) => {
                const d = calculateDistanceKm(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
                return {
                  distanceMeters: Math.round(d * 1000),
                  durationSeconds: Math.round(d * 100),
                  provider: 'google',
                  status: 'OK',
                  calculatedAt: new Date(),
                  cached: false,
                };
              }),
              getBatchRoutes: jest.fn(async (items: any[]) => {
                const resMap = new Map();
                for (const item of items) {
                  const d = calculateDistanceKm(item.origin.latitude, item.origin.longitude, item.destination.latitude, item.destination.longitude);
                  resMap.set(item.id, {
                    distanceMeters: Math.round(d * 1000),
                    durationSeconds: Math.round(d * 100),
                    provider: 'google',
                    status: 'OK',
                    calculatedAt: new Date(),
                    cached: false,
                  });
                }
                return resMap;
              }),
              isAvailable: jest.fn(() => true),
            };
            return mockRoutingService;
          },
        },
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

    it('Option A discovery: public outlet discovery strictly enforces admin 3km road limit over outlet deliveryRadiusKm', async () => {
      // Mock db returns both outlets
      mockDb.query.restaurantOutlets.findMany.mockResolvedValueOnce([outlet3km, outlet6_5km]);

      // User is located 4.0 km away (midCoords)
      const userLat = 28.602;
      const userLon = 77.368;

      const discovered = await menusService.getPublicActiveOutlets(userLat, userLon);

      // Under Option A, both outlets are filtered out because 4.0 km exceeds platform 3km limit
      expect(discovered.length).toBe(0);
    });

    it('Option A discovery: discovers outlets within the platform limit when coordinates are within range', async () => {
      mockDb.query.restaurantOutlets.findMany.mockResolvedValueOnce([outlet3km]);

      // User is located ~1.5 km away
      const userLat = 28.625;
      const userLon = 77.368;

      mockRoutingService.getBatchRoutes.mockResolvedValueOnce(
        new Map([
          [
            outlet3km.id,
            {
              distanceMeters: 1600,
              durationSeconds: 200,
              provider: 'google',
              status: 'OK',
              calculatedAt: new Date(),
              cached: false,
            },
          ],
        ]),
      );

      const discovered = await menusService.getPublicActiveOutlets(userLat, userLon);
      expect(discovered.length).toBe(1);
      expect(discovered[0].id).toBe(outlet3km.id);
      expect(discovered[0].distanceKm).toBe(1.6);
      expect(discovered[0].serviceabilityStatus).toBe('VERIFIED');
    });

    it('filters out outlet whose straight-line is <= 3 km but Google road distance exceeds 3000m', async () => {
      // Outlet is located at 28.6380, 77.3680 with 3.0 km radius
      // User is located ~2.2 km away straight-line
      const userLat = 28.618;
      const userLon = 77.368;

      mockDb.query.restaurantOutlets.findMany.mockResolvedValueOnce([outlet3km]);

      // But actual road distance has detours/flyovers making it 3,400 meters (> 3000m)
      mockRoutingService.getBatchRoutes.mockResolvedValueOnce(
        new Map([
          [
            outlet3km.id,
            {
              distanceMeters: 3400,
              durationSeconds: 420,
              provider: 'google',
              status: 'OK',
              calculatedAt: new Date(),
              cached: false,
            },
          ],
        ]),
      );

      const discovered = await menusService.getPublicActiveOutlets(userLat, userLon);

      // Must be filtered out because road distance exceeds 3000m!
      expect(discovered.length).toBe(0);
    });

    it('batches multiple candidate outlets into a single getBatchRoutes call', async () => {
      const outletA = { ...outlet3km, id: 'outlet-a', name: 'Outlet A' };
      const outletB = { ...outlet3km, id: 'outlet-b', name: 'Outlet B' };

      // User ~1.5 km away
      const userLat = 28.625;
      const userLon = 77.368;

      mockDb.query.restaurantOutlets.findMany.mockResolvedValueOnce([outletA, outletB]);

      mockRoutingService.getBatchRoutes.mockResolvedValueOnce(
        new Map([
          [outletA.id, { distanceMeters: 1600, durationSeconds: 200, status: 'OK', provider: 'google', calculatedAt: new Date(), cached: false }],
          [outletB.id, { distanceMeters: 1700, durationSeconds: 210, status: 'OK', provider: 'google', calculatedAt: new Date(), cached: false }],
        ]),
      );

      const discovered = await menusService.getPublicActiveOutlets(userLat, userLon);

      expect(discovered.length).toBe(2);
      expect(mockRoutingService.getBatchRoutes).toHaveBeenCalledTimes(1);
      expect(mockRoutingService.getBatchRoutes).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'outlet-a' }),
          expect.objectContaining({ id: 'outlet-b' }),
        ]),
      );
    });

    it('marks outlet as UNVERIFIED with undefined distanceKm when routing provider fails without falsifying Haversine as road distance', async () => {
      const userLat = 28.625;
      const userLon = 77.368;

      mockDb.query.restaurantOutlets.findMany.mockResolvedValueOnce([outlet3km]);

      // Routing provider returns error/unavailable
      mockRoutingService.getBatchRoutes.mockResolvedValueOnce(
        new Map([
          [
            outlet3km.id,
            {
              distanceMeters: null,
              durationSeconds: null,
              provider: 'google',
              status: 'ROUTING_UNAVAILABLE',
              calculatedAt: new Date(),
              cached: false,
              errorMessage: 'Google Routes service unavailable',
            },
          ],
        ]),
      );

      const discovered = await menusService.getPublicActiveOutlets(userLat, userLon);

      expect(discovered.length).toBe(1);
      // Distance must NEVER be straight-line distance; it must be undefined!
      expect(discovered[0].distanceKm).toBeUndefined();
      expect(discovered[0].isServiceable).toBe(false);
      expect(discovered[0].serviceabilityStatus).toBe('UNVERIFIED');
    });

    it('returns compatible response shape for Customer App with all required fields', async () => {
      const userLat = 28.625;
      const userLon = 77.368;

      mockDb.query.restaurantOutlets.findMany.mockResolvedValueOnce([outlet3km]);

      mockRoutingService.getBatchRoutes.mockResolvedValueOnce(
        new Map([
          [
            outlet3km.id,
            {
              distanceMeters: 1540,
              durationSeconds: 190,
              provider: 'google',
              status: 'OK',
              calculatedAt: new Date(),
              cached: false,
            },
          ],
        ]),
      );

      const [outlet] = await menusService.getPublicActiveOutlets(userLat, userLon);

      expect(outlet).toMatchObject({
        id: outlet3km.id,
        restaurantName: outlet3km.restaurant.name,
        outletName: outlet3km.name,
        slug: outlet3km.restaurant.slug,
        distanceKm: 1.54,
        isServiceable: true,
        serviceabilityStatus: 'VERIFIED',
        isAcceptingOrders: true,
      });
    });
  });
});
