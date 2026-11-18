import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsIn,
  IsInt,
  Min,
  Max,
  IsNumber,
  IsPositive,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RiderDistanceSlabDto {
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  upToKm!: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  rate!: number;
}

export class PeakHourSlotDto {
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  @Max(23)
  startHour!: number;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  @Max(23)
  endHour!: number;
}

export class RiderEarningsConfigDto {
  @IsNotEmpty()
  @IsIn(['fixed_per_delivery', 'distance_rate', 'base_plus_distance', 'distance_slabs'])
  calculationStrategy!: 'fixed_per_delivery' | 'distance_rate' | 'base_plus_distance' | 'distance_slabs';

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  baseEarning!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  additionalPerKmRate?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RiderDistanceSlabDto)
  distanceSlabs?: RiderDistanceSlabDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  minDeliveryEarning?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDeliveryEarning?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  peakHourMultiplier?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PeakHourSlotDto)
  peakHours?: PeakHourSlotDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  waitingTimeRatePerMinute?: number;
}

export class RestaurantCommissionConfigDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercentage!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedCommissionPerOrder?: number;

  @IsNotEmpty()
  @IsIn(['item_total', 'item_total_minus_discounts', 'total_payable'])
  commissionBasis!: 'item_total' | 'item_total_minus_discounts' | 'total_payable';
}

export class CustomerDeliveryFeeConfigDto {
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  freeOrderThresholdCount!: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  baseDeliveryFeeAfterFree!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  additionalPerKmFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minDeliveryFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDeliveryFee?: number;

  @IsOptional()
  @IsBoolean()
  cancelledOrdersConsumeFreeQuota: boolean = false;
}

export class RestaurantMonthlyCreditBlockConfigDto {
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  monthlyDeliveriesQuota!: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  additionalPerDeliveryFee!: number;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  billingPeriodMonths!: number;
}

export class IncentivesConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  riderPromotionalBonus?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  peakBonusFlat?: number;
}

export class DeliveryServiceabilityConfigDto {
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(50000)
  maxRoadDistanceMeters: number = 3000;

  /** Shortest delivery time promised to customers, in minutes. */
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  minDeliveryMinutes?: number;

  /** Prep + pickup minutes added before road travel time. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  handlingMinutes?: number;

  /** Maximum rider-to-restaurant distance for dispatch offers, in meters. */
  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(20000)
  riderPickupRadiusMeters?: number;
}

export class FinancialSettingsPayloadDto {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => RiderEarningsConfigDto)
  riderEarnings!: RiderEarningsConfigDto;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => RestaurantCommissionConfigDto)
  restaurantCommission!: RestaurantCommissionConfigDto;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => CustomerDeliveryFeeConfigDto)
  customerDeliveryFee!: CustomerDeliveryFeeConfigDto;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => RestaurantMonthlyCreditBlockConfigDto)
  restaurantMonthlyCreditBlock!: RestaurantMonthlyCreditBlockConfigDto;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => IncentivesConfigDto)
  incentives!: IncentivesConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryServiceabilityConfigDto)
  deliveryServiceability?: DeliveryServiceabilityConfigDto;
}

export class CreateFinancialSettingsDraftDto {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => FinancialSettingsPayloadDto)
  settingsPayload!: FinancialSettingsPayloadDto;

  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  changeReason!: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}

export class UpdateFinancialSettingsDraftDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => FinancialSettingsPayloadDto)
  settingsPayload?: FinancialSettingsPayloadDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeReason?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}

export class PublishFinancialSettingsDto {
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class PreviewCalculationDto {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => FinancialSettingsPayloadDto)
  proposedSettings!: FinancialSettingsPayloadDto;

  @IsOptional()
  riderSample?: {
    distanceKm?: number;
    orderPlacedHour?: number;
    waitingMinutes?: number;
  };

  @IsOptional()
  restaurantSample?: {
    itemTotal?: number;
    discountAmount?: number;
    refundDeductions?: number;
  };

  @IsOptional()
  customerSample?: {
    customerPriorCompletedOrdersCount?: number;
    distanceKm?: number;
    itemTotal?: number;
  };
}

export class AdminSettingsHistoryQueryDto {
  @IsOptional()
  @IsIn(['draft', 'scheduled', 'active', 'superseded', 'archived', 'all'])
  status?: string = 'all';

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

