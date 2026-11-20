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
      vegFactsByOutlet: jest.fn().mockResolvedValue({}),
      cuisinesByRestaurant: jest.fn().mockResolvedValue({}),
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
      vegFactsByOutlet: jest.fn().mockResolvedValue({ a: { hasVeg: true, pureVeg: false } }),
      cuisinesByRestaurant: jest.fn().mockResolvedValue({ 'r-a': ['North Indian'] }),
    };
    const result = await new CustomerHomeController(db as never, menus as never).feed('28.48', '77.51');
    expect(result.sections.map(s => s.kind)).toEqual(['search_hints', 'tiles', 'rail']);
    const tiles = result.sections[1] as unknown as { targets: Array<{ id: string; title: string }> };
    expect(tiles.targets.map(t => [t.id, t.title])).toEqual([['a', 'Flat 50% off']]);
    expect(result.sections[0].cards).toEqual([]);
    expect(result.vegByOutlet).toEqual({ a: { hasVeg: true, pureVeg: false } });
    expect(result.cuisinesByOutlet).toEqual({ a: ['North Indian'] });
  });

  it('search matches names, cuisines, categories and dishes but only among visible kitchens', async () => {
    const outlet = (id: string, name: string, open = true, distanceKm = 1) =>
      ({ id, restaurantId: 'r-' + id, restaurantName: name, outletName: id, isAcceptingOrders: open, distanceKm });
    const outlets = [outlet('a', 'Biryani House', true, 3), outlet('b', 'Roll Point'), outlet('c', 'Thali Corner', false), outlet('d', 'Cafe')];
    const menus = {
      getPublicActiveOutlets: jest.fn().mockResolvedValue(outlets),
      listAvailableCategoryNamesByOutlet: jest.fn().mockResolvedValue({ a: [], b: ['Biryani Specials'], c: [], d: [] }),
      vegFactsByOutlet: jest.fn().mockResolvedValue({}),
      cuisinesByRestaurant: jest.fn().mockResolvedValue({ 'r-c': ['Biryani'] }),
      searchAvailableDishes: jest.fn().mockResolvedValue([{ outletId: 'd', dish: { id: 'x', name: 'Veg Biryani' } }]),
    };
    const controller = new CustomerHomeController({} as never, menus as never);
    const result = await controller.search('biryani', '28.4', '77.5');
    expect(menus.searchAvailableDishes).toHaveBeenCalledWith(['a', 'b', 'c', 'd'], 'biryani');
    // open name match first, then open category/dish matches by distance, closed last
    expect(result.outlets.map(o => o.id)).toEqual(['a', 'b', 'd', 'c']);
    expect(result.dishes.map(d => [d.outlet.id, d.dish.name])).toEqual([['d', 'Veg Biryani']]);
    await expect(controller.search('b')).rejects.toThrow('at least 2');
    await expect(controller.search('pizza', '91', '77')).rejects.toThrow('coordinates');
  });

  it('requires admin role for reads and writes to the editor', () => {
    expect(Reflect.getMetadata(ROLES_KEY, CustomerHomeController.prototype.editor)).toEqual(['admin']);
    expect(Reflect.getMetadata(ROLES_KEY, CustomerHomeController.prototype.save)).toEqual(['admin']);
  });
});
