(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('react-native', () => {
  const value = () => ({ interpolate: () => 0, setValue: jest.fn() });
  return {
    View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', ScrollView: 'ScrollView', Image: 'Image',
    StyleSheet: { create: (s: any) => s, absoluteFill: {} },
    useWindowDimensions: () => ({ width: 390, height: 800 }),
    Animated: { Value: value, Text: 'AnimatedText', timing: () => ({ start: jest.fn() }) },
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

import { HeroBanner, OfferTiles, RestaurantRail } from './HomeSections';
import type { FeedSection } from '../../utils/homeFeed';

const textOf = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAllByType('Text' as any).map(t => [].concat(t.props.children).join('')).join(' | ');
const outlet = (id: string, extra = {}) => ({ id, restaurantName: `Kitchen ${id}`, outletName: id, slug: id, logoUrl: null, address: '', deliveryRadiusKm: '5', isAcceptingOrders: true, ...extra });

describe('Home sections render admin content', () => {
  it('hero banner shows every admin field and opens its destination', () => {
    const onAction = jest.fn();
    const a = outlet('a');
    const section: FeedSection = { kind: 'banner', title: 'Weekend feast', eyebrow: 'WEEKEND SPECIAL', subtitle: 'Flat ₹150 OFF', cta: 'Order now', image: 'https://img.test/b.jpg', targets: [{ type: 'outlet', id: 'a' }], cards: [{ outlet: a }] };
    let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(<HeroBanner section={section} onAction={onAction} />); });
    expect(textOf(r)).toContain('WEEKEND SPECIAL | Weekend feast | Flat ₹150 OFF | Order now');
    act(() => { r.root.findByProps({ accessibilityRole: 'button' }).props.onPress(); });
    expect(onAction).toHaveBeenCalledWith({ type: 'outlet', outlet: a, dishId: undefined });
  });

  it('offer tiles show their own title and sub-line', () => {
    const section: FeedSection = { kind: 'tiles', title: 'Offers', targets: [{ type: 'outlet', id: 'a', title: 'Flat 50% OFF', subtitle: 'Top biryanis', image: 'https://img.test/t.jpg', cards: [{ outlet: outlet('a') }] }], cards: [] };
    let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(<OfferTiles section={section} onAction={jest.fn()} />); });
    expect(textOf(r)).toContain('Flat 50% OFF | Top biryanis');
  });

  it('rail toggle switches between admin tabs and shows outlet offers', () => {
    const section: FeedSection = { kind: 'rail', title: 'For you', tabs: [{ label: 'Near & Fast', filter: 'fast' }, { label: 'Offers', filter: 'offers' }], targets: [], cards: [] };
    const outlets = [outlet('fast', { deliveryEta: { minMinutes: 10, maxMinutes: 15 } }), outlet('deal', { offerTitle: '60% OFF', offerSubtitle: 'UPTO ₹120' })];
    let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(<RestaurantRail section={section} outlets={outlets} onSelectOutlet={jest.fn()} />); });
    // Near & Fast: quickest ETA first
    expect(textOf(r).indexOf('Kitchen fast')).toBeLessThan(textOf(r).indexOf('Kitchen deal'));
    act(() => { r.root.findAllByProps({ accessibilityRole: 'tab' })[1].props.onPress(); });
    expect(textOf(r)).toContain('60% OFF | UPTO ₹120 | Kitchen deal');
    expect(textOf(r)).not.toContain('Kitchen fast');
  });
});
