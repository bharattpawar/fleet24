import { BadRequestException } from '@nestjs/common';
import { EatListPlanDto } from './eat-list.dto';

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9999-12-31')
    return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function normalizePlan(input: EatListPlanDto) {
  const note = input.note?.trim() || null;
  const plannedDate = input.plannedDate || null;
  const plannedTime = input.plannedTime || null;
  const timeZone = input.timeZone || null;
  if (note && note.length > 1000)
    throw new BadRequestException('Keep your note within 1,000 characters.');
  if (plannedDate && !validDate(plannedDate))
    throw new BadRequestException('Choose a valid date (YYYY-MM-DD).');
  if (plannedTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(plannedTime))
    throw new BadRequestException('Choose a valid time (HH:mm).');
  if (plannedTime && !plannedDate)
    throw new BadRequestException('Choose a day before adding a time.');
  if (plannedDate && !timeZone)
    throw new BadRequestException('A planned day needs your time zone.');
  if (timeZone) {
    try {
      new Intl.DateTimeFormat('en', { timeZone }).format();
    } catch {
      throw new BadRequestException('Choose a valid time zone.');
    }
  }
  return { note, plannedDate, plannedTime, timeZone: plannedDate ? timeZone : null };
}

export interface EatListCursor {
  id: string;
  createdAt: string;
  plannedDate: string | null;
  plannedTime: string | null;
  mode: string;
  date: string | null;
}
export function readCursor(
  raw: string | undefined,
  mode: string,
  date?: string,
): EatListCursor | null {
  if (!raw) return null;
  try {
    if (raw.length > 600) throw new Error();
    const value = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as EatListCursor;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,6}Z$/.test(value.createdAt) ||
      !validDate(value.createdAt.slice(0, 10)) ||
      !Number.isFinite(Date.parse(value.createdAt))
    )
      throw new Error();
    if (value.mode !== mode || value.date !== (date || null)) throw new Error();
    if (
      mode === 'planned' &&
      (!value.plannedDate ||
        !validDate(value.plannedDate) ||
        (value.plannedTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.plannedTime)))
    )
      throw new Error();
    return value;
  } catch {
    throw new BadRequestException('This list cursor is invalid. Refresh the list.');
  }
}
