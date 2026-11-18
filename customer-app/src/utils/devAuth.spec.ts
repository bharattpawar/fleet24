import { isDevAuthBypassEnabled } from './devAuth';

it('shows demo tools only for an explicit development opt-in', () => {
  expect(isDevAuthBypassEnabled(true, 'true')).toBe(true);
  expect(isDevAuthBypassEnabled(true)).toBe(false);
  expect(isDevAuthBypassEnabled(false, 'true')).toBe(false);
});
