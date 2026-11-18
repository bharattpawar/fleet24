import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { RiderOffersService } from './rider-offers.service';

/**
 * Self-registration (POST /riders/profile) grants the `rider` role immediately with
 * verificationStatus 'pending'. Such riders — and rejected or suspended ones — must not be able
 * to see customer delivery addresses in the open pool or take any delivery.
 */
describe('RiderOffersService rider eligibility', () => {
  const liveOrder = {
    id: 'order-1',
    orderNumber: 'F24-1',
    status: 'ready_for_pickup',
    createdAt: new Date(),
    totalPayable: '249.00',
    items: [],
    outlet: { id: 'outlet-1', name: 'Kulcha Hub', address: 'Alpha 1', phone: '+910000000000', latitude: '28.48', longitude: '77.51' },
    deliveryAddressSnapshot: { addressLine1: 'Flat 402, Sharda Towers', city: 'Greater Noida', latitude: '28.47', longitude: '77.50' },
  };

  function makeService(rider: Record<string, unknown>) {
    const transaction = jest.fn();
    const db: any = {
      query: {
        riders: { findFirst: jest.fn().mockResolvedValue(rider) },
        orders: { findMany: jest.fn().mockResolvedValue([liveOrder]) },
        deliveries: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
      },
      transaction,
    };
    const service = new RiderOffersService(
      db,
      {} as any,
      {} as any,
      { get: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      { getActiveSettings: jest.fn().mockResolvedValue(null) } as any,
    );
    return { service, db, transaction };
  }

  const ineligible: Array<[string, Record<string, unknown>]> = [
    ['pending (self-registered)', { verificationStatus: 'pending', suspensionReason: null }],
    ['rejected', { verificationStatus: 'rejected', suspensionReason: null }],
    ['suspended', { verificationStatus: 'approved', suspensionReason: 'Fraud review' }],
  ];

  describe.each(ineligible)('%s rider', (_label, status) => {
    const rider = { id: 'rider-1', userId: 'user-1', maxActiveOrders: 2, currentActiveOrdersCount: 0, ...status };

    it('cannot list the open delivery pool (customer addresses)', async () => {
      const { service, db } = makeService(rider);
      await expect(service.getAvailableDeliveriesPool('user-1')).rejects.toThrow(ForbiddenException);
      expect(db.query.orders.findMany).not.toHaveBeenCalled();
    });

    it('cannot claim a delivery', async () => {
      const { service, transaction } = makeService(rider);
      await expect(service.claimDelivery('user-1', 'order-1')).rejects.toThrow(ForbiddenException);
      expect(transaction).not.toHaveBeenCalled();
    });

    it('cannot accept an offer', async () => {
      const { service, transaction } = makeService(rider);
      await expect(service.acceptOffer('user-1', 'order-1')).rejects.toThrow(ForbiddenException);
      expect(transaction).not.toHaveBeenCalled();
    });
  });

  it('an approved, unsuspended rider can still list the pool', async () => {
    const { service } = makeService({
      id: 'rider-1',
      userId: 'user-1',
      verificationStatus: 'approved',
      suspensionReason: null,
      maxActiveOrders: 2,
      currentActiveOrdersCount: 0,
    });
    await expect(service.getAvailableDeliveriesPool('user-1')).resolves.toEqual(expect.any(Array));
  });
});
