import {
  IsOptional,
  IsString,
  IsIn,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsNotEmpty,
  MaxLength,
  IsUUID,
  IsNumber,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AdminRiderEarningsQueryDto {
  @IsOptional()
  @IsUUID()
  riderId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export class CreateRiderPayoutRequestDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'Payout amount must be positive' })
  amount!: number;
}

export class AdminRiderPayoutQueryDto {
  @IsOptional()
  @IsUUID()
  riderId?: string;

  @IsOptional()
  @IsIn(['requested', 'approved', 'rejected', 'processing', 'processed', 'failed', 'all'])
  status?: string = 'all';

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export class AdminRejectPayoutDto {
  @IsNotEmpty({ message: 'Rejection reason is mandatory' })
  @IsString()
  @MaxLength(500)
  rejectionReason!: string;
}

export class AdminRestaurantSettlementQueryDto {
  @IsOptional()
  @IsUUID()
  restaurantId?: string;

  @IsOptional()
  @IsIn(['pending', 'approved', 'processing', 'settled', 'failed', 'all'])
  status?: string = 'all';

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export class GenerateSettlementDto {
  @IsNotEmpty()
  @IsUUID()
  restaurantId!: string;

  @IsNotEmpty()
  @IsDateString()
  periodStart!: string;

  @IsNotEmpty()
  @IsDateString()
  periodEnd!: string;
}

