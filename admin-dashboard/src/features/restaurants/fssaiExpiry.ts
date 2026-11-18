/** FSSAI expiry state for the reviewer: expired, expiring within 30 days, or fine. */
export function fssaiExpiryNote(expiry: string | null, today = new Date()): 'expired' | 'soon' | null {
  if (!expiry) return null;
  const date = new Date(`${expiry.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (date < startOfToday) return 'expired';
  const in30 = new Date(startOfToday);
  in30.setDate(in30.getDate() + 30);
  return date <= in30 ? 'soon' : null;
}
