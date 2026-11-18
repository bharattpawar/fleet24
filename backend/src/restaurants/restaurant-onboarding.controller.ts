import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUserPayload, CurrentUser } from '../auth/decorators/auth.decorators';
import { RestaurantOnboardingService } from './restaurant-onboarding.service';
import { SubmitRestaurantApplicationDto } from './dto/restaurant-onboarding.dto';

/**
 * Restaurant self-registration. Any signed-in user may apply; a new phone signs in as a customer
 * and gains the restaurant_staff role on submit (the app refreshes its session afterwards).
 */
@Controller('restaurant-onboarding')
@UseGuards(JwtAuthGuard)
export class RestaurantOnboardingController {
  constructor(private readonly onboarding: RestaurantOnboardingService) {}

  /** GET /api/v1/restaurant-onboarding/me: none | pending | approved | rejected | suspended. */
  @Get('me')
  getMine(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.onboarding.getMyApplication(user.userId);
  }

  /** POST /api/v1/restaurant-onboarding: submit, or re-submit after a rejection. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  submit(@CurrentUser() user: AuthenticatedUserPayload, @Body() dto: SubmitRestaurantApplicationDto) {
    return this.onboarding.submit(user.userId, dto);
  }
}
