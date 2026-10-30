import {
  Controller,
  Get,
  Patch,
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
import { AdminManagementService } from './admin-management.service';
import {
  AdminCustomerQueryDto,
  BlockCustomerDto,
  AdminRestaurantApplicationQueryDto,
  AdminVerifyRestaurantDto,
  AdminSuspendRestaurantDto,
  AdminUploadDocumentDto,
  AdminVerifyDocumentDto,
  AdminUpdateOutletOperationsDto,
} from './dto/admin-management.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminManagementController {
  constructor(private readonly adminService: AdminManagementService) {}

  // ==========================================
  // CUSTOMER MANAGEMENT
  // ==========================================

  /**
   * GET /api/v1/admin/customers
   * List customers with pagination, search, status, and order totals.
   */
  @Get('customers')
  async listCustomers(@Query() query: AdminCustomerQueryDto) {
    return this.adminService.listCustomers(query);
  }

  /**
   * GET /api/v1/admin/customers/:id
   * Get detailed customer profile with order & financial history.
   */
  @Get('customers/:id')
  async getCustomerDetails(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getCustomerDetails(id);
  }

  /**
   * PATCH /api/v1/admin/customers/:id/block
   * Block customer with mandatory reason.
   */
  @Patch('customers/:id/block')
  async blockCustomer(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BlockCustomerDto,
  ) {
    return this.adminService.blockCustomer(user.userId, id, dto);
  }

  /**
   * PATCH /api/v1/admin/customers/:id/unblock
   * Unblock customer.
   */
  @Patch('customers/:id/unblock')
  async unblockCustomer(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adminService.unblockCustomer(user.userId, id);
  }

  // ==========================================
  // RESTAURANT APPLICATION & VERIFICATION
  // ==========================================

  /**
   * GET /api/v1/admin/restaurants/applications
   * List restaurant onboarding applications.
   */
  @Get('restaurants/applications')
  async listRestaurantApplications(@Query() query: AdminRestaurantApplicationQueryDto) {
    return this.adminService.listRestaurantApplications(query);
  }

  /**
   * GET /api/v1/admin/restaurants/applications/:id
   * View details of a specific restaurant application.
   */
  @Get('restaurants/applications/:id')
  async getRestaurantApplicationDetails(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getRestaurantApplicationDetails(id);
  }

  /**
   * PATCH /api/v1/admin/restaurants/:id/verification
   * Approve or reject a restaurant application.
   */
  @Patch('restaurants/:id/verification')
  async verifyRestaurant(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminVerifyRestaurantDto,
  ) {
    return this.adminService.verifyRestaurant(user.userId, id, dto);
  }

  /**
   * PATCH /api/v1/admin/restaurants/:id/suspension
   * Suspend a restaurant with reason and deactivate outlets.
   */
  @Patch('restaurants/:id/suspension')
  async suspendRestaurant(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminSuspendRestaurantDto,
  ) {
    return this.adminService.suspendRestaurant(user.userId, id, dto);
  }

  /**
   * PATCH /api/v1/admin/restaurants/:id/unsuspend
   * Reinstate a suspended restaurant.
   */
  @Patch('restaurants/:id/unsuspend')
  async unsuspendRestaurant(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adminService.unsuspendRestaurant(user.userId, id);
  }

  // ==========================================
  // OUTLET OPERATIONAL MANAGEMENT
  // ==========================================

  /**
   * GET /api/v1/admin/restaurants/:id/outlets
   * List all outlets for a restaurant.
   */
  @Get('restaurants/:id/outlets')
  async listRestaurantOutlets(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.listRestaurantOutlets(id);
  }

  /**
   * PATCH /api/v1/admin/outlets/:outletId/operations
   * Operational control for activation and order acceptance.
   */
  @Patch('outlets/:outletId/operations')
  async updateOutletOperations(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('outletId', ParseUUIDPipe) outletId: string,
    @Body() dto: AdminUpdateOutletOperationsDto,
  ) {
    return this.adminService.updateOutletOperations(user.userId, outletId, dto);
  }

  // ==========================================
  // DOCUMENT MANAGEMENT
  // ==========================================

  /**
   * POST /api/v1/admin/restaurants/:id/documents
   * Attach verification document to a restaurant.
   */
  @Post('restaurants/:id/documents')
  async uploadDocument(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUploadDocumentDto,
  ) {
    return this.adminService.uploadDocument(user.userId, id, dto);
  }

  /**
   * PATCH /api/v1/admin/documents/:documentId/verification
   * Verify or reject a restaurant document.
   */
  @Patch('documents/:documentId/verification')
  async verifyDocument(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: AdminVerifyDocumentDto,
  ) {
    return this.adminService.verifyDocument(user.userId, documentId, dto);
  }
}

