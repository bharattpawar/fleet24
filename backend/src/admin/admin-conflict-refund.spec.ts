import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { AdminOperationsService } from './admin-operations.service';
import { RiderAssignmentService } from '../riders/rider-assignment.service';
import { PaymentsService } from '../payments/payments.service';
import { TrackingPublisherService } from '../tracking/tracking-publisher.service';
import { DRIZZLE_CONNECTION } from '../database/database.constants';

describe('AdminOperationsService - Atomic Approval & Safe Refund Reservation (Stage 2C-B)', () => {
  let service: AdminOperationsService;
  let mockDb: any;
  let mockPaymentsService: any;
  let mockRiderAssignmentService: any;
  let mockTrackingPublisher: any;

  const adminUserId = 'adm-00000000-0000-4000-8000-000000000001';
  const orderId = 'ord-conflict-0001';
  const customerId = 'cust-0001';

  beforeEach(async () => {
    mockDb = {
      query: {
        orders: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        payments: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        auditLogs: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        orderStatusHistory: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            for: jest.fn().mockResolvedValue([
              {
                id: orderId,
                orderNumber: 'FL-CONF-001',
                status: 'payment_conflict',
                totalPayable: '250.00',
                paymentConflictDetails: {
                  conflictType: 'duplicate_active_fulfillment',
                  resolutionStatus: 'pending_admin_review',
                },
              },
            ]),
          }),
          innerJoin: jest.fn().mockReturnValue({
            innerJoin: jest.fn().mockReturnValue({
              innerJoin: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  orderBy: jest.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      }),
      transaction: jest.fn(async (cb) => cb(mockDb)),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue(Promise.resolve([{ id: orderId }])),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue(Promise.resolve([{ id: 'audit-1' }])),
      }),
    };

    mockPaymentsService = {
      reserveRefundInTransaction: jest.fn(),
      executeReservedRefund: jest.fn(),
    };

    mockRiderAssignmentService = {
      assignOrder: jest.fn(),
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
          provide: PaymentsService,
          useValue: mockPaymentsService,
        },
        {
          provide: RiderAssignmentService,
          useValue: mockRiderAssignmentService,
        },
        {
          provide: TrackingPublisherService,
          useValue: mockTrackingPublisher,
        },
      ],
    }).compile();

    service = module.get<AdminOperationsService>(AdminOperationsService);
  });

  describe('1. Atomicity of Admin Approval & Refund Reservation', () => {
    it('executes validation, refund reservation, admin metadata, and audit log in ONE shared transaction', async () => {
      const mockOrder = {
        id: orderId,
        orderNumber: 'FL-CONF-001',
        status: 'payment_conflict',
        totalPayable: '250.00',
      };

      const mockPayment = {
        id: 'pay-1',
        amount: '250.00',
        currency: 'INR',
        providerPaymentId: 'pay_rzp_123',
      };

      const mockRefund = {
        id: 'ref-1',
        operationKey: `full_refund_${orderId}`,
        idempotencyKey: 'flt24_ref_123',
        amount: '250.00',
        status: 'pending',
      };

      mockPaymentsService.reserveRefundInTransaction.mockResolvedValue({
        isNew: true,
        refund: mockRefund,
        payment: mockPayment,
      });

      mockPaymentsService.executeReservedRefund.mockResolvedValue({
        refundId: 'ref-1',
        providerRefundId: 'rfnd_rzp_abc',
        paymentId: 'pay-1',
        amount: '250.00',
        status: 'processed',
        message: 'Refund successfully initiated with gateway.',
      });

      let insertedAudit: any = null;
      let updatedConflictDetails: any = null;

      mockDb.insert.mockImplementation(() => ({
        values: jest.fn().mockImplementation((val) => {
          if (val.action === 'payment_conflict_refund_approved') insertedAudit = val;
          return Promise.resolve([val]);
        }),
      }));

      mockDb.update.mockReturnValue({
        set: jest.fn().mockImplementation((val) => {
          if (val.paymentConflictDetails) updatedConflictDetails = val.paymentConflictDetails;
          return {
            where: jest.fn().mockReturnValue(Promise.resolve([{ id: orderId }])),
          };
        }),
      });

      const response = await service.approvePaymentConflictRefund(adminUserId, orderId, {
        reason: 'Authorized refund for duplicate active order',
      });

      expect(response.orderId).toBe(orderId);
      expect(response.refund.status).toBe('processed');

      // Crucial: reserveRefundInTransaction was called WITH the transaction client `tx` (mockDb)
      expect(mockPaymentsService.reserveRefundInTransaction).toHaveBeenCalledWith(
        mockDb,
        orderId,
        expect.stringContaining('Admin Approval'),
        adminUserId,
      );

      // Verify audit log captured approving admin
      expect(insertedAudit).toMatchObject({
        action: 'payment_conflict_refund_approved',
        entityType: 'order',
        entityId: orderId,
        performedByUserId: adminUserId,
      });

      // Verify conflictDetails updated with resolution status and admin identity
      expect(updatedConflictDetails).toMatchObject({
        resolutionStatus: 'refund_approved',
        approvedByAdminUserId: adminUserId,
      });

      // Razorpay execution was called outside the transaction with the reservation result
      expect(mockPaymentsService.executeReservedRefund).toHaveBeenCalledWith({
        isNew: true,
        refund: mockRefund,
        payment: mockPayment,
      });
    });

    it('rolls back completely if refund reservation fails inside transaction', async () => {
      mockPaymentsService.reserveRefundInTransaction.mockRejectedValue(
        new BadRequestException('Payment is in pending status. Only captured payments can be refunded.'),
      );

      await expect(
        service.approvePaymentConflictRefund(adminUserId, orderId, { reason: 'test' }),
      ).rejects.toThrow(BadRequestException);

      // Verify no audit log and no external execute call occurred
      expect(mockPaymentsService.executeReservedRefund).not.toHaveBeenCalled();
    });
  });

  describe('2. Concurrent Admin Approval Safety & Idempotency', () => {
    it('returns authoritative existing refund status and does NOT duplicate audit logs if already approved/reserved', async () => {
      const existingRefund = {
        id: 'ref-existing',
        operationKey: `full_refund_${orderId}`,
        status: 'pending',
        amount: '250.00',
        approvedByUserId: adminUserId,
      };

      const mockPayment = {
        id: 'pay-1',
        amount: '250.00',
        providerPaymentId: 'pay_rzp_123',
      };

      // Second admin call finds isNew: false
      mockPaymentsService.reserveRefundInTransaction.mockResolvedValue({
        isNew: false,
        refund: existingRefund,
        payment: mockPayment,
      });

      mockPaymentsService.executeReservedRefund.mockResolvedValue({
        refundId: existingRefund.id,
        providerRefundId: null,
        paymentId: mockPayment.id,
        amount: existingRefund.amount,
        status: 'pending',
        message: 'Refund operation is already pending on gateway.',
      });

      const auditInsertSpy = jest.fn();
      mockDb.insert = jest.fn().mockReturnValue({ values: auditInsertSpy });

      const response = await service.approvePaymentConflictRefund('admin-2', orderId, {
        reason: 'Second admin approves concurrently',
      });

      expect(response.orderId).toBe(orderId);
      expect(response.refund.refundId).toBe('ref-existing');
      expect(response.refund.status).toBe('pending');

      // Verify no duplicate audit log was inserted for the second concurrent call
      expect(auditInsertSpy).not.toHaveBeenCalled();
    });
  });

  describe('3. Preserve Resolved Conflict History & Authoritative Status', () => {
    it('retrieves both active payment_conflict orders and historically cancelled conflicts with authoritative refund status', async () => {
      const mockRows = [
        {
          id: 'ord-active-conf',
          orderNumber: 'FL-CONF-001',
          status: 'payment_conflict',
          totalPayable: '150.00',
          customerId: 'cust-1',
          customerName: 'Customer 1',
          customerPhone: '+911111111111',
          restaurantName: 'Rest 1',
          outletName: 'Outlet 1',
          paymentConflictDetails: { conflictType: 'duplicate_active_fulfillment' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'ord-resolved-conf',
          orderNumber: 'FL-RESOLVED-002',
          status: 'cancelled',
          totalPayable: '200.00',
          customerId: 'cust-2',
          customerName: 'Customer 2',
          customerPhone: '+912222222222',
          restaurantName: 'Rest 2',
          outletName: 'Outlet 2',
          paymentConflictDetails: {
            conflictType: 'duplicate_active_fulfillment',
            resolutionStatus: 'refund_processed',
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            innerJoin: jest.fn().mockReturnValue({
              innerJoin: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  orderBy: jest.fn().mockResolvedValue(mockRows),
                }),
              }),
            }),
          }),
        }),
      });

      mockDb.query.payments.findMany.mockResolvedValue([
        {
          id: 'p1',
          orderId: 'ord-active-conf',
          amount: '150.00',
          currency: 'INR',
          status: 'captured',
          refunds: [], // pending_review
        },
        {
          id: 'p2',
          orderId: 'ord-resolved-conf',
          amount: '200.00',
          currency: 'INR',
          status: 'refunded',
          refunds: [{ id: 'ref-2', status: 'processed', amount: '200.00' }], // refund_completed
        },
      ]);

      const result = await service.listPaymentConflicts({ filterStatus: 'all', page: 1, limit: 10 });

      expect(result.total).toBe(2);
      expect(result.data[0].orderNumber).toBe('FL-CONF-001');
      expect(result.data[0].authoritativeStatus).toBe('pending_review');
      expect(result.data[1].orderNumber).toBe('FL-RESOLVED-002');
      expect(result.data[1].authoritativeStatus).toBe('refund_completed');

      // Test filtering by refund_completed
      const completedResult = await service.listPaymentConflicts({
        filterStatus: 'refund_completed',
        page: 1,
        limit: 10,
      });
      expect(completedResult.total).toBe(1);
      expect(completedResult.data[0].orderNumber).toBe('FL-RESOLVED-002');
    });
  });
});
