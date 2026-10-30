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
import { AdminFinanceService } from './admin-finance.service';
import {
  AdminRiderEarningsQueryDto,
  AdminRiderPayoutQueryDto,
  AdminRejectPayoutDto,
  AdminRestaurantSettlementQueryDto,
  GenerateSettlementDto,
} from './dto/admin-finance.dto';

@Controller('admin/finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminFinanceController {
  constructor(private readonly financeService: AdminFinanceService) {}

  // ==========================================
  // FINANCIAL OVERVIEW & RECONCILIATION
  // ==========================================

  /**
   * GET /api/v1/admin/finance/overview
   * Platform monetary summary (collections, rider payouts, restaurant settlements, net balance)
   */
  @Get('overview')
  async getOverview() {
    return this.financeService.getFinancialOverview();
  }

  /**
   * GET /api/v1/admin/finance/reconciliation
   * Runs integrity reconciliation to detect uncredited deliveries, mismatches, or failed payouts
   */
  @Get('reconciliation')
  async runReconciliation() {
    return this.financeService.runFinancialReconciliation();
  }

  /**
   * GET /api/v1/admin/finance/ledger
   * Immutable financial audit ledger with filters
   */
  @Get('ledger')
  async getLedgerEntries(
    @Query('entityType') entityType?: 'rider' | 'restaurant' | 'platform' | 'customer',
    @Query('entityId') entityId?: string,
    @Query('entryType') entryType?: string,
    @Query('orderId') orderId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.financeService.getLedgerEntries({
      entityType,
      entityId,
      entryType,
      orderId,
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  // ==========================================
  // RIDER EARNINGS & PAYOUTS
  // ==========================================

  /**
   * GET /api/v1/admin/finance/riders/earnings
   * Paginated order-wise earnings of riders
   */
  @Get('riders/earnings')
  async listRiderEarnings(@Query() query: AdminRiderEarningsQueryDto) {
    return this.financeService.listRiderEarnings(query);
  }

  /**
   * GET /api/v1/admin/finance/riders/:riderId/earnings-summary
   * Rider balance and lifetime earnings breakdown
   */
  @Get('riders/:riderId/earnings-summary')
  async getRiderEarningsSummary(@Param('riderId', ParseUUIDPipe) riderId: string) {
    return this.financeService.getRiderEarningsSummary(riderId);
  }

  /**
   * GET /api/v1/admin/finance/riders/payouts
   * Paginated list of rider payouts by status/date
   */
  @Get('riders/payouts')
  async listRiderPayouts(@Query() query: AdminRiderPayoutQueryDto) {
    return this.financeService.listRiderPayouts(query);
  }

  /**
   * POST /api/v1/admin/finance/riders/payouts/:payoutId/approve
   * Transition requested payout to approved
   */
  @Post('riders/payouts/:payoutId/approve')
  async approveRiderPayout(
    @CurrentUser() adminUser: AuthenticatedUserPayload,
    @Param('payoutId', ParseUUIDPipe) payoutId: string,
  ) {
    return this.financeService.approveRiderPayout(adminUser.userId, payoutId);
  }

  /**
   * POST /api/v1/admin/finance/riders/payouts/:payoutId/reject
   * Reject payout request with mandatory reason
   */
  @Post('riders/payouts/:payoutId/reject')
  async rejectRiderPayout(
    @CurrentUser() adminUser: AuthenticatedUserPayload,
    @Param('payoutId', ParseUUIDPipe) payoutId: string,
    @Body() dto: AdminRejectPayoutDto,
  ) {
    return this.financeService.rejectRiderPayout(adminUser.userId, payoutId, dto);
  }

  /**
   * POST /api/v1/admin/finance/riders/payouts/:payoutId/process
   * Execute payout disbursement via provider and post debit to ledger
   */
  @Post('riders/payouts/:payoutId/process')
  async processRiderPayout(
    @CurrentUser() adminUser: AuthenticatedUserPayload,
    @Param('payoutId', ParseUUIDPipe) payoutId: string,
  ) {
    return this.financeService.processRiderPayout(adminUser.userId, payoutId);
  }

  // ==========================================
  // RESTAURANT SETTLEMENTS
  // ==========================================

  /**
   * POST /api/v1/admin/finance/restaurants/settlements/generate
   * Compute delivered orders, deductions, and generate settlement record
   */
  @Post('restaurants/settlements/generate')
  async generateRestaurantSettlement(
    @CurrentUser() adminUser: AuthenticatedUserPayload,
    @Body() dto: GenerateSettlementDto,
  ) {
    return this.financeService.generateRestaurantSettlement(adminUser.userId, dto);
  }

  /**
   * GET /api/v1/admin/finance/restaurants/settlements
   * Paginated restaurant settlements list
   */
  @Get('restaurants/settlements')
  async listRestaurantSettlements(@Query() query: AdminRestaurantSettlementQueryDto) {
    return this.financeService.listRestaurantSettlements(query);
  }

  /**
   * POST /api/v1/admin/finance/restaurants/settlements/:settlementId/approve
   * Approve settlement for disbursement
   */
  @Post('restaurants/settlements/:settlementId/approve')
  async approveRestaurantSettlement(
    @CurrentUser() adminUser: AuthenticatedUserPayload,
    @Param('settlementId', ParseUUIDPipe) settlementId: string,
  ) {
    return this.financeService.approveRestaurantSettlement(adminUser.userId, settlementId);
  }

  /**
   * POST /api/v1/admin/finance/restaurants/settlements/:settlementId/process
   * Process restaurant settlement disbursement and record ledger debit
   */
  @Post('restaurants/settlements/:settlementId/process')
  async processRestaurantSettlement(
    @CurrentUser() adminUser: AuthenticatedUserPayload,
    @Param('settlementId', ParseUUIDPipe) settlementId: string,
  ) {
    return this.financeService.processRestaurantSettlement(adminUser.userId, settlementId);
  }
}
