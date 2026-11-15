import {
  Injectable,
  Inject,
  Logger,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { PaymentsService } from './payments.service';

export interface ReconciliationBatchSummary {
  totalClaimed: number;
  processed: number;
  pending: number;
  failed: number;
  manualReviewRequired: number;
}

@Injectable()
export class RefundReconciliationService {
  private readonly logger = new Logger(RefundReconciliationService.name);

  // Maximum automatic retry attempts before marking for manual review
  private readonly MAX_RETRY_ATTEMPTS = 5;

  // Bounded exponential backoff in seconds: 1m, 2m, 4m, 8m, 16m
  private readonly BACKOFF_INTERVALS_SECONDS = [60, 120, 240, 480, 960];

  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * Calculates the next retry timestamp based on attempt count.
   */
  calculateNextRetryAt(currentAttemptCount: number): Date {
    const idx = Math.min(
      Math.max(0, currentAttemptCount - 1),
      this.BACKOFF_INTERVALS_SECONDS.length - 1,
    );
    const delaySeconds = this.BACKOFF_INTERVALS_SECONDS[idx];
    return new Date(Date.now() + delaySeconds * 1000);
  }

  /**
   * Atomically claims eligible pending refunds using PostgreSQL FOR UPDATE SKIP LOCKED.
   * Ensures that multiple worker instances or cron triggers never process the same refund simultaneously.
   */
  async claimEligibleRefunds(batchSize = 20, leaseDurationMs = 90000): Promise<string[]> {
    const leaseExpiryDate = new Date(Date.now() + leaseDurationMs);

    return this.db.transaction(async (tx) => {
      // Find candidate refund IDs with row-level skip-locked reservation
      const candidates = await tx.execute<{ id: string }>(sql`
        SELECT id FROM "refunds"
        WHERE "status" = 'pending'
          AND ("next_retry_at" IS NULL OR "next_retry_at" <= NOW())
          AND ("processing_lease_expires_at" IS NULL OR "processing_lease_expires_at" < NOW())
          AND "is_manual_review_required" = false
        ORDER BY "created_at" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED;
      `);

      const candidateRows = (candidates.rows || []) as { id: string }[];
      if (candidateRows.length === 0) {
        return [];
      }

      const candidateIds = candidateRows.map((r) => r.id);

      // Acquire the lease on all claimed rows
      await tx.execute(sql`
        UPDATE "refunds"
        SET "processing_lease_expires_at" = ${leaseExpiryDate},
            "updated_at" = NOW()
        WHERE "id" = ANY(${candidateIds});
      `);

      return candidateIds;
    });
  }

  /**
   * Reconciles a single claimed refund record against Razorpay gateway.
   */
  async reconcileSingleRefund(refundId: string): Promise<'processed' | 'pending' | 'failed' | 'manual_review'> {
    // 1. Fetch current refund with its associated payment and order
    const refund = await this.db.query.refunds.findFirst({
      where: eq(schema.refunds.id, refundId),
      with: {
        payment: {
          with: {
            order: true,
          },
        },
      },
    });

    if (!refund || refund.status !== 'pending') {
      return 'pending';
    }

    const payment = refund.payment;
    if (!payment || !payment.providerPaymentId) {
      this.logger.warn(`Refund ${refundId} missing authoritative providerPaymentId. Releasing lease.`);
      await this.releaseLease(refundId);
      return 'pending';
    }

    const currentAttempts = Number(refund.attemptCount || 1);

    // If max retry attempts exceeded, mark for manual review without marking as failed
    if (currentAttempts >= this.MAX_RETRY_ATTEMPTS) {
      this.logger.warn(
        `Refund ${refundId} has reached maximum retry attempts (${this.MAX_RETRY_ATTEMPTS}). Marking for manual review.`,
      );
      await this.db
        .update(schema.refunds)
        .set({
          isManualReviewRequired: true,
          processingLeaseExpiresAt: null,
          lastErrorCode: 'MAX_RETRIES_EXCEEDED',
          lastErrorMessage: `Automatic reconciliation halted after ${this.MAX_RETRY_ATTEMPTS} attempts. Requires manual review.`,
          updatedAt: new Date(),
        })
        .where(eq(schema.refunds.id, refundId));
      return 'manual_review';
    }

    const razorpayClient = (this.paymentsService as any).razorpayClient;

    // 2. Query Razorpay for actual status using fetchMultipleRefund
    let existingGatewayRefund: any = null;
    let gatewayLookupSucceeded = false;

    if (razorpayClient) {
      try {
        const multiple = await razorpayClient.payments.fetchMultipleRefund(payment.providerPaymentId);
        gatewayLookupSucceeded = true;

        if (multiple?.items && multiple.items.length > 0) {
          existingGatewayRefund = multiple.items.find(
            (item: any) =>
              (refund.providerRefundId && item.id === refund.providerRefundId) ||
              (refund.operationKey && item.notes?.operationKey === refund.operationKey) ||
              (payment.order?.id && item.notes?.fleet24OrderId === payment.order.id),
          );
        }
      } catch (lookupErr: any) {
        this.logger.warn(
          `Razorpay lookup failed during reconciliation for refund ${refundId}: ${lookupErr?.message || lookupErr}`,
        );
        gatewayLookupSucceeded = false;
      }
    }

    // CASE A & B: Refund exists on Razorpay
    if (existingGatewayRefund) {
      const isProcessed = existingGatewayRefund.status === 'processed';
      const newStatus = isProcessed ? 'processed' : 'pending';

      await this.db.transaction(async (tx) => {
        await tx
          .update(schema.refunds)
          .set({
            providerRefundId: existingGatewayRefund.id,
            status: newStatus,
            processingLeaseExpiresAt: null,
            nextRetryAt: isProcessed ? null : this.calculateNextRetryAt(currentAttempts + 1),
            lastAttemptAt: new Date(),
            lastErrorCode: null,
            lastErrorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.refunds.id, refundId));

        if (isProcessed) {
          await tx
            .update(schema.payments)
            .set({
              status: 'refunded',
              updatedAt: new Date(),
            })
            .where(eq(schema.payments.id, payment.id));

          // If the order was in payment_conflict, transition to cancelled on confirmed refund
          if (payment.order && payment.order.status === 'payment_conflict') {
            const existingDetails = (payment.order.paymentConflictDetails as any) || {};
            await tx
              .update(schema.orders)
              .set({
                status: 'cancelled',
                cancellationReason: 'Payment conflict fully refunded to customer (reconciliation)',
                cancelledAt: new Date(),
                paymentConflictDetails: {
                  ...existingDetails,
                  resolutionStatus: 'refund_processed',
                  resolvedAt: new Date().toISOString(),
                },
                updatedAt: new Date(),
              })
              .where(eq(schema.orders.id, payment.order.id));

            await tx.insert(schema.orderStatusHistory).values({
              orderId: payment.order.id,
              previousStatus: 'payment_conflict',
              newStatus: 'cancelled',
              reason: 'Full refund confirmed via background reconciliation',
              changedByUserId: refund.approvedByUserId || null,
            });
          }
        }
      });

      this.logger.log(
        `Reconciled refund ${refundId} with gateway refund ${existingGatewayRefund.id} (Status: ${newStatus})`,
      );
      return newStatus;
    }

    // CASE D: Gateway lookup failed due to network / gateway error
    // Keep pending, schedule next retry with exponential backoff, do not mark as failed
    if (!gatewayLookupSucceeded) {
      const nextRetryAt = this.calculateNextRetryAt(currentAttempts + 1);
      await this.db
        .update(schema.refunds)
        .set({
          attemptCount: sql`${schema.refunds.attemptCount} + 1`,
          nextRetryAt,
          processingLeaseExpiresAt: null,
          lastAttemptAt: new Date(),
          lastErrorCode: 'GATEWAY_LOOKUP_FAILED',
          lastErrorMessage: 'Transient error during gateway refund status check. Rescheduled.',
          updatedAt: new Date(),
        })
        .where(eq(schema.refunds.id, refundId));
      return 'pending';
    }

    // CASE C: Refund definitely does not exist on Razorpay yet -> Dispatch idempotent retry
    this.logger.log(
      `Refund ${refundId} not found on gateway. Dispatching idempotent retry with key ${refund.idempotencyKey}`,
    );

    const payload = (refund.requestPayload as any) || {
      amount: this.paymentsService.convertRupeesToPaise(parseFloat(refund.amount)),
      notes: {
        fleet24OrderId: payment.order?.id,
        operationKey: refund.operationKey,
        reason: refund.reason,
      },
    };

    try {
      const res = await this.paymentsService.executeRazorpayRefundHttp(
        payment.providerPaymentId,
        payload,
        refund.idempotencyKey,
      );

      const statusCode = res.status;
      const resData = res.data;

      if (statusCode >= 200 && statusCode < 300 && resData?.id) {
        const isProcessed = resData.status === 'processed';
        const providerStatus = isProcessed ? 'processed' : 'pending';

        await this.db.transaction(async (tx) => {
          await tx
            .update(schema.refunds)
            .set({
              providerRefundId: resData.id,
              status: providerStatus,
              processingLeaseExpiresAt: null,
              nextRetryAt: isProcessed ? null : this.calculateNextRetryAt(currentAttempts + 1),
              lastAttemptAt: new Date(),
              lastErrorCode: null,
              lastErrorMessage: null,
              updatedAt: new Date(),
            })
            .where(eq(schema.refunds.id, refundId));

          if (isProcessed) {
            await tx
              .update(schema.payments)
              .set({
                status: 'refunded',
                updatedAt: new Date(),
              })
              .where(eq(schema.payments.id, payment.id));
          }
        });

        this.logger.log(`Retry successful for refund ${refundId}: ${resData.id} (${providerStatus})`);
        return providerStatus;
      }

      // Transient response (408, 409, 429, 5xx)
      if (statusCode === 408 || statusCode === 409 || statusCode === 429 || statusCode >= 500) {
        const nextRetryAt = this.calculateNextRetryAt(currentAttempts + 1);
        await this.db
          .update(schema.refunds)
          .set({
            status: 'pending',
            processingLeaseExpiresAt: null,
            nextRetryAt,
            lastAttemptAt: new Date(),
            lastErrorCode: `HTTP_${statusCode}`,
            lastErrorMessage: resData?.error?.description || `Transient error HTTP ${statusCode}`,
            attemptCount: sql`${schema.refunds.attemptCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(schema.refunds.id, refundId));
        return 'pending';
      }

      // Definitive failure (400 Bad Request, un-refundable)
      await this.db
        .update(schema.refunds)
        .set({
          status: 'failed',
          processingLeaseExpiresAt: null,
          nextRetryAt: null,
          lastAttemptAt: new Date(),
          lastErrorCode: resData?.error?.code || `HTTP_${statusCode}`,
          lastErrorMessage: resData?.error?.description || 'Definitive gateway rejection',
          attemptCount: sql`${schema.refunds.attemptCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.refunds.id, refundId));
      return 'failed';
    } catch (networkErr: any) {
      // Network timeout during dispatch -> keep pending with exponential backoff
      const nextRetryAt = this.calculateNextRetryAt(currentAttempts + 1);
      await this.db
        .update(schema.refunds)
        .set({
          status: 'pending',
          processingLeaseExpiresAt: null,
          nextRetryAt,
          lastAttemptAt: new Date(),
          lastErrorCode: networkErr?.code || 'NETWORK_TIMEOUT',
          lastErrorMessage: networkErr?.message || 'Network error during retry',
          attemptCount: sql`${schema.refunds.attemptCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.refunds.id, refundId));
      return 'pending';
    }
  }

  /**
   * Reconciles a batch of claimed pending refunds.
   */
  async reconcileBatch(batchSize = 20): Promise<ReconciliationBatchSummary> {
    const summary: ReconciliationBatchSummary = {
      totalClaimed: 0,
      processed: 0,
      pending: 0,
      failed: 0,
      manualReviewRequired: 0,
    };

    const claimedIds = await this.claimEligibleRefunds(batchSize);
    summary.totalClaimed = claimedIds.length;

    if (claimedIds.length === 0) {
      return summary;
    }

    this.logger.log(`Starting reconciliation for ${claimedIds.length} claimed pending refunds.`);

    for (const id of claimedIds) {
      try {
        const result = await this.reconcileSingleRefund(id);
        if (result === 'processed') summary.processed++;
        else if (result === 'pending') summary.pending++;
        else if (result === 'failed') summary.failed++;
        else if (result === 'manual_review') summary.manualReviewRequired++;
      } catch (err: any) {
        this.logger.error(`Unexpected error during reconciliation of refund ${id}: ${err?.message}`);
        await this.releaseLease(id);
      }
    }

    this.logger.log(
      `Reconciliation batch complete: ${summary.processed} processed, ${summary.pending} pending, ${summary.failed} failed, ${summary.manualReviewRequired} manual review.`,
    );

    return summary;
  }

  /**
   * Safely releases a lease in case of unexpected errors.
   */
  private async releaseLease(refundId: string): Promise<void> {
    try {
      await this.db
        .update(schema.refunds)
        .set({
          processingLeaseExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.refunds.id, refundId));
    } catch (e) {
      this.logger.warn(`Failed to release lease for refund ${refundId}: ${e}`);
    }
  }
}

