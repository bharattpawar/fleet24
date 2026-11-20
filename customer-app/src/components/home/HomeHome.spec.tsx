(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('react-native', () => {
  function value(this: any) { this.interpolate = () => 0; this.setValue = jest.fn(); }
  return {
    View: 'View', Text: 'Text', TextInput: 'TextInput', TouchableOpacity: 'TouchableOpacity', ScrollView: 'ScrollView',
    Image: 'Image', ActivityIndicator: 'ActivityIndicator',
    FlatList: ({ data, renderItem }: any) => data.map((item: any, index: number) => renderItem({ item, index })),
    StyleSheet: { create: (s: any) => s, absoluteFill: {}, hairlineWidth: 1 },
    useWindowDimensions: () => ({ width: 382, height: 883 }),
    Animated: { Value: value, Text: 'AnimatedText', timing: () => ({ start: jest.fn() }) },
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('../../api/client', () => ({ API_BASE_URL: 'https://api.test/api/v1' }));
jest.mock('../../theme/homeArt', () => ({ HOME_ART: new Proxy({}, { get: () => 7 }) }));

import { BannerCarousel, SearchRow, ShortcutRow } from './HomeHeader';
import { DealRail, OfferFilterPills, SearchResults } from './HomeSections';
import { HomeImage } from './HomeImage';
import type { FeedSection } from '../../utils/homeFeed';

const textOf = (r: TestRenderer.ReactTestRenderer) =>
  r.root.findAllByType('Text' as any).map(t => [].concat(t.props.children).join('')).join(' | ');
const outlet = (id: string, extra = {}) => ({ id, restaurantName: `Kitchen ${id}`, outletName: id, slug: id, logoUrl: null, address: '', deliveryRadiusKm: '5', isAcceptingOrders: true, ...extra });
const facts = (favs: string[] = []) => ({ cuisine: () => 'Bakery', isFavorite: (id: string) => favs.includes(id), onToggleFavorite: jest.fn() });

describe('Home header', () => {
  it('shortcuts show admin labels and badges and report taps', () => {
    const onPress = jest.fn();
    const items = [{ title: 'FOOD', image: 'asset:shortcut-food', action: 'food' as const }, { title: 'FAST', image: 'media:3f2b6c1e-8d4a-4f6b-9c2d-1a2b3c4d5e6f', action: 'fast' as const, badge: '15 MINS' }];
    let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(<ShortcutRow shortcuts={items} selected={0} onPress={onPress} />); });
    expect(textOf(r)).toBe('FOOD | 15 MINS | FAST');
    const tabs = r.root.findAllByProps({ accessibilityRole: 'tab' });
    expect(tabs[0].props.accessibilityState).toEqual({ selected: true });
    act(() => { tabs[1].props.onPress(); });
    expect(onPress).toHaveBeenCalledWith(items[1], 1);
  });

  it('VEG card is a real switch and search submits from the keyboard', () => {
    const onToggleVeg = jest.fn(); const onSubmit = jest.fn(); const onQuery = jest.fn();
    let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(<SearchRow query="" onQuery={onQuery} onSubmit={onSubmit} hints={['Pizza']} vegMode={false} onToggleVeg={onToggleVeg} />); });
    const sw = r.root.findByProps({ accessibilityRole: 'switch' });
    expect(sw.props.accessibilityState).toEqual({ checked: false });
    act(() => { sw.props.onPress(); });
    expect(onToggleVeg).toHaveBeenCalled();
    const input = r.root.findByType('TextInput' as any);
    act(() => { input.props.onChangeText('biry'); input.props.onSubmitEditing(); });
    expect(onQuery).toHaveBeenCalledWith('biry');
    expect(onSubmit).toHaveBeenCalled();
    expect(textOf(r)).toContain('Search for');
  });

  it('banner shows admin text and opens its destination', () => {
    const onAction = jest.fn();
    const a = outlet('a');
    const banner: FeedSection = { kind: 'banner', title: 'Foodie Weekend', subtitle: 'Flat ₹150 OFF', cta: 'ORDER NOW', image: 'asset:brownies', imageLeft: 'asset:biryani', targets: [{ type: 'outlet', id: 'a' }], cards: [{ outlet: a }] };
    let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(<BannerCarousel banners={[banner]} onAction={onAction} />); });
    expect(textOf(r)).toBe('Foodie Weekend | Flat ₹150 OFF | ORDER NOW');
    act(() => { r.root.findByProps({ accessibilityRole: 'button' }).props.onPress(); });
    expect(onAction).toHaveBeenCalledWith({ type: 'outlet', outlet: a, dishId: undefined });
  });
});

describe('Home content', () => {
  it('filter pills mark the selected tab', () => {
    const onChange = jest.fn();
    let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(<OfferFilterPills tabs={[{ label: 'MIN ₹100 OFF', filter: 'offers' }, { label: 'FASTEST', filter: 'fast' }]} active={0} onChange={onChange} />); });
    const tabs = r.root.findAllByProps({ accessibilityRole: 'tab' });
    expect(tabs.map(t => t.props.accessibilityState.selected)).toEqual([true, false]);
    act(() => { tabs[1].props.onPress(); });
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('deal cards show only real data (offer, ETA, cuisine) and toggle favourites', () => {
    const f = facts(['b']);
    let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(<DealRail outlets={[outlet('a', { offerTitle: '65% OFF', offerSubtitle: 'UPTO ₹125', deliveryEta: { minMinutes: 30, maxMinutes: 35 } }), outlet('b', { isAcceptingOrders: false })]} facts={f} onSelectOutlet={jest.fn()} emptyText="none" />); });
    const text = textOf(r);
    expect(text).toContain('65% OFF | UPTO ₹125 | Kitchen a | 30–35 min | Bakery');
    expect(text).toContain('Kitchen b | Closed now');
    expect(text).not.toMatch(/★|rating/i);
    const hearts = r.root.findAll(n => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.includes('favourites') && n.props.onPress);
    expect(hearts.map(h => h.props.accessibilityState.selected)).toEqual([false, true]);
    act(() => { hearts[0].props.onPress(); });
    expect(f.onToggleFavorite).toHaveBeenCalledWith('a');
  });

  it('search shows loading, results with veg mode applied, and an empty state', () => {
    const base = { vegByOutlet: { a: { hasVeg: true, pureVeg: false }, b: { hasVeg: false, pureVeg: false } }, cuisinesByOutlet: {}, categoriesByOutlet: {} };
    const result = { ...base, query: 'biryani', outlets: [outlet('a'), outlet('b')], dishes: [{ outlet: outlet('a'), dish: { id: 'd1', name: 'Veg Biryani', imageUrl: null, isVeg: true, effectivePrice: '200' } }, { outlet: outlet('b'), dish: { id: 'd2', name: 'Chicken Biryani', imageUrl: null, isVeg: false, effectivePrice: '240' } }] };
    let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(<SearchResults search={{ status: 'loading', query: 'biryani' }} vegMode={false} facts={facts()} onSelectOutlet={jest.fn()} onRetry={jest.fn()} />); });
    expect(textOf(r)).toContain('Searching for “biryani”');
    act(() => { r.update(<SearchResults search={{ status: 'done', result }} vegMode facts={facts()} onSelectOutlet={jest.fn()} onRetry={jest.fn()} />); });
    expect(textOf(r)).toContain('Veg Biryani');
    expect(textOf(r)).not.toContain('Chicken Biryani');
    expect(textOf(r)).not.toContain('Kitchen b');
    act(() => { r.update(<SearchResults search={{ status: 'done', result: { ...result, query: 'zz', outlets: [], dishes: [] } }} vegMode={false} facts={facts()} onSelectOutlet={jest.fn()} onRetry={jest.fn()} />); });
    expect(textOf(r)).toContain('No results for “zz”');
  });
});

describe('HomeImage fallbacks', () => {
  it('falls back from a broken upload to the built-in illustration, then to a placeholder', () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(<HomeImage source="https://broken.test/x.jpg" fallback="biryani" alt="Biryani" />); });
    expect(r.root.findByType('Image' as any).props.source).toEqual({ uri: 'https://broken.test/x.jpg' });
    act(() => { r.root.findByType('Image' as any).props.onError(); });
    expect(r.root.findByType('Image' as any).props.source).toBe(7);
    act(() => { r.root.findByType('Image' as any).props.onError(); });
    expect(r.root.findAllByType('Image' as any)).toHaveLength(0);
    expect(r.root.findByProps({ accessibilityLabel: 'Biryani' })).toBeTruthy();
  });
});
