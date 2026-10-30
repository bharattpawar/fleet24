export interface ISmsProvider {
  /**
   * Sends an OTP to the given phone number.
   * In mock mode, it safely logs OTP to debug output without leaking in production.
   */
  sendOtp(phone: string, otp: string): Promise<boolean>;
}

export const SMS_PROVIDER_TOKEN = Symbol('SMS_PROVIDER_TOKEN');
