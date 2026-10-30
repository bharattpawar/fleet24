import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISmsProvider } from './sms-provider.interface';

@Injectable()
export class MockSmsProvider implements ISmsProvider {
  private readonly logger = new Logger(MockSmsProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async sendOtp(phone: string, otp: string): Promise<boolean> {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    if (isProduction) {
      this.logger.error(
        `[CRITICAL] MockSmsProvider invoked in production! Real SMS provider (e.g. Twilio / MSG91) must be configured.`,
      );
      return false;
    }

    // Mask phone for log security
    const maskedPhone = phone.replace(/(\+\d{2})(\d{2})\d+(\d{2})/, '$1 $2******$3');
    this.logger.log(`[MOCK SMS] Sent OTP to ${maskedPhone}: [${otp}] (Local dev only)`);

    return true;
  }
}
