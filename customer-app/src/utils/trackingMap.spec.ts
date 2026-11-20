import { isAfterPickup, pointsToFit, regionForPoints, toMapPoint, trackingStatusLabel } from './trackingMap';

const restaurant = { latitude: 28.4744, longitude: 77.504 };
const dropoff = { latitude: 28.4855, longitude: 77.5135 };
const rider = { latitude: 28.48, longitude: 77.509 };

describe('toMapPoint', () => {
  it('reads numbers and numeric strings from the API', () => {
    expect(toMapPoint(28.4744, 77.504)).toEqual(restaurant);
    expect(toMapPoint('28.4744000', '77.5040000')).toEqual(restaurant);
  });

  it('rejects missing, invalid, out-of-range and 0,0 points', () => {
    expect(toMapPoint(null, 77.5)).toBeNull();
    expect(toMapPoint('', '')).toBeNull();
    expect(toMapPoint('abc', 77.5)).toBeNull();
    expect(toMapPoint(95, 77.5)).toBeNull();
    expect(toMapPoint(0, 0)).toBeNull();
  });
});

describe('pointsToFit', () => {
  it('keeps the restaurant in view until the rider picks up the order', () => {
    expect(pointsToFit({ restaurant, dropoff, rider }, 'accepted')).toEqual([rider, dropoff, restaurant]);
    expect(pointsToFit({ restaurant, dropoff, rider }, 'at_restaurant')).toHaveLength(3);
  });

  it('follows just the rider and drop-off after pickup', () => {
    expect(pointsToFit({ restaurant, dropoff, rider }, 'picked_up')).toEqual([rider, dropoff]);
    expect(isAfterPickup('ARRIVED_CUSTOMER')).toBe(true);
  });

  it('falls back to the restaurant when it is the only point', () => {
    expect(pointsToFit({ restaurant, dropoff: null, rider: null }, 'picked_up')).toEqual([restaurant]);
    expect(pointsToFit({ restaurant: null, dropoff: null, rider: null }, 'accepted')).toEqual([]);
  });
});

describe('regionForPoints', () => {
  it('centres on the points with a margin, and never zooms in too far', () => {
    const region = regionForPoints([restaurant, dropoff])!;
    expect(region.latitude).toBeCloseTo((28.4744 + 28.4855) / 2);
    expect(region.latitudeDelta).toBeGreaterThan(28.4855 - 28.4744);
    expect(regionForPoints([rider])!.latitudeDelta).toBeGreaterThan(0);
    expect(regionForPoints([])).toBeNull();
  });
});

describe('trackingStatusLabel', () => {
  it('says whether the rider is live, updating or not yet located', () => {
    expect(trackingStatusLabel(false, false)).toBe('Waiting for rider location');
    expect(trackingStatusLabel(true, false)).toBe('Live rider location');
    expect(trackingStatusLabel(true, true)).toBe('Rider GPS updating…');
  });
});
