import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AdminManagementController } from './admin-management.controller';
import { AdminManagementService } from './admin-management.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ROLES_KEY } from '../auth/decorators/auth.decorators';

describe('AdminManagementController & Customer / Restaurant Workflows', () => {
  let controller: AdminManagementController;
  let service: jest.Mocked<AdminManagementService>;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  const mockAdminManagementService = {
    listCustomers: jest.fn(),
    getCustomerDetails: jest.fn(),
    blockCustomer: jest.fn(),
    unblockCustomer: jest.fn(),
    listRestaurantApplications: jest.fn(),
    getRestaurantApplicationDetails: jest.fn(),
    verifyRestaurant: jest.fn(),
    suspendRestaurant: jest.fn(),
    unsuspendRestaurant: jest.fn(),
    listRestaurantOutlets: jest.fn(),
    updateOutletOperations: jest.fn(),
    uploadDocument: jest.fn(),
    verifyDocument: jest.fn(),
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
      controllers: [AdminManagementController],
      providers: [
        {
          provide: AdminManagementService,
          useValue: mockAdminManagementService,
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

    controller = module.get<AdminManagementController>(AdminManagementController);
    service = module.get(AdminManagementService);
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
      const roles = Reflect.getMetadata(ROLES_KEY, AdminManagementController);
      expect(roles).toEqual(['admin']);
    });
  });

  describe('Customer Management Endpoints', () => {
    const adminUser = { userId: 'admin-1', sessionId: 's1', phone: '+919876543210', roles: ['admin'] };

    it('lists customers with filters', async () => {
      const expected = { total: 1, data: [{ id: 'c1', fullName: 'Alice' }] } as any;
      service.listCustomers.mockResolvedValueOnce(expected);

      const res = await controller.listCustomers({ search: 'Alice', status: 'active', page: 1, limit: 20 });
      expect(service.listCustomers).toHaveBeenCalledWith({ search: 'Alice', status: 'active', page: 1, limit: 20 });
      expect(res).toBe(expected);
    });

    it('returns customer details', async () => {
      const expected = { customer: { id: 'c1' }, orderSummary: { totalOrders: 5 } } as any;
      service.getCustomerDetails.mockResolvedValueOnce(expected);

      const res = await controller.getCustomerDetails('c1234567-0000-4000-8000-000000000001');
      expect(service.getCustomerDetails).toHaveBeenCalledWith('c1234567-0000-4000-8000-000000000001');
      expect(res).toBe(expected);
    });

    it('blocks customer with reason', async () => {
      const expected = { id: 'c1', isActive: false, accountStatus: 'blocked' } as any;
      service.blockCustomer.mockResolvedValueOnce(expected);

      const res = await controller.blockCustomer(
        adminUser,
        'c1234567-0000-4000-8000-000000000001',
        { reason: 'Fraudulent payment attempts' },
      );
      expect(service.blockCustomer).toHaveBeenCalledWith(
        'admin-1',
        'c1234567-0000-4000-8000-000000000001',
        { reason: 'Fraudulent payment attempts' },
      );
      expect(res).toBe(expected);
    });

    it('unblocks customer', async () => {
      const expected = { id: 'c1', isActive: true, accountStatus: 'active' } as any;
      service.unblockCustomer.mockResolvedValueOnce(expected);

      const res = await controller.unblockCustomer(
        adminUser,
        'c1234567-0000-4000-8000-000000000001',
      );
      expect(service.unblockCustomer).toHaveBeenCalledWith(
        'admin-1',
        'c1234567-0000-4000-8000-000000000001',
      );
      expect(res).toBe(expected);
    });
  });

  describe('Restaurant Application & Verification Endpoints', () => {
    const adminUser = { userId: 'admin-1', sessionId: 's1', phone: '+919876543210', roles: ['admin'] };

    it('lists restaurant onboarding applications', async () => {
      const expected = { total: 1, data: [{ id: 'r1', name: 'Burger Hub' }] } as any;
      service.listRestaurantApplications.mockResolvedValueOnce(expected);

      const res = await controller.listRestaurantApplications({ verificationStatus: 'pending', page: 1, limit: 20 });
      expect(service.listRestaurantApplications).toHaveBeenCalledWith({ verificationStatus: 'pending', page: 1, limit: 20 });
      expect(res).toBe(expected);
    });

    it('approves a restaurant application', async () => {
      const expected = { id: 'r1', verificationStatus: 'approved' } as any;
      service.verifyRestaurant.mockResolvedValueOnce(expected);

      const res = await controller.verifyRestaurant(
        adminUser,
        'r1234567-0000-4000-8000-000000000001',
        { verificationStatus: 'approved' },
      );
      expect(service.verifyRestaurant).toHaveBeenCalledWith(
        'admin-1',
        'r1234567-0000-4000-8000-000000000001',
        { verificationStatus: 'approved' },
      );
      expect(res).toBe(expected);
    });

    it('suspends a restaurant with reason', async () => {
      const expected = { id: 'r1', verificationStatus: 'suspended' } as any;
      service.suspendRestaurant.mockResolvedValueOnce(expected);

      const res = await controller.suspendRestaurant(
        adminUser,
        'r1234567-0000-4000-8000-000000000001',
        { suspensionReason: 'Failed health inspection' },
      );
      expect(service.suspendRestaurant).toHaveBeenCalledWith(
        'admin-1',
        'r1234567-0000-4000-8000-000000000001',
        { suspensionReason: 'Failed health inspection' },
      );
      expect(res).toBe(expected);
    });

    it('un-suspends a restaurant', async () => {
      const expected = { id: 'r1', verificationStatus: 'approved' } as any;
      service.unsuspendRestaurant.mockResolvedValueOnce(expected);

      const res = await controller.unsuspendRestaurant(
        adminUser,
        'r1234567-0000-4000-8000-000000000001',
      );
      expect(service.unsuspendRestaurant).toHaveBeenCalledWith(
        'admin-1',
        'r1234567-0000-4000-8000-000000000001',
      );
      expect(res).toBe(expected);
    });

    it('updates outlet operations', async () => {
      const expected = { id: 'out-1', isAcceptingOrders: false } as any;
      service.updateOutletOperations.mockResolvedValueOnce(expected);

      const res = await controller.updateOutletOperations(
        adminUser,
        'o1234567-0000-4000-8000-000000000001',
        { isAcceptingOrders: false },
      );
      expect(service.updateOutletOperations).toHaveBeenCalledWith(
        'admin-1',
        'o1234567-0000-4000-8000-000000000001',
        { isAcceptingOrders: false },
      );
      expect(res).toBe(expected);
    });

    it('uploads and verifies a restaurant document', async () => {
      const doc = { id: 'doc-1', documentType: 'fssai_license' } as any;
      service.uploadDocument.mockResolvedValueOnce(doc);

      const uploadRes = await controller.uploadDocument(
        adminUser,
        'r1234567-0000-4000-8000-000000000001',
        {
          documentType: 'fssai_license',
          documentUrl: 'https://s3.fleet24.internal/licenses/123.pdf',
        },
      );
      expect(uploadRes).toBe(doc);

      service.verifyDocument.mockResolvedValueOnce({ id: 'doc-1', verificationStatus: 'verified' } as any);
      const verifyRes = await controller.verifyDocument(
        adminUser,
        'd1234567-0000-4000-8000-000000000001',
        { status: 'verified' },
      );
      expect(verifyRes.verificationStatus).toBe('verified');
    });
  });
});
