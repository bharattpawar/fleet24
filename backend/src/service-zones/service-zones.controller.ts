import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUserPayload, CurrentUser, Roles } from '../auth/decorators/auth.decorators';
import { ServiceZonesService } from './service-zones.service';
import { CreateServiceZoneDto, UpdateServiceZoneDto } from './dto/service-zone.dto';

/** Admin management of delivery service areas. */
@Controller('admin/service-zones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminServiceZonesController {
  constructor(private readonly zones: ServiceZonesService) {}

  @Get()
  list() {
    return this.zones.listAll();
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUserPayload, @Body() dto: CreateServiceZoneDto) {
    return this.zones.create(dto, user.userId);
  }

  @Patch(':zoneId')
  update(@Param('zoneId', new ParseUUIDPipe()) zoneId: string, @Body() dto: UpdateServiceZoneDto) {
    return this.zones.update(zoneId, dto);
  }
}

/** Active service areas, for app maps and the default browsing location. */
@Controller('public/service-zones')
export class PublicServiceZonesController {
  constructor(private readonly zones: ServiceZonesService) {}

  @Get()
  async listActive() {
    const zones = await this.zones.listActive();
    return zones.map(({ id, name, centerLatitude, centerLongitude, radiusMeters }) => ({
      id,
      name,
      centerLatitude,
      centerLongitude,
      radiusMeters,
    }));
  }
}
