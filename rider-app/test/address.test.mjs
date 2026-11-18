import test from 'node:test';
import assert from 'node:assert/strict';
import { addressDetail, addressTitle } from '../src/utils/address.ts';

test('drop-off detail shows the customer area, landmark, city and PIN, never a fixed place', () => {
  assert.equal(
    addressDetail({ addressLine1: 'Flat 402', addressLine2: 'Knowledge Park III', landmark: 'Gate 2', city: 'Greater Noida', postalCode: '201310' }),
    'Knowledge Park III, Near Gate 2, Greater Noida 201310',
  );
  assert.equal(addressDetail({ addressLine1: 'Room 14', city: 'Noida' }), 'Noida');
  assert.equal(addressDetail({ addressLine1: 'Room 14' }), null);
  assert.equal(addressDetail(undefined), null);
});

test('drop-off title uses the house line, then street, then a neutral fallback', () => {
  assert.equal(addressTitle({ addressLine1: 'Flat 402' }), 'Flat 402');
  assert.equal(addressTitle({ street: 'Block B' }), 'Block B');
  assert.equal(addressTitle({}), 'Customer address');
});

import { directionsUrl, toCoordinate } from '../src/utils/address.ts';

test('toCoordinate rejects missing, 0,0 and out-of-range points instead of inventing one', () => {
  assert.deepEqual(toCoordinate('28.4716000', '77.4838000'), { latitude: 28.4716, longitude: 77.4838 });
  assert.equal(toCoordinate(0, 0), null);
  assert.equal(toCoordinate(undefined, 77.48), null);
  assert.equal(toCoordinate('', ''), null);
  assert.equal(toCoordinate(128, 77), null);
});

test('directions use the exact pin, then an address search, else nothing', () => {
  const point = { latitude: 28.4716, longitude: 77.4838 };
  assert.equal(directionsUrl('android', { point, label: 'Customer drop-off' }), 'geo:0,0?q=28.4716,77.4838(Customer%20drop-off)');
  assert.equal(directionsUrl('ios', { point, label: 'Kulcha Hub' }), 'maps:0,0?q=Kulcha%20Hub@28.4716,77.4838');
  assert.equal(
    directionsUrl('web', { point: null, label: 'x', searchText: 'Flat 402, Knowledge Park III, Greater Noida 201310' }),
    'https://www.google.com/maps/search/?api=1&query=Flat%20402%2C%20Knowledge%20Park%20III%2C%20Greater%20Noida%20201310',
  );
  assert.equal(directionsUrl('android', { point: null, label: 'x', searchText: '  ' }), null);
});
