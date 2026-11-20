import { CustomerHomeController } from './customer-home.controller';
import { ROLES_KEY } from '../auth/decorators/auth.decorators';

describe('Customer Home discovery', () => {
  it('uses only published sections, preserves card order and omits unavailable targets', async () => {
    const outlet = (id: string, isAcceptingOrders = true) => ({ id, isAcceptingOrders, latitude: '28.48', longitude: '77.51' });
    const target = (id: string) => ({ type: 'outlet', id });
    const row = (title: string, ids: string[], hidden = false) => ({
      kind: 'row', title, targets: ids.map(target), hidden,
    });
    const db = { select: () => ({ from: async () => [{
      draft: [row('Draft only', ['a'])],
      published: [row('Featured', ['b', 'missing', 'a']), row('Empty', ['closed']), row('Hidden', ['a'], true)],
    }] }) };
    const menus = {
      getPublicActiveOutlets: jest.fn().mockResolvedValue([outlet('a'), outlet('b'), outlet('closed', false)]),
      listMenuItemsForOutlet: jest.fn().mockResolvedValue([]),
      listAvailableCategoryNamesByOutlet: jest.fn().mockResolvedValue({ a: ['Main Course'], b: ['Main Course'], closed: ['Main Course'] }),
    };
    const controller = new CustomerHomeController(db as never, menus as never);
    const result = await controller.feed('28.48', '77.51');
    expect(menus.getPublicActiveOutlets).toHaveBeenCalledWith(28.48, 77.51);
    expect(result.outlets).toHaveLength(3);
    expect(result.categoriesByOutlet).toEqual({ a: ['Main Course'], b: ['Main Course'], closed: ['Main Course'] });
    expect(menus.listAvailableCategoryNamesByOutlet).toHaveBeenCalledWith(['a', 'b', 'closed']);
    // Only outlet rows are published, so no full menu is loaded
    expect(menus.listMenuItemsForOutlet).not.toHaveBeenCalled();
    expect(result.sections.map(section => section.title)).toEqual(['Featured']);
    expect(result.sections[0].cards.map(card => card.outlet.id)).toEqual(['b', 'a']);
  });

  it('resolves offer tiles, drops tiles with nothing open nearby, and passes rail + search hints through', async () => {
    const outlet = (id: string) => ({ id, restaurantId: 'r-' + id, isAcceptingOrders: true, latitude: '28.48', longitude: '77.51' });
    const img = 'https://img.test/x.jpg';
    const published = [
      { kind: 'search_hints', title: 'Search', hints: ['biryani'], targets: [] },
      { kind: 'tiles', title: 'Offers', targets: [
        { type: 'outlet', id: 'a', title: 'Flat 50% off', image: img },
        { type: 'outlet', id: 'missing', title: 'Gone', image: img },
      ] },
      { kind: 'rail', title: 'Explore', tabs: [{ label: 'All', filter: 'all' }], targets: [] },
    ];
    const db = { select: () => ({ from: async () => [{ draft: [], published }] }) };
    const menus = {
      getPublicActiveOutlets: jest.fn().mockResolvedValue([outlet('a')]),
      listMenuItemsForOutlet: jest.fn().mockResolvedValue([]),
      listAvailableCategoryNamesByOutlet: jest.fn().mockResolvedValue({ a: [] }),
    };
    const result = await new CustomerHomeController(db as never, menus as never).feed('28.48', '77.51');
    expect(result.sections.map(s => s.kind)).toEqual(['search_hints', 'tiles', 'rail']);
    const tiles = result.sections[1] as unknown as { targets: Array<{ id: string; title: string }> };
    expect(tiles.targets.map(t => [t.id, t.title])).toEqual([['a', 'Flat 50% off']]);
    expect(result.sections[0].cards).toEqual([]);
  });

  it('requires admin role for reads and writes to the editor', () => {
    expect(Reflect.getMetadata(ROLES_KEY, CustomerHomeController.prototype.editor)).toEqual(['admin']);
    expect(Reflect.getMetadata(ROLES_KEY, CustomerHomeController.prototype.save)).toEqual(['admin']);
  });
});
