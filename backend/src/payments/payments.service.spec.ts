import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PaymentsService } from './payments.service';
import { DRIZZLE_CONNECTION } from '../database/database.constants';

describe('PaymentsService - Step 1 Verification', () => {
  let service: PaymentsService;
  let mockDb: any;
  let mockConfigService: any;

  const TEST_SECRET = 'test_razorpay_secret_12345';
  const TEST_WEBHOOK_SECRET = 'test_webhook_secret_67890';

  beforeEach(async () => {
    mockDb = {
      query: {
        orders: {
          findFirst: jest.fn(),
        },
        payments: {
          findFirst: jest.fn(),
        },
      },
      transaction: jest.fn(),
      update: jest.fn(),
      insert: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'RAZORPAY_KEY_ID') return 'rzp_test_sampleKey123';
        if (key === 'RAZORPAY_KEY_SECRET') return TEST_SECRET;
        if (key === 'RAZORPAY_WEBHOOK_SECRET') return TEST_WEBHOOK_SECRET;
        if (key === 'RAZORPAY_MODE') return 'test';
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: DRIZZLE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('Amount Conversion to Paise', () => {
    it('should accurately convert integer rupees to paise', () => {
      expect(service.convertRupeesToPaise(100)).toBe(10000);
      expect(service.convertRupeesToPaise('100')).toBe(10000);
    });

    it('should accurately convert decimal rupees to paise without floating-point errors', () => {
      expect(service.convertRupeesToPaise(210.5)).toBe(21050);
      expect(service.convertRupeesToPaise('210.50')).toBe(21050);
      expect(service.convertRupeesToPaise('19.99')).toBe(1999);
      expect(service.convertRupeesToPaise('0.50')).toBe(50);
    });

    it('should throw BadRequestException on zero, negative, or invalid amounts', () => {
      expect(() => service.convertRupeesToPaise(0)).toThrow(BadRequestException);
      expect(() => service.convertRupeesToPaise(-50)).toThrow(BadRequestException);
      expect(() => service.convertRupeesToPaise('invalid')).toThrow(BadRequestException);
    });
  });

  describe('Payment Signature Verification', () => {
    const orderId = 'order_DA2871Gsh82';
    const paymentId = 'pay_294hsdg827H';

    it('should verify a valid HMAC-SHA256 signature using timing-safe comparison', () => {
      const validSignature = crypto
        .createHmac('sha256', TEST_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const isValid = service.verifyPaymentSignature(orderId, paymentId, validSignature);
      expect(isValid).toBe(true);
    });

    it('should reject a forged signature', () => {
      const forgedSignature = crypto
        .createHmac('sha256', 'wrong_secret')
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const isValid = service.verifyPaymentSignature(orderId, paymentId, forgedSignature);
      expect(isValid).toBe(false);
    });

    it('should reject when orderId or paymentId is tampered with', () => {
      const validSignature = crypto
        .createHmac('sha256', TEST_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const isValidWithTamperedOrder = service.verifyPaymentSignature(
        'order_TAMPERED',
        paymentId,
        validSignature,
      );
      expect(isValidWithTamperedOrder).toBe(false);

      const isValidWithTamperedPayment = service.verifyPaymentSignature(
        orderId,
        'pay_TAMPERED',
        validSignature,
      );
      expect(isValidWithTamperedPayment).toBe(false);
    });
  });

  describe('Webhook Signature Verification', () => {
    const rawPayload = JSON.stringify({
      entity: 'event',
      account_id: 'acc_123',
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_999' } } },
    });

    it('should verify valid raw webhook payload signature', () => {
      const validSignature = crypto
        .createHmac('sha256', TEST_WEBHOOK_SECRET)
        .update(rawPayload)
        .digest('hex');

      const isValid = service.verifyWebhookSignature(rawPayload, validSignature);
      expect(isValid).toBe(true);
    });

    it('should reject tampered webhook payload signature', () => {
      const validSignature = crypto
        .createHmac('sha256', TEST_WEBHOOK_SECRET)
        .update(rawPayload)
        .digest('hex');

      const tamperedPayload = rawPayload + ' ';
      const isValid = service.verifyWebhookSignature(tamperedPayload, validSignature);
      expect(isValid).toBe(false);
    });
  });

  describe('Payment Session & Idempotency Rules', () => {
    const customerId = 'c1234567-0000-4000-8000-000000000001';
    const orderId = 'a1234567-0000-4000-8000-000000000001';

    it('should reject if order does not exist or does not belong to customer', async () => {
      mockDb.query.orders.findFirst.mockResolvedValue(null);

      await expect(service.createPaymentSession(customerId, orderId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject if order status is not pending_payment', async () => {
      mockDb.query.orders.findFirst.mockResolvedValue({
        id: orderId,
        customerId,
        orderNumber: 'FL-20261029-1111',
        status: 'placed',
        totalPayable: '350.00',
      });

      await expect(service.createPaymentSession(customerId, orderId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reuse existing pending Razorpay order on retry without creating duplicate gateway orders', async () => {
      mockDb.query.orders.findFirst.mockResolvedValue({
        id: orderId,
        customerId,
        orderNumber: 'FL-20261029-1111',
        status: 'pending_payment',
        totalPayable: '250.00',
      });

      mockDb.query.payments.findFirst.mockResolvedValue({
        id: 'p123',
        orderId,
        provider: 'razorpay',
        providerOrderId: 'order_EXISTING_RZP_123',
        status: 'pending',
      });

      const session = await service.createPaymentSession(customerId, orderId);

      expect(session.razorpayOrderId).toBe('order_EXISTING_RZP_123');
      expect(session.amount).toBe(25000);
      expect(session.currency).toBe('INR');
    });
  });
});

