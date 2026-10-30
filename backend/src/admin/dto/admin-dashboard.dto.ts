import {
  IsOptional,
  IsIn,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export type DashboardPeriod =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'custom';

export class AdminDashboardFilterDto {
  @IsOptional()
  @IsIn(['today', 'yesterday', 'last_7_days', 'last_30_days', 'this_month', 'custom'], {
    message: 'period must be one of: today, yesterday, last_7_days, last_30_days, this_month, custom',
  })
  period?: DashboardPeriod = 'last_7_days';

  @IsOptional()
  @IsDateString({}, { message: 'from must be a valid ISO date string (YYYY-MM-DD or ISO 8601)' })
  from?: string;

  @IsOptional()
  @IsDateString({}, { message: 'to must be a valid ISO date string (YYYY-MM-DD or ISO 8601)' })
  to?: string;
}

export class AdminRecentActivityQueryDto {
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

  @IsOptional()
  @IsIn(['all', 'customer', 'restaurant', 'rider', 'order', 'delivery', 'payment', 'refund'], {
    message: 'type must be one of: all, customer, restaurant, rider, order, delivery, payment, refund',
  })
  type?: string = 'all';
}

