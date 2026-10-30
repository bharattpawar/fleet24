import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class RejectDeliveryOfferDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export interface DeliveryOfferDetails {
  orderId: string;
  orderNumber: string;
  deliveryId: string;
  outletName: string;
  outletAddress: string;
  outletPhone: string;
  distanceMeters: number;
  distanceKm: number;
  offerExpiresAt: Date;
  remainingSeconds: number;
  itemTotal: string;
  totalPayable: string;
  deliveryAddress: {
    label?: string;
    city?: string;
    postalCode?: string;
    landmark?: string;
  };
}

