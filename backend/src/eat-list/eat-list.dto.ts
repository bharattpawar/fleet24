import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class EatListPlanDto {
  @IsOptional() @IsString() @MaxLength(1000) note?: string | null;
  @IsOptional() @IsString() @MaxLength(10) plannedDate?: string | null;
  @IsOptional() @IsString() @MaxLength(5) plannedTime?: string | null;
  @IsOptional() @IsString() @MaxLength(64) timeZone?: string | null;
}
export class SaveEatListDto extends EatListPlanDto {
  @IsUUID() outletId!: string;
  @IsUUID() menuItemId!: string;
}
export class EatListQueryDto {
  @IsOptional() @IsIn(['all', 'planned', 'someday']) mode: 'all' | 'planned' | 'someday' = 'all';
  @IsOptional() @IsString() @MaxLength(10) date?: string;
  @IsOptional() @IsString() @MaxLength(600) cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}
export class EatListMembershipDto {
  @IsUUID() outletId!: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  itemIds!: string[];
}
