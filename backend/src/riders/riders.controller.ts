import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { RidersService } from './riders.service';
import { RiderOffersService } from './rider-offers.service';
import { NotificationService } from './notification.service';
import { AdminFinanceService } from '../admin/admin-finance.service';
import { CreateRiderPayoutRequestDto, AdminRiderEarningsQueryDto } from '../admin/dto/admin-finance.dto';
import {
  CreateRiderProfileDto,
  UpdateRiderProfileDto,
  UpdateRiderAvailabilityDto,
} from './dto/rider-profile.dto';
import {
  UpdateRiderLocationDto,
  RiderLocationResponse,
} from './dto/rider-location.dto';
import {
  RejectDeliveryOfferDto,
  DeliveryOfferDetails,
} from './dto/delivery-offer.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';

@Controller('riders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RidersController {
  constructor(
    private readonly ridersService: RidersService,
    private readonly riderOffersService: RiderOffersService,
    private readonly notificationService: NotificationService,
    private readonly financeService: AdminFinanceService,
  ) {}

  /**
   * POST /api/v1/riders/profile
   * Register rider profile for authenticated user (allows onboarding from customer or rider role)
   */
  @Post('profile')
  @Roles('customer', 'rider')
  @HttpCode(HttpStatus.CREATED)
  async createProfile(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Body() dto: CreateRiderProfileDto,
  ) {
    return this.ridersService.createProfile(user.userId, dto);
  }

  /**
   * GET /api/v1/riders/profile
   * View rider profile for authenticated rider
   */
  @Get('profile')
  @Roles('rider', 'admin')
  async getProfile(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.ridersService.getProfile(user.userId);
  }

  /**
   * PATCH /api/v1/riders/profile
   * Update permitted rider profile fields
   */
  @Patch('profile')
  @Roles('rider')
  async updateProfile(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Body() dto: UpdateRiderProfileDto,
  ) {
    return this.ridersService.updateProfile(user.userId, dto);
  }

  /**
   * PATCH /api/v1/riders/availability
   * Toggle availability between 'offline' and 'available'
   */
  @Patch('availability')
  @Roles('rider')
  async updateAvailability(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Body() dto: UpdateRiderAvailabilityDto,
  ) {
    return this.ridersService.updateAvailability(user.userId, dto);
  }

  /**
   * PATCH /api/v1/riders/location
   * Submit periodic GPS location update for authenticated rider
   */
  @Patch('location')
  @Roles('rider')
  async updateLocation(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Body() dto: UpdateRiderLocationDto,
  ): Promise<RiderLocationResponse> {
    return this.ridersService.updateLocation(user.userId, dto);
  }

  /**
   * POST /api/v1/riders/location
   * HTTP POST alias for location update (shares identical validation & logic)
   */
  @Post('location')
  @Roles('rider')
  @HttpCode(HttpStatus.OK)
  async postLocation(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Body() dto: UpdateRiderLocationDto,
  ): Promise<RiderLocationResponse> {
    return this.ridersService.updateLocation(user.userId, dto);
  }

  /**
   * GET /api/v1/riders/location
   * Retrieve latest recorded GPS location and freshness status for authenticated rider
   */
  @Get('location')
  @Roles('rider')
  async getLocation(
    @CurrentUser() user: AuthenticatedUserPayload,
  ): Promise<RiderLocationResponse> {
    return this.ridersService.getLocation(user.userId);
  }

  // ================= RIDER OFFER LIFECYCLE (PHASE 4.4) =================

  /**
   * GET /api/v1/riders/orders/active
   * Get currently active/in-flight deliveries belonging to authenticated rider
   * Restores active order tracking when rider app opens
   */
  @Get('orders/active')
  @Roles('rider')
  async getActiveOrders(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.riderOffersService.getActiveDeliveriesForRider(user.userId);
  }

  /**
   * GET /api/v1/riders/orders/offers
   * Get active, unexpired delivery offers belonging to authenticated rider
   */
  @Get('orders/offers')
  @Roles('rider')
  async getPendingOffers(
    @CurrentUser() user: AuthenticatedUserPayload,
  ): Promise<DeliveryOfferDetails[]> {
    return this.riderOffersService.getPendingOffers(user.userId);
  }

  /**
   * GET /api/v1/riders/orders/available
   * View all open/ready orders in the system that can be claimed or picked up
   */
  @Get('orders/available')
  @Roles('rider')
  async getAvailableOrders(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.riderOffersService.getAvailableDeliveriesPool(user.userId);
  }

  /**
   * POST /api/v1/riders/orders/:orderId/claim
   * Instantly claim and accept an available order
   */
  @Post('orders/:orderId/claim')
  @Roles('rider')
  @HttpCode(HttpStatus.OK)
  async claimOrder(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.riderOffersService.claimDelivery(user.userId, orderId);
  }

  /**
   * POST /api/v1/riders/orders/:orderId/accept
   * Accept an assigned delivery offer
   */
  @Post('orders/:orderId/accept')
  @Roles('rider')
  @HttpCode(HttpStatus.OK)
  async acceptOffer(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.riderOffersService.acceptOffer(user.userId, orderId);
  }

  /**
   * POST /api/v1/riders/orders/:orderId/reject
   * Reject an assigned delivery offer and trigger reassignment
   */
  @Post('orders/:orderId/reject')
  @Roles('rider')
  @HttpCode(HttpStatus.OK)
  async rejectOffer(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: RejectDeliveryOfferDto,
  ) {
    return this.riderOffersService.rejectOffer(user.userId, orderId, dto);
  }

  /**
   * POST /api/v1/riders/orders/:orderId/arrived
   * Confirm rider arrival at restaurant (accepted -> at_restaurant)
   */
  @Post('orders/:orderId/arrived')
  @Roles('rider')
  @HttpCode(HttpStatus.OK)
  async confirmArrival(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.riderOffersService.confirmArrival(user.userId, orderId);
  }

  /**
   * POST /api/v1/riders/orders/:orderId/pickup
   * Confirm order pickup from kitchen (at_restaurant -> picked_up)
   */
  @Post('orders/:orderId/pickup')
  @Roles('rider')
  @HttpCode(HttpStatus.OK)
  async confirmPickup(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.riderOffersService.confirmPickup(user.userId, orderId);
  }

  // ================= DELIVERY COMPLETION & OTP (PHASE 5.1) =================

  /**
   * POST /api/v1/riders/orders/:orderId/arrived-customer
   * Confirm rider arrival at customer doorstep (picked_up -> arrived_customer)
   */
  @Post('orders/:orderId/arrived-customer')
  @Roles('rider')
  @HttpCode(HttpStatus.OK)
  async confirmArrivedCustomer(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.riderOffersService.confirmArrivedCustomer(user.userId, orderId);
  }

  /**
   * POST /api/v1/riders/orders/:orderId/complete
   * Rider marks the order delivered after arriving at the customer (no OTP)
   */
  @Post('orders/:orderId/complete')
  @Roles('rider')
  @HttpCode(HttpStatus.OK)
  async completeDelivery(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.riderOffersService.completeDelivery(user.userId, orderId);
  }

  // ================= PUSH NOTIFICATIONS & DEVICE TOKENS =================

  /**
   * POST /api/v1/riders/device-token
   * Register or refresh device push notification token for authenticated rider
   */
  @Post('device-token')
  @Roles('rider')
  @HttpCode(HttpStatus.OK)
  async registerDeviceToken(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    const rider = await this.riderOffersService.getRiderForUser(user.userId);
    return this.notificationService.registerDeviceToken(rider.id, dto.token, dto.platform);
  }

  /**
   * DELETE /api/v1/riders/device-token
   * Invalidate and unregister device push token upon rider logout
   */
  @Delete('device-token')
  @Roles('rider')
  @HttpCode(HttpStatus.OK)
  async unregisterDeviceToken(@CurrentUser() user: AuthenticatedUserPayload) {
    const rider = await this.riderOffersService.getRiderForUser(user.userId);
    return this.notificationService.unregisterDeviceToken(rider.id);
  }

  // ================= RIDER FINANCIAL & PAYOUT OPERATIONS =================

  /**
   * GET /api/v1/riders/earnings/summary
   * Rider's personal earnings summary: total earned, disbursed, reserved, and available balance
   */
  @Get('earnings/summary')
  @Roles('rider')
  async getMyEarningsSummary(@CurrentUser() user: AuthenticatedUserPayload) {
    const rider = await this.ridersService.getProfile(user.userId);
    return this.financeService.getRiderEarningsSummary(rider.id);
  }

  /**
   * GET /api/v1/riders/earnings
   * Paginated order-wise earnings of the authenticated rider
   */
  @Get('earnings')
  @Roles('rider')
  async getMyEarnings(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const rider = await this.ridersService.getProfile(user.userId);
    const query: AdminRiderEarningsQueryDto = {
      riderId: rider.id,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      from,
      to,
    };
    return this.financeService.listRiderEarnings(query);
  }

  /**
   * POST /api/v1/riders/payouts/request
   * Authenticated rider requests withdrawal/payout of available earnings balance
   */
  @Post('payouts/request')
  @Roles('rider')
  @HttpCode(HttpStatus.CREATED)
  async requestPayout(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Body() dto: CreateRiderPayoutRequestDto,
  ) {
    const rider = await this.ridersService.getProfile(user.userId);
    return this.financeService.requestRiderPayout(rider.id, dto);
  }
}
