import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, CurrentUser, AuthenticatedUserPayload } from '../auth/decorators/auth.decorators';

@Controller('cart')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('customer')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.cartService.getCart(user.userId);
  }

  @Post('items')
  @HttpCode(HttpStatus.OK)
  async addItem(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Body() dto: AddCartItemDto,
  ) {
    return this.cartService.addItem(user.userId, dto);
  }

  @Patch('items/:itemId')
  async updateItemQuantity(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItemQuantity(user.userId, itemId, dto);
  }

  @Delete('items/:itemId')
  async removeItem(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('itemId') itemId: string,
  ) {
    return this.cartService.removeItem(user.userId, itemId);
  }

  @Delete()
  async clearCart(@CurrentUser() user: AuthenticatedUserPayload) {
    return this.cartService.clearCart(user.userId);
  }
}
