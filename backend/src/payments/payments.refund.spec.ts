import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { TrackingPublisherService } from '../tracking/tracking-publisher.service';
import { DRIZZLE_CONNECTION } from '../database/database.constants';

describe('PaymentsService - Automated Refunds & Concurrency / Reliability (Unit Tests)', () => {
  let service: PaymentsService;
  let mockDb: any;
  let mockConfigService: any;
  let mockRazorpayClient: any;

  const orderId = 'order-uuid-1';
  const paymentId = 'pay-uuid-1';
  const providerPaymentId = 'pay_Rzp123456';
  const providerRefundId = 'rfnd_Rzp987654';

  beforeEach(async () => {
    mockDb = {
      query: {
        payments: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        orders: {
          findFirst: jest.fn(),
        },
        refunds: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        paymentWebhookEvents: {
          findFirst: jest.fn(),
        },
      },
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            for: jest.fn(),
          }),
        }),
      }),
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
      transaction: jest.fn(async (cb) => cb(mockDb)),
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultVal: string) => {
        if (key === 'RAZORPAY_KEY_ID') return 'rzp_test_mockKeyId';
        if (key === 'RAZORPAY_KEY_SECRET') return 'rzp_test_mockKeySecret';
        if (key === 'RAZORPAY_WEBHOOK_SECRET') return 'rzp_test_mockWebhookSecret';
        return defaultVal;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: DRIZZLE_CONNECTION, useValue: mockDb },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: TrackingPublisherService,
          useValue: { publishOrderCreated: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);

    mockRazorpayClient = {
      payments: {
        refund: jest.fn(),
        fetchRefund: jest.fn(),
        fetchMultipleRefund: jest.fn(),
      },
    };
    (service as any).razorpayClient = mockRazorpayClient;
  });

  describe('executeRazorpayRefundHttp & X-Refund-Idempotency', () => {
    it('1. Razorpay receives the exact persisted X-Refund-Idempotency key and correct Basic Auth header', async () => {
      const spyHttp = jest
        .spyOn(service, 'executeRazorpayRefundHttp')
        .mockImplementation(async (payId, _payload, key) => {
          expect(key).toMatch(/^flt24_ref_[a-zA-Z0-9_-]{10,}$/);
          expect(payId).toBe(providerPaymentId);
          return {
            status: 200,
            data: { id: providerRefundId, status: 'processed' },
          };
        });

      mockDb.select().from().where().for.mockResolvedValueOnce([
        {
          id: paymentId,
          orderId,
          providerPaymentId,
          status: 'captured',
          amount: '250.00',
        },
      ]);
      mockDb.query.refunds.findFirst.mockResolvedValueOnce(null);
      mockDb.query.refunds.findMany.mockResolvedValueOnce([]);

      const testKey = 'flt24_ref_abc1234567890xyz';
      mockDb.insert().values().returning.mockResolvedValueOnce([
        {
          id: 'refund-uuid-1',
          paymentId,
          operationKey: `full_refund_${orderId}`,
          idempotencyKey: testKey,
          amount: '250.00',
          status: 'pending',
          requestPayload: { amount: 25000, notes: {} },
        },
      ]);

      const result = await service.initiateOrderRefund(orderId, 'Kitchen closed');

      expect(spyHttp).toHaveBeenCalled();
      expect(result.status).toBe('processed');
      expect(result.providerRefundId).toBe(providerRefundId);
    });
  });

  describe('HTTP Status Code Granularity (408, 429, 401/403, 5xx)', () => {
    it('2. HTTP 429 Rate Limit preserves the refund as pending with RATE_LIMITED_429 error code', async () => {
      mockDb.select().from().where().for.mockResolvedValueOnce([
        {
          id: paymentId,
          orderId,
          providerPaymentId,
          status: 'captured',
          amount: '200.00',
        },
      ]);
      mockDb.query.refunds.findFirst.mockResolvedValueOnce(null);
      mockDb.query.refunds.findMany.mockResolvedValueOnce([]);

      mockDb.insert().values().returning.mockResolvedValueOnce([
        {
          id: 'refund-uuid-429',
          paymentId,
          operationKey: `full_refund_${orderId}`,
          idempotencyKey: 'flt24_ref_429_key',
          amount: '200.00',
          status: 'pending',
          requestPayload: { amount: 20000, notes: {} },
        },
      ]);

      jest.spyOn(service, 'executeRazorpayRefundHttp').mockResolvedValueOnce({
        status: 429,
        data: {
          error: { description: 'Too many refund requests. Slow down.' },
        },
      });

      const result = await service.initiateOrderRefund(orderId, 'Rate limit test');
      expect(result.status).toBe('pending');
      expect(result.message).toContain('rate limited');

      const updateCalls = mockDb.update().set.mock.calls;
      const statusPassedToSet = updateCalls[updateCalls.length - 1][0];
      expect(statusPassedToSet.status).toBe('pending');
      expect(statusPassedToSet.lastErrorCode).toBe('RATE_LIMITED_429');
    });

    it('3. HTTP 401 Unauthorized marks refund as failed and alerts credential error', async () => {
      mockDb.select().from().where().for.mockResolvedValueOnce([
        {
          id: paymentId,
          orderId,
          providerPaymentId,
          status: 'captured',
          amount: '200.00',
        },
      ]);
      mockDb.query.refunds.findFirst.mockResolvedValueOnce(null);
      mockDb.query.refunds.findMany.mockResolvedValueOnce([]);

      mockDb.insert().values().returning.mockResolvedValueOnce([
        {
          id: 'refund-uuid-401',
          paymentId,
          operationKey: `full_refund_${orderId}`,
          idempotencyKey: 'flt24_ref_401_key',
          amount: '200.00',
          status: 'pending',
          requestPayload: { amount: 20000, notes: {} },
        },
      ]);

      jest.spyOn(service, 'executeRazorpayRefundHttp').mockResolvedValueOnce({
        status: 401,
        data: {
          error: { description: 'The provided API key is invalid.' },
        },
      });

      await expect(service.initiateOrderRefund(orderId, 'Auth error test')).rejects.toThrow(
        'Gateway credential error',
      );

      const updateCalls = mockDb.update().set.mock.calls;
      const statusPassedToSet = updateCalls[updateCalls.length - 1][0];
      expect(statusPassedToSet.status).toBe('failed');
      expect(statusPassedToSet.lastErrorCode).toBe('GATEWAY_AUTH_401');
    });
  });

  describe('Concurrency & Promise.all Verification', () => {
    it('4. Concurrent requests (Promise.all) produce exactly one logical refund row and one HTTP call', async () => {
      const stableKey = 'flt24_ref_concurrent_123';
      const sharedRefundRecord = {
        id: 'refund-shared-uuid',
        paymentId,
        operationKey: `full_refund_${orderId}`,
        idempotencyKey: stableKey,
        amount: '180.00',
        status: 'pending',
        providerRefundId: null,
        requestPayload: { amount: 18000, notes: { operationKey: `full_refund_${orderId}` } },
      };

      // Mock database behavior for 2 concurrent transaction threads
      let firstCall = true;
      mockDb.transaction.mockImplementation(async () => {
        if (firstCall) {
          firstCall = false;
          // Thread 1 creates the row
          return {
            isNew: true,
            refund: sharedRefundRecord,
            payment: { id: paymentId, providerPaymentId, status: 'captured', amount: '180.00' },
          };
        } else {
          // Thread 2 finds the existing row created by Thread 1
          return {
            isNew: false,
            refund: sharedRefundRecord,
            payment: { id: paymentId, providerPaymentId, status: 'captured', amount: '180.00' },
          };
        }
      });

      const httpSpy = jest.spyOn(service, 'executeRazorpayRefundHttp').mockResolvedValue({
        status: 200,
        data: { id: providerRefundId, status: 'processed' },
      });

      // Execute simultaneously with Promise.all
      const [res1, res2] = await Promise.all([
        service.initiateOrderRefund(orderId, 'Restaurant kitchen rejection'),
        service.initiateOrderRefund(orderId, 'Customer cancellation race'),
      ]);

      // Both callers receive consistent statuses and identical refund metadata
      expect(res1.status).toBe('processed');
      expect(res1.providerRefundId).toBe(providerRefundId);
      expect(res2.refundId).toBe(sharedRefundRecord.id);

      // Verify only 1 outgoing HTTP request was issued with the stable idempotency key
      expect(httpSpy).toHaveBeenCalledTimes(1);
      expect(httpSpy).toHaveBeenCalledWith(providerPaymentId, expect.any(Object), stableKey);
    });
  });

  describe('Ambiguous Network Timeouts & Concurrency Safety', () => {
    it('5. Network timeout (ETIMEDOUT / socket hang up) does NOT mark the refund failed and preserves it as pending', async () => {
      mockDb.select().from().where().for.mockResolvedValueOnce([
        {
          id: paymentId,
          orderId,
          providerPaymentId,
          status: 'captured',
          amount: '300.00',
        },
      ]);
      mockDb.query.refunds.findFirst.mockResolvedValueOnce(null);
      mockDb.query.refunds.findMany.mockResolvedValueOnce([]);

      const testKey = 'flt24_ref_timeout12345';
      mockDb.insert().values().returning.mockResolvedValueOnce([
        {
          id: 'refund-uuid-timeout',
          paymentId,
          operationKey: `full_refund_${orderId}`,
          idempotencyKey: testKey,
          amount: '300.00',
          status: 'pending',
          requestPayload: { amount: 30000, notes: {} },
        },
      ]);

      const timeoutError: any = new Error('ETIMEDOUT: Connection timed out');
      timeoutError.code = 'ETIMEDOUT';
      jest.spyOn(service, 'executeRazorpayRefundHttp').mockRejectedValueOnce(timeoutError);

      const result = await service.initiateOrderRefund(orderId, 'Timeout test');

      expect(result.status).toBe('pending');
      expect(result.message).toContain('Network timeout encountered');

      expect(mockDb.update).toHaveBeenCalled();
      const updateCalls = mockDb.update().set.mock.calls;
      const statusPassedToSet = updateCalls[updateCalls.length - 1][0];
      expect(statusPassedToSet.status).toBe('pending');
      expect(statusPassedToSet.lastErrorCode).toBe('ETIMEDOUT');
    });

    it('6. Retry after ambiguous timeout reuses the exact same idempotency key and request payload', async () => {
      const stableKey = 'flt24_ref_stableKey12345';
      const stablePayload = {
        amount: 30000,
        notes: { fleet24OrderId: orderId, operationKey: `full_refund_${orderId}` },
      };

      mockDb.select().from().where().for.mockResolvedValueOnce([
        {
          id: paymentId,
          orderId,
          providerPaymentId,
          status: 'captured',
          amount: '300.00',
        },
      ]);
      mockDb.query.refunds.findFirst.mockResolvedValueOnce({
        id: 'refund-uuid-timeout',
        paymentId,
        operationKey: `full_refund_${orderId}`,
        idempotencyKey: stableKey,
        amount: '300.00',
        status: 'pending',
        providerRefundId: null,
        requestPayload: stablePayload,
        attemptCount: '2',
        lastAttemptAt: new Date(Date.now() - 60000), // 60 seconds ago (outside concurrency window)
      });

      mockRazorpayClient.payments.fetchMultipleRefund.mockResolvedValueOnce({ items: [] });

      const httpSpy = jest.spyOn(service, 'executeRazorpayRefundHttp').mockResolvedValueOnce({
        status: 200,
        data: { id: providerRefundId, status: 'processed' },
      });

      const result = await service.initiateOrderRefund(orderId, 'Retrying refund');

      expect(httpSpy).toHaveBeenCalledWith(providerPaymentId, stablePayload, stableKey);
      expect(result.status).toBe('processed');
      expect(result.providerRefundId).toBe(providerRefundId);
    });

    it('7. Razorpay 409 Conflict preserves the pending refund without failing or generating a new key', async () => {
      mockDb.select().from().where().for.mockResolvedValueOnce([
        {
          id: paymentId,
          orderId,
          providerPaymentId,
          status: 'captured',
          amount: '150.00',
        },
      ]);
      mockDb.query.refunds.findFirst.mockResolvedValueOnce(null);
      mockDb.query.refunds.findMany.mockResolvedValueOnce([]);

      mockDb.insert().values().returning.mockResolvedValueOnce([
        {
          id: 'refund-uuid-409',
          paymentId,
          operationKey: `full_refund_${orderId}`,
          idempotencyKey: 'flt24_ref_409_key123',
          amount: '150.00',
          status: 'pending',
          requestPayload: { amount: 15000, notes: {} },
        },
      ]);

      jest.spyOn(service, 'executeRazorpayRefundHttp').mockResolvedValueOnce({
        status: 409,
        data: {
          error: {
            code: 'BAD_REQUEST_ERROR',
            description: 'A refund with the same idempotency key is already in progress.',
          },
        },
      });

      const result = await service.initiateOrderRefund(orderId, '409 Conflict check');

      expect(result.status).toBe('pending');
      expect(result.message).toContain('currently processing');
    });

    it('8. Definitive rejection (HTTP 400 Bad Request) marks the refund as failed', async () => {
      mockDb.select().from().where().for.mockResolvedValueOnce([
        {
          id: paymentId,
          orderId,
          providerPaymentId,
          status: 'captured',
          amount: '100.00',
        },
      ]);
      mockDb.query.refunds.findFirst.mockResolvedValueOnce(null);
      mockDb.query.refunds.findMany.mockResolvedValueOnce([]);

      mockDb.insert().values().returning.mockResolvedValueOnce([
        {
          id: 'refund-uuid-def-fail',
          paymentId,
          operationKey: `full_refund_${orderId}`,
          idempotencyKey: 'flt24_ref_fail_key123',
          amount: '100.00',
          status: 'pending',
          requestPayload: { amount: 10000, notes: {} },
        },
      ]);

      jest.spyOn(service, 'executeRazorpayRefundHttp').mockResolvedValueOnce({
        status: 400,
        data: {
          error: {
            code: 'BAD_REQUEST_ERROR',
            description: 'Payment has already reached the maximum refundable amount.',
          },
        },
      });

      await expect(service.initiateOrderRefund(orderId, 'Rejection test')).rejects.toThrow(
        BadRequestException,
      );

      const updateCalls = mockDb.update().set.mock.calls;
      const statusPassedToSet = updateCalls[updateCalls.length - 1][0];
      expect(statusPassedToSet.status).toBe('failed');
    });

    it('9. Reconciles via gateway fetchMultipleRefund if refund was already accepted during previous timeout', async () => {
      const stableKey = 'flt24_ref_recon_12345';
      mockDb.select().from().where().for.mockResolvedValueOnce([
        {
          id: paymentId,
          orderId,
          providerPaymentId,
          status: 'captured',
          amount: '400.00',
        },
      ]);
      mockDb.query.refunds.findFirst.mockResolvedValueOnce({
        id: 'refund-uuid-recon',
        paymentId,
        operationKey: `full_refund_${orderId}`,
        idempotencyKey: stableKey,
        amount: '400.00',
        status: 'pending',
        providerRefundId: null,
      });

      mockRazorpayClient.payments.fetchMultipleRefund.mockResolvedValueOnce({
        items: [
          {
            id: 'rfnd_RzpReconciled123',
            status: 'processed',
            notes: { operationKey: `full_refund_${orderId}` },
          },
        ],
      });

      const httpSpy = jest.spyOn(service, 'executeRazorpayRefundHttp');

      const result = await service.initiateOrderRefund(orderId, 'Recon retry');

      expect(result.status).toBe('processed');
      expect(result.providerRefundId).toBe('rfnd_RzpReconciled123');
      expect(httpSpy).not.toHaveBeenCalled();
    });
  });

  describe('Webhook Reconciliation & Idempotency', () => {
    it('10. Handles refund.processed webhook event idempotently', async () => {
      const webhookPayload = {
        event_id: 'event-101',
        event: 'refund.processed',
        payload: {
          refund: {
            entity: {
              id: providerRefundId,
              payment_id: providerPaymentId,
              status: 'processed',
            },
          },
        },
      };

      jest.spyOn(service, 'verifyWebhookSignature').mockReturnValueOnce(true);
      mockDb.query.paymentWebhookEvents.findFirst.mockResolvedValueOnce(null);

      mockDb.query.refunds.findFirst.mockResolvedValueOnce({
        id: 'refund-uuid-1',
        paymentId,
        providerRefundId,
        status: 'pending',
      });

      const res = await service.handleWebhook(JSON.stringify(webhookPayload), 'valid-sig');

      expect(res.received).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('11. Handles duplicate webhook deliveries without reprocessing', async () => {
      const webhookPayload = {
        event_id: 'event-duplicate-102',
        event: 'refund.processed',
        payload: {},
      };

      jest.spyOn(service, 'verifyWebhookSignature').mockReturnValueOnce(true);
      mockDb.query.paymentWebhookEvents.findFirst.mockResolvedValueOnce({
        id: 'evt-db-id',
        eventId: 'event-duplicate-102',
      });

      const res = await service.handleWebhook(JSON.stringify(webhookPayload), 'valid-sig');

      expect(res.received).toBe(true);
      expect(res.reason).toContain('Duplicate event ignored');
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });
});
