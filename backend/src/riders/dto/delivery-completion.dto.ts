import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CompleteDeliveryDto {
  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 numeric digits' })
  @Matches(/^\d{6}$/, { message: 'OTP must consist only of numeric digits' })
  otp!: string;
}

export interface CustomerDeliveryTrackingResponse {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  deliveryStatus: string;
  deliveryOtp?: string; // Only returned if order is out_for_delivery / arrived_customer and viewer is order owner
  otpExpiresAt?: Date | null;
  restaurant: {
    name: string;
    address: string;
    phone: string;
  };
  rider?: {
    fullName: string | null;
    vehicleType: string;
    vehicleNumber: string | null;
    location?: {
      latitude: number;
      longitude: number;
      accuracy?: number | null;
      heading?: number | null;
      speed?: number | null;
      capturedAt?: Date | null;
      updatedAt: Date;
      freshness: string;
      ageSeconds: number;
    } | null;
  } | null;
  timestamps: {
    placedAt: Date | null;
    confirmedAt: Date | null;
    assignedAt: Date | null;
    pickedUpAt: Date | null;
    arrivedCustomerAt: Date | null;
    deliveredAt: Date | null;
  };
  deliveryAddress: any;
}

