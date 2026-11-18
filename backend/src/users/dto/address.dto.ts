import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsNotEmpty({ message: 'addressLine1 is required' })
  addressLine1!: string;

  @IsString()
  @IsOptional()
  addressLine2?: string;

  @IsString()
  @IsOptional()
  landmark?: string;

  @IsString()
  @IsNotEmpty({ message: 'city is required' })
  city!: string;

  @IsString()
  @IsNotEmpty({ message: 'postalCode is required' })
  postalCode!: string;

  @IsString()
  @IsNotEmpty({ message: 'latitude is required' })
  latitude!: string;

  @IsString()
  @IsNotEmpty({ message: 'longitude is required' })
  longitude!: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

/** Partial update; latitude and longitude must be sent together (checked in the service). */
export class UpdateAddressDto {
  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  addressLine1?: string;

  @IsString()
  @IsOptional()
  addressLine2?: string;

  @IsString()
  @IsOptional()
  landmark?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  city?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  postalCode?: string;

  @IsString()
  @IsOptional()
  latitude?: string;

  @IsString()
  @IsOptional()
  longitude?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
