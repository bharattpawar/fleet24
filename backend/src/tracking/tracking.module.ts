import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { TrackingGateway } from './tracking.gateway';
import { TrackingPublisherService } from './tracking-publisher.service';
import { RidersModule } from '../riders/riders.module';

@Module({
  imports: [
    DatabaseModule,
    JwtModule,
    ConfigModule,
    forwardRef(() => RidersModule),
  ],
  providers: [TrackingGateway, TrackingPublisherService],
  exports: [TrackingGateway, TrackingPublisherService],
})
export class TrackingModule {}

