import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyRestaurantForm,
  restaurantGate,
  toApplicationPayload,
  toggleCuisine,
  validateRestaurantForm,
} from '../src/utils/restaurantOnboarding.ts';

const filled = () => ({
  ...emptyRestaurantForm(),
  restaurantName: ' Sharma Dhaba ',
  cuisines: ['North Indian'],
  ownerName: 'Rakesh Sharma',
  contactPhone: '98111 00000',
  outletAddress: 'Shop 4, Sector 19, Noida',
  latitude: 28.585,
  longitude: 77.31,
  fssaiNumber: '1234 5678 9012 34',
  panNumber: 'abcde1234f',
  bankAccountHolder: 'Rakesh Sharma',
  bankAccountNumber: '1234 5678 9012',
  bankAccountNumberConfirm: '123456789012',
  bankIfsc: 'hdfc0001234',
});

const gate = (over) => restaurantGate({ isAuthenticated: true, applicationStatus: 'approved', isEditingApplication: false, ...over });

test('screens: login, register, under review, rejected, suspended, then the app', () => {
  assert.equal(gate({ isAuthenticated: false }), 'login');
  assert.equal(gate({ applicationStatus: 'none' }), 'register');
  assert.equal(gate({ applicationStatus: 'pending' }), 'pending');
  assert.equal(gate({ applicationStatus: 'rejected' }), 'rejected');
  assert.equal(gate({ applicationStatus: 'rejected', isEditingApplication: true }), 'register');
  assert.equal(gate({ applicationStatus: 'suspended' }), 'suspended');
  assert.equal(gate({ applicationStatus: 'approved' }), 'app');
});

test('a complete form passes and is cleaned up for the server', () => {
  const form = filled();
  assert.deepEqual(validateRestaurantForm(form), {});
  const body = toApplicationPayload(form);
  assert.equal(body.restaurantName, 'Sharma Dhaba');
  assert.equal(body.contactPhone, '9811100000');
  assert.equal(body.fssaiNumber, '12345678901234');
  assert.equal(body.panNumber, 'ABCDE1234F');
  assert.equal(body.bankIfsc, 'HDFC0001234');
  assert.equal('gstin' in body, false);
  assert.equal('ownerEmail' in body, false);
});

test('flags the fields Swiggy-style checks care about', () => {
  const errors = validateRestaurantForm({
    ...filled(),
    fssaiNumber: '123',
    panNumber: 'ABC12',
    gstin: 'BADGST',
    bankIfsc: 'HDFC1234567',
    bankAccountNumberConfirm: '999',
    latitude: null,
  });
  assert.deepEqual(Object.keys(errors).sort(), [
    'bankAccountNumberConfirm',
    'bankIfsc',
    'fssaiNumber',
    'gstin',
    'outletAddress',
    'panNumber',
  ]);
});

test('an expired FSSAI licence is refused; a future one is fine', () => {
  const today = new Date(2026, 10, 18);
  assert.ok(validateRestaurantForm({ ...filled(), fssaiExpiry: '2025-01-31' }, today).fssaiExpiry);
  assert.equal(validateRestaurantForm({ ...filled(), fssaiExpiry: '2028-03-31' }, today).fssaiExpiry, undefined);
  assert.ok(validateRestaurantForm({ ...filled(), fssaiExpiry: '31/03/2028' }, today).fssaiExpiry);
});

test('cuisine picker toggles and stops at six', () => {
  let picked = [];
  for (const c of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) picked = toggleCuisine(picked, c);
  assert.equal(picked.length, 6);
  assert.deepEqual(toggleCuisine(picked, 'A'), ['B', 'C', 'D', 'E', 'F']);
});
