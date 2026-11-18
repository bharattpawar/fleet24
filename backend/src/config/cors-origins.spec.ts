import { isPrivateDevelopmentOrigin, parseCorsOrigins } from './cors-origins';

it('parses and normalizes a comma-separated CORS allowlist', () => {
  expect(parseCorsOrigins(' https://example.com/, http://localhost:4173 ')).toEqual([
    'https://example.com', 'http://localhost:4173',
  ]);
  expect(() => parseCorsOrigins('https://example.com/checkout')).toThrow('CORS_ORIGINS');
});

it.each(['localhost:4000', '10.9.8.7', '172.16.0.1:8000', '172.31.255.254', '192.168.1.1'])(
  'allows %s for development', (host) => expect(isPrivateDevelopmentOrigin('http://' + host)).toBe(true),
);

it.each(['localhost.example.com', '172.15.0.1', '172.32.0.1', '192.169.1.1', '10.0.0.1@example.com'])(
  'rejects %s from the private-network rule', (host) => expect(isPrivateDevelopmentOrigin('http://' + host)).toBe(false),
);
