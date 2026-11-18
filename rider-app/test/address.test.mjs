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
