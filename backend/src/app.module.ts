import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validate } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { MediaModule } from './media/media.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { RidersModule } from './riders/riders.module';
import { TrackingModule } from './tracking/tracking.module';
import { AdminDashboardModule } from './admin/admin-dashboard.module';
import { RoutingModule } from './routing/routing.module';
import { GeoModule } from './geo/geo.module';
import { ServiceZonesModule } from './service-zones/service-zones.module';
import { PromotionsModule } from './promotions/promotions.module';
import { EatListModule } from './eat-list/eat-list.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: ['.env'],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RestaurantsModule,
    MediaModule,
    OrdersModule,
    PaymentsModule,
    RidersModule,
    TrackingModule,
    AdminDashboardModule,
    RoutingModule,
    GeoModule,
    ServiceZonesModule,
    PromotionsModule,
    EatListModule,
  ],
})
export class AppModule {}
