import { HomeCatalog, HomeSectionError, validateHomeSections } from './customer-home.sections';

const catalog: HomeCatalog = {
  category: [{ id: 'cat-1', name: 'Biryani' }],
  restaurant: [{ id: 'r-1', name: 'Spice Hub' }],
  outlet: [{ id: 'o-1', name: 'Spice Hub - Sector 18' }],
  dish: [{ id: 'd-1', name: 'Paneer Tikka' }],
};
const img = 'https://ik.imagekit.io/fleet24/banner.jpg';

describe('validateHomeSections', () => {
  it('accepts every section kind and trims text', () => {
    const out = validateHomeSections([
      { kind: 'search_hints', title: 'Search', hints: [' biryani ', 'pizza'], targets: [] },
      { kind: 'banner', title: ' Weekend feast ', eyebrow: 'WEEKEND SPECIAL', subtitle: 'Flat ₹150 OFF', image: img, cta: 'Order now', targets: [{ type: 'restaurant', id: 'r-1' }] },
      { kind: 'tiles', title: 'Offers', targets: [{ type: 'category', id: 'cat-1', title: 'Biryani deals', subtitle: 'Up to 40% off', image: img }] },
      { kind: 'rail', title: 'Explore', tabs: [{ label: 'All', filter: 'all' }, { label: 'Offers', filter: 'offers' }], targets: [] },
      { kind: 'category', title: 'Biryani', image: img, targets: [{ type: 'category', id: 'cat-1' }] },
      { kind: 'row', title: 'Top picks', targets: [{ type: 'outlet', id: 'o-1' }, { type: 'dish', id: 'd-1' }] },
    ], catalog);
    expect(out.map(s => s.kind)).toEqual(['search_hints', 'banner', 'tiles', 'rail', 'category', 'row']);
    expect(out[0].hints).toEqual(['biryani', 'pizza']);
    expect(out[1].title).toBe('Weekend feast');
  });

  it('accepts uploaded media, built-in illustrations, alt text and a shortcut row', () => {
    const media = 'media:3f2b6c1e-8d4a-4f6b-9c2d-1a2b3c4d5e6f';
    const [shortcuts, banner, tiles] = validateHomeSections([
      { kind: 'shortcuts', title: 'Services', shortcuts: [
        { title: 'Food', image: 'asset:shortcut-food', action: 'food', alt: 'Burger' },
        { title: 'Quick', image: media, action: 'fast', badge: '10 MINS' },
      ], targets: [] },
      { kind: 'banner', title: 'Feast', cta: 'Order now', image: media, imageLeft: 'asset:biryani', imageAlt: 'Biryani and brownies', targets: [{ type: 'outlet', id: 'o-1' }] },
      { kind: 'tiles', title: 'Deals', targets: [{ type: 'outlet', id: 'o-1', title: '65% OFF', image: 'asset:promo-percent', alt: 'Percent badge' }] },
    ], catalog);
    expect(shortcuts.shortcuts).toEqual([
      { title: 'Food', image: 'asset:shortcut-food', action: 'food', alt: 'Burger' },
      { title: 'Quick', image: media, action: 'fast', badge: '10 MINS' },
    ]);
    expect(banner).toMatchObject({ image: media, imageLeft: 'asset:biryani', imageAlt: 'Biryani and brownies' });
    expect(tiles.targets[0]).toMatchObject({ image: 'asset:promo-percent', alt: 'Percent badge' });
    expect(validateHomeSections([{ kind: 'rail', title: '', tabs: [{ label: 'Offers', filter: 'offers' }], targets: [] }], catalog)[0].title).toBe('');
  });

  it.each([
    ['not an array', 'nope'],
    ['row without a title', [{ kind: 'row', title: '', targets: [{ type: 'outlet', id: 'o-1' }] }]],
    ['unknown kind', [{ kind: 'popup', title: 'x', targets: [] }]],
    ['banner without image', [{ kind: 'banner', title: 'x', cta: 'Go', targets: [{ type: 'outlet', id: 'o-1' }] }]],
    ['banner with non-http image', [{ kind: 'banner', title: 'x', cta: 'Go', image: 'javascript:alert(1)', targets: [{ type: 'outlet', id: 'o-1' }] }]],
    ['tile without its own photo', [{ kind: 'tiles', title: 'x', targets: [{ type: 'outlet', id: 'o-1', title: 'Deal' }] }]],
    ['rail with a bad filter', [{ kind: 'rail', title: 'x', tabs: [{ label: 'A', filter: 'cheap' }], targets: [] }]],
    ['rail without tabs', [{ kind: 'rail', title: 'x', tabs: [], targets: [] }]],
    ['two search hint sections', [
      { kind: 'search_hints', title: 'a', hints: ['x'], targets: [] },
      { kind: 'search_hints', title: 'b', hints: ['y'], targets: [] },
    ]],
    ['banner pointing at an unknown built-in illustration', [{ kind: 'banner', title: 'x', cta: 'Go', image: 'asset:not-real', targets: [{ type: 'outlet', id: 'o-1' }] }]],
    ['shortcut with an action the app does not have', [{ kind: 'shortcuts', title: 's', shortcuts: [{ title: 'Dineout', image: 'asset:shortcut-food', action: 'dineout' }], targets: [] }]],
    ['seven shortcuts', [{ kind: 'shortcuts', title: 's', shortcuts: Array.from({ length: 7 }, () => ({ title: 'Food', image: 'asset:shortcut-food', action: 'food' })), targets: [] }]],
    ['row pointing at a missing outlet', [{ kind: 'row', title: 'x', targets: [{ type: 'outlet', id: 'gone' }] }]],
    ['category section pointing at a dish', [{ kind: 'category', title: 'x', image: img, targets: [{ type: 'dish', id: 'd-1' }] }]],
  ])('rejects %s', (_label, input) => {
    expect(() => validateHomeSections(input, catalog)).toThrow(HomeSectionError);
  });
});
