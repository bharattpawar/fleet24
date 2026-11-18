import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiBaseUrl } from '../src/api/apiBaseUrl.ts';

test('prefers the configured API URL, then Metro, then localhost', () => {
  assert.equal(resolveApiBaseUrl('https://example.com/api/v1/', '10.0.0.1:8081'), 'https://example.com/api/v1');
  assert.equal(resolveApiBaseUrl(undefined, '10.0.0.1:8081'), 'http://10.0.0.1:4000/api/v1');
  assert.equal(resolveApiBaseUrl(), 'http://localhost:4000/api/v1');
});
