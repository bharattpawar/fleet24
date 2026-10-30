import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddCartItemDto {
  @IsUUID('4', { message: 'outletId must be a valid UUID' })
  @IsNotEmpty()
  outletId!: string;

  @IsUUID('4', { message: 'menuItemId must be a valid UUID' })
  @IsNotEmpty()
  menuItemId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'quantity must be at least 1' })
  @Max(50, { message: 'quantity cannot exceed 50 per item' })
  quantity!: number;
}

export class UpdateCartItemDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'quantity must be at least 1' })
  @Max(50, { message: 'quantity cannot exceed 50 per item' })
  quantity!: number;
}

export class CheckoutDto {
  @IsUUID('4', { message: 'deliveryAddressId must be a valid UUID' })
  @IsNotEmpty()
  deliveryAddressId!: string;

  @IsOptional()
  @IsString()
  customerInstructions?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class OrderPaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit: number = 20;
}
