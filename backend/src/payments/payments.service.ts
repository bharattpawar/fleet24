import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, ne, and, inArray, sql } from 'drizzle-orm';
import * as crypto from 'crypto';
import * as https from 'https';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Razorpay = require('razorpay');
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { TrackingPublisherService } from '../tracking/tracking-publisher.service';
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
  isConflict?: boolean;
}

export interface FinalizeCapturedPaymentParams {
  orderId: string;
  paymentId: string;
  providerPaymentId: string;
  rawGatewayMetadata?: any;
  source: 'client_verify' | 'webhook';
}

export interface FinalizeCapturedPaymentResult {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  paymentId: string;
  paymentStatus: string;
  amount: string;
  isConflict: boolean;
  orderToNotify: {
    orderId: string;
    orderNumber: string;
    outletId: string;
    createdAt: string;
    itemCount: number;
    totalAmount: string;
    currency: string;
    items?: Array<{ name: string; quantity: number }>;
  } | null;
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
    @Inject(TrackingPublisherService)
    private readonly trackingPublisher?: TrackingPublisherService,
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

    // Advisory Guard: A customer cannot open or retry payment for a different order while another order is actively being fulfilled.
    // Legitimate retries for the SAME pending order are preserved.
    const [activeFulfillmentOrder] = await this.db
      .select({
        id: schema.orders.id,
        orderNumber: schema.orders.orderNumber,
        status: schema.orders.status,
      })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.customerId, customerId),
          ne(schema.orders.id, order.id),
          inArray(schema.orders.status, [...schema.ACTIVE_FULFILLMENT_ORDER_STATUSES]),
        ),
      )
      .limit(1);

    if (activeFulfillmentOrder) {
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        code: 'ACTIVE_ORDER_IN_PROGRESS',
        message: `You already have an active order #${activeFulfillmentOrder.orderNumber} (${activeFulfillmentOrder.status}). You cannot initiate payment for another order until your active order is delivered or cancelled.`,
        activeOrder: {
          id: activeFulfillmentOrder.id,
          orderNumber: activeFulfillmentOrder.orderNumber,
          status: activeFulfillmentOrder.status,
        },
      });
    }

    const amountInPaise = this.convertRupeesToPaise(order.totalPayable);

    // Check if a payment record already exists for this order
    const existingPayment = await this.db.query.payments.findFirst({
      where: eq(schema.payments.orderId, order.id),
    });

    if (existingPayment?.status === 'captured') {
      throw new BadRequestException('Payment is already captured. Refresh your order.');
    }

    // Keep the provider order available for a delayed capture webhook.
    if (existingPayment?.providerOrderId) {
      if (!this.razorpayClient) {
        throw new InternalServerErrorException('Razorpay payment gateway is unavailable.');
      }
      const remoteOrder = await this.razorpayClient.orders.fetch(existingPayment.providerOrderId)
        .catch(() => { throw new BadRequestException('Could not check the previous payment. Please try again shortly.'); });
      if (remoteOrder.status === 'paid') {
        throw new BadRequestException('Payment is being confirmed. Refresh your order shortly.');
      }

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
   * Authoritative, centralized transaction-safe finalization gate for captured payments.
   *
   * Shared by:
   * 1. Client payment verification (verifyPayment)
   * 2. Signed webhook processing (handleWebhook - payment.captured, order.paid)
   *
   * Enforces:
   * - Verification / gateway calls outside the transaction.
   * - PostgreSQL customer-level locking (users FOR UPDATE) to serialize finalization per customer.
   * - In-transaction re-reading of payment and order records.
   * - Exact-once idempotency if already finalized.
   * - Checks for another active fulfillment order across:
   *   ['placed', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery']
   * - If no conflict: promotes order from 'pending_payment' -> 'placed', records status history.
   * - If conflict:
   *   - Preserves existing active order.
   *   - Keeps payment status as 'captured' with full provider evidence.
   *   - Sets conflicting order status to 'payment_conflict'.
   *   - Populates payment_conflict_details JSONB with structured metadata.
   *   - Inserts orderStatusHistory and auditLogs record.
   *   - Never marks payment failed, never auto-refunds, never creates deliveries or dispatches order.
   * - Recovers safely from PostgreSQL error 23505 (partial unique index collision) by moving to payment_conflict.
   * - Emits operational WebSocket notifications only after transaction commits successfully and only for 'placed' orders.
   */
  async finalizeCapturedPayment(
    params: FinalizeCapturedPaymentParams,
  ): Promise<FinalizeCapturedPaymentResult> {
    const { orderId, paymentId, providerPaymentId, rawGatewayMetadata, source } = params;

    let orderToNotify: FinalizeCapturedPaymentResult['orderToNotify'] = null;

    const result = await this.db.transaction(async (tx) => {
      // 1. In-transaction re-read of the order to identify owning customer
      const initialOrder = await tx.query.orders.findFirst({
        where: eq(schema.orders.id, orderId),
      });

      if (!initialOrder) {
        throw new NotFoundException(`Order record '${orderId}' missing during payment finalization.`);
      }

      // 2. Row-level customer lock (users FOR UPDATE) to serialize all concurrent checkout and payment finalizations
      const [lockedCustomer] = await tx
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.id, initialOrder.customerId))
        .for('update');

      if (!lockedCustomer) {
        throw new NotFoundException(`Owning customer '${initialOrder.customerId}' not found.`);
      }

      // 3. Re-read payment and order records under the customer lock
      const currentOrder = await tx.query.orders.findFirst({
        where: eq(schema.orders.id, orderId),
        with: {
          items: true,
        },
      });

      if (!currentOrder) {
        throw new NotFoundException(`Order record '${orderId}' missing under transaction lock.`);
      }

      const currentPayment = await tx.query.payments.findFirst({
        where: eq(schema.payments.id, paymentId),
      });

      if (!currentPayment) {
        throw new NotFoundException(`Payment record '${paymentId}' missing under transaction lock.`);
      }

      // 4. Idempotency Check: Already captured and finalized (or already in payment_conflict)
      if (
        currentPayment.status === 'captured' &&
        currentOrder.status !== 'pending_payment'
      ) {
        this.logger.log(
          `Payment ${paymentId} for order ${currentOrder.orderNumber} already finalized in status '${currentOrder.status}'. Returning idempotent state.`,
        );
        return {
          orderId: currentOrder.id,
          orderNumber: currentOrder.orderNumber,
          orderStatus: currentOrder.status,
          paymentId: currentPayment.id,
          paymentStatus: currentPayment.status,
          amount: currentPayment.amount,
          isConflict: currentOrder.status === 'payment_conflict',
          orderToNotify: null,
        };
      }

      // Check if order was cancelled/rejected before payment confirmation
      if (currentOrder.status === 'cancelled' || currentOrder.status === 'rejected') {
        this.logger.warn(
          `Order ${currentOrder.orderNumber} was '${currentOrder.status}' prior to payment capture finalization. Preserving captured payment for refund review.`,
        );
        await tx
          .update(schema.payments)
          .set({
            providerPaymentId: providerPaymentId || currentPayment.providerPaymentId,
            status: 'captured',
            paidAt: currentPayment.paidAt || new Date(),
            rawResponseMetadata: rawGatewayMetadata || currentPayment.rawResponseMetadata || null,
            updatedAt: new Date(),
          })
          .where(eq(schema.payments.id, currentPayment.id));

        return {
          orderId: currentOrder.id,
          orderNumber: currentOrder.orderNumber,
          orderStatus: currentOrder.status,
          paymentId: currentPayment.id,
          paymentStatus: 'captured',
          amount: currentPayment.amount,
          isConflict: false,
          orderToNotify: null,
        };
      }

      // 5. Always persist the provider-confirmed payment capture evidence
      await tx
        .update(schema.payments)
        .set({
          providerPaymentId: providerPaymentId || currentPayment.providerPaymentId,
          status: 'captured',
          paidAt: currentPayment.paidAt || new Date(),
          rawResponseMetadata: rawGatewayMetadata || currentPayment.rawResponseMetadata || null,
          updatedAt: new Date(),
        })
        .where(eq(schema.payments.id, currentPayment.id));

      // 6. Check for another active fulfillment order for this customer
      const [conflictingActiveOrder] = await tx
        .select({
          id: schema.orders.id,
          orderNumber: schema.orders.orderNumber,
          status: schema.orders.status,
          placedAt: schema.orders.placedAt,
          totalPayable: schema.orders.totalPayable,
        })
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.customerId, currentOrder.customerId),
            ne(schema.orders.id, currentOrder.id),
            inArray(schema.orders.status, [...schema.ACTIVE_FULFILLMENT_ORDER_STATUSES]),
          ),
        )
        .limit(1);

      // Helper closure to mark this order in payment_conflict
      const recordPaymentConflict = async (
        conflictingActive: {
          id: string;
          orderNumber: string;
          status: string;
          placedAt?: Date | null;
          totalPayable?: string;
        } | null,
        reason: string,
      ) => {
        const conflictDetails = {
          conflictType: 'duplicate_active_fulfillment',
          detectedAt: new Date().toISOString(),
          detectionSource: source,
          capturedPaymentId: currentPayment.id,
          providerPaymentId: providerPaymentId || currentPayment.providerPaymentId,
          capturedAmount: currentPayment.amount,
          currency: currentPayment.currency,
          conflictingActiveOrder: conflictingActive
            ? {
                id: conflictingActive.id,
                orderNumber: conflictingActive.orderNumber,
                status: conflictingActive.status,
                placedAt: conflictingActive.placedAt ? new Date(conflictingActive.placedAt).toISOString() : null,
              }
            : null,
          resolutionStatus: 'pending_admin_review',
          resolutionNotes: reason,
        };

        const [conflictOrder] = await tx
          .update(schema.orders)
          .set({
            status: 'payment_conflict',
            paymentConflictDetails: conflictDetails,
            updatedAt: new Date(),
          })
          .where(eq(schema.orders.id, currentOrder.id))
          .returning();

        await tx.insert(schema.orderStatusHistory).values({
          orderId: currentOrder.id,
          previousStatus: currentOrder.status,
          newStatus: 'payment_conflict',
          changedByUserId: currentOrder.customerId,
          reason,
        });

        // Insert auditable log
        await tx.insert(schema.auditLogs).values({
          action: 'payment_conflict_detected',
          entityType: 'order',
          entityId: currentOrder.id,
          performedByUserId: currentOrder.customerId,
          details: conflictDetails,
        });

        this.logger.warn(
          `Payment conflict recorded for order ${currentOrder.orderNumber}: ${reason}. Payment ${currentPayment.id} preserved as captured.`,
        );

        return {
          orderId: conflictOrder.id,
          orderNumber: conflictOrder.orderNumber,
          orderStatus: 'payment_conflict',
          paymentId: currentPayment.id,
          paymentStatus: 'captured',
          amount: currentPayment.amount,
          isConflict: true,
          orderToNotify: null,
        };
      };

      if (conflictingActiveOrder) {
        return await recordPaymentConflict(
          conflictingActiveOrder,
          `Customer already has an active order #${conflictingActiveOrder.orderNumber} (${conflictingActiveOrder.status}) in fulfillment.`,
        );
      }

      // 7. No conflict detected: Advance order from pending_payment -> placed
      try {
        const [placedOrder] = await tx
          .update(schema.orders)
          .set({
            status: 'placed',
            updatedAt: new Date(),
          })
          .where(and(eq(schema.orders.id, currentOrder.id), eq(schema.orders.status, 'pending_payment')))
          .returning({ id: schema.orders.id });

        if (placedOrder) {
          await tx.insert(schema.orderStatusHistory).values({
            orderId: currentOrder.id,
            previousStatus: 'pending_payment',
            newStatus: 'placed',
            changedByUserId: currentOrder.customerId,
            reason: `Payment capture verified via ${source}`,
          });

          const safeItems = currentOrder.items
            ? currentOrder.items.map((i: any) => ({
                name: i.nameSnapshot || i.name || 'Item',
                quantity: i.quantity || 1,
              }))
            : [];

          orderToNotify = {
            orderId: currentOrder.id,
            orderNumber: currentOrder.orderNumber,
            outletId: currentOrder.outletId,
            createdAt: currentOrder.createdAt
              ? new Date(currentOrder.createdAt).toISOString()
              : new Date().toISOString(),
            itemCount:
              safeItems.reduce((acc: number, curr: any) => acc + curr.quantity, 0) || safeItems.length,
            totalAmount: currentOrder.totalPayable,
            currency: 'INR',
            items: safeItems,
          };
        }

        const finalOrder = await tx.query.orders.findFirst({
          where: eq(schema.orders.id, currentOrder.id),
        });

        return {
          orderId: currentOrder.id,
          orderNumber: currentOrder.orderNumber,
          orderStatus: placedOrder ? 'placed' : finalOrder?.status ?? currentOrder.status,
          paymentId: currentPayment.id,
          paymentStatus: 'captured',
          amount: currentPayment.amount,
          isConflict: false,
          orderToNotify,
        };
      } catch (dbErr: any) {
        // Inspect for PostgreSQL error 23505 (unique_violation)
        // If orders_single_active_per_customer_idx collided, safely recover to payment_conflict
        const isUniqueViolation = dbErr?.code === '23505' || dbErr?.routine === 'nbtinsert';
        const isSingleActiveIdx =
          typeof dbErr?.message === 'string' &&
          dbErr.message.includes('orders_single_active_per_customer_idx');

        if (isUniqueViolation && isSingleActiveIdx) {
          this.logger.warn(
            `PostgreSQL 23505 unique violation on orders_single_active_per_customer_idx caught for order ${currentOrder.orderNumber}. Transitioning safely to payment_conflict.`,
          );
          return await recordPaymentConflict(
            null,
            'Concurrent transaction committed an active fulfillment order (PostgreSQL 23505 unique index guard triggered).',
          );
        }

        // Unrelated database error: do not swallow
        throw dbErr;
      }
    });

    // 8. Post-commit notification dispatch (Guaranteed only after DB transaction commits successfully and only if placed)
    if (result.orderToNotify && this.trackingPublisher) {
      try {
        this.trackingPublisher.publishOrderCreated(result.orderToNotify.outletId, {
          ...result.orderToNotify,
          status: 'placed',
        });
      } catch (err: any) {
        this.logger.error(
          `Failed to publish order.created event for ${result.orderToNotify.orderNumber}: ${err.message}`,
        );
      }
    }

    return result;
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

    // Idempotency: If already captured and finalized, return verified state immediately without repeated side effects
    if (payment.status === 'captured' && payment.order.status !== 'pending_payment') {
      return {
        verified: true,
        orderId: payment.order.id,
        orderNumber: payment.order.orderNumber,
        orderStatus: payment.order.status,
        paymentId: payment.id,
        paymentStatus: payment.status,
        amount: payment.amount,
        isConflict: payment.order.status === 'payment_conflict',
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
        .where(and(eq(schema.payments.id, payment.id), ne(schema.payments.status, 'captured')));

      throw new BadRequestException('Invalid payment signature. Payment verification rejected.');
    }

    if (!this.razorpayClient) {
      throw new BadRequestException('Payment verification is unavailable.');
    }

    // 3. Provider verification performed outside database transaction
    const fetchedPayment = await this.razorpayClient.payments
      .fetch(dto.razorpayPaymentId)
      .catch(() => {
        throw new BadRequestException('Could not confirm payment with Razorpay.');
      });

    if (
      fetchedPayment.amount !== this.convertRupeesToPaise(payment.amount) ||
      fetchedPayment.currency !== payment.currency ||
      fetchedPayment.order_id !== dto.razorpayOrderId
    ) {
      throw new BadRequestException('Payment details do not match the order.');
    }

    if (fetchedPayment.status === 'authorized') {
      return {
        verified: false,
        orderId: payment.orderId,
        orderNumber: payment.order.orderNumber,
        orderStatus: payment.order.status,
        paymentId: payment.id,
        paymentStatus: 'pending',
        amount: payment.amount,
        isConflict: false,
      };
    }

    if (fetchedPayment.status !== 'captured') {
      throw new BadRequestException('Razorpay has not captured this payment.');
    }

    // 4. Delegate to the centralized, transaction-safe finalization gate
    const finalized = await this.finalizeCapturedPayment({
      orderId: payment.order.id,
      paymentId: payment.id,
      providerPaymentId: dto.razorpayPaymentId,
      rawGatewayMetadata: fetchedPayment,
      source: 'client_verify',
    });

    return {
      verified: true,
      orderId: finalized.orderId,
      orderNumber: finalized.orderNumber,
      orderStatus: finalized.orderStatus,
      paymentId: finalized.paymentId,
      paymentStatus: finalized.paymentStatus,
      amount: finalized.amount,
      isConflict: finalized.isConflict,
    };
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
    const eventType = payload.event;
    const entityId = payload.payload?.payment?.entity?.id || payload.payload?.order?.entity?.id;
    const eventId = payload.event_id || (entityId ? `${eventType}:${entityId}` : `evt_${Date.now()}`);

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

      const captureReported = eventType === 'payment.captured'
        ? paymentEntity?.status === 'captured'
        : payload.payload?.order?.entity?.status === 'paid';

      if (rzpOrderId && captureReported) {
        const payment = await this.db.query.payments.findFirst({
          where: eq(schema.payments.providerOrderId, rzpOrderId),
          with: { order: true },
        });

        if (
          payment &&
          (!paymentEntity ||
            (paymentEntity.amount === this.convertRupeesToPaise(payment.amount) &&
              paymentEntity.currency === payment.currency))
        ) {
          if (payment.order) {
            await this.finalizeCapturedPayment({
              orderId: payment.order.id,
              paymentId: payment.id,
              providerPaymentId: rzpPaymentId || payment.providerPaymentId || '',
              rawGatewayMetadata: paymentEntity || null,
              source: 'webhook',
            });
            this.logger.log(`Successfully reconciled payment and order via webhook: ${rzpOrderId}`);
          }
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
            .where(and(eq(schema.payments.id, payment.id), ne(schema.payments.status, 'captured')));
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

            // If order was in payment_conflict, transition to cancelled
            const paymentOrderId = existingRefund.payment?.orderId || (await tx.query.payments.findFirst({
              where: eq(schema.payments.id, existingRefund.paymentId),
            }))?.orderId;

            if (paymentOrderId) {
              const targetOrder = await tx.query.orders.findFirst({
                where: eq(schema.orders.id, paymentOrderId),
              });
              if (targetOrder && targetOrder.status === 'payment_conflict') {
                const existingDetails = (targetOrder.paymentConflictDetails as any) || {};
                await tx
                  .update(schema.orders)
                  .set({
                    status: 'cancelled',
                    cancellationReason: 'Payment conflict fully refunded to customer (webhook)',
                    cancelledAt: new Date(),
                    paymentConflictDetails: {
                      ...existingDetails,
                      resolutionStatus: 'refund_processed',
                      resolvedAt: new Date().toISOString(),
                    },
                    updatedAt: new Date(),
                  })
                  .where(eq(schema.orders.id, targetOrder.id));

                await tx.insert(schema.orderStatusHistory).values({
                  orderId: targetOrder.id,
                  previousStatus: 'payment_conflict',
                  newStatus: 'cancelled',
                  reason: 'Full refund confirmed via webhook',
                  changedByUserId: existingRefund.approvedByUserId || null,
                });
              }
            }
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
    }).onConflictDoNothing({ target: schema.paymentWebhookEvents.eventId });

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
   * Internal routine to execute an atomic refund reservation inside a given or new transaction client.
   * Allows caller transactions (such as AdminOperationsService.approvePaymentConflictRefund)
   * to atomically combine order validation, metadata updates, audit logs, and refund reservation.
   */
  async reserveRefundInTransaction(
    tx: any,
    orderId: string,
    reason: string,
    approvedByUserId?: string,
  ) {
    const operationKey = `full_refund_${orderId}`;

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
    const nonFailedRefunds = allRefunds.filter((r: any) => r.status !== 'failed');
    const totalRefundedAlready = nonFailedRefunds.reduce(
      (sum: number, r: any) => sum + parseFloat(r.amount),
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
  }

  /**
   * Executes Razorpay HTTP refund API call outside database transaction using a pre-reserved refund row.
   */
  async executeReservedRefund(reservation: {
    isNew: boolean;
    refund: any;
    payment: any;
  }) {
    const { refund: currentRefund, payment } = reservation;
    const orderId = payment.orderId;
    const operationKey = currentRefund.operationKey || `full_refund_${orderId}`;

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

                const targetOrder = await tx.query.orders.findFirst({
                  where: eq(schema.orders.id, payment.orderId),
                });
                if (targetOrder && targetOrder.status === 'payment_conflict') {
                  const existingDetails = (targetOrder.paymentConflictDetails as any) || {};
                  await tx
                    .update(schema.orders)
                    .set({
                      status: 'cancelled',
                      cancellationReason: 'Payment conflict fully refunded to customer',
                      cancelledAt: new Date(),
                      paymentConflictDetails: {
                        ...existingDetails,
                        resolutionStatus: 'refund_processed',
                        resolvedAt: new Date().toISOString(),
                      },
                      updatedAt: new Date(),
                    })
                    .where(eq(schema.orders.id, targetOrder.id));

                  await tx.insert(schema.orderStatusHistory).values({
                    orderId: targetOrder.id,
                    previousStatus: 'payment_conflict',
                    newStatus: 'cancelled',
                    reason: 'Full refund confirmed by payment gateway',
                    changedByUserId: currentRefund.approvedByUserId || null,
                  });
                }
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

    // Call Razorpay API outside database transaction with X-Refund-Idempotency
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

            // If the order was in payment_conflict, transition order to cancelled once full refund is confirmed
            const targetOrder = await tx.query.orders.findFirst({
              where: eq(schema.orders.id, payment.orderId),
            });
            if (targetOrder && targetOrder.status === 'payment_conflict') {
              const existingDetails = (targetOrder.paymentConflictDetails as any) || {};
              await tx
                .update(schema.orders)
                .set({
                  status: 'cancelled',
                  cancellationReason: 'Payment conflict fully refunded to customer',
                  cancelledAt: new Date(),
                  paymentConflictDetails: {
                    ...existingDetails,
                    resolutionStatus: 'refund_processed',
                    resolvedAt: new Date().toISOString(),
                  },
                  updatedAt: new Date(),
                })
                .where(eq(schema.orders.id, targetOrder.id));

              await tx.insert(schema.orderStatusHistory).values({
                orderId: targetOrder.id,
                previousStatus: 'payment_conflict',
                newStatus: 'cancelled',
                reason: 'Full refund confirmed by payment gateway',
                changedByUserId: currentRefund.approvedByUserId || null,
              });
            }
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
   * Initiates or reconciles an automated full refund against a captured payment.
   */
  async initiateOrderRefund(
    orderId: string,
    reason: string,
    approvedByUserId?: string,
  ) {
    const reservation = await this.db.transaction(async (tx) => {
      return this.reserveRefundInTransaction(tx, orderId, reason, approvedByUserId);
    });

    return this.executeReservedRefund(reservation);
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
