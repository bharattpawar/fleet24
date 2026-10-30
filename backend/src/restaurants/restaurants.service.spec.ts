import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { RestaurantsService } from './restaurants.service';
import { MenusService } from './menus.service';
import { OutletAuthorizationService } from './outlet-auth.service';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import { AuthenticatedUserPayload } from '../auth/decorators/auth.decorators';

describe('Restaurant & Menu Management (Unit Tests)', () => {
  let restaurantsService: RestaurantsService;
  let menusService: MenusService;
  let outletAuthService: OutletAuthorizationService;
  let mockDb: any;

  const adminUser: AuthenticatedUserPayload = {
    userId: 'admin-uuid-1',
    phone: '+919999999999',
    sessionId: 'session-admin',
    roles: ['admin'],
  };

  const staffUser: AuthenticatedUserPayload = {
    userId: 'staff-uuid-1',
    phone: '+918888888888',
    sessionId: 'session-staff',
    roles: ['restaurant_staff'],
  };

  const customerUser: AuthenticatedUserPayload = {
    userId: 'customer-uuid-1',
    phone: '+917777777777',
    sessionId: 'session-customer',
    roles: ['customer'],
  };

  beforeEach(async () => {
    mockDb = {
      query: {
        restaurants: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        restaurantOutlets: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        restaurantStaff: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        outletOperatingHours: {
          findMany: jest.fn(),
        },
        menuCategories: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        menuItems: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        outletMenuItemOverrides: {
          findFirst: jest.fn(),
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
      delete: jest.fn().mockReturnValue({
        where: jest.fn(),
      }),
      transaction: jest.fn(async (cb) => cb(mockDb)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RestaurantsService,
        MenusService,
        OutletAuthorizationService,
        { provide: DRIZZLE_CONNECTION, useValue: mockDb },
      ],
    }).compile();

    restaurantsService = module.get<RestaurantsService>(RestaurantsService);
    menusService = module.get<MenusService>(MenusService);
    outletAuthService = module.get<OutletAuthorizationService>(OutletAuthorizationService);
  });

  describe('OutletAuthorizationService', () => {
    it('should allow admin full access to any outlet', async () => {
      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: 'outlet-1',
        restaurantId: 'rest-1',
      });

      const outlet = await outletAuthService.verifyOutletAccess(adminUser, 'outlet-1');
      expect(outlet.id).toBe('outlet-1');
    });

    it('should allow restaurant staff assigned to the outlet', async () => {
      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: 'outlet-1',
        restaurantId: 'rest-1',
      });
      mockDb.query.restaurantStaff.findFirst.mockResolvedValueOnce({
        id: 'staff-assignment-1',
        userId: staffUser.userId,
        outletId: 'outlet-1',
        isActive: true,
      });

      const outlet = await outletAuthService.verifyOutletAccess(staffUser, 'outlet-1');
      expect(outlet.id).toBe('outlet-1');
    });

    it('should throw ForbiddenException if staff is not assigned to the outlet', async () => {
      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: 'outlet-unauthorized',
      });
      mockDb.query.restaurantStaff.findFirst.mockResolvedValueOnce(null);

      await expect(
        outletAuthService.verifyOutletAccess(staffUser, 'outlet-unauthorized'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for ordinary customer role', async () => {
      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: 'outlet-1',
      });

      await expect(
        outletAuthService.verifyOutletAccess(customerUser, 'outlet-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('RestaurantsService', () => {
    it('should create a restaurant with generated slug', async () => {
      mockDb.query.restaurants.findFirst.mockResolvedValueOnce(null);
      mockDb.insert.mockReturnValueOnce({
        values: jest.fn().mockReturnValueOnce({
          returning: jest.fn().mockResolvedValueOnce([
            { id: 'rest-uuid', name: 'Bikanervala Greater Noida', slug: 'bikanervala-greater-noida' },
          ]),
        }),
      });

      const result = await restaurantsService.createRestaurant(
        { name: 'Bikanervala Greater Noida' },
        adminUser,
      );

      expect(result.slug).toBe('bikanervala-greater-noida');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should reject duplicate slug creation', async () => {
      mockDb.query.restaurants.findFirst.mockResolvedValueOnce({
        id: 'existing-id',
        slug: 'bikanervala',
      });

      await expect(
        restaurantsService.createRestaurant({ name: 'Bikanervala', slug: 'bikanervala' }, adminUser),
      ).rejects.toThrow(ConflictException);
    });

    it('should pause and resume order acceptance', async () => {
      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: 'outlet-1',
      });
      mockDb.update.mockReturnValueOnce({
        set: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            returning: jest.fn().mockResolvedValueOnce([
              { id: 'outlet-1', isAcceptingOrders: false },
            ]),
          }),
        }),
      });

      const res = await restaurantsService.updateOrderAcceptance('outlet-1', false, adminUser);
      expect(res.isAcceptingOrders).toBe(false);
    });
  });

  describe('Operating Hours Validation', () => {
    it('should reject operating hours where openTime >= closeTime', async () => {
      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({ id: 'outlet-1' });

      await expect(
        restaurantsService.saveOutletOperatingHours(
          'outlet-1',
          [
            { dayOfWeek: 1, openTime: '22:00', closeTime: '10:00', isClosed: false },
          ],
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('MenusService - Effective Pricing & Overrides', () => {
    it('should merge base menu item with outlet override correctly', async () => {
      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: 'outlet-1',
        restaurantId: 'rest-1',
      });

      mockDb.query.menuItems.findMany.mockResolvedValueOnce([
        {
          id: 'item-1',
          name: 'Paneer Butter Masala',
          basePrice: '250.00',
          isAvailable: true,
          outletOverrides: [
            {
              outletId: 'outlet-1',
              customPrice: '280.00',
              isAvailable: true,
            },
          ],
        },
        {
          id: 'item-2',
          name: 'Dal Makhani',
          basePrice: '200.00',
          isAvailable: true,
          outletOverrides: [
            {
              outletId: 'outlet-1',
              customPrice: null,
              isAvailable: false, // Paused only at this outlet
            },
          ],
        },
      ]);

      const items = await menusService.listMenuItemsForOutlet('outlet-1');

      // Item 1 has custom price 280.00
      expect(items[0].effectivePrice).toBe('280.00');
      expect(items[0].effectiveIsAvailable).toBe(true);
      expect(items[0].isOverridden).toBe(true);

      // Item 2 has base price 200.00 but is paused (false) at outlet
      expect(items[1].effectivePrice).toBe('200.00');
      expect(items[1].effectiveIsAvailable).toBe(false);
      expect(items[1].isOverridden).toBe(true);
    });
  });
});
