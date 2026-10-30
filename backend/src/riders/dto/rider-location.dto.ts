import {
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateRiderLocationDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
  latitude!: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  longitude!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Accuracy must be non-negative (>= 0 meters)' })
  accuracy?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Heading must be between 0 and 360 degrees' })
  @Max(360, { message: 'Heading must be between 0 and 360 degrees' })
  heading?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Speed must be non-negative (>= 0)' })
  speed?: number;

  @IsOptional()
  @IsDateString({}, { message: 'capturedAt must be a valid ISO 8601 date string' })
  capturedAt?: string;
}

export type LocationFreshness = 'fresh' | 'stale' | 'missing';

export interface RiderLocationResponse {
  riderId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  capturedAt: Date | null;
  updatedAt: Date;
  freshness: LocationFreshness;
  ageSeconds: number;
}

