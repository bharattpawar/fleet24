export function isDevAuthBypassEnabled(isDevelopment: boolean, value?: string): boolean {
  return isDevelopment && value === 'true';
}
