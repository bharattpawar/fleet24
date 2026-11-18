import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SubmitRestaurantApplicationDto } from './restaurant-onboarding.dto';

const valid = {
  restaurantName: 'Sharma Dhaba',
  cuisines: ['North Indian'],
  ownerName: 'Rakesh Sharma',
  ownerEmail: '',
  contactPhone: '98111 00000',
  outletAddress: 'Shop 4, Sector 19, Noida',
  latitude: '28.585',
  longitude: '77.31',
  fssaiNumber: '1234 5678 9012 34',
  fssaiExpiry: '',
  panNumber: 'abcde1234f',
  gstin: '',
  bankAccountHolder: 'Rakesh Sharma',
  bankAccountNumber: '1234 5678 9012',
  bankIfsc: 'hdfc0001234',
};

const check = async (body: Record<string, unknown>) => {
  const dto = plainToInstance(SubmitRestaurantApplicationDto, body);
  const errors = await validate(dto);
  return { dto, failed: errors.map((e) => e.property) };
};

describe('SubmitRestaurantApplicationDto (restaurant registration form)', () => {
  it('accepts a typical form and normalises what people type', async () => {
    const { dto, failed } = await check(valid);
    expect(failed).toEqual([]);
    expect(dto).toMatchObject({
      contactPhone: '9811100000',
      fssaiNumber: '12345678901234',
      panNumber: 'ABCDE1234F',
      bankAccountNumber: '123456789012',
      bankIfsc: 'HDFC0001234',
      latitude: 28.585,
    });
    // Blank optional fields are treated as not given.
    expect(dto.gstin).toBeUndefined();
    expect(dto.ownerEmail).toBeUndefined();
  });

  it('accepts a valid GSTIN and rejects a malformed one', async () => {
    expect((await check({ ...valid, gstin: '09abcde1234f1z5' })).failed).toEqual([]);
    expect((await check({ ...valid, gstin: '09ABCDE1234' })).failed).toEqual(['gstin']);
  });

  it('rejects wrong FSSAI, PAN, IFSC, account and phone formats', async () => {
    const { failed } = await check({
      ...valid,
      fssaiNumber: '1234',
      panNumber: 'ABC123',
      bankIfsc: 'HDFC1234567',
      bankAccountNumber: '12AB',
      contactPhone: '12345',
    });
    expect(failed.sort()).toEqual(['bankAccountNumber', 'bankIfsc', 'contactPhone', 'fssaiNumber', 'panNumber']);
  });

  it('needs at least one cuisine and a location', async () => {
    const { failed } = await check({ ...valid, cuisines: [], latitude: undefined, longitude: 'x' });
    expect(failed.sort()).toEqual(['cuisines', 'latitude', 'longitude']);
  });
});
