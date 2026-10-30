import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, sql } from 'drizzle-orm';
import * as crypto from 'crypto';
import * as https from 'https';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Razorpay = require('razorpay');
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { VerifyPaymentDto } from './dto/payment.dto';

export interface PaymentSessionResult {
  orderId: string;
  orderNumber: string;
  razorpayOrderId: string;
  keyId: string;
  amount: number; // in paise
  currency: string;
  status: string;
  checkoutUrl?: string;
}

export interface VerifyPaymentResult {
  verified: boolean;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  paymentId: string;
  paymentStatus: string;
  amount: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private razorpayClient: any = null;
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;
  private readonly mode: string;

  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly configService: ConfigService,
  ) {
    this.keyId = this.configService.get<string>('RAZORPAY_KEY_ID', '');
    this.keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET', '');
    this.webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET', '');
    this.mode = this.configService.get<string>('RAZORPAY_MODE', 'test');

    if (this.keyId && this.keySecret) {
      try {
        const RazorpayModule: any = Razorpay;
        const RazorpayClass =
          typeof RazorpayModule === 'function'
            ? RazorpayModule
            : typeof RazorpayModule?.default === 'function'
            ? RazorpayModule.default
            : RazorpayModule;

        if (typeof RazorpayClass === 'function') {
          this.razorpayClient = new RazorpayClass({
            key_id: this.keyId,
            key_secret: this.keySecret,
          });
          this.logger.log(`Razorpay client initialized in ${this.mode} mode.`);
        } else {
          this.logger.error('Razorpay class constructor could not be resolved from module exports.');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to initialize Razorpay client: ${msg}`);
      }
    } else {
      this.logger.warn(
        'Razorpay credentials not fully configured. Live gateway calls will be disabled until credentials are provided.',
      );
    }
  }

  /**
   * Converts Rupee amounts into integer paise (avoiding floating point precision issues)
   */
  convertRupeesToPaise(amountInRupees: number | string): number {
    const numericAmount = typeof amountInRupees === 'string' ? parseFloat(amountInRupees) : amountInRupees;
    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new BadRequestException('Invalid order amount for payment processing.');
    }
    return Math.round(numericAmount * 100);
  }

  /**
   * Cryptographically verifies Razorpay Checkout payment signatures using HMAC-SHA256
   */
  verifyPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    signature: string,
    secretOverride?: string,
  ): boolean {
    const secret = secretOverride || this.keySecret;
    if (!secret) {
      throw new InternalServerErrorException('Razorpay secret is not configured.');
    }

    if (!razorpayOrderId || !razorpayPaymentId || !signature) {
      return false;
    }

    try {
      const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      const expectedBuffer = Buffer.from(generatedSignature, 'utf8');
      const actualBuffer = Buffer.from(signature, 'utf8');

      if (expectedBuffer.length !== actualBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Cryptographically verifies Razorpay Webhook signatures against raw request body
   */
  verifyWebhookSignature(rawBody: string | Buffer, signature: string, secretOverride?: string): boolean {
    const secret = secretOverride || this.webhookSecret;
    if (!secret) {
      throw new InternalServerErrorException('Razorpay webhook secret is not configured.');
    }

    if (!rawBody || !signature) {
      return false;
    }

    try {
      const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      const expectedBuffer = Buffer.from(generatedSignature, 'utf8');
      const actualBuffer = Buffer.from(signature, 'utf8');

      if (expectedBuffer.length !== actualBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Creates or retrieves an existing Razorpay Order for an eligible pending order
   */
  async createPaymentSession(customerId: string, orderId: string): Promise<PaymentSessionResult> {
    const order = await this.db.query.orders.findFirst({
      where: and(eq(schema.orders.id, orderId), eq(schema.orders.customerId, customerId)),
    });

    if (!order) {
      throw new NotFoundException('Order not found or does not belong to customer.');
    }

    if (order.status !== 'pending_payment') {
      throw new BadRequestException(
        `Order ${order.orderNumber} is in status '${order.status}' and cannot accept payment.`,
      );
    }

    const amountInPaise = this.convertRupeesToPaise(order.totalPayable);

    // Check if a payment record already exists for this order
    const existingPayment = await this.db.query.payments.findFirst({
      where: eq(schema.payments.orderId, order.id),
    });

    // Reuse existing Razorpay order if already created and still pending AND not already paid at gateway
    if (existingPayment?.providerOrderId && existingPayment.status === 'pending') {
      let isAlreadyPaidAtGateway = false;
      if (this.razorpayClient) {
        try {
          const remoteOrder = await this.razorpayClient.orders.fetch(existingPayment.providerOrderId);
          if (remoteOrder?.status === 'paid') {
            isAlreadyPaidAtGateway = true;
          }
        } catch {
          // If fetch fails, proceed with existing
        }
      }

      if (!isAlreadyPaidAtGateway) {
        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          razorpayOrderId: existingPayment.providerOrderId,
          keyId: this.keyId,
          amount: amountInPaise,
          currency: 'INR',
          status: 'pending',
          checkoutUrl: `/api/v1/payments/checkout/${order.id}`,
        };
      }
    }

    if (!this.razorpayClient) {
      throw new InternalServerErrorException(
        'Razorpay payment gateway is not initialized with valid credentials.',
      );
    }

    try {
      // Create Razorpay Order server-side with authoritative total
      const rzpOrder = await this.razorpayClient.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: order.orderNumber,
        notes: {
          fleet24OrderId: order.id,
          orderNumber: order.orderNumber,
          customerId,
        },
      });

      // Transactionally update/create payment record
      await this.db.transaction(async (tx) => {
        if (existingPayment) {
          await tx
            .update(schema.payments)
            .set({
              provider: 'razorpay',
              providerOrderId: rzpOrder.id,
              amount: order.totalPayable,
              currency: 'INR',
              status: 'pending',
              updatedAt: new Date(),
            })
            .where(eq(schema.payments.id, existingPayment.id));
        } else {
          await tx.insert(schema.payments).values({
            orderId: order.id,
            provider: 'razorpay',
            providerOrderId: rzpOrder.id,
            amount: order.totalPayable,
            currency: 'INR',
            status: 'pending',
          });
        }
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        razorpayOrderId: rzpOrder.id,
        keyId: this.keyId,
        amount: amountInPaise,
        currency: 'INR',
        status: 'pending',
        checkoutUrl: `/api/v1/payments/checkout/${order.id}`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error creating Razorpay order for ${order.orderNumber}: ${msg}`);
      throw new InternalServerErrorException('Failed to create payment session with gateway.');
    }
  }

  /**
   * Verifies Razorpay Checkout signature and reconciles payment state with gateway
   */
  async verifyPayment(customerId: string, dto: VerifyPaymentDto): Promise<VerifyPaymentResult> {
    // 1. Locate payment by providerOrderId
    const payment = await this.db.query.payments.findFirst({
      where: eq(schema.payments.providerOrderId, dto.razorpayOrderId),
      with: {
        order: true,
      },
    });

    if (!payment || !payment.order) {
      throw new NotFoundException('No pending payment found for the provided Razorpay order ID.');
    }

    if (payment.order.customerId !== customerId) {
      throw new UnauthorizedException('Payment does not belong to the current authenticated customer.');
    }

    // Idempotency: If already captured, return verified state immediately without repeated side effects
    if (payment.status === 'captured' && payment.order.status !== 'pending_payment') {
      return {
        verified: true,
        orderId: payment.order.id,
        orderNumber: payment.order.orderNumber,
        orderStatus: payment.order.status,
        paymentId: payment.id,
        paymentStatus: payment.status,
        amount: payment.amount,
      };
    }

    // 2. Cryptographic signature check
    const isSignatureValid = this.verifyPaymentSignature(
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
    );

    if (!isSignatureValid) {
      this.logger.warn(
        `Payment signature verification failed for order ${payment.order.orderNumber}, paymentId ${dto.razorpayPaymentId}`,
      );

      // Record failed attempt on payment record if still pending
      await this.db
        .update(schema.payments)
        .set({
          providerPaymentId: dto.razorpayPaymentId,
          failedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.payments.id, payment.id));

      throw new BadRequestException('Invalid payment signature. Payment verification rejected.');
    }

    // 3. Optional gateway verification if client initialized
    if (this.razorpayClient) {
      try {
        const fetchedPayment = await this.razorpayClient.payments.fetch(dto.razorpayPaymentId);
        const expectedPaise = this.convertRupeesToPaise(payment.amount);

        if (fetchedPayment.amount !== expectedPaise || fetchedPayment.currency !== payment.currency) {
          this.logger.error(
            `Payment amount mismatch! Expected ${expectedPaise} ${payment.currency}, got ${fetchedPayment.amount} ${fetchedPayment.currency}`,
          );
          throw new BadRequestException('Payment amount or currency mismatch.');
        }

        if (fetchedPayment.order_id !== dto.razorpayOrderId) {
          throw new BadRequestException('Payment was not made for the associated order.');
        }
      } catch (err: unknown) {
        if (err instanceof BadRequestException) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Could not fetch payment directly from Razorpay: ${msg}`);
      }
    }

    // 4. Transactionally mark order as placed and payment as captured
    return this.db.transaction(async (tx) => {
      // Re-query with row-level safety
      const currentOrder = await tx.query.orders.findFirst({
        where: eq(schema.orders.id, payment.orderId),
      });

      if (!currentOrder) {
        throw new NotFoundException('Order record missing.');
      }

      // Check if order was cancelled while customer was paying
      if (currentOrder.status === 'cancelled') {
        this.logger.warn(`Order ${currentOrder.orderNumber} was cancelled before payment verification.`);
        await tx
          .update(schema.payments)
          .set({
            providerPaymentId: dto.razorpayPaymentId,
            status: 'captured', // Payment is captured at gateway, but order is cancelled -> eligible for refund
            paidAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.payments.id, payment.id));

        return {
          verified: true,
          orderId: currentOrder.id,
          orderNumber: currentOrder.orderNumber,
          orderStatus: currentOrder.status,
          paymentId: payment.id,
          paymentStatus: 'captured',
          amount: payment.amount,
        };
      }

      // Update payment
      await tx
        .update(schema.payments)
        .set({
          providerPaymentId: dto.razorpayPaymentId,
          status: 'captured',
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.payments.id, payment.id));

      // Advance order status from pending_payment -> placed
      await tx
        .update(schema.orders)
        .set({
          status: 'placed',
          updatedAt: new Date(),
        })
        .where(eq(schema.orders.id, currentOrder.id));

      // Log status transition
      await tx.insert(schema.orderStatusHistory).values({
        orderId: currentOrder.id,
        previousStatus: currentOrder.status,
        newStatus: 'placed',
        changedByUserId: customerId,
        reason: 'Payment verified via Razorpay Checkout signature',
      });

      return {
        verified: true,
        orderId: currentOrder.id,
        orderNumber: currentOrder.orderNumber,
        orderStatus: 'placed',
        paymentId: payment.id,
        paymentStatus: 'captured',
        amount: payment.amount,
      };
    });
  }

  /**
   * Idempotent webhook event processor using raw body signature verification
   */
  async handleWebhook(rawBody: string | Buffer, signature: string): Promise<{ received: boolean; reason?: string }> {
    // 1. Cryptographic webhook signature check
    const isSignatureValid = this.verifyWebhookSignature(rawBody, signature);
    if (!isSignatureValid) {
      this.logger.warn('Rejected webhook event: Invalid HMAC signature.');
      throw new UnauthorizedException('Invalid webhook signature.');
    }

    const payload = JSON.parse(rawBody.toString('utf8'));
    const eventId = payload.event_id || payload.payload?.payment?.entity?.id || `evt_${Date.now()}`;
    const eventType = payload.event;

    // 2. Event deduplication check
    const existingEvent = await this.db.query.paymentWebhookEvents.findFirst({
      where: eq(schema.paymentWebhookEvents.eventId, eventId),
    });

    if (existingEvent) {
      this.logger.log(`Webhook event ${eventId} (${eventType}) already processed. Acknowledging safely.`);
      return { received: true, reason: 'Duplicate event ignored' };
    }

    // 3. Process supported events
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = payload.payload?.payment?.entity;
      const rzpOrderId = paymentEntity?.order_id || payload.payload?.order?.entity?.id;
      const rzpPaymentId = paymentEntity?.id;

      if (rzpOrderId) {
        const payment = await this.db.query.payments.findFirst({
          where: eq(schema.payments.providerOrderId, rzpOrderId),
          with: { order: true },
        });

        if (payment && payment.status !== 'captured') {
          await this.db.transaction(async (tx) => {
            await tx
              .update(schema.payments)
              .set({
                providerPaymentId: rzpPaymentId || payment.providerPaymentId,
                status: 'captured',
                paidAt: new Date(),
                rawResponseMetadata: paymentEntity || null,
                updatedAt: new Date(),
              })
              .where(eq(schema.payments.id, payment.id));

            if (payment.order && payment.order.status === 'pending_payment') {
              await tx
                .update(schema.orders)
                .set({
                  status: 'placed',
                  updatedAt: new Date(),
                })
                .where(eq(schema.orders.id, payment.order.id));

              await tx.insert(schema.orderStatusHistory).values({
                orderId: payment.order.id,
                previousStatus: payment.order.status,
                newStatus: 'placed',
                changedByUserId: payment.order.customerId,
                reason: `Payment confirmed via webhook (${eventType})`,
              });
            }
          });
          this.logger.log(`Successfully reconciled payment and order via webhook: ${rzpOrderId}`);
        }
      }
    } else if (eventType === 'payment.failed') {
      const paymentEntity = payload.payload?.payment?.entity;
      const rzpOrderId = paymentEntity?.order_id;
      if (rzpOrderId) {
        const payment = await this.db.query.payments.findFirst({
          where: eq(schema.payments.providerOrderId, rzpOrderId),
        });

        // Never overwrite an already captured payment with a late failure event
        if (payment && payment.status !== 'captured') {
          await this.db
            .update(schema.payments)
            .set({
              status: 'failed',
              failedAt: new Date(),
              rawResponseMetadata: paymentEntity || null,
              updatedAt: new Date(),
            })
            .where(eq(schema.payments.id, payment.id));
          this.logger.log(`Recorded payment failure via webhook for order: ${rzpOrderId}`);
        }
      }
    } else if (eventType === 'refund.processed') {
      const refundEntity = payload.payload?.refund?.entity;
      const rzpPaymentId = refundEntity?.payment_id;
      const rzpRefundId = refundEntity?.id;

      if (rzpRefundId) {
        const existingRefund = await this.db.query.refunds.findFirst({
          where: eq(schema.refunds.providerRefundId, rzpRefundId),
          with: { payment: true },
        });

        if (existingRefund) {
          await this.db.transaction(async (tx) => {
            await tx
              .update(schema.refunds)
              .set({
                status: 'processed',
                updatedAt: new Date(),
              })
              .where(eq(schema.refunds.id, existingRefund.id));

            // Mark master payment as refunded
            await tx
              .update(schema.payments)
              .set({
                status: 'refunded',
                updatedAt: new Date(),
              })
              .where(eq(schema.payments.id, existingRefund.paymentId));
          });
          this.logger.log(`Marked refund processed via webhook: ${rzpRefundId}`);
        } else if (rzpPaymentId) {
          // If refund was triggered directly from Razorpay Dashboard
          const payment = await this.db.query.payments.findFirst({
            where: eq(schema.payments.providerPaymentId, rzpPaymentId),
          });
          if (payment) {
            const refundAmountRupees = (Number(refundEntity.amount || 0) / 100).toFixed(2);
            const webhookIdempotencyKey = `flt24_wh_${rzpRefundId}`;
            await this.db.transaction(async (tx) => {
              await tx.insert(schema.refunds).values({
                paymentId: payment.id,
                idempotencyKey: webhookIdempotencyKey,
                providerRefundId: rzpRefundId,
                amount: refundAmountRupees,
                reason: refundEntity.notes?.reason || 'Refund processed via gateway dashboard',
                status: 'processed',
              });
              await tx
                .update(schema.payments)
                .set({
                  status: 'refunded',
                  updatedAt: new Date(),
                })
                .where(eq(schema.payments.id, payment.id));
            });
            this.logger.log(`Created external processed refund record: ${rzpRefundId}`);
          }
        }
      }
    } else if (eventType === 'refund.failed') {
      const refundEntity = payload.payload?.refund?.entity;
      const rzpRefundId = refundEntity?.id;

      if (rzpRefundId) {
        await this.db
          .update(schema.refunds)
          .set({
            status: 'failed',
            updatedAt: new Date(),
          })
          .where(eq(schema.refunds.providerRefundId, rzpRefundId));
        this.logger.warn(`Marked refund failed via webhook: ${rzpRefundId}`);
      }
    }

    // 4. Record event in webhook deduplication table
    await this.db.insert(schema.paymentWebhookEvents).values({
      eventId,
      eventType,
      provider: 'razorpay',
      payload,
    });

    return { received: true };
  }

  /**
   * Dedicated, secure HTTPS client for Razorpay Refund API
   * Guarantees delivery of the official 'X-Refund-Idempotency' header.
   */
  async executeRazorpayRefundHttp(
    providerPaymentId: string,
    payload: { amount: number; notes: Record<string, any> },
    idempotencyKey: string,
  ): Promise<{ status: number; data: any }> {
    if (!this.keyId || !this.keySecret) {
      throw new InternalServerErrorException('Razorpay credentials not initialized.');
    }

    const postData = JSON.stringify(payload);
    const authHeader = 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

    return new Promise((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: 'api.razorpay.com',
        port: 443,
        path: `/v1/payments/${encodeURIComponent(providerPaymentId)}/refund`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': authHeader,
          'X-Refund-Idempotency': idempotencyKey,
          'User-Agent': 'Fleet24-Backend/1.0',
        },
        timeout: 15000, // 15 second request timeout
      };

      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });

        res.on('end', () => {
          let parsedData: any = null;
          try {
            parsedData = responseBody ? JSON.parse(responseBody) : {};
          } catch {
            parsedData = { raw: responseBody };
          }

          resolve({
            status: res.statusCode || 500,
            data: parsedData,
          });
        });
      });

      req.on('timeout', () => {
        req.destroy(new Error('ETIMEDOUT: Connection timed out'));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Initiates or reconciles an automated full refund against a captured payment.
   *
   * Enforces:
   * 1. Persistent Idempotency Key ('flt24_ref_...') adhering to Razorpay rules.
   * 2. Atomic Database Reservation using operationKey and row-locking to block concurrent duplicate requests.
   * 3. Sends official 'X-Refund-Idempotency' header over authenticated HTTPS.
   * 4. Categorized error handling: Ambiguous timeouts/5xx/409 remain 'pending' and preserve keys for safe retry.
   * 5. Active gateway reconciliation before retrying.
   */
  async initiateOrderRefund(
    orderId: string,
    reason: string,
    approvedByUserId?: string,
  ) {
    const operationKey = `full_refund_${orderId}`;

    // Step 1: Atomic Database Reservation inside a short transaction
    const reservation = await this.db.transaction(async (tx) => {
      // Lock the payment row to serialize concurrent refund requests for this order
      const [payment] = await tx
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.orderId, orderId))
        .for('update');

      if (!payment) {
        throw new NotFoundException(`No payment record found for order '${orderId}'.`);
      }

      if (payment.status !== 'captured') {
        throw new BadRequestException(
          `Payment is in '${payment.status}' status. Only captured payments can be refunded.`,
        );
      }

      if (!payment.providerPaymentId) {
        throw new BadRequestException(
          'Payment record is missing authoritative gateway providerPaymentId.',
        );
      }

      // Check if a refund record with this operationKey already exists
      const existingOperationRefund = await tx.query.refunds.findFirst({
        where: eq(schema.refunds.operationKey, operationKey),
      });

      if (existingOperationRefund) {
        // If already completed or in-flight, return the existing reservation
        return {
          isNew: false,
          refund: existingOperationRefund,
          payment,
        };
      }

      // Check cumulative non-failed refunds to prevent exceeding captured total
      const allRefunds = await tx.query.refunds.findMany({
        where: eq(schema.refunds.paymentId, payment.id),
      });
      const nonFailedRefunds = allRefunds.filter((r) => r.status !== 'failed');
      const totalRefundedAlready = nonFailedRefunds.reduce(
        (sum, r) => sum + parseFloat(r.amount),
        0,
      );
      const capturedAmount = parseFloat(payment.amount);
      const remainingRefundable = Math.max(0, capturedAmount - totalRefundedAlready);

      if (remainingRefundable <= 0) {
        const activeRefund = nonFailedRefunds[0];
        return {
          isNew: false,
          refund: activeRefund,
          payment,
        };
      }

      // Generate a persistent, stable idempotency key [A-Za-z0-9_-]{10,}
      const randomPart = crypto.randomBytes(12).toString('hex');
      const idempotencyKey = `flt24_ref_${randomPart}`;

      const refundAmountPaise = this.convertRupeesToPaise(remainingRefundable);
      const requestPayload = {
        amount: refundAmountPaise,
        notes: {
          fleet24OrderId: orderId,
          reason: reason || 'Customer order cancelled or rejected by restaurant',
          operationKey,
        },
      };

      // Atomically persist the pending refund reservation
      const [newRefund] = await tx
        .insert(schema.refunds)
        .values({
          paymentId: payment.id,
          operationKey,
          idempotencyKey,
          amount: remainingRefundable.toFixed(2),
          reason: reason || 'Customer order cancelled or rejected by restaurant',
          status: 'pending',
          requestPayload,
          attemptCount: '1',
          lastAttemptAt: new Date(),
          approvedByUserId: approvedByUserId || null,
        })
        .returning();

      return {
        isNew: true,
        refund: newRefund,
        payment,
      };
    });

    const { refund: currentRefund, payment } = reservation;

    // If another concurrent thread or previous operation already completed or is in-flight:
    if (!reservation.isNew) {
      if (currentRefund.status === 'processed') {
        return {
          refundId: currentRefund.id,
          providerRefundId: currentRefund.providerRefundId,
          paymentId: payment.id,
          amount: currentRefund.amount,
          status: currentRefund.status,
          message: 'Order payment is already fully refunded.',
        };
      }

      // If active gateway reconciliation can determine if refund was already accepted:
      if (this.razorpayClient) {
        try {
          const multiple = await this.razorpayClient.payments.fetchMultipleRefund(
            payment.providerPaymentId,
          );
          const existingGatewayRefund = multiple?.items?.find(
            (item: any) =>
              item.notes?.operationKey === operationKey ||
              item.notes?.fleet24OrderId === orderId ||
              (currentRefund.providerRefundId && item.id === currentRefund.providerRefundId),
          );

          if (existingGatewayRefund) {
            const gatewayStatus =
              existingGatewayRefund.status === 'processed' ? 'processed' : 'pending';

            await this.db.transaction(async (tx) => {
              await tx
                .update(schema.refunds)
                .set({
                  providerRefundId: existingGatewayRefund.id,
                  status: gatewayStatus,
                  updatedAt: new Date(),
                })
                .where(eq(schema.refunds.id, currentRefund.id));

              if (gatewayStatus === 'processed') {
                await tx
                  .update(schema.payments)
                  .set({ status: 'refunded', updatedAt: new Date() })
                  .where(eq(schema.payments.id, payment.id));
              }
            });

            return {
              refundId: currentRefund.id,
              providerRefundId: existingGatewayRefund.id,
              paymentId: payment.id,
              amount: currentRefund.amount,
              status: gatewayStatus,
              message: `Reconciled with existing gateway refund ${existingGatewayRefund.id}.`,
            };
          }
        } catch (reconErr) {
          this.logger.warn(`Gateway reconciliation check failed, continuing with retry: ${reconErr}`);
        }
      }

      // If already has providerRefundId and wasn't processed, keep pending
      if (currentRefund.providerRefundId) {
        return {
          refundId: currentRefund.id,
          providerRefundId: currentRefund.providerRefundId,
          paymentId: payment.id,
          amount: currentRefund.amount,
          status: currentRefund.status,
          message: 'Refund operation is already pending on gateway.',
        };
      }

      // If another concurrent request just created this pending reservation within the last 30 seconds
      // and hasn't finished calling the gateway, do not issue a duplicate concurrent gateway call:
      const attemptAgeSeconds = currentRefund.lastAttemptAt
        ? (Date.now() - new Date(currentRefund.lastAttemptAt).getTime()) / 1000
        : 0;

      if (attemptAgeSeconds < 30 && Number(currentRefund.attemptCount || 1) <= 1) {
        return {
          refundId: currentRefund.id,
          providerRefundId: currentRefund.providerRefundId,
          paymentId: payment.id,
          amount: currentRefund.amount,
          status: currentRefund.status,
          message: 'Refund operation is currently being dispatched by a concurrent request.',
        };
      }
    }

    // Step 3: Call Razorpay API outside long-running database transaction with X-Refund-Idempotency
    const payload = (currentRefund.requestPayload as any) || {
      amount: this.convertRupeesToPaise(parseFloat(currentRefund.amount)),
      notes: {
        fleet24OrderId: orderId,
        reason: currentRefund.reason,
        operationKey,
      },
    };

    const idempotencyKey = currentRefund.idempotencyKey;
    const providerPaymentId = payment.providerPaymentId!;

    try {
      const response = await this.executeRazorpayRefundHttp(
        providerPaymentId,
        payload,
        idempotencyKey,
      );

      const statusCode = response.status;
      const resData = response.data;

      // Category A: Confirmed Success or Accepted Refund (200 - 299)
      if (statusCode >= 200 && statusCode < 300 && resData?.id) {
        const providerStatus = resData.status === 'processed' ? 'processed' : 'pending';

        await this.db.transaction(async (tx) => {
          await tx
            .update(schema.refunds)
            .set({
              providerRefundId: resData.id,
              status: providerStatus,
              lastAttemptAt: new Date(),
              lastErrorCode: null,
              lastErrorMessage: null,
              updatedAt: new Date(),
            })
            .where(eq(schema.refunds.id, currentRefund.id));

          if (providerStatus === 'processed') {
            await tx
              .update(schema.payments)
              .set({
                status: 'refunded',
                updatedAt: new Date(),
              })
              .where(eq(schema.payments.id, payment.id));
          }
        });

        this.logger.log(
          `Initiated Razorpay refund ${resData.id} (${providerStatus}) with idempotency key ${idempotencyKey}`,
        );

        return {
          refundId: currentRefund.id,
          providerRefundId: resData.id,
          paymentId: payment.id,
          amount: currentRefund.amount,
          status: providerStatus,
          message: `Refund successfully initiated with gateway (status: ${providerStatus}).`,
        };
      }

      // Category B: 408 Request Timeout / 429 Rate Limit (Ambiguous/Transient - keep pending for retry)
      if (statusCode === 408 || statusCode === 429) {
        const retryAfter = (resData && resData.retry_after) || 5;
        this.logger.warn(`Razorpay transient HTTP ${statusCode} for payment ${payment.providerPaymentId}. Preserving pending state.`);
        await this.db
          .update(schema.refunds)
          .set({
            status: 'pending',
            lastAttemptAt: new Date(),
            lastErrorCode: statusCode === 429 ? 'RATE_LIMITED_429' : 'REQUEST_TIMEOUT_408',
            lastErrorMessage: resData?.error?.description || `HTTP ${statusCode} Transient Gateway Condition. Retry after ${retryAfter}s`,
            attemptCount: sql`${schema.refunds.attemptCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(schema.refunds.id, currentRefund.id));

        return {
          refundId: currentRefund.id,
          providerRefundId: currentRefund.providerRefundId,
          paymentId: payment.id,
          amount: currentRefund.amount,
          status: 'pending',
          message: `Refund operation transiently rate limited or timed out (HTTP ${statusCode}). Queued for retry.`,
        };
      }

      // Category B: 409 Conflict (Request is currently processing on gateway)
      if (statusCode === 409) {
        this.logger.warn(`Razorpay 409 Conflict for payment ${payment.providerPaymentId}: In-progress.`);
        await this.db
          .update(schema.refunds)
          .set({
            status: 'pending',
            lastAttemptAt: new Date(),
            lastErrorCode: '409_CONFLICT_PROCESSING',
            lastErrorMessage: resData?.error?.description || 'Refund currently in progress on gateway',
            attemptCount: sql`${schema.refunds.attemptCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(schema.refunds.id, currentRefund.id));

        return {
          refundId: currentRefund.id,
          providerRefundId: currentRefund.providerRefundId,
          paymentId: payment.id,
          amount: currentRefund.amount,
          status: 'pending',
          message: 'Refund is currently processing at the payment gateway.',
        };
      }

      // Category B: Gateway 5xx Ambiguous Outcomes
      if (statusCode >= 500) {
        const errMsg = resData?.error?.description || `HTTP ${statusCode} Gateway Error`;
        this.logger.warn(`Ambiguous Gateway 5xx error for payment ${payment.providerPaymentId}: ${errMsg}`);

        await this.db
          .update(schema.refunds)
          .set({
            status: 'pending', // NEVER mark as failed on 5xx
            lastAttemptAt: new Date(),
            lastErrorCode: `GATEWAY_5XX_${statusCode}`,
            lastErrorMessage: errMsg,
            attemptCount: sql`${schema.refunds.attemptCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(schema.refunds.id, currentRefund.id));

        return {
          refundId: currentRefund.id,
          providerRefundId: null,
          paymentId: payment.id,
          amount: currentRefund.amount,
          status: 'pending',
          message: 'Refund request encountered a gateway timeout. Preserved as pending for automatic reconciliation.',
        };
      }

      // Category C: Authentication or Permissions Failure (401/403)
      if (statusCode === 401 || statusCode === 403) {
        const authErrMsg = resData?.error?.description || 'Gateway authentication or permission error';
        this.logger.error(`Razorpay Authentication / Authorization failure (${statusCode}): ${authErrMsg}`);
        await this.db
          .update(schema.refunds)
          .set({
            status: 'failed',
            lastAttemptAt: new Date(),
            lastErrorCode: `GATEWAY_AUTH_${statusCode}`,
            lastErrorMessage: authErrMsg,
            attemptCount: sql`${schema.refunds.attemptCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(schema.refunds.id, currentRefund.id));

        throw new BadRequestException(`Gateway credential error: ${authErrMsg}`);
      }

      // Category C: Definitive Rejection (400 Bad Request, un-refundable, invalid state)
      const clientErrMsg = resData?.error?.description || JSON.stringify(resData);
      this.logger.error(`Definitive Razorpay refund rejection (HTTP ${statusCode}): ${clientErrMsg}`);

      await this.db
        .update(schema.refunds)
        .set({
          status: 'failed',
          lastAttemptAt: new Date(),
          lastErrorCode: resData?.error?.code || `HTTP_${statusCode}`,
          lastErrorMessage: clientErrMsg,
          attemptCount: sql`${schema.refunds.attemptCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.refunds.id, currentRefund.id));

      throw new BadRequestException(`Razorpay refund rejected: ${clientErrMsg}`);
    } catch (networkErr: unknown) {
      // Category B: Ambiguous Network Timeout / Connection Drop
      if (networkErr instanceof BadRequestException) {
        throw networkErr; // Rethrow definitive rejections
      }

      const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
      const errorCode = (networkErr as any)?.code || 'NETWORK_TIMEOUT';
      this.logger.warn(
        `Ambiguous network failure during refund for payment ${payment.providerPaymentId}: ${errorCode} - ${msg}. Preserving as pending.`,
      );

      await this.db
        .update(schema.refunds)
        .set({
          status: 'pending', // PRESERVE AS PENDING
          lastAttemptAt: new Date(),
          lastErrorCode: errorCode,
          lastErrorMessage: msg,
          attemptCount: sql`${schema.refunds.attemptCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.refunds.id, currentRefund.id));

      return {
        refundId: currentRefund.id,
        providerRefundId: null,
        paymentId: payment.id,
        amount: currentRefund.amount,
        status: 'pending',
        message: 'Network timeout encountered. Refund preserved in pending status for reconciliation.',
      };
    }
  }

  /**
   * Retrieves order payment details for safe checkout rendering
   */
  async getOrderForCheckout(orderId: string) {
    const order = await this.db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
      with: {
        outlet: {
          with: {
            restaurant: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    const payment = await this.db.query.payments.findFirst({
      where: eq(schema.payments.orderId, order.id),
    });

    return {
      order,
      payment,
      keyId: this.keyId,
      amountInPaise: this.convertRupeesToPaise(order.totalPayable),
    };
  }
}
