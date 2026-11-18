import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateRiderProfileDto } from './rider-profile.dto';

const errorsFor = async (body: Record<string, unknown>) => {
  const errors = await validate(plainToInstance(CreateRiderProfileDto, body));
  return errors.map((e) => e.property);
};

describe('CreateRiderProfileDto (rider registration form)', () => {
  it('accepts a motorcycle rider with vehicle number and licence', async () => {
    expect(
      await errorsFor({ fullName: 'Ravi', vehicleType: 'motorcycle', vehicleNumber: 'UP16AB1234', licenseNumber: 'DL123' }),
    ).toEqual([]);
  });

  it('requires vehicle number and licence for motor vehicles', async () => {
    expect(await errorsFor({ fullName: 'Ravi', vehicleType: 'scooter' })).toEqual(['vehicleNumber', 'licenseNumber']);
  });

  it('lets a bicycle rider skip vehicle number and licence', async () => {
    expect(await errorsFor({ fullName: 'Ravi', vehicleType: 'bicycle' })).toEqual([]);
  });

  it('needs a name and a known vehicle type', async () => {
    expect(await errorsFor({ vehicleType: 'truck' })).toEqual(['fullName', 'vehicleType', 'vehicleNumber', 'licenseNumber']);
  });
});
