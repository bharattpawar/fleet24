import test from 'node:test';
import assert from 'node:assert/strict';
import { canVerifyOtp, otpDeadlines, secondsRemaining } from '../src/utils/otp.ts';

test('uses the server cooldown and expiry relative to issue time', () => {
  const deadlines = otpDeadlines({ cooldownSeconds: 20, expiresInSeconds: 120 }, 1000);
  assert.deepEqual(deadlines, { resendAt: 21000, expiresAt: 121000 });
  assert.equal(secondsRemaining(deadlines.resendAt, 20001), 1);
  assert.equal(secondsRemaining(deadlines.resendAt, 21000), 0);
  assert.equal(secondsRemaining(deadlines.resendAt, 25000), 0);
});

test('only verifies a six-digit code before expiry', () => {
  assert.equal(canVerifyOtp('012345', 2000, 1999), true);
  assert.equal(canVerifyOtp('012345', 2000, 2000), false);
  assert.equal(canVerifyOtp('12a345', 2000, 1999), false);
  assert.equal(canVerifyOtp('12345', 2000, 1999), false);
});
