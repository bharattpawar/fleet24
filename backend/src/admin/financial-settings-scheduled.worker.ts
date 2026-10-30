import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FinancialSettingsService } from './financial-settings.service';

@Injectable()
export class FinancialSettingsScheduledWorker {
  private readonly logger = new Logger(FinancialSettingsScheduledWorker.name);
  private isRunning = false;

  constructor(private readonly settingsService: FinancialSettingsService) {}

  /**
   * Runs every minute to evaluate and activate scheduled financial settings configurations
   * that have reached their effectiveFrom timestamp, without waiting for API request triggers.
   */
  @Cron('0 * * * * *')
  async handleCron() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    try {
      const promoted = await this.settingsService.promoteDueScheduledSettings();
      if (promoted > 0) {
        this.logger.log(`Scheduled worker promoted ${promoted} scheduled financial settings version(s) to active`);
      }
    } catch (err: any) {
      this.logger.error(`Error in FinancialSettingsScheduledWorker: ${err?.message || err}`);
    } finally {
      this.isRunning = false;
    }
  }
}

