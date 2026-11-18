import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { CartService } from './cart.service';

describe('CartService.getDeliveryEstimate', () => {
  const outlet = { id: 'o1', latitude: '28.4716000', longitude: '77.4838000' };
  const address = { id: 'a1', userId: 'c1', latitude: '28.4900000', longitude: '77.4900000' };

  function make(opts: { cart?: any; address?: any; route?: any; routing?: boolean } = {}) {
    const db: any = {
      query: {
        customerCarts: { findFirst: jest.fn().mockResolvedValue('cart' in opts ? opts.cart : { outletId: 'o1' }) },
        customerAddresses: { findFirst: jest.fn().mockResolvedValue('address' in opts ? opts.address : address) },
        restaurantOutlets: { findFirst: jest.fn().mockResolvedValue(outlet) },
      },
    };
    const settings = { getActiveSettings: jest.fn().mockResolvedValue({ settings: { deliveryServiceability: { minDeliveryMinutes: 15, handlingMinutes: 10 } } }) };
    const routing = opts.routing === false ? undefined : {
      isAvailable: () => true,
      getRoute: jest.fn().mockResolvedValue(opts.route ?? { status: 'OK', durationSeconds: 540, distanceMeters: 2600 }),
    };
    return new CartService(db, settings as any, routing as any);
  }

  it('adds Google travel time to prep + pickup', async () => {
    await expect(make().getDeliveryEstimate('c1', 'a1')).resolves.toEqual({
      deliveryEta: { minMinutes: 19, maxMinutes: 24, source: 'route' },
      roadDistanceMeters: 2600,
      reason: null,
    });
  });

  it('never promises less than the 15 minute minimum', async () => {
    const res = await make({ route: { status: 'OK', durationSeconds: 120, distanceMeters: 600 } }).getDeliveryEstimate('c1', 'a1');
    expect(res.deliveryEta).toEqual({ minMinutes: 15, maxMinutes: 20, source: 'route' });
  });

  it('estimates from distance when Google routing is unavailable', async () => {
    const res = await make({ routing: false }).getDeliveryEstimate('c1', 'a1');
    expect(res.deliveryEta?.source).toBe('estimate');
    expect(res.deliveryEta!.minMinutes).toBeGreaterThanOrEqual(15);
  });

  it('gives no time for an unconfirmed (old placeholder) address or an empty cart', async () => {
    await expect(make({ address: { ...address, latitude: '28.4855000', longitude: '77.5135000' } }).getDeliveryEstimate('c1', 'a1'))
      .resolves.toMatchObject({ deliveryEta: null, reason: 'LOCATION_NOT_CONFIRMED' });
    await expect(make({ cart: null }).getDeliveryEstimate('c1', 'a1')).resolves.toMatchObject({ deliveryEta: null, reason: 'EMPTY_CART' });
  });

  it("refuses another customer's address", async () => {
    await expect(make({ address: undefined }).getDeliveryEstimate('c1', 'a1')).rejects.toThrow(NotFoundException);
  });
});
