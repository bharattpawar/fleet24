import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GeoModule } from '../geo/geo.module';
import { ServiceZonesService } from './service-zones.service';
import { AdminServiceZonesController, PublicServiceZonesController } from './service-zones.controller';

@Module({
  imports: [AuthModule, GeoModule],
  controllers: [AdminServiceZonesController, PublicServiceZonesController],
  providers: [ServiceZonesService],
  exports: [ServiceZonesService],
})
export class ServiceZonesModule {}
