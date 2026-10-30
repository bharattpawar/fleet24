/**
 * Indian Standard Time (IST / Asia/Kolkata: UTC+05:30) Date Utilities
 * Ensures financial month-period boundaries, peak hours, and billing periods
 * are strictly calculated according to India's commercial timezone,
 * regardless of host server OS or cloud runtime timezone.
 */

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30 in milliseconds

export interface IstDateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  second: number; // 0-59
  yearMonth: string; // 'YYYY-MM'
}

/**
 * Returns year, month, date, and hour in Asia/Kolkata (IST) for a given date or now
 */
export function getIstParts(date: Date = new Date()): IstDateParts {
  const istTimeMs = date.getTime() + IST_OFFSET_MS;
  const istDate = new Date(istTimeMs);

  const year = istDate.getUTCFullYear();
  const month = istDate.getUTCMonth() + 1; // 1-12
  const day = istDate.getUTCDate();
  const hour = istDate.getUTCHours();
  const minute = istDate.getUTCMinutes();
  const second = istDate.getUTCSeconds();

  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    yearMonth,
  };
}

/**
 * Returns UTC Date instances for the exact start (inclusive) and end (inclusive)
 * of an Indian calendar month (00:00:00.000 IST on 1st to 23:59:59.999 IST on last day)
 */
export function getIstMonthBoundaries(date: Date = new Date()): {
  yearMonth: string;
  startUtc: Date;
  endUtc: Date;
} {
  const parts = getIstParts(date);
  const year = parts.year;
  const month = parts.month; // 1-based

  // 1st of month at 00:00:00.000 IST in UTC
  const startUtcMs = Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - IST_OFFSET_MS;

  // Next month 1st at 00:00:00.000 IST minus 1ms = end of current month
  const endUtcMs = Date.UTC(year, month, 1, 0, 0, 0, 0) - IST_OFFSET_MS - 1;

  return {
    yearMonth: parts.yearMonth,
    startUtc: new Date(startUtcMs),
    endUtc: new Date(endUtcMs),
  };
}

/**
 * Returns the current hour (0-23) in Asia/Kolkata
 */
export function getIstHour(date: Date = new Date()): number {
  return getIstParts(date).hour;
}

