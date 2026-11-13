import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  Roles,
  CurrentUser,
  AuthenticatedUserPayload,
} from '../auth/decorators/auth.decorators';
import { RestaurantsService } from './restaurants.service';
import {
  RestaurantSettlementQueryDto,
  RestaurantFinancialSummaryQueryDto,
} from './dto/restaurant-finance.dto';

@Controller('restaurant')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('restaurant_staff', 'admin')
export class RestaurantProfileController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  /**
   * GET /api/v1/restaurant/profile
   * Returns authenticated staff member details and all authorized outlets.
   */
  @Get('profile')
  async getProfile(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.restaurantsService.getRestaurantStaffProfile(user);
  }

  /**
   * GET /api/v1/restaurant/settlements
   * Paginated settlement records for caller's authorized restaurant(s).
   */
  @Get('settlements')
  async getSettlements(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Query() query: RestaurantSettlementQueryDto,
  ) {
    return this.restaurantsService.getRestaurantSettlements(user, query);
  }

  /**
   * GET /api/v1/restaurant/finance/summary
   * Financial summary and monthly delivery credit status for authorized restaurant(s).
   */
  @Get('finance/summary')
  async getFinancialSummary(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Query() query: RestaurantFinancialSummaryQueryDto,
  ) {
    return this.restaurantsService.getRestaurantFinancialSummary(user, query);
  }
}

