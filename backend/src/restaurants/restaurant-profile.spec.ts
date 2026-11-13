import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RestaurantsService } from './restaurants.service';
import { RestaurantProfileController } from './restaurant-profile.controller';
import { OutletAuthorizationService } from './outlet-auth.service';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import { AuthenticatedUserPayload } from '../auth/decorators/auth.decorators';

describe('RestaurantProfile & Financial APIs', () => {
  let controller: RestaurantProfileController;
  let service: RestaurantsService;
  let mockDb: any;
  let mockOutletAuthService: any;
  let mockJwtService: any;
  let mockConfigService: any;

  const mockStaffUser: AuthenticatedUserPayload = {
    userId: 'user-staff-1',
    phone: '+919876543210',
    sessionId: 'session-1',
    roles: ['restaurant_staff'],
  };

  const mockMultiOutletStaffUser: AuthenticatedUserPayload = {
    userId: 'user-multi-staff-2',
    phone: '+919811122233',
    sessionId: 'session-2',
    roles: ['restaurant_staff'],
  };

  const mockAdminUser: AuthenticatedUserPayload = {
    userId: 'user-admin-99',
    phone: '+919999999999',
    sessionId: 'session-99',
    roles: ['admin'],
  };

  const mockRiderUser: AuthenticatedUserPayload = {
    userId: 'user-rider-5',
    phone: '+919555555555',
    sessionId: 'session-5',
    roles: ['rider'],
  };

  beforeEach(async () => {
    mockDb = {
      query: {
        users: {
          findFirst: jest.fn(),
        },
        restaurants: {
          findFirst: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
        },
        restaurantOutlets: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        restaurantStaff: {
          findFirst: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
        },
        restaurantSettlements: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        restaurantMonthlyDeliveryCredits: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
      },
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      transaction: jest.fn(),
    };

    mockOutletAuthService = {
      verifyOutletAccess: jest.fn(),
      verifyRestaurantAdminAccess: jest.fn(),
    };

    mockJwtService = {
      verifyAsync: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('mock-jwt-secret'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestaurantProfileController],
      providers: [
        RestaurantsService,
        {
          provide: DRIZZLE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: OutletAuthorizationService,
          useValue: mockOutletAuthService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<RestaurantProfileController>(RestaurantProfileController);
    service = module.get<RestaurantsService>(RestaurantsService);
  });

  describe('1. Profile API (GET /api/v1/restaurant/profile)', () => {
    it('should return authenticated staff profile and authorized outlet details', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 'user-staff-1',
        fullName: 'Chef Rajesh',
        email: 'rajesh@burgerpoint.com',
        phone: '+919876543210',
      });

      mockDb.query.restaurantStaff.findMany.mockResolvedValue([
        {
          id: 'staff-rel-1',
          userId: 'user-staff-1',
          outletId: 'outlet-1',
          designation: 'Head Chef',
          isActive: true,
          outlet: {
            id: 'outlet-1',
            name: 'Burger Point Sector 1',
            phone: '+91120000001',
            address: 'Pari Chowk, Greater Noida',
            isAcceptingOrders: true,
            isActive: true,
            deliveryRadiusKm: '3.50',
            restaurant: {
              id: 'rest-1',
              name: 'Burger Point',
              slug: 'burger-point',
              verificationStatus: 'verified',
              isActive: true,
            },
          },
        },
      ]);

      const result = await controller.getProfile(mockStaffUser);

      expect(result).toBeDefined();
      expect(result.staff.id).toBe('user-staff-1');
      expect(result.staff.name).toBe('Chef Rajesh');
      expect(result.staff.designation).toBe('Head Chef');
      expect(result.authorizedOutlets).toHaveLength(1);
      expect(result.authorizedOutlets[0].outletId).toBe('outlet-1');
      expect(result.authorizedOutlets[0].outletName).toBe('Burger Point Sector 1');
      expect(result.authorizedOutlets[0].restaurant.name).toBe('Burger Point');
      expect(result.authorizedOutlets[0].isAcceptingOrders).toBe(true);
    });

    it('should support multi-outlet staff and return all authorized outlets', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 'user-multi-staff-2',
        fullName: 'Manager Priya',
        email: 'priya@foodcorp.com',
        phone: '+919811122233',
      });

      mockDb.query.restaurantStaff.findMany.mockResolvedValue([
        {
          id: 'staff-rel-10',
          userId: 'user-multi-staff-2',
          outletId: 'outlet-alpha',
          designation: 'General Manager',
          isActive: true,
          outlet: {
            id: 'outlet-alpha',
            name: 'Pizza Hub Alpha',
            phone: '+91120111111',
            address: 'Alpha 1 Commercial Belt',
            isAcceptingOrders: true,
            isActive: true,
            deliveryRadiusKm: '4.00',
            restaurant: {
              id: 'rest-10',
              name: 'Pizza Hub',
              slug: 'pizza-hub',
              verificationStatus: 'verified',
              isActive: true,
            },
          },
        },
        {
          id: 'staff-rel-11',
          userId: 'user-multi-staff-2',
          outletId: 'outlet-beta',
          designation: 'Area Manager',
          isActive: true,
          outlet: {
            id: 'outlet-beta',
            name: 'Pizza Hub Beta',
            phone: '+91120222222',
            address: 'Beta 2 Market',
            isAcceptingOrders: false,
            isActive: true,
            deliveryRadiusKm: '3.00',
            restaurant: {
              id: 'rest-10',
              name: 'Pizza Hub',
              slug: 'pizza-hub',
              verificationStatus: 'verified',
              isActive: true,
            },
          },
        },
      ]);

      const result = await controller.getProfile(mockMultiOutletStaffUser);

      expect(result.authorizedOutlets).toHaveLength(2);
      expect(result.authorizedOutlets[0].outletId).toBe('outlet-alpha');
      expect(result.authorizedOutlets[1].outletId).toBe('outlet-beta');
      expect(result.authorizedOutlets[1].isAcceptingOrders).toBe(false);
    });

    it('should reject profile request if staff has no active outlet assignments', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 'user-staff-1',
        fullName: 'Chef Rajesh',
      });

      mockDb.query.restaurantStaff.findMany.mockResolvedValue([]);

      await expect(controller.getProfile(mockStaffUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow admin user to retrieve profile with all outlets', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 'user-admin-99',
        fullName: 'Fleet24 Superadmin',
        email: 'admin@fleet24.in',
      });

      mockDb.query.restaurantOutlets.findMany.mockResolvedValue([
        {
          id: 'outlet-root-1',
          name: 'Central Kitchen',
          address: 'Knowledge Park III',
          phone: '+91120999999',
          isAcceptingOrders: true,
          isActive: true,
          deliveryRadiusKm: '5.00',
          restaurant: {
            id: 'rest-root-1',
            name: 'Central Food Works',
            slug: 'central-food-works',
            verificationStatus: 'verified',
            isActive: true,
          },
        },
      ]);

      const result = await controller.getProfile(mockAdminUser);

      expect(result.staff.designation).toBe('Platform Administrator');
      expect(result.authorizedOutlets).toHaveLength(1);
      expect(result.authorizedOutlets[0].outletName).toBe('Central Kitchen');
    });

    it('should throw ForbiddenException if user lacks staff or admin role', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 'user-rider-5',
        fullName: 'Rider Anil',
      });

      await expect(controller.getProfile(mockRiderUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('2. Settlement History API (GET /api/v1/restaurant/settlements)', () => {
    beforeEach(() => {
      // Mock resolution of authorized restaurants
      mockDb.query.restaurantStaff.findMany.mockResolvedValue([
        {
          userId: 'user-staff-1',
          outlet: { restaurantId: 'rest-1' },
          isActive: true,
        },
      ]);
    });

    it('should retrieve settlement history for authorized restaurant with pagination', async () => {
      const mockSettlements = [
        {
          id: 'settle-1',
          restaurantId: 'rest-1',
          settlementReference: 'SETTLE_F24_1001',
          periodStart: new Date('2026-10-01T00:00:00Z'),
          periodEnd: new Date('2026-10-07T23:59:59Z'),
          grossOrderAmount: '15000.00',
          commissionAmount: '0.00',
          taxAmount: '750.00',
          refundDeductions: '0.00',
          netPayableAmount: '15000.00',
          currency: 'INR',
          status: 'settled',
          approvedAt: new Date('2026-10-08T10:00:00Z'),
          settledAt: new Date('2026-10-08T12:00:00Z'),
          failureReason: null,
          createdAt: new Date('2026-10-08T09:00:00Z'),
        },
      ];

      // Mock count query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockResolvedValueOnce([{ count: 1 }]),
        }),
      });

      // Mock select items query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            orderBy: jest.fn().mockReturnValueOnce({
              limit: jest.fn().mockReturnValueOnce({
                offset: jest.fn().mockResolvedValueOnce(mockSettlements),
              }),
            }),
          }),
        }),
      });

      const result = await controller.getSettlements(mockStaffUser, {
        page: 1,
        limit: 20,
        status: 'all',
      });

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('settle-1');
      expect(result.items[0].netPayableAmount).toBe('15000.00');
      expect(result.items[0].settlementReference).toBe('SETTLE_F24_1001');
      expect(result.pagination.total).toBe(1);
    });

    it('should return empty list when no settlements exist', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockResolvedValueOnce([{ count: 0 }]),
        }),
      });

      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            orderBy: jest.fn().mockReturnValueOnce({
              limit: jest.fn().mockReturnValueOnce({
                offset: jest.fn().mockResolvedValueOnce([]),
              }),
            }),
          }),
        }),
      });

      const result = await controller.getSettlements(mockStaffUser, {
        page: 1,
        limit: 10,
      });

      expect(result.items).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should reject access if staff attempts to query a restaurantId they do not own', async () => {
      await expect(
        controller.getSettlements(mockStaffUser, {
          restaurantId: 'rest-999-unauthorized',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to filter by any restaurantId', async () => {
      mockDb.query.restaurants.findMany.mockResolvedValue([
        { id: 'rest-1' },
        { id: 'rest-999-unauthorized' },
      ]);

      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockResolvedValueOnce([{ count: 0 }]),
        }),
      });

      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            orderBy: jest.fn().mockReturnValueOnce({
              limit: jest.fn().mockReturnValueOnce({
                offset: jest.fn().mockResolvedValueOnce([]),
              }),
            }),
          }),
        }),
      });

      const result = await controller.getSettlements(mockAdminUser, {
        restaurantId: 'rest-999-unauthorized',
      });

      expect(result.items).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('3. Restaurant Financial Summary API (GET /api/v1/restaurant/finance/summary)', () => {
    beforeEach(() => {
      mockDb.query.restaurantStaff.findMany.mockResolvedValue([
        {
          userId: 'user-staff-1',
          outlet: { restaurantId: 'rest-1' },
          isActive: true,
        },
      ]);
    });

    it('should return financial summary with settled, pending amounts and monthly credits', async () => {
      // 1. Settled aggregate query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockResolvedValueOnce([
            { totalSettledAmount: '45000.00' },
          ]),
        }),
      });

      // 2. Pending aggregate query
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockResolvedValueOnce([
            { pendingSettlementAmount: '12500.00', pendingCount: 2 },
          ]),
        }),
      });

      // 3. Previous settlement
      mockDb.query.restaurantSettlements.findFirst.mockResolvedValue({
        id: 'settle-prev-1',
        settlementReference: 'SETTLE_F24_PREV',
        netPayableAmount: '22000.00',
        settledAt: new Date('2026-10-15T10:00:00Z'),
        status: 'settled',
      });

      // 4. Monthly delivery credits
      mockDb.query.restaurantMonthlyDeliveryCredits.findMany.mockResolvedValue([
        {
          restaurantId: 'rest-1',
          allocatedCredits: 150,
          usedCredits: 85,
          additionalDeliveriesCount: 5,
          additionalPerDeliveryFee: '25.00',
        },
      ]);

      const result = await controller.getFinancialSummary(mockStaffUser, {});

      expect(result).toBeDefined();
      expect(result.financialSummary.currentPayableBalance).toBe('12500.00');
      expect(result.financialSummary.totalSettledAmount).toBe('45000.00');
      expect(result.financialSummary.pendingSettlementAmount).toBe('12500.00');
      expect(result.financialSummary.pendingSettlementCount).toBe(2);
      expect(result.financialSummary.previousSettlement).toBeDefined();
      expect(result.financialSummary.previousSettlement?.amount).toBe('22000.00');

      expect(result.deliveryCredits.allocatedCredits).toBe(150);
      expect(result.deliveryCredits.usedCredits).toBe(85);
      expect(result.deliveryCredits.remainingCredits).toBe(65);
      expect(result.deliveryCredits.additionalDeliveriesCount).toBe(5);
      expect(result.deliveryCredits.additionalCharges).toBe('125.00'); // 5 * 25.00
    });

    it('should reject unauthorized restaurantId in financial summary request', async () => {
      await expect(
        controller.getFinancialSummary(mockStaffUser, {
          restaurantId: 'rest-other-secret',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
