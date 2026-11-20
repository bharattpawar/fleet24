import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FavoritesController } from './favorites.controller';
import { MediaController } from './media.controller';

@Module({
  imports: [AuthModule],
  controllers: [MediaController, FavoritesController],
})
export class MediaModule {}
