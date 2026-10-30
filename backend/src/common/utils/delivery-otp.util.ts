import * as crypto from 'crypto';

export class DeliveryOtpUtil {
  /**
   * Generates a cryptographically secure 6-digit numeric OTP ('100000' to '999999')
   */
  static generateOtp(): string {
    const num = crypto.randomInt(100000, 1000000);
    return num.toString();
  }

  /**
   * Hashes the OTP using server-secret HMAC-SHA256 with deliveryId or orderId salt.
   * This protects 6-digit OTPs against offline dictionary attacks by a database-only attacker.
   */
  static hashOtp(otp: string, secret: string, orderId: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(`${orderId}:${otp.trim()}`)
      .digest('hex');
  }

  /**
   * Constant-time comparison to prevent timing side-channel attacks.
   */
  static verifyOtp(otp: string, secret: string, orderId: string, expectedHash: string): boolean {
    if (!expectedHash || !otp) return false;
    const computedHash = this.hashOtp(otp, secret, orderId);
    try {
      const computedBuf = Buffer.from(computedHash, 'hex');
      const expectedBuf = Buffer.from(expectedHash, 'hex');
      if (computedBuf.length !== expectedBuf.length) return false;
      return crypto.timingSafeEqual(computedBuf, expectedBuf);
    } catch {
      return false;
    }
  }
}

