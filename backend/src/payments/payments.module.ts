import { Module, forwardRef } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { RefundReconciliationService } from './refund-reconciliation.service';
import { RefundReconciliationWorker } from './refund-reconciliation.worker';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { TrackingModule } from '../tracking/tracking.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    forwardRef(() => TrackingModule),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    RefundReconciliationService,
    RefundReconciliationWorker,
  ],
  exports: [PaymentsService, RefundReconciliationService],
})
export class PaymentsModule {}

