import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreatePromotionDto {
  /** Code the customer types, e.g. WELCOME50. Saved in capitals. */
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,30}$/, { message: 'code must be 3-30 letters, numbers, - or _' })
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsIn(['percentage', 'fixed_amount'])
  discountType!: 'percentage' | 'fixed_amount';

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  discountValue!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  maxDiscountAmount?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimitPerUser?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalUsageLimit?: number | null;

  @IsDateString()
  validFrom!: string;

  @IsDateString()
  validUntil!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePromotionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsIn(['percentage', 'fixed_amount'])
  discountType?: 'percentage' | 'fixed_amount';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  discountValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  maxDiscountAmount?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimitPerUser?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalUsageLimit?: number | null;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ApplyPromoCodeDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,30}$/, { message: 'Enter a valid coupon code.' })
  code!: string;
}
