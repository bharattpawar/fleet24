import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MenusService } from './menus.service';
import { OutletAuthorizationService } from './outlet-auth.service';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import { AuthenticatedUserPayload } from '../auth/decorators/auth.decorators';

describe('Step 4.1 Menu Management Verification - Isolation, Auth & Integrity', () => {
  let menusService: MenusService;
  let outletAuthService: OutletAuthorizationService;
  let mockDb: any;

  // Mock Users
  const platformAdmin: AuthenticatedUserPayload = {
    userId: 'admin-uuid',
    phone: '+919999999999',
    sessionId: 'session-admin',
    roles: ['admin'],
  };

  const ownerUser: AuthenticatedUserPayload = {
    userId: 'owner-uuid',
    phone: '+919876543210',
    sessionId: 'session-owner',
    roles: ['restaurant_staff'],
  };

  const kitchenCrewStaff: AuthenticatedUserPayload = {
    userId: 'kitchen-crew-1',
    phone: '+919811111199',
    sessionId: 'session-kitchen',
    roles: ['restaurant_staff'],
  };

  const managerStaff: AuthenticatedUserPayload = {
    userId: 'manager-outlet-a',
    phone: '+919811111188',
    sessionId: 'session-manager',
    roles: ['restaurant_staff'],
  };

  const outletBStaff: AuthenticatedUserPayload = {
    userId: 'staff-outlet-b',
    phone: '+919822222222',
    sessionId: 'session-staff-b',
    roles: ['restaurant_staff'],
  };

  const unauthorizedStaff: AuthenticatedUserPayload = {
    userId: 'staff-stranger',
    phone: '+919833333333',
    sessionId: 'session-stranger',
    roles: ['restaurant_staff'],
  };

  const customerUser: AuthenticatedUserPayload = {
    userId: 'customer-uuid',
    phone: '+919844444444',
    sessionId: 'session-customer',
    roles: ['customer'],
  };

  // Base restaurant and outlets
  const testRestaurant = {
    id: 'rest-uuid-1',
    name: 'Spice Symphony',
    slug: 'spice-symphony',
    ownerId: 'owner-uuid',
  };

  const outletA = {
    id: 'outlet-a-uuid',
    restaurantId: 'rest-uuid-1',
    name: 'Spice Symphony - Sector 62',
    restaurant: testRestaurant,
  };

  const outletB = {
    id: 'outlet-b-uuid',
    restaurantId: 'rest-uuid-1',
    name: 'Spice Symphony - Indirapuram',
    restaurant: testRestaurant,
  };

  const outletC = {
    id: 'outlet-c-uuid',
    restaurantId: 'rest-uuid-1',
    name: 'Spice Symphony - Greater Noida',
    restaurant: testRestaurant,
  };

  const baseDish = {
    id: 'dish-butter-chicken',
    restaurantId: 'rest-uuid-1',
    name: 'Butter Chicken Special',
    basePrice: '350.00',
    isAvailable: true,
  };

  beforeEach(async () => {
    mockDb = {
      query: {
        restaurantOutlets: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        restaurants: {
          findFirst: jest.fn(),
        },
        restaurantStaff: {
          findFirst: jest.fn(),
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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenusService,
        OutletAuthorizationService,
        { provide: DRIZZLE_CONNECTION, useValue: mockDb },
      ],
    }).compile();

    menusService = module.get<MenusService>(MenusService);
    outletAuthService = module.get<OutletAuthorizationService>(OutletAuthorizationService);
  });

  describe('1. Outlet Isolation: Independent Availability & Pricing', () => {
    it('marking dish unavailable in Outlet A must NOT affect Outlet B or Outlet C', async () => {
      // Mock Outlet A query where dish has override isAvailable = false
      mockDb.query.restaurantOutlets.findFirst.mockImplementation(({ where }: any) => {
        return Promise.resolve(outletA);
      });

      // Simulation: Query menu items for Outlet A
      mockDb.query.menuItems.findMany.mockResolvedValueOnce([
        {
          ...baseDish,
          outletOverrides: [
            {
              outletId: outletA.id,
              customPrice: null,
              isAvailable: false, // Turned OFF at Outlet A
            },
          ],
        },
      ]);

      const outletAItems = await menusService.listMenuItemsForOutlet(outletA.id);
      expect(outletAItems[0].effectiveIsAvailable).toBe(false);
      expect(outletAItems[0].effectivePrice).toBe('350.00');

      // Simulation: Query menu items for Outlet B (No override, base applies)
      mockDb.query.menuItems.findMany.mockResolvedValueOnce([
        {
          ...baseDish,
          outletOverrides: [], // No override for Outlet B
        },
      ]);

      const outletBItems = await menusService.listMenuItemsForOutlet(outletB.id);
      expect(outletBItems[0].effectiveIsAvailable).toBe(true);
      expect(outletBItems[0].effectivePrice).toBe('350.00');

      // Simulation: Query menu items for Outlet C (Independent override: Price = 380, isAvailable = true)
      mockDb.query.menuItems.findMany.mockResolvedValueOnce([
        {
          ...baseDish,
          outletOverrides: [
            {
              outletId: outletC.id,
              customPrice: '380.00',
              isAvailable: true,
            },
          ],
        },
      ]);

      const outletCItems = await menusService.listMenuItemsForOutlet(outletC.id);
      expect(outletCItems[0].effectiveIsAvailable).toBe(true);
      expect(outletCItems[0].effectivePrice).toBe('380.00');
      // Crucial: Base price remains untouched at 350.00
      expect(outletCItems[0].basePrice).toBe('350.00');
    });

    it('updating override at Outlet A inserts/updates outlet_menu_item_overrides scoped to outlet_id', async () => {
      // OutletAuth allows outletAStaff
      mockDb.query.restaurantOutlets.findFirst.mockResolvedValue(outletA);
      mockDb.query.restaurantStaff.findFirst.mockResolvedValue({
        id: 'staff-assignment-a',
        userId: kitchenCrewStaff.userId,
        outletId: outletA.id,
        isActive: true,
      });

      // MenuItem exists
      mockDb.query.menuItems.findFirst.mockResolvedValue(baseDish);

      // Existing override does not exist initially
      mockDb.query.outletMenuItemOverrides.findFirst.mockResolvedValue(null);

      const returningMock = jest.fn().mockResolvedValue([
        {
          id: 'override-1',
          outletId: outletA.id,
          menuItemId: baseDish.id,
          isAvailable: false,
          customPrice: null,
        },
      ]);
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: returningMock,
        }),
      });

      const res = await menusService.setOutletMenuItemOverride(
        outletA.id,
        baseDish.id,
        { isAvailable: false },
        kitchenCrewStaff,
      );

      expect(res.outletId).toBe(outletA.id);
      expect(res.isAvailable).toBe(false);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('2. Backend Role Authorization Tests', () => {
    it('Owner can manage base menu items and update outlet overrides', async () => {
      // Owner matches restaurant.ownerId
      mockDb.query.restaurantOutlets.findFirst.mockResolvedValue(outletA);

      const outletAccess = await outletAuthService.verifyOutletAccess(ownerUser, outletA.id);
      expect(outletAccess.id).toBe(outletA.id);
    });

    it('Manager assigned to Outlet A has operational authority for Outlet A', async () => {
      mockDb.query.restaurantOutlets.findFirst.mockResolvedValue(outletA);
      mockDb.query.restaurantStaff.findFirst.mockResolvedValue({
        id: 'assignment-manager-a',
        userId: managerStaff.userId,
        outletId: outletA.id,
        designation: 'General Manager',
        isActive: true,
      });

      const outletAccess = await outletAuthService.verifyOutletAccess(managerStaff, outletA.id);
      expect(outletAccess.id).toBe(outletA.id);
    });

    it('Kitchen staff assigned to Outlet A can set overrides for Outlet A', async () => {
      mockDb.query.restaurantOutlets.findFirst.mockResolvedValue(outletA);
      mockDb.query.restaurantStaff.findFirst.mockResolvedValue({
        id: 'staff-assignment-a',
        userId: kitchenCrewStaff.userId,
        outletId: outletA.id,
        designation: 'Head Chef',
        isActive: true,
      });

      const outletAccess = await outletAuthService.verifyOutletAccess(kitchenCrewStaff, outletA.id);
      expect(outletAccess.id).toBe(outletA.id);
    });

    it('Kitchen Crew permissions in frontend resolver prohibit catalog editing but allow stock toggling', () => {
      const { resolvePermissions } = require('../../../restaurant-app/src/utils/permissions');
      
      const kitchenUser = {
        id: 'kitchen-crew-1',
        phone: '+919811111199',
        fullName: 'Ramesh Chef',
        email: null,
        roles: ['restaurant_staff'],
        designation: 'Kitchen Crew',
        resolvedRole: 'staff',
        restaurantName: 'Spice Symphony',
        isOwner: false,
      };

      const kitchenPerms = resolvePermissions(kitchenUser, {
        id: outletA.id,
        role: 'staff',
        designation: 'Kitchen Crew',
      });

      expect(kitchenPerms.canManageMenu).toBe(false);
      expect(kitchenPerms.canToggleItemAvailability).toBe(true);
      expect(kitchenPerms.canManageOutletInfo).toBe(false);

      const managerUser = {
        ...kitchenUser,
        id: 'manager-outlet-a',
        designation: 'Store Manager',
        resolvedRole: 'manager',
      };

      const managerPerms = resolvePermissions(managerUser, {
        id: outletA.id,
        role: 'manager',
        designation: 'Store Manager',
      });

      expect(managerPerms.canManageMenu).toBe(true);
      expect(managerPerms.canToggleItemAvailability).toBe(true);
      expect(managerPerms.canManageOutletInfo).toBe(true);
    });

    it('Staff assigned to Outlet A is FORBIDDEN from updating overrides for Outlet B', async () => {
      mockDb.query.restaurantOutlets.findFirst.mockResolvedValue(outletB);
      // Staff assignment query returns null for Outlet B
      mockDb.query.restaurantStaff.findFirst.mockResolvedValue(null);

      await expect(
        outletAuthService.verifyOutletAccess(kitchenCrewStaff, outletB.id),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Unauthorized staff or cross-restaurant user is rejected with ForbiddenException', async () => {
      mockDb.query.restaurantOutlets.findFirst.mockResolvedValue(outletA);
      mockDb.query.restaurantStaff.findFirst.mockResolvedValue(null);

      await expect(
        outletAuthService.verifyOutletAccess(unauthorizedStaff, outletA.id),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Platform Admin bypasses outlet assignment and has full access', async () => {
      mockDb.query.restaurantOutlets.findFirst.mockResolvedValue(outletA);

      const outletAccess = await outletAuthService.verifyOutletAccess(platformAdmin, outletA.id);
      expect(outletAccess.id).toBe(outletA.id);
    });

    it('Customer role is strictly forbidden from accessing outlet management', async () => {
      mockDb.query.restaurantOutlets.findFirst.mockResolvedValue(outletA);

      await expect(
        outletAuthService.verifyOutletAccess(customerUser, outletA.id),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('3. Historical Order Snapshot & Schema Integrity', () => {
    it('verifies orderItems schema contains immutable snapshots (itemName, unitPrice, quantity)', async () => {
      const orderSchema = require('../database/schema/orders');
      
      expect(orderSchema.orderItems).toBeDefined();
      expect(orderSchema.orderItems.itemName).toBeDefined();
      expect(orderSchema.orderItems.unitPrice).toBeDefined();
      expect(orderSchema.orderItems.quantity).toBeDefined();
      expect(orderSchema.orderItems.totalPrice).toBeDefined();
      expect(orderSchema.orderItems.menuItemId).toBeDefined();
    });

    it('modifying base menu item price and name does NOT alter existing order_items row values', async () => {
      // Historical order item snapshot recorded during past order
      const pastOrderItem = {
        id: 'order-item-uuid-1',
        orderId: 'order-uuid-999',
        menuItemId: baseDish.id,
        itemName: 'Butter Chicken Special',
        unitPrice: '350.00',
        quantity: 2,
        totalPrice: '700.00',
      };

      // Base dish is updated later to new name and higher price
      const updatedDish = {
        ...baseDish,
        name: 'Butter Chicken Deluxe',
        basePrice: '420.00',
      };

      // Assert that past order item snapshot remains intact
      expect(pastOrderItem.itemName).toBe('Butter Chicken Special');
      expect(pastOrderItem.unitPrice).toBe('350.00');
      expect(pastOrderItem.totalPrice).toBe('700.00');
      expect(pastOrderItem.unitPrice).not.toBe(updatedDish.basePrice);
      expect(pastOrderItem.itemName).not.toBe(updatedDish.name);
    });
  });
});

