import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/auth.decorators';
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto, UpdatePromotionDto } from './dto/promotion.dto';

/** Admin management of coupon codes. Coupons are paid for by the platform, not the restaurant. */
@Controller('admin/promotions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminPromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get()
  list() {
    return this.promotions.listAll();
  }

  @Post()
  create(@Body() dto: CreatePromotionDto) {
    return this.promotions.create(dto);
  }

  @Patch(':promotionId')
  update(@Param('promotionId', new ParseUUIDPipe()) promotionId: string, @Body() dto: UpdatePromotionDto) {
    return this.promotions.update(promotionId, dto);
  }
}
