import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export enum RestaurantUpdatableStatus {
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY_FOR_PICKUP = 'ready_for_pickup',
  REJECTED = 'rejected',
}

export class UpdateRestaurantOrderStatusDto {
  @IsEnum(RestaurantUpdatableStatus, {
    message:
      'status must be one of: confirmed, preparing, ready_for_pickup, rejected',
  })
  @IsNotEmpty()
  status!: RestaurantUpdatableStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class RestaurantOrdersQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'outletId must be a valid UUID' })
  outletId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

