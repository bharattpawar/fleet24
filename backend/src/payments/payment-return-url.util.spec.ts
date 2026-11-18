import {
  DEFAULT_PAYMENT_RETURN_URL,
  escapeHtml,
  isAllowedPaymentReturnUrl,
  parsePaymentReturnAllowlist,
  resolvePaymentReturnUrl,
  toInlineScriptLiteral,
} from './payment-return-url.util';

describe('payment return URL safety', () => {
  const prodList = parsePaymentReturnAllowlist('https://app.fleet24.in');

  it('always allows the Fleet24 app scheme', () => {
    expect(parsePaymentReturnAllowlist(undefined)).toEqual(['fleet24://']);
    expect(isAllowedPaymentReturnUrl('fleet24://payment-callback', prodList, false)).toBe(true);
  });

  it('allows configured web origins by exact origin only', () => {
    expect(isAllowedPaymentReturnUrl('https://app.fleet24.in/payment-callback', prodList, false)).toBe(true);
    expect(isAllowedPaymentReturnUrl('https://app.fleet24.in.evil.com/x', prodList, false)).toBe(false);
    expect(isAllowedPaymentReturnUrl('http://app.fleet24.in/x', prodList, false)).toBe(false);
  });

  it('rejects attacker URLs and script schemes', () => {
    for (const url of [
      'https://evil.example/steal',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      '"></script><script>alert(1)</script>',
      'not a url',
    ]) {
      expect(isAllowedPaymentReturnUrl(url, prodList, true)).toBe(false);
    }
  });

  it('allows Expo and localhost only outside production', () => {
    const dev = ['exp://192.168.1.5:8081/--/payment-callback', 'http://localhost:8081/payment-callback'];
    for (const url of dev) {
      expect(isAllowedPaymentReturnUrl(url, prodList, true)).toBe(true);
      expect(isAllowedPaymentReturnUrl(url, prodList, false)).toBe(false);
    }
    expect(isAllowedPaymentReturnUrl('http://localhost:8081.evil.com/x', prodList, true)).toBe(false);
  });

  it('falls back to the app deep link for anything not allowed', () => {
    expect(resolvePaymentReturnUrl('https://evil.example', prodList, false)).toBe(DEFAULT_PAYMENT_RETURN_URL);
    expect(resolvePaymentReturnUrl(['array'], prodList, false)).toBe(DEFAULT_PAYMENT_RETURN_URL);
    expect(resolvePaymentReturnUrl(undefined, prodList, false)).toBe(DEFAULT_PAYMENT_RETURN_URL);
  });

  it('escapes HTML and inline-script values', () => {
    expect(escapeHtml('"><img src=x onerror=1>')).toBe('&quot;&gt;&lt;img src=x onerror=1&gt;');
    const literal = toInlineScriptLiteral({ v: '</script><script>alert(1)</script>' });
    expect(literal).not.toContain('</script>');
    expect(JSON.parse(literal)).toEqual({ v: '</script><script>alert(1)</script>' });
  });
});
