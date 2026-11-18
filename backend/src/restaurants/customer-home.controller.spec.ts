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
      listMenuItemsForOutlet: jest.fn().mockResolvedValue([
        { categoryName: 'Main Course', effectiveIsAvailable: true, categoryIsActive: true },
        { categoryName: 'Main Course', effectiveIsAvailable: true, categoryIsActive: true },
        { categoryName: 'Sides', effectiveIsAvailable: false, categoryIsActive: true },
      ]),
    };
    const controller = new CustomerHomeController(db as never, menus as never);
    const result = await controller.feed('28.48', '77.51');
    expect(menus.getPublicActiveOutlets).toHaveBeenCalledWith(28.48, 77.51);
    expect(result.outlets).toHaveLength(3);
    expect(result.categoriesByOutlet).toEqual({ a: ['Main Course'], b: ['Main Course'], closed: ['Main Course'] });
    expect(result.sections.map(section => section.title)).toEqual(['Featured']);
    expect(result.sections[0].cards.map(card => card.outlet.id)).toEqual(['b', 'a']);
  });

  it('requires admin role for reads and writes to the editor', () => {
    expect(Reflect.getMetadata(ROLES_KEY, CustomerHomeController.prototype.editor)).toEqual(['admin']);
    expect(Reflect.getMetadata(ROLES_KEY, CustomerHomeController.prototype.save)).toEqual(['admin']);
  });
});
