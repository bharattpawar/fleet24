import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  MaxLength,
  Matches,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  IsIn,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export class CreateRestaurantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters, numbers, and hyphens (e.g. bikanervala-greater-noida)',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;
}

export class UpdateRestaurantDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;
}

export class UpdateRestaurantStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

export class CreateOutletDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+91)?[6-9]\d{9}$/, {
    message: 'phone must be a valid 10-digit Indian phone number',
  })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(25)
  deliveryRadiusKm?: number = 3.0;
}

export class UpdateOutletDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(\+91)?[6-9]\d{9}$/, {
    message: 'phone must be a valid 10-digit Indian phone number',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(25)
  deliveryRadiusKm?: number;
}

export class UpdateOrderAcceptanceDto {
  @IsBoolean()
  isAcceptingOrders!: boolean;
}

export class UpdateOutletStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

export class OperatingHourDayDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(6)
  dayOfWeek!: number; // 0 = Sunday, 6 = Saturday

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'openTime must be a valid HH:MM or HH:MM:SS format',
  })
  openTime!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'closeTime must be a valid HH:MM or HH:MM:SS format',
  })
  closeTime!: string;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean = false;
}

export class CreateMenuCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  displayOrder?: number = 0;
}

export class UpdateMenuCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateMenuItemDto {
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'basePrice must be greater than 0' })
  basePrice!: number;

  @IsOptional()
  @IsBoolean()
  isVeg?: boolean = true;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean = true;
}

export class UpdateMenuItemDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  basePrice?: number;

  @IsOptional()
  @IsBoolean()
  isVeg?: boolean;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  /** Restaurant's own discount on this dish; null removes it. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(['percentage', 'fixed_amount'])
  discountType?: 'percentage' | 'fixed_amount' | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  discountValue?: number | null;
}

export class UpdateMenuItemAvailabilityDto {
  @IsBoolean()
  isAvailable!: boolean;
}

export class OutletMenuItemOverrideDto {
  @IsBoolean()
  isAvailable!: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  customPrice?: number;
}
