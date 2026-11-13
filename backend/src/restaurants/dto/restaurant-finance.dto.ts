import {
  IsOptional,
  IsString,
  IsIn,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RestaurantSettlementQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'restaurantId must be a valid UUID v4' })
  restaurantId?: string;

  @IsOptional()
  @IsIn(['pending', 'approved', 'processing', 'settled', 'failed', 'all'], {
    message: 'Invalid settlement status filter',
  })
  status?: string = 'all';

  @IsOptional()
  @IsDateString({}, { message: 'from date must be a valid ISO-8601 date string' })
  from?: string;

  @IsOptional()
  @IsDateString({}, { message: 'to date must be a valid ISO-8601 date string' })
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class RestaurantFinancialSummaryQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'restaurantId must be a valid UUID v4' })
  restaurantId?: string;
}
