import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AdminOperationsController } from './admin-operations.controller';
import { AdminOperationsService } from './admin-operations.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ROLES_KEY } from '../auth/decorators/auth.decorators';

describe('AdminOperationsController & Delivery Operations Workflows', () => {
  let controller: AdminOperationsController;
  let service: jest.Mocked<AdminOperationsService>;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  const mockOperationsService = {
    listOrders: jest.fn(),
    getOrderDetails: jest.fn(),
    cancelOrder: jest.fn(),
    retryDispatch: jest.fn(),
    getActiveDeliveries: jest.fn(),
    getDeliveryDetails: jest.fn(),
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
      controllers: [AdminOperationsController],
      providers: [
        {
          provide: AdminOperationsService,
          useValue: mockOperationsService,
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

    controller = module.get<AdminOperationsController>(AdminOperationsController);
    service = module.get(AdminOperationsService);
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
            user: userRoles ? { userId: 'admin-uuid', roles: userRoles } : null,
          }),
        }),
      } as unknown as ExecutionContext;
    };

    it('denies access if unauthenticated or roles missing', () => {
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

    it('has @Roles("admin") configured on the controller', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, AdminOperationsController);
      expect(roles).toEqual(['admin']);
    });
  });

  describe('Order Operations Handlers', () => {
    const adminUser = { userId: 'admin-1', sessionId: 's1', phone: '+919876543210', roles: ['admin'] };

    it('lists orders with filters and pagination', async () => {
      const expected = { total: 1, data: [{ orderId: 'ord-1' }] } as any;
      service.listOrders.mockResolvedValueOnce(expected);

      const res = await controller.listOrders({ orderStatus: 'preparing', page: 1, limit: 20 });
      expect(service.listOrders).toHaveBeenCalledWith({ orderStatus: 'preparing', page: 1, limit: 20 });
      expect(res).toBe(expected);
    });

    it('fetches full order operational details and timeline', async () => {
      const expected = { order: { id: 'ord-1' }, timeline: [] } as any;
      service.getOrderDetails.mockResolvedValueOnce(expected);

      const res = await controller.getOrderDetails('a1234567-0000-4000-8000-000000000001');
      expect(service.getOrderDetails).toHaveBeenCalledWith('a1234567-0000-4000-8000-000000000001');
      expect(res).toBe(expected);
    });

    it('cancels an order with mandatory reason', async () => {
      const expected = { id: 'ord-1', status: 'cancelled' } as any;
      service.cancelOrder.mockResolvedValueOnce(expected);

      const res = await controller.cancelOrder(
        adminUser,
        'a1234567-0000-4000-8000-000000000001',
        { reason: 'Customer requested manual override' },
      );
      expect(service.cancelOrder).toHaveBeenCalledWith(
        'admin-1',
        'a1234567-0000-4000-8000-000000000001',
        { reason: 'Customer requested manual override' },
      );
      expect(res).toBe(expected);
    });

    it('retries dispatch for an order', async () => {
      const expected = { assigned: true, riderId: 'r1' } as any;
      service.retryDispatch.mockResolvedValueOnce(expected);

      const res = await controller.retryDispatch(
        adminUser,
        'a1234567-0000-4000-8000-000000000001',
      );
      expect(service.retryDispatch).toHaveBeenCalledWith(
        'admin-1',
        'a1234567-0000-4000-8000-000000000001',
      );
      expect(res).toBe(expected);
    });
  });

  describe('Delivery Monitoring Handlers', () => {
    it('monitors active deliveries with freshness filtering', async () => {
      const expected = { total: 1, data: [{ deliveryId: 'del-1' }] } as any;
      service.getActiveDeliveries.mockResolvedValueOnce(expected);

      const res = await controller.getActiveDeliveries({ locationFreshness: 'fresh', page: 1, limit: 20 });
      expect(service.getActiveDeliveries).toHaveBeenCalledWith({ locationFreshness: 'fresh', page: 1, limit: 20 });
      expect(res).toBe(expected);
    });

    it('retrieves detailed delivery lifecycle and assignment history', async () => {
      const expected = { delivery: { id: 'del-1' }, latestLocation: { latitude: 12.97 } } as any;
      service.getDeliveryDetails.mockResolvedValueOnce(expected);

      const res = await controller.getDeliveryDetails('d1234567-0000-4000-8000-000000000001');
      expect(service.getDeliveryDetails).toHaveBeenCalledWith('d1234567-0000-4000-8000-000000000001');
      expect(res).toBe(expected);
    });
  });
});

