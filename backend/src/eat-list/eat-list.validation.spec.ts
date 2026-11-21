import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EatListMembershipDto } from './eat-list.dto';
import { normalizePlan, readCursor, validDate } from './eat-list.validation';

describe('Eat List input boundaries', () => {
  it('keeps calendar days exact, including leap days', () => {
    expect(validDate('2028-02-29')).toBe(true);
    for (const value of ['2027-02-29', '2026-04-31', '2026-1-01', '2026-13-01', '1899-12-31'])
      expect(validDate(value)).toBe(false);
  });
  it('normalizes empty notes and unplanned dishes', () => {
    expect(normalizePlan({ note: '  ' })).toEqual({
      note: null,
      plannedDate: null,
      plannedTime: null,
      timeZone: null,
    });
    expect(
      normalizePlan({
        note: '  extra spicy  ',
        plannedDate: '2026-11-30',
        timeZone: 'Asia/Kolkata',
      }),
    ).toMatchObject({ note: 'extra spicy', plannedDate: '2026-11-30', plannedTime: null });
  });
  it.each([
    { plannedTime: '12:00' },
    { plannedDate: '2026-11-30' },
    { plannedDate: '2026-11-30', timeZone: 'Not/AZone' },
    { plannedDate: '2026-11-30', timeZone: 'UTC', plannedTime: '24:00' },
    { note: 'x'.repeat(1001) },
  ])('rejects invalid plan %j', (input) => {
    expect(() => normalizePlan(input)).toThrow();
  });
  it('binds a microsecond-precise cursor to the selected filter', () => {
    const cursor = {
      id: 'e0aa4ebc-3ffc-40df-9bb0-555c5ed0b772',
      createdAt: '2026-11-21T18:00:00.123456Z',
      plannedDate: null,
      plannedTime: null,
      mode: 'all',
      date: null,
    };
    const encoded = Buffer.from(JSON.stringify(cursor)).toString('base64url');
    expect(readCursor(encoded, 'all')).toEqual(cursor);
    expect(() => readCursor(encoded, 'someday')).toThrow();
    expect(() => readCursor('not a cursor', 'all')).toThrow();
    const invalidDay = Buffer.from(
      JSON.stringify({ ...cursor, createdAt: '2026-02-31T18:00:00.123456Z' }),
    ).toString('base64url');
    expect(() => readCursor(invalidDay, 'all')).toThrow();
  });
  it('bounds and validates the batched membership request', async () => {
    const uuid = 'e0aa4ebc-3ffc-40df-9bb0-555c5ed0b772';
    expect(
      await validate(plainToInstance(EatListMembershipDto, { outletId: uuid, itemIds: uuid })),
    ).toHaveLength(0);
    expect(
      (
        await validate(
          plainToInstance(EatListMembershipDto, { outletId: uuid, itemIds: Array(101).fill(uuid) }),
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (await validate(plainToInstance(EatListMembershipDto, { outletId: uuid, itemIds: '' })))
        .length,
    ).toBeGreaterThan(0);
  });
});
