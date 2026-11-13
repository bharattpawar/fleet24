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

  /**
   * Resolves a valid 32-byte Buffer from the provided key string (hex, base64 or utf-8 with sha256 derivation)
   */
  private static resolveKeyBuffer(rawKey: string): Buffer {
    if (!rawKey || typeof rawKey !== 'string') {
      throw new Error('Delivery OTP encryption key is required');
    }
    const trimmed = rawKey.trim();
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return Buffer.from(trimmed, 'hex');
    }
    // If base64 32 bytes
    try {
      const b64Buf = Buffer.from(trimmed, 'base64');
      if (b64Buf.length === 32) return b64Buf;
    } catch {}
    // Otherwise derive deterministic 32-byte key via sha256
    return crypto.createHash('sha256').update(trimmed).digest();
  }

  /**
   * Authenticated Encryption: Encrypts OTP using AES-256-GCM.
   * Returns formatted string: `${ivHex}:${authTagHex}:${ciphertextHex}`
   */
  static encryptOtp(otp: string, encryptionKey: string): string {
    const keyBuf = this.resolveKeyBuffer(encryptionKey);
    const iv = crypto.randomBytes(12); // standard 96-bit IV for AES-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);

    const ciphertext = Buffer.concat([
      cipher.update(otp.trim(), 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
  }

  /**
   * Authenticated Decryption: Decrypts AES-256-GCM payload.
   * Verifies authentication tag to prevent tampering.
   */
  static decryptOtp(payload: string, encryptionKey: string): string {
    if (!payload) {
      throw new Error('Encrypted OTP payload is empty');
    }
    const parts = payload.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted OTP payload structure');
    }

    const [ivHex, authTagHex, ciphertextHex] = parts;
    const keyBuf = this.resolveKeyBuffer(encryptionKey);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}

