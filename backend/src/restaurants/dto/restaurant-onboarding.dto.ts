import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const digits = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/\s+/g, '') : value);
const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/**
 * Restaurant self-registration form (restaurant app). Mirrors what Swiggy/Zomato ask for:
 * owner, restaurant and outlet details, FSSAI, PAN, optional GSTIN and payout bank details.
 * Numbers only; admin verifies them before approving.
 */
export class SubmitRestaurantApplicationDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  restaurantName!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Pick at least one cuisine.' })
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  cuisines!: string[];

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  ownerName!: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(255)
  ownerEmail?: string;

  /** Outlet phone customers and riders call. */
  @Transform(digits)
  @Matches(/^(\+91)?[6-9]\d{9}$/, { message: 'Enter a valid 10-digit Indian mobile number.' })
  contactPhone!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  outletAddress!: string;

  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @Transform(digits)
  @Matches(/^\d{14}$/, { message: 'FSSAI licence number must be 14 digits.' })
  fssaiNumber!: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsDateString({}, { message: 'FSSAI expiry must be a date (YYYY-MM-DD).' })
  fssaiExpiry?: string;

  @Transform(upper)
  @Matches(/^[A-Z]{5}\d{4}[A-Z]$/, { message: 'Enter a valid PAN, like ABCDE1234F.' })
  panNumber!: string;

  /** Optional: required by law only above the GST turnover threshold. */
  @Transform((p) => emptyToUndefined({ value: upper(p) }))
  @IsOptional()
  @Matches(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, { message: 'Enter a valid 15-character GSTIN.' })
  gstin?: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  bankAccountHolder!: string;

  @Transform(digits)
  @Matches(/^\d{9,18}$/, { message: 'Bank account number must be 9 to 18 digits.' })
  bankAccountNumber!: string;

  @Transform(upper)
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'Enter a valid IFSC, like HDFC0001234.' })
  bankIfsc!: string;
}

export type RestaurantApplicationStatus = 'none' | 'pending' | 'approved' | 'rejected' | 'suspended';
