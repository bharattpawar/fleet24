import { railOutlets, searchHints, targetAction, outletPhoto, DEFAULT_SEARCH_HINT, FeedSection, vegOutlets, cuisineLine } from './homeFeed';
import type { OutletSummary } from '../components/RestaurantCard';

const outlet = (id: string, extra: Partial<OutletSummary> = {}): OutletSummary => ({
  id, restaurantName: id, outletName: id, slug: id, logoUrl: `https://img.test/${id}-logo.png`, address: '', deliveryRadiusKm: '5',
  isAcceptingOrders: true, ...extra,
});

describe('home feed helpers', () => {
  it('uses admin search hints, else a neutral default', () => {
    const hints: FeedSection = { kind: 'search_hints', title: '', hints: ['biryani', ' ', 'pizza'], targets: [], cards: [] };
    expect(searchHints([hints])).toEqual(['biryani', 'pizza']);
    expect(searchHints([])).toEqual([DEFAULT_SEARCH_HINT]);
  });

  it('filters rail tabs from admin-set outlet data', () => {
    const list = [
      outlet('far-offer', { offerTitle: '50% OFF', distanceKm: 4, deliveryEta: { minMinutes: 30, maxMinutes: 35 } }),
      outlet('near', { distanceKm: 1, deliveryEta: { minMinutes: 15, maxMinutes: 20 } }),
      outlet('closed-offer', { offerTitle: '20% OFF', isAcceptingOrders: false, distanceKm: 0.5 }),
      outlet('no-eta', { distanceKm: 2 }),
    ];
    expect(railOutlets(list, 'offers').map(o => o.id)).toEqual(['far-offer', 'closed-offer']);
    expect(railOutlets(list, 'fast').map(o => o.id)).toEqual(['near', 'far-offer', 'no-eta']);
    expect(railOutlets(list, 'all').map(o => o.id)).toEqual(['near', 'no-eta', 'far-offer', 'closed-offer']);
  });

  it('prefers the admin cover photo over the logo', () => {
    expect(outletPhoto(outlet('a', { coverImageUrl: 'https://img.test/cover.jpg' }))).toBe('https://img.test/cover.jpg');
    expect(outletPhoto(outlet('a'))).toBe('https://img.test/a-logo.png');
  });

  it('veg mode keeps kitchens that sell at least one veg dish', () => {
    const list = [outlet('a'), outlet('b'), outlet('c')];
    expect(vegOutlets(list, { a: { hasVeg: true, pureVeg: true }, b: { hasVeg: false, pureVeg: false } }).map(o => o.id)).toEqual(['a']);
  });

  it('cuisine line prefers declared cuisines, else menu categories', () => {
    expect(cuisineLine('a', { a: ['Bakery', 'Desserts'] }, { a: ['Cakes'] })).toBe('Bakery, Desserts');
    expect(cuisineLine('b', { b: [] }, { b: ['Starters', 'Starters', 'Breads', 'Rolls', 'Extra'] })).toBe('Starters, Breads, Rolls');
    expect(cuisineLine('c', {}, {})).toBe('');
  });

  it('turns a banner or tile destination into an action', () => {
    const a = outlet('a');
    expect(targetAction({ type: 'dish', id: 'd' }, [{ outlet: a, dish: { id: 'd', name: 'x', imageUrl: null, effectivePrice: '1' } }], 'T'))
      .toEqual({ type: 'outlet', outlet: a, dishId: 'd' });
    expect(targetAction({ type: 'category', id: 'c', name: 'Biryani' }, [{ outlet: a }, { outlet: a }, { outlet: outlet('b') }], 'Deals'))
      .toEqual({ type: 'outlets', outletIds: ['a', 'b'], label: 'Biryani' });
    expect(targetAction({ type: 'outlet', id: 'gone' }, [], 'T')).toEqual({ type: 'none' });
  });
});
