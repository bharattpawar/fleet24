import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminManagementController } from './admin-management.controller';
import { AdminManagementService } from './admin-management.service';
import { AdminOperationsController } from './admin-operations.controller';
import { AdminOperationsService } from './admin-operations.service';
import { AdminFinanceController } from './admin-finance.controller';
import { AdminFinanceService } from './admin-finance.service';
import { FinancialSettingsController } from './financial-settings.controller';
import { FinancialSettingsService } from './financial-settings.service';
import { FinancialSettingsScheduledWorker } from './financial-settings-scheduled.worker';
import { RidersModule } from '../riders/riders.module';
import { PaymentsModule } from '../payments/payments.module';
import { TrackingModule } from '../tracking/tracking.module';

@Module({
  imports: [
    DatabaseModule,
    JwtModule,
    ConfigModule,
    forwardRef(() => RidersModule),
    forwardRef(() => PaymentsModule),
    forwardRef(() => TrackingModule),
  ],
  controllers: [
    AdminDashboardController,
    AdminManagementController,
    AdminOperationsController,
    AdminFinanceController,
    FinancialSettingsController,
  ],
  providers: [
    AdminDashboardService,
    AdminManagementService,
    AdminOperationsService,
    AdminFinanceService,
    FinancialSettingsService,
    FinancialSettingsScheduledWorker,
  ],
  exports: [
    AdminDashboardService,
    AdminManagementService,
    AdminOperationsService,
    AdminFinanceService,
    FinancialSettingsService,
  ],
})
export class AdminDashboardModule {}

