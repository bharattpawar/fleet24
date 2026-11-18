import { isIPv4 } from 'node:net';

function parseHttpOrigin(value: string): URL | null {
  if (!/^https?:\/\/[^/?#\s]+\/?$/i.test(value)) return null;
  try {
    const url = new URL(value);
    return url.username || url.password ? null : url;
  } catch {
    return null;
  }
}

export function parseCorsOrigins(value?: string): string[] {
  if (!value?.trim()) return [];
  return value.split(',').map((entry) => {
    const url = parseHttpOrigin(entry.trim());
    if (!url) throw new Error('CORS_ORIGINS must be a comma-separated list of HTTP(S) origins without paths.');
    return url.origin;
  });
}

export function isPrivateDevelopmentOrigin(origin: string): boolean {
  const host = parseHttpOrigin(origin)?.hostname;
  if (!host) return false;
  if (host === 'localhost' || host === '[::1]') return true;
  if (!isIPv4(host)) return false;
  const [first, second] = host.split('.').map(Number);
  return first === 10 || first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168);
}
