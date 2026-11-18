import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GeoService } from './geo.service';
import { AutocompleteQueryDto, PlaceDetailsQueryDto, ReverseGeocodeQueryDto } from './dto/geo.dto';

/**
 * Location search for the customer address picker. Signed-in users only, so the server-side
 * Google key cannot be used anonymously.
 */
@Controller('geo')
@UseGuards(JwtAuthGuard)
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  /** GET /api/v1/geo/autocomplete?input=...&sessionToken=...&latitude=..&longitude=.. */
  @Get('autocomplete')
  autocomplete(@Query() query: AutocompleteQueryDto) {
    return this.geoService.autocomplete({
      input: query.input.trim(),
      sessionToken: query.sessionToken,
      latitude: query.latitude,
      longitude: query.longitude,
    });
  }

  /** GET /api/v1/geo/places/:placeId?sessionToken=... */
  @Get('places/:placeId')
  placeDetails(@Param('placeId') placeId: string, @Query() query: PlaceDetailsQueryDto) {
    if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) {
      throw new BadRequestException('Invalid place id.');
    }
    return this.geoService.placeDetails(placeId, query.sessionToken);
  }

  /** GET /api/v1/geo/reverse?latitude=..&longitude=.. */
  @Get('reverse')
  reverse(@Query() query: ReverseGeocodeQueryDto) {
    return this.geoService.reverseGeocode(query.latitude, query.longitude);
  }
}
