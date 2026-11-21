import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EatListController } from './eat-list.controller';
import { EatListRepository } from './eat-list.repository';
import { EatListService } from './eat-list.service';
@Module({
  imports: [AuthModule],
  controllers: [EatListController],
  providers: [EatListRepository, EatListService],
})
export class EatListModule {}
