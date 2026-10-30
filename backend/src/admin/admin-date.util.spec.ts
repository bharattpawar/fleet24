import { BadRequestException } from '@nestjs/common';
import { resolveDateRange } from './admin-date.util';

describe('Admin Date Utility (resolveDateRange)', () => {
  it('resolves "today" period accurately using Asia/Kolkata boundary', () => {
    const range = resolveDateRange('today');
    expect(range.period).toBe('today');
    expect(range.startDate).toBeInstanceOf(Date);
    expect(range.endDate).toBeInstanceOf(Date);
    expect(range.endDate.getTime()).toBeGreaterThan(range.startDate.getTime());
    // Difference should be 24 hours
    expect(range.endDate.getTime() - range.startDate.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('resolves "yesterday" period accurately', () => {
    const range = resolveDateRange('yesterday');
    expect(range.period).toBe('yesterday');
    expect(range.endDate.getTime() - range.startDate.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('resolves "last_7_days" period accurately (7 days = 168 hours)', () => {
    const range = resolveDateRange('last_7_days');
    expect(range.period).toBe('last_7_days');
    expect(range.endDate.getTime() - range.startDate.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('resolves "last_30_days" period accurately (30 days)', () => {
    const range = resolveDateRange('last_30_days');
    expect(range.period).toBe('last_30_days');
    expect(range.endDate.getTime() - range.startDate.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('resolves "this_month" period with month start and next month start', () => {
    const range = resolveDateRange('this_month');
    expect(range.period).toBe('this_month');
    expect(range.endDate.getTime()).toBeGreaterThan(range.startDate.getTime());
  });

  it('resolves custom date ranges with inclusive end date', () => {
    const range = resolveDateRange('custom', '2026-10-01', '2026-10-15');
    expect(range.period).toBe('custom');
    expect(range.startDate.toISOString()).toContain('2026-09-30T18:30:00.000Z'); // 2026-10-01 00:00 IST in UTC
    expect(range.endDate.toISOString()).toContain('2026-10-15T18:30:00.000Z'); // 2026-10-16 00:00 IST in UTC
  });

  it('throws BadRequestException when custom range is missing from or to', () => {
    expect(() => resolveDateRange('custom', '2026-10-01')).toThrow(BadRequestException);
    expect(() => resolveDateRange('custom', undefined, '2026-10-15')).toThrow(BadRequestException);
  });

  it('throws BadRequestException when from date is after to date', () => {
    expect(() => resolveDateRange('custom', '2026-10-20', '2026-10-10')).toThrow(BadRequestException);
  });

  it('throws BadRequestException for invalid date format', () => {
    expect(() => resolveDateRange('custom', 'not-a-date', '2026-10-10')).toThrow(BadRequestException);
  });
});

