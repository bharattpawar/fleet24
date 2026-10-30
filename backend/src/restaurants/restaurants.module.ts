import { Module } from '@nestjs/common';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantsService } from './restaurants.service';
import { MenusService } from './menus.service';
import { OutletAuthorizationService } from './outlet-auth.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [RestaurantsController],
  providers: [
    RestaurantsService,
    MenusService,
    OutletAuthorizationService,
  ],
  exports: [RestaurantsService, MenusService, OutletAuthorizationService],
})
export class RestaurantsModule {}
