import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { RidersService } from './riders.service';
import { RiderAssignmentService } from './rider-assignment.service';
import { RiderOffersService } from './rider-offers.service';
import { OfferExpirationWorker } from './offer-expiration.worker';
import { NotificationService } from './notification.service';
import { RidersController } from './riders.controller';
import { AdminRidersController } from './admin-riders.controller';
import { DatabaseModule } from '../database/database.module';
import { TrackingModule } from '../tracking/tracking.module';
import { AdminDashboardModule } from '../admin/admin-dashboard.module';
import { ServiceZonesModule } from '../service-zones/service-zones.module';

@Module({
  imports: [
    DatabaseModule,
    JwtModule,
    ConfigModule,
    ServiceZonesModule,
    forwardRef(() => TrackingModule),
    forwardRef(() => AdminDashboardModule),
  ],
  controllers: [RidersController, AdminRidersController],
  providers: [
    RidersService,
    RiderAssignmentService,
    RiderOffersService,
    OfferExpirationWorker,
    NotificationService,
  ],
  exports: [
    RidersService,
    RiderAssignmentService,
    RiderOffersService,
    NotificationService,
  ],
})
export class RidersModule {}

