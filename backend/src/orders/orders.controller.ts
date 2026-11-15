import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PaymentsService } from '../payments/payments.service';
import { RiderOffersService } from '../riders/rider-offers.service';
import { CheckoutDto, CancelOrderDto, OrderPaginationDto } from './dto/order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, CurrentUser, AuthenticatedUserPayload } from '../auth/decorators/auth.decorators';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('customer')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly riderOffersService: RiderOffersService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async checkout(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Body() dto: CheckoutDto,
  ) {
    return this.ordersService.checkout(user.userId, dto);
  }

  /**
   * Alias: POST /api/v1/orders/:orderId/payment-session
   */
  @Post(':orderId/payment-session')
  @HttpCode(HttpStatus.OK)
  async createPaymentSession(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentsService.createPaymentSession(user.userId, orderId);
  }

  @Get()
  async listOrders(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Query() query: OrderPaginationDto,
  ) {
    return this.ordersService.listCustomerOrders(user.userId, query);
  }

  /**
   * GET /api/v1/orders/active
   * Retrieves the customer's current active fulfillment order (placed, confirmed, preparing, ready_for_pickup, out_for_delivery)
   */
  @Get('active')
  async getActiveOrder(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.ordersService.getActiveCustomerOrder(user.userId);
  }

  @Get(':orderId')
  async getOrderDetails(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.ordersService.getCustomerOrderDetails(user.userId, orderId);
  }

  /**
   * GET /api/v1/orders/:orderId/delivery
   * Customer delivery status, assigned rider details, and OTP for delivery handoff
   */
  @Get(':orderId/delivery')
  async getDeliveryDetails(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.riderOffersService.getDeliveryForCustomer(user.userId, orderId);
  }

  @Post(':orderId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelOrder(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('orderId') orderId: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrder(user.userId, orderId, dto);
  }
}
