export function otpDeadlines(
  response: { cooldownSeconds: number; expiresInSeconds: number },
  now: number,
) {
  return {
    resendAt: now + response.cooldownSeconds * 1000,
    expiresAt: now + response.expiresInSeconds * 1000,
  };
}

export function secondsRemaining(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function canVerifyOtp(code: string, expiresAt: number, now: number): boolean {
  return /^\d{6}$/.test(code) && now < expiresAt;
}
