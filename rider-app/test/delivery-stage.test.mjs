import test from 'node:test';
import assert from 'node:assert/strict';
import { nextDeliveryStep } from '../src/utils/deliveryStage.ts';

test('walks the rider through each stage in order', () => {
  assert.deepEqual(nextDeliveryStep('accepted'), { action: 'arrive_restaurant', label: 'CONFIRM ARRIVAL AT RESTAURANT' });
  assert.equal(nextDeliveryStep('assigned')?.action, 'arrive_restaurant');
  assert.equal(nextDeliveryStep('at_restaurant')?.action, 'pickup');
  assert.equal(nextDeliveryStep('picked_up')?.action, 'arrive_customer');
});

test('at the customer the rider marks it delivered, with no OTP step', () => {
  const step = nextDeliveryStep('arrived_customer');
  assert.deepEqual(step, { action: 'mark_delivered', label: 'MARK DELIVERED' });
  assert.doesNotMatch(step.label, /OTP/i);
});

test('finished or unknown deliveries have no next step', () => {
  assert.equal(nextDeliveryStep('completed'), null);
  assert.equal(nextDeliveryStep('cancelled'), null);
  assert.equal(nextDeliveryStep('ARRIVED_CUSTOMER')?.action, 'mark_delivered');
});
