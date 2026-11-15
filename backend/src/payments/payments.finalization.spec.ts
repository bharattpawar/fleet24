import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PaymentsService } from './payments.service';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import { TrackingPublisherService } from '../tracking/tracking-publisher.service';

describe('PaymentsService - Phase 2B Shared Finalization Gate & Concurrency Tests', () => {
  let service: PaymentsService;
  let mockDb: any;
  let mockConfigService: any;
  let mockTrackingPublisher: any;

  const TEST_SECRET = 'test_razorpay_secret_12345';
  const TEST_WEBHOOK_SECRET = 'test_webhook_secret_67890';
  const customerId = 'c1111111-1111-4111-8111-111111111111';
  const outletId = 'out-1111-1111';

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
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
            for: jest.fn().mockResolvedValue([{ id: customerId }]),
          }),
        }),
      }),
      transaction: jest.fn(async (cb) => cb(mockDb)),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{ id: 'order-1' }]),
          }),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{}]),
          onConflictDoNothing: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([{}]) }),
        }),
      }),
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

    mockTrackingPublisher = {
      publishOrderCreated: jest.fn(),
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
        {
          provide: TrackingPublisherService,
          useValue: mockTrackingPublisher,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    (service as any).razorpayClient = {
      orders: {
        fetch: jest.fn().mockResolvedValue({ status: 'created' }),
        create: jest.fn(),
      },
      payments: {
        fetch: jest.fn(),
      },
    };
  });

  describe('1. Normal first captured payment', () => {
    it('promotes pending_payment order to placed, sets payment to captured, and publishes order.created', async () => {
      const order = {
        id: 'ord-1',
        orderNumber: 'FL-20261115-0001',
        customerId,
        outletId,
        status: 'pending_payment',
        totalPayable: '150.00',
        items: [{ name: 'Burger', quantity: 2 }],
      };
      const payment = {
        id: 'pay-1',
        orderId: order.id,
        customerId,
        amount: '150.00',
        currency: 'INR',
        status: 'pending',
        providerOrderId: 'order_rzp_1',
      };

      mockDb.query.orders.findFirst.mockResolvedValue(order);
      mockDb.query.payments.findFirst.mockResolvedValue(payment);

      const result = await service.finalizeCapturedPayment({
        orderId: order.id,
        paymentId: payment.id,
        providerPaymentId: 'pay_rzp_captured_1',
        rawGatewayMetadata: { id: 'pay_rzp_captured_1', status: 'captured' },
        source: 'client_verify',
      });

      expect(result.orderStatus).toBe('placed');
      expect(result.paymentStatus).toBe('captured');
      expect(result.isConflict).toBe(false);
      expect(mockTrackingPublisher.publishOrderCreated).toHaveBeenCalledTimes(1);
      expect(mockTrackingPublisher.publishOrderCreated).toHaveBeenCalledWith(
        outletId,
        expect.objectContaining({ orderId: 'ord-1', status: 'placed' }),
      );
    });
  });

  describe('2. Duplicate capture for another order (Active order already exists)', () => {
    it('preserves captured payment, transitions second order to payment_conflict, and never dispatches', async () => {
      const activeOrder = {
        id: 'ord-active',
        orderNumber: 'FL-20261115-ACTIVE',
        status: 'preparing',
        placedAt: new Date(),
        totalPayable: '200.00',
      };

      const orderB = {
        id: 'ord-conflict-2',
        orderNumber: 'FL-20261115-0002',
        customerId,
        outletId,
        status: 'pending_payment',
        totalPayable: '300.00',
        items: [{ name: 'Pizza', quantity: 1 }],
      };

      const paymentB = {
        id: 'pay-2',
        orderId: orderB.id,
        customerId,
        amount: '300.00',
        currency: 'INR',
        status: 'pending',
        providerOrderId: 'order_rzp_2',
      };

      // Mock DB: locked customer check succeeds, conflicting active order found
      mockDb.query.orders.findFirst.mockResolvedValue(orderB);
      mockDb.query.payments.findFirst.mockResolvedValue(paymentB);

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockImplementation((condition) => ({
            limit: jest.fn().mockResolvedValue([activeOrder]),
            for: jest.fn().mockResolvedValue([{ id: customerId }]),
          })),
        }),
      });

      let insertedAudit: any = null;
      let insertedHistory: any = null;
      mockDb.insert.mockImplementation(() => ({
        values: jest.fn().mockImplementation((val) => {
          if (val.action === 'payment_conflict_detected') insertedAudit = val;
          if (val.newStatus === 'payment_conflict') insertedHistory = val;
          return { returning: jest.fn().mockResolvedValue([val]) };
        }),
      }));

      const result = await service.finalizeCapturedPayment({
        orderId: orderB.id,
        paymentId: paymentB.id,
        providerPaymentId: 'pay_rzp_dup_2',
        rawGatewayMetadata: { id: 'pay_rzp_dup_2', status: 'captured' },
        source: 'client_verify',
      });

      expect(result.orderStatus).toBe('payment_conflict');
      expect(result.paymentStatus).toBe('captured');
      expect(result.isConflict).toBe(true);
      expect(mockTrackingPublisher.publishOrderCreated).not.toHaveBeenCalled();

      // Check audit and history records
      expect(insertedHistory).toMatchObject({
        orderId: orderB.id,
        newStatus: 'payment_conflict',
        changedByUserId: customerId,
      });
      expect(insertedAudit).toMatchObject({
        action: 'payment_conflict_detected',
        entityType: 'order',
        entityId: orderB.id,
        details: expect.objectContaining({
          conflictType: 'duplicate_active_fulfillment',
          capturedPaymentId: paymentB.id,
          providerPaymentId: 'pay_rzp_dup_2',
          capturedAmount: '300.00',
          currency: 'INR',
          resolutionStatus: 'pending_admin_review',
        }),
      });
    });
  });

  describe('3. Idempotency & Concurrency: Same payment verified twice', () => {
    it('returns exact-once state and does not duplicate status history or events', async () => {
      const order = {
        id: 'ord-1',
        orderNumber: 'FL-20261115-0001',
        customerId,
        outletId,
        status: 'placed',
        totalPayable: '150.00',
      };
      const payment = {
        id: 'pay-1',
        orderId: order.id,
        amount: '150.00',
        currency: 'INR',
        status: 'captured',
        providerOrderId: 'order_rzp_1',
      };

      mockDb.query.orders.findFirst.mockResolvedValue(order);
      mockDb.query.payments.findFirst.mockResolvedValue(payment);

      const result = await service.finalizeCapturedPayment({
        orderId: order.id,
        paymentId: payment.id,
        providerPaymentId: 'pay_rzp_captured_1',
        source: 'client_verify',
      });

      expect(result.orderStatus).toBe('placed');
      expect(result.paymentStatus).toBe('captured');
      expect(result.isConflict).toBe(false);
      expect(mockTrackingPublisher.publishOrderCreated).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('4. Client verification racing with webhook', () => {
    it('serializes under customer lock and only the first caller transitions and notifies', async () => {
      let orderStatus = 'pending_payment';
      let paymentStatus = 'pending';
      let lockPromiseResolve: (() => void) | null = null;

      const order = {
        id: 'ord-race',
        orderNumber: 'FL-RACE-1',
        customerId,
        outletId,
        get status() { return orderStatus; },
        totalPayable: '100.00',
        items: [],
      };
      const payment = {
        id: 'pay-race',
        orderId: order.id,
        amount: '100.00',
        currency: 'INR',
        get status() { return paymentStatus; },
        providerOrderId: 'order_rzp_race',
      };

      mockDb.query.orders.findFirst.mockImplementation(() => Promise.resolve({ ...order, status: orderStatus }));
      mockDb.query.payments.findFirst.mockImplementation(() => Promise.resolve({ ...payment, status: paymentStatus }));

      // Simulate serialized transaction execution queue matching PostgreSQL customer row lock
      let activeTx = Promise.resolve();
      mockDb.transaction.mockImplementation(async (cb: any) => {
        const prev = activeTx;
        let release: () => void;
        activeTx = new Promise((resolve) => { release = resolve; });
        await prev;
        try {
          return await cb(mockDb);
        } finally {
          release!();
        }
      });

      mockDb.update.mockReturnValue({
        set: jest.fn().mockImplementation((val) => ({
          where: jest.fn().mockImplementation(() => {
            if (val.status === 'placed') {
              orderStatus = 'placed';
              return { returning: jest.fn().mockResolvedValue([{ id: order.id }]) };
            }
            if (val.status === 'captured') {
              paymentStatus = 'captured';
            }
            return { returning: jest.fn().mockResolvedValue([]) };
          }),
        })),
      });

      const call1 = service.finalizeCapturedPayment({
        orderId: order.id,
        paymentId: payment.id,
        providerPaymentId: 'pay_rzp_race_1',
        source: 'client_verify',
      });

      const call2 = service.finalizeCapturedPayment({
        orderId: order.id,
        paymentId: payment.id,
        providerPaymentId: 'pay_rzp_race_1',
        source: 'webhook',
      });

      const [res1, res2] = await Promise.all([call1, call2]);

      expect(res1.orderStatus).toBe('placed');
      expect(res2.orderStatus).toBe('placed');
      expect(mockTrackingPublisher.publishOrderCreated).toHaveBeenCalledTimes(1);
    });
  });

  describe('5. Duplicate webhook events', () => {
    it('acknowledges duplicate event safely without reprocessing', async () => {
      mockDb.query.paymentWebhookEvents.findFirst.mockResolvedValue({
        id: 'evt-uuid-1',
        eventId: 'evt_dup_123',
      });

      const rawPayload = JSON.stringify({
        event: 'payment.captured',
        event_id: 'evt_dup_123',
        payload: { payment: { entity: { id: 'pay_dup', order_id: 'ord_rzp_dup' } } },
      });
      const sig = crypto.createHmac('sha256', TEST_WEBHOOK_SECRET).update(rawPayload).digest('hex');

      const result = await service.handleWebhook(rawPayload, sig);

      expect(result.received).toBe(true);
      expect(result.reason).toBe('Duplicate event ignored');
      expect(mockTrackingPublisher.publishOrderCreated).not.toHaveBeenCalled();
    });
  });

  describe('6. Amount or currency mismatch', () => {
    it('rejects client verification if provider payment amount does not match', async () => {
      const order = { id: 'ord-mismatch', orderNumber: 'FL-MISM', customerId, status: 'pending_payment', totalPayable: '100.00' };
      const payment = { id: 'p-mismatch', orderId: order.id, providerOrderId: 'rzp_ord_mism', amount: '100.00', currency: 'INR', order };
      mockDb.query.payments.findFirst.mockResolvedValue(payment);

      const dto = {
        razorpayOrderId: 'rzp_ord_mism',
        razorpayPaymentId: 'rzp_pay_mism',
        razorpaySignature: crypto.createHmac('sha256', TEST_SECRET).update('rzp_ord_mism|rzp_pay_mism').digest('hex'),
      };

      (service as any).razorpayClient.payments.fetch = jest.fn().mockResolvedValue({
        amount: 5000, // 50.00 INR vs expected 100.00 INR
        currency: 'INR',
        order_id: 'rzp_ord_mism',
        status: 'captured',
      });

      await expect(service.verifyPayment(customerId, dto)).rejects.toThrow(BadRequestException);
      expect(mockTrackingPublisher.publishOrderCreated).not.toHaveBeenCalled();
    });
  });

  describe('7. Payment session advisory guard', () => {
    it('rejects createPaymentSession when another order is in active fulfillment', async () => {
      const pendingOrder = {
        id: 'ord-pending',
        orderNumber: 'FL-PENDING',
        customerId,
        status: 'pending_payment',
        totalPayable: '200.00',
      };
      mockDb.query.orders.findFirst.mockResolvedValue(pendingOrder);

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([
              { id: 'ord-active-1', orderNumber: 'FL-ACTIVE-1', status: 'out_for_delivery' },
            ]),
          }),
        }),
      });

      await expect(service.createPaymentSession(customerId, pendingOrder.id)).rejects.toThrow(ConflictException);
    });

    it('allows retry for the SAME pending_payment order', async () => {
      const pendingOrder = {
        id: 'ord-pending',
        orderNumber: 'FL-PENDING',
        customerId,
        status: 'pending_payment',
        totalPayable: '200.00',
      };
      mockDb.query.orders.findFirst.mockResolvedValue(pendingOrder);

      // where condition filters out same order (ne(schema.orders.id, order.id))
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]), // No other order
          }),
        }),
      });

      mockDb.query.payments.findFirst.mockResolvedValue({
        id: 'pay-pending',
        orderId: pendingOrder.id,
        providerOrderId: 'rzp_ord_retry',
        status: 'pending',
      });

      (service as any).razorpayClient.orders.fetch = jest.fn().mockResolvedValue({
        id: 'rzp_ord_retry',
        status: 'created',
      });

      const session = await service.createPaymentSession(customerId, pendingOrder.id);
      expect(session.razorpayOrderId).toBe('rzp_ord_retry');
      expect(session.orderId).toBe(pendingOrder.id);
    });
  });

  describe('8. Database Unique Index Conflict Recovery (23505)', () => {
    it('safely recovers to payment_conflict if orders_single_active_per_customer_idx collides', async () => {
      const order = {
        id: 'ord-concurrent-unique',
        orderNumber: 'FL-COLLIDE',
        customerId,
        outletId,
        status: 'pending_payment',
        totalPayable: '180.00',
        items: [],
      };
      const payment = {
        id: 'pay-unique',
        orderId: order.id,
        amount: '180.00',
        currency: 'INR',
        status: 'pending',
        providerOrderId: 'order_rzp_unique',
      };

      mockDb.query.orders.findFirst.mockResolvedValue(order);
      mockDb.query.payments.findFirst.mockResolvedValue(payment);

      let conflictRecorded = false;

      mockDb.update.mockReturnValue({
        set: jest.fn().mockImplementation((val) => ({
          where: jest.fn().mockImplementation(() => {
            if (val.status === 'placed') {
              const err: any = new Error('duplicate key value violates unique constraint "orders_single_active_per_customer_idx"');
              err.code = '23505';
              throw err;
            }
            if (val.status === 'payment_conflict') {
              conflictRecorded = true;
              return {
                returning: jest.fn().mockResolvedValue([{ ...order, status: 'payment_conflict' }]),
              };
            }
            return { returning: jest.fn().mockResolvedValue([]) };
          }),
        })),
      });

      const result = await service.finalizeCapturedPayment({
        orderId: order.id,
        paymentId: payment.id,
        providerPaymentId: 'pay_rzp_unique_captured',
        source: 'client_verify',
      });

      expect(result.orderStatus).toBe('payment_conflict');
      expect(result.paymentStatus).toBe('captured');
      expect(result.isConflict).toBe(true);
      expect(conflictRecorded).toBe(true);
      expect(mockTrackingPublisher.publishOrderCreated).not.toHaveBeenCalled();
    });

    it('does not swallow unrelated database unique violations', async () => {
      const order = {
        id: 'ord-unrelated',
        orderNumber: 'FL-UNRELATED',
        customerId,
        outletId,
        status: 'pending_payment',
        totalPayable: '180.00',
        items: [],
      };
      const payment = {
        id: 'pay-unrelated',
        orderId: order.id,
        amount: '180.00',
        currency: 'INR',
        status: 'pending',
      };

      mockDb.query.orders.findFirst.mockResolvedValue(order);
      mockDb.query.payments.findFirst.mockResolvedValue(payment);

      mockDb.update.mockReturnValue({
        set: jest.fn().mockImplementation((val) => ({
          where: jest.fn().mockImplementation(() => {
            if (val.status === 'placed') {
              const err: any = new Error('duplicate key value violates unique constraint "orders_order_number_idx"');
              err.code = '23505';
              throw err;
            }
            return { returning: jest.fn().mockResolvedValue([]) };
          }),
        })),
      });

      await expect(
        service.finalizeCapturedPayment({
          orderId: order.id,
          paymentId: payment.id,
          providerPaymentId: 'pay_rzp_unrelated',
          source: 'client_verify',
        }),
      ).rejects.toThrow('orders_order_number_idx');
    });
  });
});
