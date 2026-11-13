import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  Roles,
  CurrentUser,
  AuthenticatedUserPayload,
} from '../auth/decorators/auth.decorators';
import { RestaurantOrdersService } from './restaurant-orders.service';
import {
  UpdateRestaurantOrderStatusDto,
  RestaurantOrdersQueryDto,
} from './dto/restaurant-order.dto';

@Controller('restaurant/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('restaurant_staff', 'admin')
export class RestaurantOrdersController {
  constructor(
    private readonly restaurantOrdersService: RestaurantOrdersService,
  ) {}

  /**
   * GET /api/v1/restaurant/orders
   * Lists orders for the outlets managed by the authenticated restaurant staff
   */
  @Get()
  async listOrders(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Query() query: RestaurantOrdersQueryDto,
  ) {
    return this.restaurantOrdersService.listOrdersForRestaurant(
      user.userId,
      user.roles,
      query,
    );
  }

  /**
   * GET /api/v1/restaurant/orders/overview
   * Real-time operational overview counts (new, confirmed, preparing, ready, completed today)
   * and recent order activity for a selected authorized outlet.
   */
  @Get('overview')
  async getOverview(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Query('outletId', new ParseUUIDPipe({ version: '4' })) outletId: string,
  ) {
    return this.restaurantOrdersService.getOrdersOverview(
      user.userId,
      user.roles,
      outletId,
    );
  }

  /**
   * GET /api/v1/restaurant/orders/:orderId
   * Gets specific order details for the authorized kitchen staff
   */
  @Get(':orderId')
  async getOrder(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    return this.restaurantOrdersService.getOrderDetails(
      user.userId,
      user.roles,
      orderId,
    );
  }

  /**
   * PATCH /api/v1/restaurant/orders/:orderId/status
   * Transitions order state: confirmed -> preparing -> ready_for_pickup, or rejected
   */
  @Patch(':orderId/status')
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() dto: UpdateRestaurantOrderStatusDto,
  ) {
    return this.restaurantOrdersService.updateOrderStatus(
      user.userId,
      user.roles,
      orderId,
      dto,
    );
  }
}

