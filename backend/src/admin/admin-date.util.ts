import { BadRequestException } from '@nestjs/common';
import { DashboardPeriod } from './dto/admin-dashboard.dto';

export interface DateRange {
  startDate: Date;
  endDate: Date;
  period: DashboardPeriod;
}

/**
 * Calculates start and end timestamps in Asia/Kolkata (UTC+05:30)
 * Date ranges are inclusive of startDate and exclusive of endDate (i.e. [startDate, endDate))
 */
export function resolveDateRange(
  period?: DashboardPeriod,
  fromStr?: string,
  toStr?: string,
): DateRange {
  // IST offset in ms: +5.5 hours = +19800000 ms
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

  const nowUtc = new Date();
  const nowIst = new Date(nowUtc.getTime() + IST_OFFSET_MS);

  // Helper to construct IST midnight converted back to UTC
  const getIstMidnight = (year: number, month: number, date: number): Date => {
    // Construct UTC milliseconds for IST midnight
    const utcMs = Date.UTC(year, month, date, 0, 0, 0, 0) - IST_OFFSET_MS;
    return new Date(utcMs);
  };

  const istYear = nowIst.getUTCFullYear();
  const istMonth = nowIst.getUTCMonth();
  const istDate = nowIst.getUTCDate();

  if (fromStr || toStr || period === 'custom') {
    if (!fromStr || !toStr) {
      throw new BadRequestException('Both "from" and "to" parameters are required for custom date ranges.');
    }

    const startDate = new Date(fromStr);
    const rawEndDate = new Date(toStr);

    if (isNaN(startDate.getTime()) || isNaN(rawEndDate.getTime())) {
      throw new BadRequestException('Invalid date format for "from" or "to". Expected YYYY-MM-DD.');
    }

    if (startDate > rawEndDate) {
      throw new BadRequestException('"from" date must be earlier than or equal to "to" date.');
    }

    // If toStr is just YYYY-MM-DD, make it inclusive until 23:59:59.999 IST
    let endDate: Date;
    if (toStr.length <= 10) {
      const [y, m, d] = toStr.split('-').map(Number);
      endDate = getIstMidnight(y, m - 1, d + 1); // Next day IST midnight
    } else {
      endDate = rawEndDate;
    }

    let start: Date;
    if (fromStr.length <= 10) {
      const [y, m, d] = fromStr.split('-').map(Number);
      start = getIstMidnight(y, m - 1, d);
    } else {
      start = startDate;
    }

    return {
      startDate: start,
      endDate,
      period: 'custom',
    };
  }

  const selectedPeriod = period || 'last_7_days';

  switch (selectedPeriod) {
    case 'today': {
      const startDate = getIstMidnight(istYear, istMonth, istDate);
      const endDate = getIstMidnight(istYear, istMonth, istDate + 1);
      return { startDate, endDate, period: 'today' };
    }

    case 'yesterday': {
      const startDate = getIstMidnight(istYear, istMonth, istDate - 1);
      const endDate = getIstMidnight(istYear, istMonth, istDate);
      return { startDate, endDate, period: 'yesterday' };
    }

    case 'last_7_days': {
      // Last 7 full days up to end of today IST
      const startDate = getIstMidnight(istYear, istMonth, istDate - 6);
      const endDate = getIstMidnight(istYear, istMonth, istDate + 1);
      return { startDate, endDate, period: 'last_7_days' };
    }

    case 'last_30_days': {
      const startDate = getIstMidnight(istYear, istMonth, istDate - 29);
      const endDate = getIstMidnight(istYear, istMonth, istDate + 1);
      return { startDate, endDate, period: 'last_30_days' };
    }

    case 'this_month': {
      const startDate = getIstMidnight(istYear, istMonth, 1);
      const endDate = getIstMidnight(istYear, istMonth + 1, 1);
      return { startDate, endDate, period: 'this_month' };
    }

    default: {
      const startDate = getIstMidnight(istYear, istMonth, istDate - 6);
      const endDate = getIstMidnight(istYear, istMonth, istDate + 1);
      return { startDate, endDate, period: 'last_7_days' };
    }
  }
}
