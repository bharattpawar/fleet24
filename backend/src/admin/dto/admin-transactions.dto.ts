import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { paymentStatusEnum, refundStatusEnum } from '../../database/schema/enums';

class TransactionQueryDto {
  @IsOptional() @IsString() @MaxLength(120)
  search?: string;

  @IsOptional() @IsISO8601({ strict: true })
  from?: string;

  @IsOptional() @IsISO8601({ strict: true })
  to?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000000)
  page = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 20;
}

export class AdminPaymentQueryDto extends TransactionQueryDto {
  @IsOptional() @IsIn(paymentStatusEnum.enumValues)
  status?: (typeof paymentStatusEnum.enumValues)[number];

  @IsOptional() @IsUUID()
  outletId?: string;
}

export class AdminRefundQueryDto extends TransactionQueryDto {
  @IsOptional() @IsIn(refundStatusEnum.enumValues)
  status?: (typeof refundStatusEnum.enumValues)[number];

  @IsOptional() @IsIn(['true', 'false'])
  needsReview?: 'true' | 'false';
}
