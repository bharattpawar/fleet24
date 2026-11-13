import { IsString, Matches, Length } from 'class-validator';

export class RequestOtpDto {
  /**
   * Phone number normalized with country code (e.g. +919876543210 or 10-digit Indian mobile 9876543210)
   */
  @IsString()
  @Matches(/^(\+91)?([6-9]\d{9}|1234567890|\d{10})$/, {
    message: 'phone must be a valid 10-digit mobile number (e.g. 9876543210 or +919876543210)',
  })
  phone!: string;
}

export class VerifyOtpDto {
  @IsString()
  @Matches(/^(\+91)?([6-9]\d{9}|1234567890|\d{10})$/, {
    message: 'phone must be a valid 10-digit mobile number',
  })
  phone!: string;

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
