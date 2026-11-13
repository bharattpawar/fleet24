import { IsNotEmpty, IsString, IsIn, IsOptional } from 'class-validator';

export class RegisterDeviceTokenDto {
  @IsNotEmpty()
  @IsString()
  token!: string;

  @IsOptional()
  @IsIn(['android', 'ios', 'web'])
  platform?: 'android' | 'ios' | 'web';
}

