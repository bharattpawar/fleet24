(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (s: any) => s },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../api/client', () => ({ apiRequest: jest.fn() }));

import { ConfirmDeliveryCard } from './ConfirmDeliveryCard';
import { confirmDeliveryReceived } from '../api/deliveryConfirmation';
import { apiRequest } from '../api/client';

const textOf = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAllByType('Text' as any).map((t) => [].concat(t.props.children).join('')).join(' | ');
const press = async (r: TestRenderer.ReactTestRenderer, label: string) => {
  await act(async () => {
    await r.root.findByProps({ accessibilityLabel: label }).props.onPress();
  });
};

describe('ConfirmDeliveryCard ("I got my order")', () => {
  it('asks once more before confirming, then confirms', async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(<ConfirmDeliveryCard onConfirm={onConfirm} />);
    });

    await press(r, 'I got my order');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(textOf(r)).toContain('Did you receive your order?');

    await press(r, 'Yes, I got it');
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('"Not yet" backs out without confirming', async () => {
    const onConfirm = jest.fn();
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(<ConfirmDeliveryCard onConfirm={onConfirm} />);
    });

    await press(r, 'I got my order');
    await press(r, 'Not yet');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(r.root.findByProps({ accessibilityLabel: 'I got my order' })).toBeTruthy();
  });

  it('shows the server message when confirming fails', async () => {
    const onConfirm = jest.fn().mockRejectedValue(new Error('You can confirm delivery once the rider has picked up your order.'));
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(<ConfirmDeliveryCard onConfirm={onConfirm} />);
    });

    await press(r, 'I got my order');
    await press(r, 'Yes, I got it');
    expect(textOf(r)).toContain('You can confirm delivery once the rider has picked up your order.');
  });
});

describe('confirmDeliveryReceived', () => {
  it('posts to the customer confirm endpoint', async () => {
    (apiRequest as jest.Mock).mockResolvedValueOnce({ orderId: 'order-1', status: 'completed' });

    const res = await confirmDeliveryReceived('order-1');

    expect(apiRequest).toHaveBeenCalledWith('/orders/order-1/delivery/confirm', { method: 'POST' });
    expect(res.status).toBe('completed');
  });
});
