import { Type } from 'class-transformer';
import { IsBoolean, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateServiceZoneDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @Type(() => Number)
  @IsLatitude()
  centerLatitude!: number;

  @Type(() => Number)
  @IsLongitude()
  centerLongitude!: number;

  /** Radius of the delivery circle in km (0.5 to 50). */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(50)
  radiusKm!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateServiceZoneDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  centerLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  centerLongitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(50)
  radiusKm?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
