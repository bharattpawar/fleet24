import { resolveApiBaseUrl } from './apiBaseUrl';

it('prefers the configured URL, then Metro, then localhost', () => {
  expect(resolveApiBaseUrl('https://example.com/api/v1/', '10.0.0.1:8081')).toBe('https://example.com/api/v1');
  expect(resolveApiBaseUrl(undefined, '10.0.0.1:8081')).toBe('http://10.0.0.1:4000/api/v1');
  expect(resolveApiBaseUrl()).toBe('http://localhost:4000/api/v1');
});
