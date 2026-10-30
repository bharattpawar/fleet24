import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ROLES_KEY } from '../auth/decorators/auth.decorators';

describe('AdminDashboardController & RolesGuard Authorization', () => {
  let controller: AdminDashboardController;
  let service: jest.Mocked<AdminDashboardService>;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  const mockDashboardService = {
    getOverview: jest.fn(),
    getOrdersAnalytics: jest.fn(),
    getRevenueAnalytics: jest.fn(),
    getRiderAnalytics: jest.fn(),
    getRestaurantAnalytics: jest.fn(),
    getRecentActivity: jest.fn(),
  };

  const mockJwtService = {
    verifyAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('mock-jwt-secret'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminDashboardController],
      providers: [
        {
          provide: AdminDashboardService,
          useValue: mockDashboardService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        RolesGuard,
        JwtAuthGuard,
        Reflector,
      ],
    }).compile();

    controller = module.get<AdminDashboardController>(AdminDashboardController);
    service = module.get(AdminDashboardService);
    rolesGuard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('Authorization Rules', () => {
    const createMockContext = (userRoles?: string[]): ExecutionContext => {
      return {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({
          getRequest: () => ({
            user: userRoles ? { userId: 'u1', roles: userRoles } : null,
          }),
        }),
      } as unknown as ExecutionContext;
    };

    it('denies access if unauthenticated or user payload missing', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
      const ctx = createMockContext(undefined);
      expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('denies access for customer role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
      const ctx = createMockContext(['customer']);
      expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('denies access for rider role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
      const ctx = createMockContext(['rider']);
      expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('denies access for restaurant_staff role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
      const ctx = createMockContext(['restaurant_staff']);
      expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('allows access for admin role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
      const ctx = createMockContext(['admin']);
      expect(rolesGuard.canActivate(ctx)).toBe(true);
    });

    it('has @Roles("admin") decorator configured on controller class', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, AdminDashboardController);
      expect(roles).toEqual(['admin']);
    });
  });

  describe('Endpoint Dispatch Handlers', () => {
    it('dispatches getOverview correctly', async () => {
      const expected = { customers: { totalCustomers: 10 } } as any;
      service.getOverview.mockResolvedValueOnce(expected);

      const res = await controller.getOverview({ period: 'last_7_days' });
      expect(service.getOverview).toHaveBeenCalledWith({ period: 'last_7_days' });
      expect(res).toBe(expected);
    });

    it('dispatches getOrdersAnalytics correctly', async () => {
      const expected = { summary: { totalOrders: 50 } } as any;
      service.getOrdersAnalytics.mockResolvedValueOnce(expected);

      const res = await controller.getOrdersAnalytics({ period: 'today' });
      expect(service.getOrdersAnalytics).toHaveBeenCalledWith({ period: 'today' });
      expect(res).toBe(expected);
    });

    it('dispatches getRevenueAnalytics correctly', async () => {
      const expected = { summary: { grossCapturedAmount: 5000 } } as any;
      service.getRevenueAnalytics.mockResolvedValueOnce(expected);

      const res = await controller.getRevenueAnalytics({ period: 'last_30_days' });
      expect(service.getRevenueAnalytics).toHaveBeenCalledWith({ period: 'last_30_days' });
      expect(res).toBe(expected);
    });

    it('dispatches getRiderAnalytics correctly', async () => {
      const expected = { summary: { totalRiders: 15 } } as any;
      service.getRiderAnalytics.mockResolvedValueOnce(expected);

      const res = await controller.getRiderAnalytics({ period: 'this_month' });
      expect(service.getRiderAnalytics).toHaveBeenCalledWith({ period: 'this_month' });
      expect(res).toBe(expected);
    });

    it('dispatches getRestaurantAnalytics correctly', async () => {
      const expected = { summary: { totalRestaurants: 5 } } as any;
      service.getRestaurantAnalytics.mockResolvedValueOnce(expected);

      const res = await controller.getRestaurantAnalytics({ period: 'custom', from: '2026-10-01', to: '2026-10-15' });
      expect(service.getRestaurantAnalytics).toHaveBeenCalledWith({
        period: 'custom',
        from: '2026-10-01',
        to: '2026-10-15',
      });
      expect(res).toBe(expected);
    });

    it('dispatches getRecentActivity correctly', async () => {
      const expected = { events: [] } as any;
      service.getRecentActivity.mockResolvedValueOnce(expected);

      const res = await controller.getRecentActivity({ page: 1, limit: 10, type: 'all' });
      expect(service.getRecentActivity).toHaveBeenCalledWith({ page: 1, limit: 10, type: 'all' });
      expect(res).toBe(expected);
    });
  });
});
