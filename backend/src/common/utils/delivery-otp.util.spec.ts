import { DeliveryOtpUtil } from './delivery-otp.util';

describe('DeliveryOtpUtil', () => {
  const secret = 'super-secret-fleet24-key';
  const orderId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  describe('generateOtp', () => {
    it('should generate a 6-digit numeric string', () => {
      for (let i = 0; i < 50; i++) {
        const otp = DeliveryOtpUtil.generateOtp();
        expect(otp).toHaveLength(6);
        expect(/^\d{6}$/.test(otp)).toBe(true);
        const numeric = parseInt(otp, 10);
        expect(numeric).toBeGreaterThanOrEqual(100000);
        expect(numeric).toBeLessThanOrEqual(999999);
      }
    });
  });

  describe('hashOtp and verifyOtp', () => {
    it('should verify a valid OTP correctly', () => {
      const otp = '742918';
      const hash = DeliveryOtpUtil.hashOtp(otp, secret, orderId);
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // sha256 hex string

      const isValid = DeliveryOtpUtil.verifyOtp(otp, secret, orderId, hash);
      expect(isValid).toBe(true);
    });

    it('should reject an incorrect OTP', () => {
      const otp = '742918';
      const wrongOtp = '742919';
      const hash = DeliveryOtpUtil.hashOtp(otp, secret, orderId);

      const isValid = DeliveryOtpUtil.verifyOtp(wrongOtp, secret, orderId, hash);
      expect(isValid).toBe(false);
    });

    it('should reject an OTP verified with a different orderId', () => {
      const otp = '742918';
      const hash = DeliveryOtpUtil.hashOtp(otp, secret, orderId);

      const isValid = DeliveryOtpUtil.verifyOtp(otp, secret, 'different-order-id', hash);
      expect(isValid).toBe(false);
    });

    it('should reject an OTP verified with a different secret', () => {
      const otp = '742918';
      const hash = DeliveryOtpUtil.hashOtp(otp, secret, orderId);

      const isValid = DeliveryOtpUtil.verifyOtp(otp, 'wrong-secret', orderId, hash);
      expect(isValid).toBe(false);
    });

    it('should reject empty or malformed inputs safely', () => {
      const hash = DeliveryOtpUtil.hashOtp('123456', secret, orderId);

      expect(DeliveryOtpUtil.verifyOtp('', secret, orderId, hash)).toBe(false);
      expect(DeliveryOtpUtil.verifyOtp('123456', secret, orderId, '')).toBe(false);
      expect(DeliveryOtpUtil.verifyOtp('123456', secret, orderId, 'short-hash')).toBe(false);
    });
  });

  describe('encryptOtp and decryptOtp (AES-256-GCM)', () => {
    const encKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    it('should encrypt and decrypt OTP successfully with authenticated integrity', () => {
      const plainOtp = '654321';
      const encrypted = DeliveryOtpUtil.encryptOtp(plainOtp, encKey);

      expect(typeof encrypted).toBe('string');
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3); // iv:tag:ciphertext

      const decrypted = DeliveryOtpUtil.decryptOtp(encrypted, encKey);
      expect(decrypted).toBe(plainOtp);
    });

    it('should fail decryption if wrong key is used', () => {
      const plainOtp = '123456';
      const encrypted = DeliveryOtpUtil.encryptOtp(plainOtp, encKey);
      const wrongKey = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

      expect(() => DeliveryOtpUtil.decryptOtp(encrypted, wrongKey)).toThrow();
    });

    it('should detect ciphertext tampering and fail authentication', () => {
      const plainOtp = '987654';
      const encrypted = DeliveryOtpUtil.encryptOtp(plainOtp, encKey);
      const [iv, tag, ciphertext] = encrypted.split(':');

      // Tamper with ciphertext by flipping last char
      const tamperedCiphertext =
        ciphertext.slice(0, -1) + (ciphertext.slice(-1) === 'a' ? 'b' : 'a');
      const tamperedPayload = `${iv}:${tag}:${tamperedCiphertext}`;

      expect(() => DeliveryOtpUtil.decryptOtp(tamperedPayload, encKey)).toThrow();
    });
  });
});
