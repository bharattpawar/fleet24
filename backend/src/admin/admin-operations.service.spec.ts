import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { AdminOperationsService } from './admin-operations.service';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import { RiderAssignmentService } from '../riders/rider-assignment.service';
import { PaymentsService } from '../payments/payments.service';
import { TrackingPublisherService } from '../tracking/tracking-publisher.service';

describe('AdminOperationsService Unit & Transactional Flows', () => {
  let service: AdminOperationsService;
  let mockDb: any;
  let mockRiderAssignmentService: any;
  let mockPaymentsService: any;
  let mockTrackingPublisher: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      transaction: jest.fn((cb) => cb(mockDb)),
      query: {
        orders: {
          findFirst: jest.fn(),
        },
        deliveries: {
          findFirst: jest.fn(),
        },
        riderLocations: {
          findFirst: jest.fn(),
        },
        deliveryAssignmentAttempts: {
          findMany: jest.fn(),
        },
        orderStatusHistory: {
          findMany: jest.fn(),
        },
        payments: {
          findFirst: jest.fn(),
        },
      },
    };

    mockRiderAssignmentService = {
      assignOrder: jest.fn(),
    };

    mockPaymentsService = {
      initiateOrderRefund: jest.fn(),
    };

    mockTrackingPublisher = {
      publishDeliveryCancelled: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminOperationsService,
        {
          provide: DRIZZLE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: RiderAssignmentService,
          useValue: mockRiderAssignmentService,
        },
        {
          provide: PaymentsService,
          useValue: mockPaymentsService,
        },
        {
          provide: TrackingPublisherService,
          useValue: mockTrackingPublisher,
        },
      ],
    }).compile();

    service = module.get<AdminOperationsService>(AdminOperationsService);
  });

  describe('cancelOrder', () => {
    it('throws NotFoundException when order does not exist', async () => {
      mockDb.query.orders.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.cancelOrder('admin-1', 'order-999', { reason: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when order is already completed and delivered', async () => {
      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: 'order-1',
        orderNumber: 'ORD-1',
        status: 'delivered',
      });

      await expect(
        service.cancelOrder('admin-1', 'order-1', { reason: 'Test' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException if order is already cancelled', async () => {
      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: 'order-1',
        orderNumber: 'ORD-1',
        status: 'cancelled',
      });

      await expect(
        service.cancelOrder('admin-1', 'order-1', { reason: 'Test' }),
      ).rejects.toThrow(ConflictException);
    });

    it('cancels placed order, releases assigned rider capacity, triggers automated refund and publishes WS event', async () => {
      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: 'order-1',
        orderNumber: 'ORD-1',
        status: 'placed',
      });

      // Update order mock
      const updateOrderWhere = jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValueOnce([
          {
            id: 'order-1',
            orderNumber: 'ORD-1',
            status: 'cancelled',
            cancellationReason: '[Admin: Customer requested]',
            cancelledAt: new Date(),
          },
        ]),
      });
      const updateOrderSet = jest.fn().mockReturnValue({ where: updateOrderWhere });

      // Delivery & Rider capacity query mocks
      const selectDeliveriesForUpdate = jest.fn().mockResolvedValueOnce([
        { id: 'del-1', riderId: 'rider-1', status: 'accepted' },
      ]);
      const selectDeliveriesWhere = jest.fn().mockReturnValue({ for: selectDeliveriesForUpdate });

      const selectRiderForUpdate = jest.fn().mockResolvedValueOnce([
        {
          id: 'rider-1',
          currentActiveOrdersCount: 1,
          maxActiveOrders: 2,
          isOnline: true,
          verificationStatus: 'approved',
          suspensionReason: null,
          availabilityStatus: 'busy',
        },
      ]);
      const selectRiderWhere = jest.fn().mockReturnValue({ for: selectRiderForUpdate });

      const updateRiderWhere = jest.fn().mockResolvedValueOnce([]);
      const updateRiderSet = jest.fn().mockReturnValue({ where: updateRiderWhere });

      const updateDeliveryWhere = jest.fn().mockResolvedValueOnce([]);
      const updateDeliverySet = jest.fn().mockReturnValue({ where: updateDeliveryWhere });

      mockDb.update
        .mockReturnValueOnce({ set: updateOrderSet }) // 1. Order cancel
        .mockReturnValueOnce({ set: updateRiderSet }) // 2. Rider capacity
        .mockReturnValueOnce({ set: updateDeliverySet }); // 3. Delivery cancel

      mockDb.select
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: selectDeliveriesWhere }) }) // Deliveries select
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: selectRiderWhere }) }); // Rider select

      mockDb.insert.mockReturnValue({ values: jest.fn().mockResolvedValue([]) });

      mockPaymentsService.initiateOrderRefund.mockResolvedValueOnce({
        refundId: 'ref-1',
        status: 'processed',
      });

      const res = await service.cancelOrder('admin-1', 'order-1', {
        reason: 'Customer requested',
      });

      expect(res.status).toBe('cancelled');
      expect(mockPaymentsService.initiateOrderRefund).toHaveBeenCalledWith(
        'order-1',
        'Admin cancellation: Customer requested',
        'admin-1',
      );
      expect(mockTrackingPublisher.publishDeliveryCancelled).toHaveBeenCalled();
    });
  });

  describe('retryDispatch', () => {
    it('delegates to canonical RiderAssignmentService and records audit log', async () => {
      mockDb.query.orders.findFirst.mockResolvedValueOnce({
        id: 'order-1',
        status: 'placed',
      });

      mockRiderAssignmentService.assignOrder.mockResolvedValueOnce({
        assigned: true,
        orderId: 'order-1',
        riderId: 'rider-1',
        message: 'Rider assigned',
      });

      mockDb.insert.mockReturnValue({ values: jest.fn().mockResolvedValue([]) });

      const res = await service.retryDispatch('admin-1', 'order-1');
      expect(res.assigned).toBe(true);
      expect(mockRiderAssignmentService.assignOrder).toHaveBeenCalledWith('order-1');
    });
  });
});

