import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { UsersService } from './users.service';
import { UpdateProfileDto } from '../auth/dto/auth.dto';
import { CreateAddressDto } from './dto/address.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUserPayload } from '../auth/decorators/auth.decorators';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Update permitted profile fields for the authenticated user
   */
  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.userId, dto);
  }

  /**
   * Get user saved delivery addresses
   */
  @Get('addresses')
  async getAddresses(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.usersService.getAddresses(user.userId);
  }

  /**
   * Create new delivery address
   */
  @Post('addresses')
  async createAddress(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Body() dto: CreateAddressDto,
  ) {
    return this.usersService.createAddress(user.userId, dto);
  }
}

