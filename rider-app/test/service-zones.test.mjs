import test from 'node:test';
import assert from 'node:assert/strict';
import { firstZoneCenter, zoneAtLocation } from '../src/utils/serviceZones.ts';

test('uses the nearest containing zone and falls back outside all zones', () => {
  const zones = [
    { id: 'a', name: 'West', centerLatitude: 10, centerLongitude: 10, radiusMeters: 3000 },
    { id: 'b', name: 'East', centerLatitude: 10, centerLongitude: 10.01, radiusMeters: 3000 },
  ];
  assert.equal(zoneAtLocation(zones, { latitude: 10, longitude: 10.01 }), 'East');
  assert.equal(zoneAtLocation(zones, { latitude: 11, longitude: 11 }), undefined);
  assert.equal(zoneAtLocation(zones, null), undefined);
});

test('mock GPS uses the first active zone centre and has no fix without zones', () => {
  const first = { id: 'first', name: 'First', centerLatitude: 11, centerLongitude: 12, radiusMeters: 3000 };
  const second = { ...first, id: 'second', centerLatitude: 13, centerLongitude: 14 };
  assert.deepEqual(firstZoneCenter([first, second]), { latitude: 11, longitude: 12 });
  assert.equal(firstZoneCenter([]), null);
});
