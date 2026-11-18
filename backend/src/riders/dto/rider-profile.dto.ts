import { IsLatitude, IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsDateString,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export type RiderVehicleType = 'bicycle' | 'motorcycle' | 'scooter' | 'ev' | 'other';
export type RiderVerificationStatus = 'pending' | 'approved' | 'rejected';
export type RiderAvailabilityStatus = 'offline' | 'available' | 'busy';

export class CreateRiderProfileDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  fullName!: string;

  @IsNotEmpty()
  @IsIn(['bicycle', 'motorcycle', 'scooter', 'ev', 'other'], {
    message: 'vehicleType must be one of: bicycle, motorcycle, scooter, ev, other',
  })
  vehicleType!: RiderVehicleType;

  @IsNotEmpty()
  @IsString()
  @MaxLength(30)
  vehicleNumber!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  licenseNumber!: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  profileImageUrl?: string;
}

export class UpdateRiderProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsIn(['bicycle', 'motorcycle', 'scooter', 'ev', 'other'], {
    message: 'vehicleType must be one of: bicycle, motorcycle, scooter, ev, other',
  })
  vehicleType?: RiderVehicleType;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  vehicleNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  profileImageUrl?: string;
}

export class UpdateRiderAvailabilityDto {
  @IsNotEmpty()
  @IsIn(['offline', 'available'], {
    message: 'availabilityStatus must be either "offline" or "available". "busy" is managed automatically by the delivery dispatch system.',
  })
  availabilityStatus!: 'offline' | 'available';

  /** Rider's current GPS position, sent when going online so the service-area check is current. */
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;
}

export class AdminVerifyRiderDto {
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

export class AdminSuspendRiderDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  suspensionReason!: string;
}

export class AdminRidersQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  verificationStatus?: RiderVerificationStatus;

  @IsOptional()
  @IsIn(['offline', 'available', 'busy'])
  availabilityStatus?: RiderAvailabilityStatus;

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
