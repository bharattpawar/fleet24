import 'reflect-metadata';
import { RiderAssignmentService } from './rider-assignment.service';
import { calculateRiderProximity } from '../common/utils/geo';

describe('rider search radius (admin setting)', () => {
  const make = (settings: any) =>
    new RiderAssignmentService({} as any, {} as any, {} as any, undefined, {
      getActiveSettings: jest.fn().mockResolvedValue({ settings: { deliveryServiceability: settings } }),
    } as any);

  it('uses the admin value', async () => {
    await expect(make({ maxRoadDistanceMeters: 3000, riderPickupRadiusMeters: 5000 }).getRiderPickupRadiusMeters()).resolves.toBe(5000);
  });

  it('defaults to 3 km when unset or settings fail', async () => {
    await expect(make({ maxRoadDistanceMeters: 3000 }).getRiderPickupRadiusMeters()).resolves.toBe(3000);
    const broken = new RiderAssignmentService({} as any, {} as any, {} as any, undefined, {
      getActiveSettings: jest.fn().mockRejectedValue(new Error('db down')),
    } as any);
    await expect(broken.getRiderPickupRadiusMeters()).resolves.toBe(3000);
  });

  it('proximity follows the radius passed in', () => {
    // ~4.4 km apart (KP II centre to a point north of KP III)
    const p = calculateRiderProximity(28.4594, 77.4934, 28.4990, 77.4934, 5000);
    expect(p.isWithinRadius).toBe(true);
    expect(p.isWithin3Km).toBe(false);
    expect(calculateRiderProximity(28.4594, 77.4934, 28.4990, 77.4934, 3000).isWithinRadius).toBe(false);
  });
});
