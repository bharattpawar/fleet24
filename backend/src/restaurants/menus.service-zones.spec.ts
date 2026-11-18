import 'reflect-metadata';
import { MenusService } from './menus.service';

describe('MenusService discovery and service zones', () => {
  const outlet = (id: string, latitude: string, longitude: string) => ({
    id, name: id, latitude, longitude, isActive: true, isAcceptingOrders: true, deliveryRadiusKm: '3.00',
    restaurant: { id: 'r', name: 'R', isActive: true, verificationStatus: 'approved' }, operatingHours: [],
  });
  const db: any = {
    query: {
      restaurantOutlets: {
        findMany: jest.fn().mockResolvedValue([
          outlet('inside', '28.4716000', '77.4838000'),
          outlet('outside', '28.6315000', '77.2167000'),
        ]),
      },
    },
  };
  const zones: any = {
    isServiceable: jest.fn(async (lat: unknown) => Number(lat) < 28.5),
  };

  it('returns no kitchens to a customer outside every zone', async () => {
    const service = new MenusService(db, {} as any, undefined, undefined, zones);
    await expect(service.getPublicActiveOutlets(28.6315, 77.2167)).resolves.toEqual([]);
  });

  it('never lists outlets located outside every zone', async () => {
    const service = new MenusService(db, {} as any, undefined, undefined, zones);
    const result: any[] = await service.getPublicActiveOutlets();
    const ids = result.map((o) => o.id);
    expect(ids).toContain('inside');
    expect(ids).not.toContain('outside');
  });
});
