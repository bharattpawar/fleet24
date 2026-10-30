import {
  getIstParts,
  getIstMonthBoundaries,
  getIstHour,
  IST_OFFSET_MS,
} from './ist-date.util';

describe('IST Date Utilities (Asia/Kolkata)', () => {
  it('correctly calculates IST offset', () => {
    expect(IST_OFFSET_MS).toBe(19800000); // 5.5 hours in ms
  });

  it('correctly handles month boundary at 11:59 PM IST on last day of month', () => {
    // 2026-10-31 23:59:00 IST -> In UTC: 2026-10-31 18:29:00 UTC
    const dateUtc = new Date(Date.UTC(2026, 9, 31, 18, 29, 0));
    const parts = getIstParts(dateUtc);

    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(10);
    expect(parts.day).toBe(31);
    expect(parts.hour).toBe(23);
    expect(parts.yearMonth).toBe('2026-10');
  });

  it('correctly handles month boundary at 12:15 AM IST on first day of new month', () => {
    // 2026-11-01 00:15:00 IST -> In UTC: 2026-10-31 18:45:00 UTC
    const dateUtc = new Date(Date.UTC(2026, 9, 31, 18, 45, 0));
    const parts = getIstParts(dateUtc);

    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(11);
    expect(parts.day).toBe(1);
    expect(parts.hour).toBe(0);
    expect(parts.minute).toBe(15);
    expect(parts.yearMonth).toBe('2026-11');
  });

  it('correctly handles month boundary at 5:15 AM IST on first day of new month', () => {
    // 2026-11-01 05:15:00 IST -> In UTC: 2026-10-31 23:45:00 UTC
    const dateUtc = new Date(Date.UTC(2026, 9, 31, 23, 45, 0));
    const parts = getIstParts(dateUtc);

    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(11);
    expect(parts.day).toBe(1);
    expect(parts.hour).toBe(5);
    expect(parts.yearMonth).toBe('2026-11');
  });

  it('returns exact UTC timestamps for Indian month boundaries', () => {
    // October 2026
    const sampleDate = new Date(Date.UTC(2026, 9, 15, 12, 0, 0));
    const { yearMonth, startUtc, endUtc } = getIstMonthBoundaries(sampleDate);

    expect(yearMonth).toBe('2026-10');
    // Start of Oct 2026 IST (2026-10-01 00:00:00 IST) is 2026-09-30 18:30:00 UTC
    expect(startUtc.toISOString()).toBe('2026-09-30T18:30:00.000Z');
    // End of Oct 2026 IST (2026-10-31 23:59:59.999 IST) is 2026-10-31 18:29:59.999 UTC
    expect(endUtc.toISOString()).toBe('2026-10-31T18:29:59.999Z');
  });

  it('evaluates peak hours in Asia/Kolkata timezone', () => {
    // 8:00 PM IST (20:00 IST) -> 14:30 UTC
    const peakUtc = new Date(Date.UTC(2026, 9, 30, 14, 30, 0));
    expect(getIstHour(peakUtc)).toBe(20);

    // 1:00 AM IST -> 19:30 UTC previous day
    const lateUtc = new Date(Date.UTC(2026, 9, 29, 19, 30, 0));
    expect(getIstHour(lateUtc)).toBe(1);
  });
});

