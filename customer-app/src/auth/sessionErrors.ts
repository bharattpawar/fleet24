import { ApiError } from '../api/client';

/**
 * Only a rejected session (401/403 from /auth/me after a refresh attempt) ends a login.
 * Network errors, timeouts and server errors keep the saved session so it can be restored later.
 */
export function isSessionEnded(err: unknown): boolean {
  return err instanceof ApiError && (err.statusCode === 401 || err.statusCode === 403);
}
