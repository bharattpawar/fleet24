import test from 'node:test';
import assert from 'node:assert/strict';
import { riderGate, validateRiderForm, toRiderProfilePayload, normalizeId } from '../src/utils/riderOnboarding.ts';

const gate = (over) =>
  riderGate({ isAuthenticated: true, isMockSession: false, needsRegistration: false, isEditingApplication: false, verificationStatus: 'pending', ...over });

test('a new rider without a profile sees the registration form', () => {
  assert.equal(gate({ needsRegistration: true, verificationStatus: null }), 'register');
});

test('after applying, the rider waits; approval opens the app; rejection shows the reason', () => {
  assert.equal(gate({ verificationStatus: 'pending' }), 'pending');
  assert.equal(gate({ verificationStatus: 'approved' }), 'app');
  assert.equal(gate({ verificationStatus: 'rejected' }), 'rejected');
  assert.equal(gate({ verificationStatus: 'rejected', isEditingApplication: true }), 'register');
});

test('signed out shows login; dev mock sessions skip the gate', () => {
  assert.equal(gate({ isAuthenticated: false }), 'login');
  assert.equal(gate({ isMockSession: true, verificationStatus: 'pending' }), 'app');
});

test('motor vehicles need a vehicle number and licence', () => {
  const errors = validateRiderForm({ fullName: 'Ravi Kumar', vehicleType: 'scooter', vehicleNumber: '', licenseNumber: '' });
  assert.deepEqual(Object.keys(errors).sort(), ['licenseNumber', 'vehicleNumber']);
  assert.deepEqual(
    validateRiderForm({ fullName: 'Ravi Kumar', vehicleType: 'motorcycle', vehicleNumber: 'up 16 ab 1234', licenseNumber: 'UP16 20230001234' }),
    {},
  );
});

test('a cycle rider only needs a name', () => {
  assert.deepEqual(validateRiderForm({ fullName: 'Ravi', vehicleType: 'bicycle', vehicleNumber: '', licenseNumber: '' }), {});
  assert.ok(validateRiderForm({ fullName: ' R ', vehicleType: 'bicycle', vehicleNumber: '', licenseNumber: '' }).fullName);
});

test('the payload is cleaned up and leaves out empty optional fields', () => {
  assert.equal(normalizeId(' up 16 ab 1234 '), 'UP16AB1234');
  assert.deepEqual(
    toRiderProfilePayload({ fullName: '  Ravi Kumar ', vehicleType: 'bicycle', vehicleNumber: '', licenseNumber: '' }),
    { fullName: 'Ravi Kumar', vehicleType: 'bicycle' },
  );
  assert.deepEqual(
    toRiderProfilePayload({ fullName: 'Ravi', vehicleType: 'ev', vehicleNumber: 'dl 3c ab 1', licenseNumber: 'dl-1420110012345' }),
    { fullName: 'Ravi', vehicleType: 'ev', vehicleNumber: 'DL3CAB1', licenseNumber: 'DL-1420110012345' },
  );
});
