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

  it.each([
    ['not an array', 'nope'],
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
    ['row pointing at a missing outlet', [{ kind: 'row', title: 'x', targets: [{ type: 'outlet', id: 'gone' }] }]],
    ['category section pointing at a dish', [{ kind: 'category', title: 'x', image: img, targets: [{ type: 'dish', id: 'd-1' }] }]],
  ])('rejects %s', (_label, input) => {
    expect(() => validateHomeSections(input, catalog)).toThrow(HomeSectionError);
  });
});
