import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { RiderAssignmentService } from './rider-assignment.service';
import { NotificationService } from './notification.service';
import { Inject } from '@nestjs/common';

@Injectable()
export class OfferExpirationWorker {
  private readonly logger = new Logger(OfferExpirationWorker.name);
  private isRunning = false;

  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly riderAssignmentService: RiderAssignmentService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Runs every 10 seconds to check for expired rider delivery offers
   * and retry dispatching unassigned active orders to newly available riders.
   */
  @Cron('*/10 * * * * *')
  async handleCron() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    try {
      await this.processExpiredOffers();
      await this.processUnassignedDeliveries();
    } catch (err: any) {
      this.logger.error(`Error in dispatch worker: ${err?.message || err}`);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Scans for orders awaiting rider assignment and dispatches them to available nearby riders.
   * Ensures orders confirmed or prepared while riders were offline get dispatched immediately
   * once a rider comes online.
   */
  async processUnassignedDeliveries(): Promise<number> {
    const cooldownThreshold = new Date(Date.now() - 10000); // 10s retry cooldown

    const unassignedDeliveries = await this.db
      .select({
        orderId: schema.deliveries.orderId,
      })
      .from(schema.deliveries)
      .innerJoin(schema.orders, eq(schema.deliveries.orderId, schema.orders.id))
      .where(
        and(
          eq(schema.deliveries.status, 'unassigned'),
          inArray(schema.orders.status, ['confirmed', 'preparing', 'ready_for_pickup']),
          sql`(${schema.deliveries.lastDispatchAttemptAt} IS NULL OR ${schema.deliveries.lastDispatchAttemptAt} <= ${cooldownThreshold})`,
        ),
      )
      .limit(10);

    for (const item of unassignedDeliveries) {
      try {
        await this.riderAssignmentService.assignOrder(item.orderId);
      } catch (err: any) {
        // Dispatch attempts record failure reasons directly on the delivery row
      }
    }

    return unassignedDeliveries.length;
  }

  /**
   * Scans and expires pending offers whose offerExpiresAt <= now().
   * Uses FOR UPDATE SKIP LOCKED to prevent multiple workers from processing the same row.
   */
  async processExpiredOffers(): Promise<number> {
    const now = new Date();

    const expiredDeliveries = await this.db.transaction(async (tx) => {
      // Find and lock expired pending delivery assignments
      const deliveriesToExpire = await tx
        .select()
        .from(schema.deliveries)
        .where(
          and(
            eq(schema.deliveries.status, 'assigned'),
            sql`${schema.deliveries.offerExpiresAt} IS NOT NULL`,
            sql`${schema.deliveries.offerExpiresAt} <= ${now}`,
          ),
        )
        .for('update', { skipLocked: true })
        .limit(20);

      if (deliveriesToExpire.length === 0) {
        return [];
      }

      const results = [];

      for (const d of deliveriesToExpire) {
        const previousRiderId = d.riderId;

        // 1. Mark latest assignment attempt as 'expired'
        if (previousRiderId) {
          await tx
            .update(schema.deliveryAssignmentAttempts)
            .set({
              status: 'expired',
              respondedAt: now,
              updatedAt: now,
            })
            .where(
              and(
                eq(schema.deliveryAssignmentAttempts.deliveryId, d.id),
                eq(schema.deliveryAssignmentAttempts.riderId, previousRiderId),
                eq(schema.deliveryAssignmentAttempts.status, 'offered'),
              ),
            );
        }

        // 2. Reset delivery status to 'unassigned' and release rider assignment
        await tx
          .update(schema.deliveries)
          .set({
            status: 'unassigned',
            riderId: null,
            offerExpiresAt: null,
            lastDispatchAttemptAt: now,
            dispatchFailureReason: `Previous offer to rider ${previousRiderId} expired without response`,
            updatedAt: now,
          })
          .where(eq(schema.deliveries.id, d.id));

        results.push({
          orderId: d.orderId,
          deliveryId: d.id,
          previousRiderId,
        });

        this.logger.warn(
          `Delivery offer for order ${d.orderId} (Rider: ${previousRiderId}) expired. Capacity released.`,
        );
      }

      return results;
    });

    // 3. Trigger reassignment outside the transaction for each expired delivery
    for (const item of expiredDeliveries) {
      if (item.previousRiderId) {
        this.notificationService
          .notifyRider({
            riderId: item.previousRiderId,
            orderId: item.orderId,
            deliveryId: item.deliveryId,
            type: 'offer_expired',
            title: 'Offer Expired',
            body: 'The delivery offer has expired and has been reassigned.',
          })
          .catch(() => {});
      }

      this.riderAssignmentService.assignOrder(item.orderId).catch((err) => {
        this.logger.error(
          `Reassignment attempt failed after offer expiration for order ${item.orderId}: ${err?.message || err}`,
        );
      });
    }

    return expiredDeliveries.length;
  }
}

