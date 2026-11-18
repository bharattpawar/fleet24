import test from 'node:test';
import assert from 'node:assert/strict';
import { zoneAtLocation } from '../src/utils/serviceZones.ts';

test('uses the nearest containing zone and falls back outside all zones', () => {
  const zones = [
    { id: 'a', name: 'West', centerLatitude: 10, centerLongitude: 10, radiusMeters: 3000 },
    { id: 'b', name: 'East', centerLatitude: 10, centerLongitude: 10.01, radiusMeters: 3000 },
  ];
  assert.equal(zoneAtLocation(zones, { latitude: 10, longitude: 10.01 }), 'East');
  assert.equal(zoneAtLocation(zones, { latitude: 11, longitude: 11 }), undefined);
  assert.equal(zoneAtLocation(zones, null), undefined);
});
