import 'reflect-metadata';
import { RiderOffersService } from './rider-offers.service';

describe('RiderOffersService.tripDistanceMeters', () => {
  const outlet = { latitude: '28.4716000', longitude: '77.4838000' };

  it('prefers the road distance measured at checkout', () => {
    expect(RiderOffersService.tripDistanceMeters(
      { deliveryAddressSnapshot: { roadDistanceMeters: 2640 }, deliveryLatitude: '28.49', deliveryLongitude: '77.49' },
      outlet,
    )).toBe(2640);
  });

  it('uses the real straight line otherwise, even for very short trips', () => {
    const m = RiderOffersService.tripDistanceMeters({ deliveryLatitude: '28.4718000', deliveryLongitude: '77.4838000' }, outlet);
    expect(m).toBeGreaterThan(15);
    expect(m).toBeLessThan(30); // ~22 m, no longer bumped to 1,800 m
  });

  it('returns null instead of inventing a distance', () => {
    expect(RiderOffersService.tripDistanceMeters({ deliveryLatitude: null, deliveryLongitude: null }, outlet)).toBeNull();
    expect(RiderOffersService.tripDistanceMeters({ deliveryLatitude: '28.49', deliveryLongitude: '77.49' }, null)).toBeNull();
  });
});
