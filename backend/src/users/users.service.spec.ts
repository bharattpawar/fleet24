import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { isUsableLocation } from './address-location.util';

describe('UsersService addresses', () => {
  const baseDto = { addressLine1: 'Flat 402', city: 'Greater Noida', postalCode: '201310' };

  function makeService(existing?: any) {
    const returning = jest.fn().mockImplementation(async () => [{ id: 'a1', ...baseDto, latitude: '28.4712000', longitude: '77.4901000' }]);
    const db: any = {
      query: {
        customerAddresses: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'old', latitude: '28.4855000', longitude: '77.5135000' },
            { id: 'new', latitude: '28.4712000', longitude: '77.4901000' },
          ]),
          findFirst: jest.fn().mockResolvedValue(existing),
        },
      },
      insert: jest.fn(() => ({ values: jest.fn(() => ({ returning })) })),
      update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn(() => ({ returning })) })) })),
    };
    return { service: new UsersService(db), db };
  }

  it('flags legacy placeholder addresses for re-pinning', async () => {
    const { service } = makeService();
    const rows = await service.getAddresses('u1');
    expect(rows.map((r) => [r.id, r.needsLocationConfirmation])).toEqual([['old', true], ['new', false]]);
  });

  it.each([
    ['the legacy placeholder', '28.4855000', '77.5135000'],
    ['0,0', '0', '0'],
    ['out of range', '128.4', '77.5'],
    ['not a number', 'abc', '77.5'],
  ])('rejects saving an address at %s', async (_label, latitude, longitude) => {
    const { service, db } = makeService();
    await expect(service.createAddress('u1', { ...baseDto, latitude, longitude } as any)).rejects.toThrow(BadRequestException);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('saves an address with a real pinned location', async () => {
    const { service } = makeService();
    const saved = await service.createAddress('u1', { ...baseDto, latitude: '28.4712000', longitude: '77.4901000' } as any);
    expect(saved.needsLocationConfirmation).toBe(false);
  });

  it('updates only the caller’s own address and needs both coordinates', async () => {
    const missing = makeService(undefined);
    await expect(missing.service.updateAddress('u1', 'a1', { addressLine1: 'x' })).rejects.toThrow(NotFoundException);

    const { service } = makeService({ id: 'a1', userId: 'u1' });
    await expect(service.updateAddress('u1', 'a1', { latitude: '28.47' })).rejects.toThrow(/together/);
    await expect(service.updateAddress('u1', 'a1', { latitude: '28.4855000', longitude: '77.5135000' })).rejects.toThrow(BadRequestException);
    await expect(service.updateAddress('u1', 'a1', { latitude: '28.4712000', longitude: '77.4901000' })).resolves.toMatchObject({ needsLocationConfirmation: false });
  });

  it('isUsableLocation accepts real Greater Noida points', () => {
    expect(isUsableLocation('28.4744', '77.5040')).toBe(true);
    expect(isUsableLocation(undefined, '77.5')).toBe(false);
  });
});
