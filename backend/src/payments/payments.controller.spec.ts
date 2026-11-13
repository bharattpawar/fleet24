import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { RefundReconciliationService } from './refund-reconciliation.service';
import { TrackingPublisherService } from '../tracking/tracking-publisher.service';
import { DRIZZLE_CONNECTION } from '../database/database.constants';

describe('PaymentsController & PaymentsService - Step 2 Verification', () => {
  let service: PaymentsService;
  let controller: PaymentsController;
  let mockDb: any;
  let mockConfigService: any;
  let mockJwtService: any;
  let mockReconciliationService: any;

  const TEST_SECRET = 'test_razorpay_secret_12345';
  const TEST_WEBHOOK_SECRET = 'test_webhook_secret_67890';
  const customerId = 'c1234567-0000-4000-8000-000000000001';
  const orderId = 'a1234567-0000-4000-8000-000000000001';

  beforeEach(async () => {
    mockDb = {
      query: {
        orders: {
          findFirst: jest.fn(),
        },
        payments: {
          findFirst: jest.fn(),
        },
        paymentWebhookEvents: {
          findFirst: jest.fn(),
        },
      },
      transaction: jest.fn(async (cb) => {
        return cb(mockDb);
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{}]),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockResolvedValue([{}]),
      }),
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'RAZORPAY_KEY_ID') return 'rzp_test_sampleKey123';
        if (key === 'RAZORPAY_KEY_SECRET') return TEST_SECRET;
        if (key === 'RAZORPAY_WEBHOOK_SECRET') return TEST_WEBHOOK_SECRET;
        if (key === 'RAZORPAY_MODE') return 'test';
        if (key === 'JWT_ACCESS_SECRET') return 'test_jwt_secret_32_characters_long_123';
        return defaultValue;
      }),
    };

    mockJwtService = {
      verifyAsync: jest.fn(),
      signAsync: jest.fn(),
    };

    mockReconciliationService = {
      reconcilePendingRefunds: jest.fn().mockResolvedValue({
        scanned: 0,
        reconciled: 0,
        retried: 0,
        failed: 0,
        skipped: 0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        PaymentsService,
        {
          provide: RefundReconciliationService,
          useValue: mockReconciliationService,
        },
        {
          provide: DRIZZLE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: TrackingPublisherService,
          useValue: { publishOrderCreated: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    controller = module.get<PaymentsController>(PaymentsController);
    expect(controller).toBeDefined();
  });

  describe('Payment Verification Flow', () => {
    const rzpOrderId = 'order_RZP_123';
    const rzpPaymentId = 'pay_RZP_456';
    const validSignature = crypto
      .createHmac('sha256', TEST_SECRET)
      .update(`${rzpOrderId}|${rzpPaymentId}`)
      .digest('hex');

    it('should reject verification if payment does not belong to authenticated customer', async () => {
      mockDb.query.payments.findFirst.mockResolvedValue({
        id: 'p1',
        orderId,
        providerOrderId: rzpOrderId,
        status: 'pending',
        amount: '200.00',
        order: {
          id: orderId,
          customerId: 'ANOTHER_CUSTOMER_ID',
          orderNumber: 'FL-20261029-9999',
          status: 'pending_payment',
        },
      });

      await expect(
        service.verifyPayment(customerId, {
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: rzpPaymentId,
          razorpaySignature: validSignature,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject verification when signature is invalid', async () => {
      mockDb.query.payments.findFirst.mockResolvedValue({
        id: 'p1',
        orderId,
        providerOrderId: rzpOrderId,
        status: 'pending',
        amount: '200.00',
        order: {
          id: orderId,
          customerId,
          orderNumber: 'FL-20261029-9999',
          status: 'pending_payment',
        },
      });

      await expect(
        service.verifyPayment(customerId, {
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: rzpPaymentId,
          razorpaySignature: 'invalid_forged_sig',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should transactionally advance order to placed and payment to captured on valid signature', async () => {
      mockDb.query.payments.findFirst.mockResolvedValue({
        id: 'p1',
        orderId,
        providerOrderId: rzpOrderId,
        status: 'pending',
        amount: '200.00',
        order: {
          id: orderId,
          customerId,
          orderNumber: 'FL-20261029-9999',
          status: 'pending_payment',
        },
      });

      mockDb.query.orders.findFirst.mockResolvedValue({
        id: orderId,
        orderNumber: 'FL-20261029-9999',
        status: 'pending_payment',
      });

      const result = await service.verifyPayment(customerId, {
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPaymentId,
        razorpaySignature: validSignature,
      });

      expect(result.verified).toBe(true);
      expect(result.orderStatus).toBe('placed');
      expect(result.paymentStatus).toBe('captured');
    });

    it('should be idempotent if payment is already captured', async () => {
      mockDb.query.payments.findFirst.mockResolvedValue({
        id: 'p1',
        orderId,
        providerOrderId: rzpOrderId,
        status: 'captured',
        amount: '200.00',
        order: {
          id: orderId,
          customerId,
          orderNumber: 'FL-20261029-9999',
          status: 'placed',
        },
      });

      const result = await service.verifyPayment(customerId, {
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPaymentId,
        razorpaySignature: validSignature,
      });

      expect(result.verified).toBe(true);
      expect(result.orderStatus).toBe('placed');
      expect(result.paymentStatus).toBe('captured');
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('Webhook Reconciliation Flow', () => {
    it('should reject webhook without signature or with invalid signature', async () => {
      const payload = JSON.stringify({ event: 'payment.captured' });
      await expect(service.handleWebhook(payload, 'bad_sig')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should deduplicate already processed webhook events', async () => {
      const payloadObj = {
        event_id: 'evt_dup_123',
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_123', order_id: 'order_123' } } },
      };
      const rawPayload = JSON.stringify(payloadObj);
      const validSig = crypto
        .createHmac('sha256', TEST_WEBHOOK_SECRET)
        .update(rawPayload)
        .digest('hex');

      mockDb.query.paymentWebhookEvents.findFirst.mockResolvedValue({
        eventId: 'evt_dup_123',
      });

      const result = await service.handleWebhook(rawPayload, validSig);
      expect(result.received).toBe(true);
      expect(result.reason).toContain('Duplicate event');
    });

    it('should never overwrite captured payment when late payment.failed event arrives', async () => {
      const payloadObj = {
        event_id: 'evt_fail_999',
        event: 'payment.failed',
        payload: { payment: { entity: { id: 'pay_fail_123', order_id: 'order_ALREADY_CAPTURED' } } },
      };
      const rawPayload = JSON.stringify(payloadObj);
      const validSig = crypto
        .createHmac('sha256', TEST_WEBHOOK_SECRET)
        .update(rawPayload)
        .digest('hex');

      mockDb.query.paymentWebhookEvents.findFirst.mockResolvedValue(null);
      mockDb.query.payments.findFirst.mockResolvedValue({
        id: 'p1',
        providerOrderId: 'order_ALREADY_CAPTURED',
        status: 'captured', // Already captured!
      });

      const result = await service.handleWebhook(rawPayload, validSig);
      expect(result.received).toBe(true);
      // Ensure payments table was NOT updated to 'failed'
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });
});
