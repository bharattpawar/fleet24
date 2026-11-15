import { Module, forwardRef } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { RestaurantOrdersService } from './restaurant-orders.service';
import { RestaurantOrdersController } from './restaurant-orders.controller';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { RidersModule } from '../riders/riders.module';
import { TrackingModule } from '../tracking/tracking.module';
import { AdminDashboardModule } from '../admin/admin-dashboard.module';
import { RoutingModule } from '../routing/routing.module';

@Module({
  imports: [
    AuthModule,
    RoutingModule,
    forwardRef(() => PaymentsModule),
    forwardRef(() => RidersModule),
    forwardRef(() => TrackingModule),
    forwardRef(() => AdminDashboardModule),
  ],
  controllers: [CartController, OrdersController, RestaurantOrdersController],
  providers: [CartService, OrdersService, RestaurantOrdersService],
  exports: [CartService, OrdersService, RestaurantOrdersService],
})
export class OrdersModule {}
