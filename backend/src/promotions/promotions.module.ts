import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PromotionsService } from './promotions.service';
import { AdminPromotionsController } from './promotions.controller';

@Module({
  imports: [AuthModule],
  controllers: [AdminPromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
