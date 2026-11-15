import { CustomerHomeController } from './customer-home.controller';
import { Module, forwardRef } from '@nestjs/common';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantProfileController } from './restaurant-profile.controller';
import { RestaurantsService } from './restaurants.service';
import { MenusService } from './menus.service';
import { OutletAuthorizationService } from './outlet-auth.service';
import { AuthModule } from '../auth/auth.module';
import { RoutingModule } from '../routing/routing.module';
import { AdminDashboardModule } from '../admin/admin-dashboard.module';

@Module({
  imports: [
    AuthModule,
    RoutingModule,
    forwardRef(() => AdminDashboardModule),
  ],
  controllers: [CustomerHomeController, RestaurantsController, RestaurantProfileController],
  providers: [
    RestaurantsService,
    MenusService,
    OutletAuthorizationService,
  ],
  exports: [RestaurantsService, MenusService, OutletAuthorizationService],
})
export class RestaurantsModule {}
