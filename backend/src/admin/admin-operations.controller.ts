import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, CurrentUser, AuthenticatedUserPayload } from '../auth/decorators/auth.decorators';
import { AdminOperationsService } from './admin-operations.service';
import {
  AdminOrderQueryDto,
  AdminCancelOrderDto,
  AdminActiveDeliveriesQueryDto,
  AdminPaymentConflictQueryDto,
  AdminApproveConflictRefundDto,
} from './dto/admin-operations.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminOperationsController {
  constructor(private readonly operationsService: AdminOperationsService) {}

  // ==========================================
  // ORDER MONITORING & MANAGEMENT
  // ==========================================

  /**
   * GET /api/v1/admin/orders
   * Paginated order listing with comprehensive search and filters.
   */
  @Get('orders')
  async listOrders(@Query() query: AdminOrderQueryDto) {
    return this.operationsService.listOrders(query);
  }

  /**
   * GET /api/v1/admin/orders/:orderId
   * Operational view of an order with customer, restaurant, delivery, and lifecycle timeline.
   */
  @Get('orders/:orderId')
  async getOrderDetails(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.operationsService.getOrderDetails(orderId);
  }

  /**
   * POST /api/v1/admin/orders/:orderId/cancel
   * Administrative order cancellation with mandatory reason, capacity release, and automated refund.
   */
  @Post('orders/:orderId/cancel')
  async cancelOrder(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: AdminCancelOrderDto,
  ) {
    return this.operationsService.cancelOrder(user.userId, orderId, dto);
  }

  /**
   * POST /api/v1/admin/orders/:orderId/retry-dispatch
   * Administrative dispatch retry for unassigned orders or failed dispatch.
   */
  @Post('orders/:orderId/retry-dispatch')
  async retryDispatch(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.operationsService.retryDispatch(user.userId, orderId);
  }

  // ==========================================
  // DELIVERY MONITORING
  // ==========================================

  /**
   * GET /api/v1/admin/deliveries/active
   * Monitor all active in-flight deliveries across the system with GPS freshness.
   */
  @Get('deliveries/active')
  async getActiveDeliveries(@Query() query: AdminActiveDeliveriesQueryDto) {
    return this.operationsService.getActiveDeliveries(query);
  }

  /**
   * GET /api/v1/admin/deliveries/:deliveryId
   * Detailed delivery lifecycle, assigned rider, latest authorized coordinates, and attempt history.
   */
  @Get('deliveries/:deliveryId')
  async getDeliveryDetails(@Param('deliveryId', ParseUUIDPipe) deliveryId: string) {
    return this.operationsService.getDeliveryDetails(deliveryId);
  }

  // ==========================================
  // PAYMENT CONFLICT MANAGEMENT & REFUND APPROVAL
  // ==========================================

  /**
   * GET /api/v1/admin/payment-conflicts
   * Paginated list of captured payment conflict orders requiring admin review.
   */
  @Get('payment-conflicts')
  async listPaymentConflicts(@Query() query: AdminPaymentConflictQueryDto) {
    return this.operationsService.listPaymentConflicts(query);
  }

  /**
   * GET /api/v1/admin/payment-conflicts/:orderId
   * Detailed view of a single payment conflict with captured payment, conflicting active order, and audit trail.
   */
  @Get('payment-conflicts/:orderId')
  async getPaymentConflictDetails(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.operationsService.getPaymentConflictDetails(orderId);
  }

  /**
   * POST /api/v1/admin/payment-conflicts/:orderId/approve-refund
   * Explicit admin approval and durable refund reservation for a captured payment conflict.
   */
  @Post('payment-conflicts/:orderId/approve-refund')
  async approvePaymentConflictRefund(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: AdminApproveConflictRefundDto,
  ) {
    return this.operationsService.approvePaymentConflictRefund(user.userId, orderId, dto);
  }
}

