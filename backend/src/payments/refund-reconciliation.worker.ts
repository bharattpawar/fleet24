import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RefundReconciliationService } from './refund-reconciliation.service';

@Injectable()
export class RefundReconciliationWorker {
  private readonly logger = new Logger(RefundReconciliationWorker.name);
  private isRunning = false;

  constructor(
    private readonly reconciliationService: RefundReconciliationService,
  ) {}

  /**
   * Periodic reconciliation job runs every 2 minutes.
   * Leverages in-memory lock as a first line of defense, backed by PostgreSQL FOR UPDATE SKIP LOCKED.
   */
  @Cron('*/2 * * * *')
  async handleCron() {
    if (this.isRunning) {
      this.logger.debug('Previous reconciliation cycle is still executing. Skipping tick.');
      return;
    }

    this.isRunning = true;
    try {
      this.logger.log('Starting automated 2-minute refund reconciliation cycle.');
      const summary = await this.reconciliationService.reconcileBatch(25);

      if (summary.totalClaimed > 0) {
        this.logger.log(
          `Automated reconciliation cycle complete. Processed: ${summary.processed}, Pending: ${summary.pending}, Failed: ${summary.failed}, Manual Review: ${summary.manualReviewRequired}`,
        );
      } else {
        this.logger.debug('Automated reconciliation cycle complete: No eligible pending refunds.');
      }
    } catch (err: any) {
      this.logger.error(`Unhandled error during automated refund reconciliation cycle: ${err?.message || err}`);
    } finally {
      this.isRunning = false;
    }
  }
}
