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
} from 'class-validator';
import { Type } from 'class-transformer';

export class AdminOrderQueryDto {
  @IsOptional()
  @IsString()
  search?: string; // Order number, customer name, customer phone, restaurant name, outlet name

  @IsOptional()
  @IsString()
  orderStatus?: string;

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  deliveryStatus?: string;

  @IsOptional()
  @IsUUID()
  restaurantId?: string;

  @IsOptional()
  @IsUUID()
  outletId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

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
  @IsIn(['all', 'cancelled', 'active'])
  cancellationStatus?: 'all' | 'cancelled' | 'active' = 'all';

  @IsOptional()
  @IsIn(['newest', 'oldest', 'highest_value', 'lowest_value'])
  sortBy?: 'newest' | 'oldest' | 'highest_value' | 'lowest_value' = 'newest';

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

export class AdminCancelOrderDto {
  @IsNotEmpty({ message: 'Cancellation reason is mandatory for administrative interventions' })
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class AdminActiveDeliveriesQueryDto {
  @IsOptional()
  @IsString()
  deliveryStatus?: string; // 'assigned', 'accepted', 'at_restaurant', 'picked_up', 'arrived_customer'

  @IsOptional()
  @IsUUID()
  restaurantId?: string;

  @IsOptional()
  @IsUUID()
  outletId?: string;

  @IsOptional()
  @IsUUID()
  riderId?: string;

  @IsOptional()
  @IsIn(['fresh', 'stale', 'all'])
  locationFreshness?: 'fresh' | 'stale' | 'all' = 'all';

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

