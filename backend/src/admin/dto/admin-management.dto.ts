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
  IsUrl,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AdminCustomerQueryDto {
  @IsOptional()
  @IsString()
  search?: string; // Search across name, phone, email

  @IsOptional()
  @IsIn(['active', 'blocked', 'all'])
  status?: 'active' | 'blocked' | 'all' = 'all';

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(['created_at', 'order_count'])
  sortBy?: 'created_at' | 'order_count' = 'created_at';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

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

export class BlockCustomerDto {
  @IsNotEmpty({ message: 'Reason for blocking customer is required' })
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class AdminRestaurantApplicationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected', 'suspended', 'all'])
  verificationStatus?: 'pending' | 'approved' | 'rejected' | 'suspended' | 'all' = 'all';

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

export class AdminVerifyRestaurantDto {
  @IsNotEmpty()
  @IsIn(['approved', 'rejected'], {
    message: 'verificationStatus must be either "approved" or "rejected"',
  })
  verificationStatus!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}

export class AdminSuspendRestaurantDto {
  @IsNotEmpty({ message: 'Suspension reason is required' })
  @IsString()
  @MaxLength(500)
  suspensionReason!: string;
}

export class AdminUploadDocumentDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  documentType!: string; // 'fssai_license', 'gst_certificate', 'pan_card', etc.

  @IsOptional()
  @IsString()
  @MaxLength(100)
  documentNumber?: string;

  @IsNotEmpty()
  @IsUrl({}, { message: 'documentUrl must be a valid URL or S3 storage URI' })
  documentUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  storageKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class AdminVerifyDocumentDto {
  @IsNotEmpty()
  @IsIn(['verified', 'rejected'], {
    message: 'status must be either "verified" or "rejected"',
  })
  status!: 'verified' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class AdminUpdateOutletOperationsDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isAcceptingOrders?: boolean;
}

