import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminManagementService } from './admin-management.service';
import { DRIZZLE_CONNECTION } from '../database/database.constants';

describe('AdminManagementService Unit & Database Flow Tests', () => {
  let service: AdminManagementService;
  let mockDb: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      query: {
        users: {
          findFirst: jest.fn(),
        },
        restaurants: {
          findFirst: jest.fn(),
        },
        restaurantOutlets: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        restaurantDocuments: {
          findFirst: jest.fn(),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminManagementService,
        {
          provide: DRIZZLE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<AdminManagementService>(AdminManagementService);
  });

  describe('Customer Blocking & Unblocking', () => {
    it('prevents an admin from blocking their own admin account', async () => {
      await expect(
        service.blockCustomer('admin-1', 'admin-1', { reason: 'Test' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when customer does not exist', async () => {
      mockDb.query.users.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.blockCustomer('admin-1', 'customer-999', { reason: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('blocks customer, updates isActive = false and writes audit log', async () => {
      mockDb.query.users.findFirst.mockResolvedValueOnce({
        id: 'customer-1',
        isActive: true,
      });

      const updateWhere = jest.fn().mockResolvedValueOnce([]);
      const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
      mockDb.update.mockReturnValue({ set: updateSet });

      const insertValues = jest.fn().mockResolvedValueOnce([]);
      mockDb.insert.mockReturnValue({ values: insertValues });

      const res = await service.blockCustomer('admin-1', 'customer-1', {
        reason: 'Payment chargeback fraud',
      });

      expect(res.accountStatus).toBe('blocked');
      expect(res.isActive).toBe(false);
      expect(updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
          blockedReason: 'Payment chargeback fraud',
          blockedBy: 'admin-1',
        }),
      );
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'customer_blocked',
          entityType: 'user',
          entityId: 'customer-1',
          performedByUserId: 'admin-1',
        }),
      );
    });

    it('unblocks customer, restores isActive = true and records audit log', async () => {
      mockDb.query.users.findFirst.mockResolvedValueOnce({
        id: 'customer-1',
        isActive: false,
        blockedReason: 'Previous issue',
      });

      const updateWhere = jest.fn().mockResolvedValueOnce([]);
      const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
      mockDb.update.mockReturnValue({ set: updateSet });

      const insertValues = jest.fn().mockResolvedValueOnce([]);
      mockDb.insert.mockReturnValue({ values: insertValues });

      const res = await service.unblockCustomer('admin-1', 'customer-1');

      expect(res.accountStatus).toBe('active');
      expect(res.isActive).toBe(true);
      expect(updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          blockedReason: null,
          blockedBy: null,
        }),
      );
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'customer_unblocked',
          entityType: 'user',
          entityId: 'customer-1',
        }),
      );
    });
  });

  describe('Restaurant Verification & Suspension', () => {
    it('requires a rejectionReason when rejecting a restaurant', async () => {
      mockDb.query.restaurants.findFirst.mockResolvedValueOnce({ id: 'rest-1' });

      await expect(
        service.verifyRestaurant('admin-1', 'rest-1', {
          verificationStatus: 'rejected',
          rejectionReason: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('approves a restaurant application successfully', async () => {
      mockDb.query.restaurants.findFirst.mockResolvedValueOnce({
        id: 'rest-1',
        verificationStatus: 'pending',
      });

      const updateWhere = jest.fn().mockResolvedValueOnce([]);
      const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
      mockDb.update.mockReturnValue({ set: updateSet });

      const insertValues = jest.fn().mockResolvedValueOnce([]);
      mockDb.insert.mockReturnValue({ values: insertValues });

      const res = await service.verifyRestaurant('admin-1', 'rest-1', {
        verificationStatus: 'approved',
      });

      expect(res.verificationStatus).toBe('approved');
      expect(updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          verificationStatus: 'approved',
          verifiedBy: 'admin-1',
          isActive: true,
        }),
      );
    });

    it('suspends restaurant and deactivates all associated outlets', async () => {
      mockDb.query.restaurants.findFirst.mockResolvedValueOnce({
        id: 'rest-1',
        verificationStatus: 'approved',
      });

      const updateWhere = jest.fn().mockResolvedValue([]);
      const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
      mockDb.update.mockReturnValue({ set: updateSet });

      const insertValues = jest.fn().mockResolvedValueOnce([]);
      mockDb.insert.mockReturnValue({ values: insertValues });

      const res = await service.suspendRestaurant('admin-1', 'rest-1', {
        suspensionReason: 'Health hygiene compliance breach',
      });

      expect(res.verificationStatus).toBe('suspended');
      expect(res.suspensionReason).toBe('Health hygiene compliance breach');

      // Verify outlets were deactivated
      expect(updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          isAcceptingOrders: false,
        }),
      );
    });

    it('prevents opening outlet order acceptance if parent restaurant is suspended', async () => {
      mockDb.query.restaurantOutlets.findFirst.mockResolvedValueOnce({
        id: 'out-1',
        restaurant: {
          verificationStatus: 'suspended',
        },
      });

      await expect(
        service.updateOutletOperations('admin-1', 'out-1', {
          isAcceptingOrders: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

