import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
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
import { RiderAssignmentService } from './rider-assignment.service';
import {
  AdminVerifyRiderDto,
  AdminSuspendRiderDto,
  AdminRidersQueryDto,
} from './dto/rider-profile.dto';

@Controller('admin/riders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminRidersController {
  constructor(
    private readonly ridersService: RidersService,
    private readonly riderAssignmentService: RiderAssignmentService,
  ) {}

  /**
   * GET /api/v1/admin/riders
   * List all riders with pagination and filters
   */
  @Get()
  async listRiders(@Query() query: AdminRidersQueryDto) {
    return this.ridersService.adminListRiders(query);
  }

  /**
   * GET /api/v1/admin/riders/:id
   * Get rider details by rider ID
   */
  @Get(':id')
  async getRider(@Param('id', ParseUUIDPipe) id: string) {
    return this.ridersService.adminGetRider(id);
  }

  /**
   * PATCH /api/v1/admin/riders/:id/verification
   * Approve or reject rider verification
   */
  @Patch(':id/verification')
  async verifyRider(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminVerifyRiderDto,
  ) {
    return this.ridersService.adminVerifyRider(user.userId, id, dto);
  }

  /**
   * PATCH /api/v1/admin/riders/:id/suspension
   * Suspend a rider with a mandatory reason
   */
  @Patch(':id/suspension')
  async suspendRider(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminSuspendRiderDto,
  ) {
    return this.ridersService.adminSuspendRider(user.userId, id, dto);
  }

  /**
   * PATCH /api/v1/admin/riders/:id/unsuspend
   * Lift suspension on a rider
   */
  @Patch(':id/unsuspend')
  async unsuspendRider(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ridersService.adminUnsuspendRider(user.userId, id);
  }

  /**
   * POST /api/v1/admin/riders/orders/:orderId/assign
   * Admin-triggered manual or retry assignment dispatch for an order
   */
  @Post('orders/:orderId/assign')
  async assignOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.riderAssignmentService.assignOrder(orderId);
  }
}

