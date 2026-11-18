import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsOptional, IsString, Length, Matches } from 'class-validator';

export class AutocompleteQueryDto {
  @IsString()
  @Length(2, 120)
  input!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{8,64}$/)
  sessionToken?: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;
}

export class PlaceDetailsQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{8,64}$/)
  sessionToken?: string;
}

export class ReverseGeocodeQueryDto {
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @Type(() => Number)
  @IsLongitude()
  longitude!: number;
}
