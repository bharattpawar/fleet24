import { IsString, Matches, Length } from 'class-validator';

export const INDIAN_MOBILE_PATTERN = /^(\+91)?[6-9]\d{9}$/;

export class IndianMobileDto {
  @IsString()
  @Matches(INDIAN_MOBILE_PATTERN, { message: 'phone must be a valid Indian mobile number' })
  phone!: string;
}

/** The auth service checks mobile numbers before issuing or verifying an OTP. */
export class RequestOtpDto {
  @IsString()
  phone!: string;
}

export class VerifyOtpDto extends RequestOtpDto {
  @IsString()
  @Length(6, 6, { message: 'otp must be a 6-digit numeric string' })
  @Matches(/^\d{6}$/, { message: 'otp must contain only digits' })
  otp!: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}

export class UpdateProfileDto {
  @IsString()
  @Length(2, 100, { message: 'fullName must be between 2 and 100 characters' })
  fullName!: string;
}

export class GoogleAuthDto {
  @IsString()
  idToken!: string;
}
