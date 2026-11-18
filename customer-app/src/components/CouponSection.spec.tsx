(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (s: any) => s },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

import { CouponSection } from './CouponSection';

const textOf = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAllByType('Text' as any).map((t) => [].concat(t.props.children).join('')).join(' | ');

describe('CouponSection', () => {
  it('applies a typed code and shows the server reason when it fails', async () => {
    const onApply = jest.fn().mockRejectedValue(new Error('Add items worth ₹49 more to use this coupon.'));
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(<CouponSection promo={null} canUseCoupons onApply={onApply} onRemove={jest.fn()} />);
    });
    await act(async () => {
      r.root.findByProps({ accessibilityLabel: 'Coupon code' }).props.onChangeText('save50');
    });
    await act(async () => {
      await r.root.findByProps({ accessibilityLabel: 'Apply coupon' }).props.onPress();
    });
    expect(onApply).toHaveBeenCalledWith('save50');
    expect(textOf(r)).toContain('Add items worth ₹49 more to use this coupon.');
  });

  it('shows the saving for an applied coupon and removes it', async () => {
    const onRemove = jest.fn().mockResolvedValue(undefined);
    const promo = { promotionId: 'p', code: 'SAVE50', description: null, applied: true, discountAmount: 50, message: null };
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(<CouponSection promo={promo} canUseCoupons onApply={jest.fn()} onRemove={onRemove} />);
    });
    expect(textOf(r)).toContain('You save ₹50 with this coupon');
    await act(async () => {
      await r.root.findByProps({ accessibilityLabel: 'Remove coupon SAVE50' }).props.onPress();
    });
    expect(onRemove).toHaveBeenCalled();
  });

  it('explains a coupon that stopped applying', async () => {
    const promo = { promotionId: 'p', code: 'SAVE50', description: null, applied: false, discountAmount: 0, message: 'This coupon has expired.' };
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(<CouponSection promo={promo} canUseCoupons onApply={jest.fn()} onRemove={jest.fn()} />);
    });
    expect(textOf(r)).toContain('This coupon has expired.');
  });

  it('asks guests to log in', async () => {
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(<CouponSection promo={null} canUseCoupons={false} onApply={jest.fn()} onRemove={jest.fn()} />);
    });
    expect(textOf(r)).toContain('Log in to use a coupon');
  });
});
