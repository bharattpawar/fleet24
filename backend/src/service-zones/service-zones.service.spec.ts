import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ServiceZonesService, findContainingZone, ServiceZone } from './service-zones.service';
import { RidersService } from '../riders/riders.service';

const KP2 = { latitude: 28.4594, longitude: 77.4934 };
const KP3 = { latitude: 28.4716, longitude: 77.4838 };

function zone(name: string, at: { latitude: number; longitude: number }, isActive = true): ServiceZone {
  return { id: name, name, centerLatitude: at.latitude, centerLongitude: at.longitude, radiusMeters: 3000, isActive };
}

function makeService(rows: any[], geo: any = {}) {
  const db: any = {
    query: {
      serviceZones: {
        findMany: jest.fn().mockResolvedValue(rows),
        findFirst: jest.fn().mockResolvedValue(rows[0]),
      },
    },
    insert: jest.fn(() => ({ values: jest.fn().mockResolvedValue(undefined) })),
  };
  const config = { get: jest.fn(() => 'development') };
  return { service: new ServiceZonesService(db, geo, config as any), db };
}

const row = (z: ServiceZone) => ({
  id: z.id,
  name: z.name,
  centerLatitude: String(z.centerLatitude),
  centerLongitude: String(z.centerLongitude),
  radiusMeters: z.radiusMeters,
  isActive: z.isActive,
});

describe('service zones', () => {
  it('finds the nearest active zone containing a point', () => {
    const zones = [zone('Knowledge Park II', KP2), zone('Knowledge Park III', KP3)];
    expect(findContainingZone(zones, 28.4600, 77.4940)?.name).toBe('Knowledge Park II');
    expect(findContainingZone(zones, 28.4720, 77.4840)?.name).toBe('Knowledge Park III');
    // Connaught Place, New Delhi: far outside both
    expect(findContainingZone(zones, 28.6315, 77.2167)).toBeNull();
    // ~3.3 km north of KP III: just outside the 3 km circle
    expect(findContainingZone([zone('Knowledge Park III', KP3)], 28.5013, 77.4838)).toBeNull();
  });

  it('does not enforce anything until a zone is configured', async () => {
    const { service } = makeService([]);
    await expect(service.locate(28.6315, 77.2167)).resolves.toEqual({ enforced: false, zone: null });
    await expect(service.isServiceable(28.6315, 77.2167)).resolves.toBe(true);
  });

  it('serves nothing when every zone is switched off', async () => {
    const { service } = makeService([row(zone('Knowledge Park III', KP3, false))]);
    await expect(service.isServiceable(KP3.latitude, KP3.longitude)).resolves.toBe(false);
  });

  it('blocks points outside with the given message', async () => {
    const { service } = makeService([row(zone('Knowledge Park III', KP3))]);
    await expect(service.assertServiceable(28.6315, 77.2167, 'outside')).rejects.toThrow(BadRequestException);
    await expect(service.assertServiceable(KP3.latitude, KP3.longitude, 'outside')).resolves.toBeUndefined();
    await expect(service.isServiceable(undefined, undefined)).resolves.toBe(false);
  });

  it('creates the two Knowledge Park zones from Google when the table is empty', async () => {
    const geo = {
      autocomplete: jest.fn().mockResolvedValue([{ placeId: 'ChIJkp000001' }]),
      placeDetails: jest
        .fn()
        .mockResolvedValueOnce({ latitude: KP2.latitude, longitude: KP2.longitude })
        .mockResolvedValueOnce({ latitude: KP3.latitude, longitude: KP3.longitude }),
    };
    const { service, db } = makeService([], geo);
    db.query.serviceZones.findFirst.mockResolvedValue(undefined);
    await expect(service.ensureDefaultZones()).resolves.toBe(2);
    expect(geo.autocomplete).toHaveBeenCalledWith({ input: 'Knowledge Park II, Greater Noida, Uttar Pradesh' });
    expect(geo.autocomplete).toHaveBeenCalledWith({ input: 'Knowledge Park III, Greater Noida, Uttar Pradesh' });
    const inserted = db.insert.mock.results.map((r: any) => r.value.values.mock.calls[0][0]);
    expect(inserted).toEqual([
      expect.objectContaining({ name: 'Knowledge Park II', radiusMeters: 3000, centerLatitude: '28.4594000' }),
      expect.objectContaining({ name: 'Knowledge Park III', radiusMeters: 3000, centerLatitude: '28.4716000' }),
    ]);
  });

  it('never re-seeds once any zone exists', async () => {
    const geo = { autocomplete: jest.fn() };
    const { service } = makeService([row(zone('Custom', KP3))], geo);
    await expect(service.ensureDefaultZones()).resolves.toBe(0);
    expect(geo.autocomplete).not.toHaveBeenCalled();
  });
});

describe('rider going online', () => {
  const zones = (inside: boolean) => ({
    locate: jest.fn(async (lat: unknown) => ({
      enforced: true,
      zone: inside && lat !== undefined ? zone('Knowledge Park III', KP3) : null,
    })),
  });
  const tx = (latest?: any) => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (latest ? [latest] : []) }) }) }),
    insert: () => ({ values: () => ({ onConflictDoUpdate: async () => undefined }) }),
  });
  const service = (z: any) => new RidersService({} as any, {} as any, z);
  const check = (s: RidersService, t: any, dto: any) => (s as any).assertRiderInsideServiceZone(t, 'rider-1', dto);

  it('allows going online with a GPS point inside a zone', async () => {
    await expect(check(service(zones(true)), tx(), { availabilityStatus: 'available', latitude: KP3.latitude, longitude: KP3.longitude })).resolves.toBeUndefined();
  });

  it('blocks going online outside every zone', async () => {
    await expect(check(service(zones(false)), tx(), { availabilityStatus: 'available', latitude: 28.63, longitude: 77.21 })).rejects.toThrow(/outside Fleet24's service area/);
  });

  it('asks for location when there is no fresh fix', async () => {
    const stale = { latitude: '28.4716', longitude: '77.4838', updatedAt: new Date(Date.now() - 3600_000) };
    await expect(check(service(zones(true)), tx(stale), { availabilityStatus: 'available' })).rejects.toThrow(ForbiddenException);
    await expect(check(service(zones(true)), tx(stale), { availabilityStatus: 'available' })).rejects.toThrow(/Turn on location/);
  });

  it('uses a fresh stored fix when the app sends no GPS', async () => {
    const fresh = { latitude: '28.4716', longitude: '77.4838', updatedAt: new Date() };
    await expect(check(service(zones(true)), tx(fresh), { availabilityStatus: 'available' })).resolves.toBeUndefined();
  });
});
