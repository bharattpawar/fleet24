import { estimateDeliveryEta } from './delivery-eta';

describe('estimateDeliveryEta', () => {
  it('is at least the 15 minute platform target for nearby orders', () => {
    expect(estimateDeliveryEta({ travelSeconds: 180 })).toEqual({ minMinutes: 15, maxMinutes: 20, source: 'route' });
  });

  it('grows with road travel time for farther orders', () => {
    // 10 min handling + 8 min ride
    expect(estimateDeliveryEta({ travelSeconds: 455 })).toEqual({ minMinutes: 18, maxMinutes: 23, source: 'route' });
  });

  it('uses admin settings when present', () => {
    expect(estimateDeliveryEta({ travelSeconds: 300, settings: { minDeliveryMinutes: 20, handlingMinutes: 12 } }))
      .toEqual({ minMinutes: 20, maxMinutes: 25, source: 'route' });
    expect(estimateDeliveryEta({ travelSeconds: 900, settings: { minDeliveryMinutes: 20, handlingMinutes: 12 } }))
      .toEqual({ minMinutes: 27, maxMinutes: 32, source: 'route' });
  });

  it('falls back to straight-line distance at 20 km/h when no route is available', () => {
    // 2.5 km straight line -> 3.25 km road -> 10 min ride
    expect(estimateDeliveryEta({ travelSeconds: null, straightLineMeters: 2500 }))
      .toEqual({ minMinutes: 20, maxMinutes: 25, source: 'estimate' });
  });

  it('returns nothing rather than inventing a time', () => {
    expect(estimateDeliveryEta({})).toBeNull();
    expect(estimateDeliveryEta({ travelSeconds: Number.NaN })).toBeNull();
  });
});
