/**
 * Helpers for the public hosted-checkout page and its redirect callback.
 *
 * Both endpoints receive a caller-supplied `returnUrl`. It must never be reflected unescaped
 * into HTML/JS, and the redirect must only target Fleet24's own app or known web origins.
 */

export const DEFAULT_PAYMENT_RETURN_URL = 'fleet24://payment-callback';

/**
 * Allowlist entries are either a custom scheme (`fleet24://`) or a full web origin
 * (`https://app.fleet24.in`). Outside production, Expo Go (`exp://`, `exps://`) and
 * http(s) localhost / 127.0.0.1 on any port are also accepted for development.
 */
export function isAllowedPaymentReturnUrl(
  candidate: string,
  allowlist: string[],
  allowLocalDev: boolean,
): boolean {
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return false;
  }

  for (const entry of allowlist) {
    if (entry.endsWith('://')) {
      if (url.protocol === entry.slice(0, -2).toLowerCase()) return true;
      continue;
    }
    try {
      if (url.origin !== 'null' && url.origin === new URL(entry).origin) return true;
    } catch {
      // ignore malformed allowlist entries
    }
  }

  if (allowLocalDev) {
    if (url.protocol === 'exp:' || url.protocol === 'exps:') return true;
    if (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    ) {
      return true;
    }
  }

  return false;
}

/** Parses PAYMENT_RETURN_URL_ALLOWLIST; the Fleet24 app scheme is always allowed. */
export function parsePaymentReturnAllowlist(raw: string | undefined): string[] {
  const entries = (raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return Array.from(new Set(['fleet24://', ...entries]));
}

/** Returns the candidate when allowed, otherwise the default Fleet24 deep link. */
export function resolvePaymentReturnUrl(
  candidate: unknown,
  allowlist: string[],
  allowLocalDev: boolean,
): string {
  if (typeof candidate === 'string' && candidate && isAllowedPaymentReturnUrl(candidate, allowlist, allowLocalDev)) {
    return candidate;
  }
  return DEFAULT_PAYMENT_RETURN_URL;
}

/** Escapes text for safe placement in HTML element content and quoted attributes. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Serialises a value as a JavaScript literal that is safe inside an inline <script>:
 * JSON-encodes it and escapes characters that could close the script or break parsing.
 */
export function toInlineScriptLiteral(value: unknown): string {
  return JSON.stringify(value ?? null)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(new RegExp('\\u2028', 'g'), '\\u2028')
    .replace(new RegExp('\\u2029', 'g'), '\\u2029');
}
