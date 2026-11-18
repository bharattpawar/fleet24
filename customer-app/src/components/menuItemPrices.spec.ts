import { menuItemPrices } from './MenuItemCard';

jest.mock('./ExplorePhoto', () => ({ ExplorePhoto: () => null }));
jest.mock('./VegBadge', () => ({ VegBadge: () => null }));
jest.mock('./QuantityStepper', () => ({ QuantityStepper: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

describe('menu item prices', () => {
  it('charges the dish-discounted price and strikes the outlet price', () => {
    expect(menuItemPrices({ basePrice: '200.00', effectivePrice: '200.00', finalPrice: '160.00' })).toEqual({ price: 160, strikePrice: 200 });
  });

  it('strikes the base price when the outlet price is lower', () => {
    expect(menuItemPrices({ basePrice: '210.00', effectivePrice: '190.00', finalPrice: '190.00' })).toEqual({ price: 190, strikePrice: 210 });
  });

  it('shows one price when there is no discount, also on older servers', () => {
    expect(menuItemPrices({ basePrice: '120.00', effectivePrice: '120.00' })).toEqual({ price: 120, strikePrice: null });
  });
});
