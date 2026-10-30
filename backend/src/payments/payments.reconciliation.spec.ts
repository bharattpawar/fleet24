import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { RefundReconciliationService } from './refund-reconciliation.service';
import { PaymentsService } from './payments.service';
import { DRIZZLE_CONNECTION } from '../database/database.constants';

describe('RefundReconciliationService (Unit & Concurrency Tests)', () => {
  let service: RefundReconciliationService;
  let mockDb: any;
  let mockPaymentsService: any;
  let mockRazorpayClient: any;

  const paymentId = 'pay-uuid-1';
  const refundId = 'refund-uuid-1';
  const providerPaymentId = 'pay_Rzp123456';
  const providerRefundId = 'rfnd_Rzp987654';

  beforeEach(async () => {
    mockDb = {
      transaction: jest.fn(async (cb) => cb(mockDb)),
      execute: jest.fn(),
      query: {
        refunds: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        payments: {
          findFirst: jest.fn(),
        },
      },
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn(),
          }),
        }),
      }),
    };

    mockRazorpayClient = {
      payments: {
        fetchMultipleRefund: jest.fn(),
      },
    };

    mockPaymentsService = {
      razorpayClient: mockRazorpayClient,
      convertRupeesToPaise: jest.fn((amt: number) => Math.round(amt * 100)),
      executeRazorpayRefundHttp: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundReconciliationService,
        { provide: DRIZZLE_CONNECTION, useValue: mockDb },
        { provide: PaymentsService, useValue: mockPaymentsService },
      ],
    }).compile();

    service = module.get<RefundReconciliationService>(RefundReconciliationService);
  });

  describe('Claiming & Concurrency Safety', () => {
    it('1. Atomically claims eligible pending refunds using FOR UPDATE SKIP LOCKED', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [{ id: 'ref-1' }, { id: 'ref-2' }],
      });

      const claimed = await service.claimEligibleRefunds(10, 60000);

      expect(claimed).toEqual(['ref-1', 'ref-2']);
      expect(mockDb.execute).toHaveBeenCalledTimes(2); // SELECT FOR UPDATE + UPDATE lease
    });

    it('2. Returns empty array if no refunds are due', async () => {
      mockDb.execute.mockResolvedValueOnce({ rows: [] });

      const claimed = await service.claimEligibleRefunds(10);
      expect(claimed).toEqual([]);
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });

    it('3. Two parallel workers claim disjoint sets without contention', async () => {
      // First worker query returns ref-1, second returns ref-2
      let selectCount = 0;
      mockDb.execute.mockImplementation(async (query: any) => {
        // In Drizzle, sql template tag produces query with queryChunks
        const hasSelect = JSON.stringify(query).includes('SELECT id FROM');
        if (hasSelect) {
          selectCount++;
          return { rows: [{ id: `ref-${selectCount}` }] };
        }
        return {};
      });

      const [worker1Claim, worker2Claim] = await Promise.all([
        service.claimEligibleRefunds(1),
        service.claimEligibleRefunds(1),
      ]);

      expect(worker1Claim).toEqual(['ref-1']);
      expect(worker2Claim).toEqual(['ref-2']);
    });
  });

  describe('Reconciliation Decision Matrix', () => {
    it('4. Case A: Gateway has already processed refund -> marks processed & synchronizes payment', async () => {
      mockDb.query.refunds.findFirst.mockResolvedValueOnce({
        id: refundId,
        status: 'pending',
        providerRefundId,
        attemptCount: '1',
        payment: { id: paymentId, providerPaymentId, order: { id: 'order-1' } },
      });

      mockRazorpayClient.payments.fetchMultipleRefund.mockResolvedValueOnce({
        items: [{ id: providerRefundId, status: 'processed' }],
      });

      const result = await service.reconcileSingleRefund(refundId);

      expect(result).toBe('processed');
      expect(mockPaymentsService.executeRazorpayRefundHttp).not.toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('5. Case B: Gateway has refund still pending -> updates provider ID and preserves pending', async () => {
      mockDb.query.refunds.findFirst.mockResolvedValueOnce({
        id: refundId,
        status: 'pending',
        providerRefundId: null,
        operationKey: 'full_refund_order-1',
        attemptCount: '1',
        payment: { id: paymentId, providerPaymentId, order: { id: 'order-1' } },
      });

      mockRazorpayClient.payments.fetchMultipleRefund.mockResolvedValueOnce({
        items: [{ id: 'rfnd_new_123', status: 'pending', notes: { operationKey: 'full_refund_order-1' } }],
      });

      const result = await service.reconcileSingleRefund(refundId);

      expect(result).toBe('pending');
      expect(mockPaymentsService.executeRazorpayRefundHttp).not.toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('6. Case C: Gateway has no record -> dispatches idempotent retry with original key and payload', async () => {
      const stableKey = 'flt24_ref_reconcile_key';
      const stablePayload = { amount: 5000, notes: { operationKey: 'full_refund_order-1' } };

      mockDb.query.refunds.findFirst.mockResolvedValueOnce({
        id: refundId,
        status: 'pending',
        providerRefundId: null,
        idempotencyKey: stableKey,
        requestPayload: stablePayload,
        amount: '50.00',
        attemptCount: '1',
        payment: { id: paymentId, providerPaymentId, order: { id: 'order-1' } },
      });

      // Gateway returns no refund items
      mockRazorpayClient.payments.fetchMultipleRefund.mockResolvedValueOnce({ items: [] });

      mockPaymentsService.executeRazorpayRefundHttp.mockResolvedValueOnce({
        status: 200,
        data: { id: 'rfnd_created_now', status: 'processed' },
      });

      const result = await service.reconcileSingleRefund(refundId);

      expect(result).toBe('processed');
      expect(mockPaymentsService.executeRazorpayRefundHttp).toHaveBeenCalledWith(
        providerPaymentId,
        stablePayload,
        stableKey,
      );
    });

    it('7. Case D: Gateway lookup fails -> preserves pending status and schedules backoff retry without calling POST', async () => {
      mockDb.query.refunds.findFirst.mockResolvedValueOnce({
        id: refundId,
        status: 'pending',
        providerRefundId: null,
        attemptCount: '1',
        payment: { id: paymentId, providerPaymentId, order: { id: 'order-1' } },
      });

      mockRazorpayClient.payments.fetchMultipleRefund.mockRejectedValueOnce(
        new Error('503 Service Unavailable'),
      );

      const result = await service.reconcileSingleRefund(refundId);

      expect(result).toBe('pending');
      expect(mockPaymentsService.executeRazorpayRefundHttp).not.toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('8. Maximum Retries Exceeded -> marks for manual review without marking failed', async () => {
      mockDb.query.refunds.findFirst.mockResolvedValueOnce({
        id: refundId,
        status: 'pending',
        attemptCount: '5', // Reached max 5
        payment: { id: paymentId, providerPaymentId, order: { id: 'order-1' } },
      });

      const result = await service.reconcileSingleRefund(refundId);

      expect(result).toBe('manual_review');
      expect(mockPaymentsService.executeRazorpayRefundHttp).not.toHaveBeenCalled();

      const updateCalls = mockDb.update().set.mock.calls;
      const statusPassedToSet = updateCalls[updateCalls.length - 1][0];
      expect(statusPassedToSet.isManualReviewRequired).toBe(true);
      expect(statusPassedToSet.lastErrorCode).toBe('MAX_RETRIES_EXCEEDED');
    });
  });

  describe('Bounded Exponential Backoff Calculations', () => {
    it('9. Backoff calculates expected delay intervals: 1m, 2m, 4m, 8m, 16m', () => {
      const now = Date.now();
      const retry1 = service.calculateNextRetryAt(1).getTime();
      const retry2 = service.calculateNextRetryAt(2).getTime();
      const retry3 = service.calculateNextRetryAt(3).getTime();
      const retry4 = service.calculateNextRetryAt(4).getTime();
      const retry5 = service.calculateNextRetryAt(5).getTime();

      expect(Math.round((retry1 - now) / 1000)).toBeCloseTo(60, -1);
      expect(Math.round((retry2 - now) / 1000)).toBeCloseTo(120, -1);
      expect(Math.round((retry3 - now) / 1000)).toBeCloseTo(240, -1);
      expect(Math.round((retry4 - now) / 1000)).toBeCloseTo(480, -1);
      expect(Math.round((retry5 - now) / 1000)).toBeCloseTo(960, -1);
    });
  });
});
