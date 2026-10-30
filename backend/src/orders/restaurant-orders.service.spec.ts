import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RestaurantOrdersService } from './restaurant-orders.service';
import { RestaurantUpdatableStatus } from './dto/restaurant-order.dto';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import { PaymentsService } from '../payments/payments.service';
import { RiderAssignmentService } from '../riders/rider-assignment.service';

describe('RestaurantOrdersService (Unit Tests)', () => {
  let service: RestaurantOrdersService;
  let mockDb: any;

  const staffUserId = 'staff-user-1';
  const authorizedOutletId = 'outlet-1';
  const unauthorizedOutletId = 'outlet-2';
  const orderId = 'order-1';

  beforeEach(async () => {
    mockDb = {
      query: {
        restaurantOutlets: {
          findMany: jest.fn(),
        },
        restaurantStaff: {
          findMany: jest.fn(),
        },
        orders: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
      },
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn(),
          }),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        values: jest.fn(),
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

    const mockRiderAssignmentService = {
      assignOrder: jest.fn().mockResolvedValue({
        assigned: true,
        orderId: 'order-1',
        orderNumber: 'FL-001',
        status: 'assigned',
        candidatesCount: 1,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RestaurantOrdersService,
        { provide: DRIZZLE_CONNECTION, useValue: mockDb },
        { provide: PaymentsService, useValue: mockPaymentsService },
        { provide: RiderAssignmentService, useValue: mockRiderAssignmentService },
      ],
    }).compile();

    service = module.get<RestaurantOrdersService>(RestaurantOrdersService);
  });

  describe('Authorization Rules', () => {
    it('should throw ForbiddenException if user has no assigned active outlet', async () => {
      mockDb.query.restaurantStaff.findMany.mockResolvedValueOnce([]);

      await expect(
        service.getAuthorizedOutletIds(staffUserId, ['restaurant_staff']),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if staff tries to access unauthorized outlet', async () => {
      mockDb.query.restaurantStaff.findMany.mockResolvedValueOnce([
        { outletId: authorizedOutletId },
      ]);

      await expect(
        service.getAuthorizedOutletIds(
          staffUserId,
          ['restaurant_staff'],
          unauthorizedOutletId,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to access any requested outlet', async () => {
      const result = await service.getAuthorizedOutletIds(
        'admin-user',
        ['admin'],
        unauthorizedOutletId,
      );
      expect(result).toEqual([unauthorizedOutletId]);
    });
  });

  describe('Order Lifecycle & Transitions', () => {
    it('1. Restaurant successfully accepts a paid (placed) order', async () => {
      mockDb.query.restaurantStaff.findMany.mockResolvedValueOnce([
        { outletId: authorizedOutletId },
      ]);

      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: orderId,
        orderNumber: 'FL-20261030-1001',
        outletId: authorizedOutletId,
        status: 'placed',
      });

      mockDb.update().set().where().returning.mockResolvedValueOnce([
        {
          id: orderId,
          orderNumber: 'FL-20261030-1001',
          status: 'confirmed',
          updatedAt: new Date(),
        },
      ]);

      const result = await service.updateOrderStatus(
        staffUserId,
        ['restaurant_staff'],
        orderId,
        { status: RestaurantUpdatableStatus.CONFIRMED },
      );

      expect(result.currentStatus).toBe('confirmed');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('2. Restaurant rejects a paid (placed) order with reason', async () => {
      mockDb.query.restaurantStaff.findMany.mockResolvedValueOnce([
        { outletId: authorizedOutletId },
      ]);

      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: orderId,
        orderNumber: 'FL-20261030-1001',
        outletId: authorizedOutletId,
        status: 'placed',
      });

      mockDb.update().set().where().returning.mockResolvedValueOnce([
        {
          id: orderId,
          orderNumber: 'FL-20261030-1001',
          status: 'rejected',
          updatedAt: new Date(),
        },
      ]);

      const result = await service.updateOrderStatus(
        staffUserId,
        ['restaurant_staff'],
        orderId,
        {
          status: RestaurantUpdatableStatus.REJECTED,
          reason: 'Kitchen out of essential ingredients',
        },
      );

      expect(result.currentStatus).toBe('rejected');
      expect(result.reason).toBe('Kitchen out of essential ingredients');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('3. Restaurant cannot accept a pending_payment order', async () => {
      mockDb.query.restaurantStaff.findMany.mockResolvedValueOnce([
        { outletId: authorizedOutletId },
      ]);

      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: orderId,
        orderNumber: 'FL-20261030-1001',
        outletId: authorizedOutletId,
        status: 'pending_payment',
      });

      await expect(
        service.updateOrderStatus(
          staffUserId,
          ['restaurant_staff'],
          orderId,
          { status: RestaurantUpdatableStatus.CONFIRMED },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('4. Unauthorized restaurant cannot access or modify another outlet order', async () => {
      mockDb.query.restaurantStaff.findMany.mockResolvedValueOnce([
        { outletId: authorizedOutletId },
      ]);

      // Order belongs to a different outlet
      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: orderId,
        orderNumber: 'FL-20261030-1001',
        outletId: unauthorizedOutletId,
        status: 'placed',
      });

      await expect(
        service.updateOrderStatus(
          staffUserId,
          ['restaurant_staff'],
          orderId,
          { status: RestaurantUpdatableStatus.CONFIRMED },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('5. Invalid status transition is rejected (e.g. placed directly to ready_for_pickup)', async () => {
      mockDb.query.restaurantStaff.findMany.mockResolvedValueOnce([
        { outletId: authorizedOutletId },
      ]);

      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: orderId,
        orderNumber: 'FL-20261030-1001',
        outletId: authorizedOutletId,
        status: 'placed',
      });

      await expect(
        service.updateOrderStatus(
          staffUserId,
          ['restaurant_staff'],
          orderId,
          { status: RestaurantUpdatableStatus.READY_FOR_PICKUP },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('6. Valid progressive transition (confirmed -> preparing -> ready_for_pickup)', async () => {
      mockDb.query.restaurantStaff.findMany.mockResolvedValueOnce([
        { outletId: authorizedOutletId },
      ]);

      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: orderId,
        orderNumber: 'FL-20261030-1001',
        outletId: authorizedOutletId,
        status: 'confirmed',
      });

      mockDb.update().set().where().returning.mockResolvedValueOnce([
        {
          id: orderId,
          orderNumber: 'FL-20261030-1001',
          status: 'preparing',
          updatedAt: new Date(),
        },
      ]);

      const result = await service.updateOrderStatus(
        staffUserId,
        ['restaurant_staff'],
        orderId,
        { status: RestaurantUpdatableStatus.PREPARING },
      );

      expect(result.currentStatus).toBe('preparing');
    });

    it('7. Repeated status requests are handled safely (Idempotency)', async () => {
      mockDb.query.restaurantStaff.findMany.mockResolvedValueOnce([
        { outletId: authorizedOutletId },
      ]);

      // Order is already in 'confirmed'
      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: orderId,
        orderNumber: 'FL-20261030-1001',
        outletId: authorizedOutletId,
        status: 'confirmed',
      });

      const result = await service.updateOrderStatus(
        staffUserId,
        ['restaurant_staff'],
        orderId,
        { status: RestaurantUpdatableStatus.CONFIRMED },
      );

      expect(result.currentStatus).toBe('confirmed');
      expect(result.message).toContain('already in status');
      // Should not call db.update or insert duplicate history
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('8. Terminal statuses cannot be modified afterward', async () => {
      mockDb.query.restaurantStaff.findMany.mockResolvedValueOnce([
        { outletId: authorizedOutletId },
      ]);

      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: orderId,
        orderNumber: 'FL-20261030-1001',
        outletId: authorizedOutletId,
        status: 'rejected',
      });

      await expect(
        service.updateOrderStatus(
          staffUserId,
          ['restaurant_staff'],
          orderId,
          { status: RestaurantUpdatableStatus.CONFIRMED },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
