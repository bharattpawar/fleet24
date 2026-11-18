import 'reflect-metadata';
import { FinancialSettingsService } from '../admin/financial-settings.service';
import { CartService } from './cart.service';

describe('CartService delivery fee fallback', () => {
  it.each([0, FinancialSettingsService.DEFAULT_SETTINGS.customerDeliveryFee.freeOrderThresholdCount])(
    'prices the cart with the default policy after %i eligible orders',
    async (count) => {
      const db = {
        query: { customerCarts: { findFirst: jest.fn().mockResolvedValue({
          outlet: { restaurant: {} },
          items: [{ quantity: 1, menuItem: { basePrice: '100' } }],
        }) } },
        select: () => ({ from: () => ({ where: async () => [{ count }] }) }),
      };
      const settings = {
        getActiveSettings: jest.fn().mockRejectedValue(new Error('Settings unavailable')),
        calculateCustomerDeliveryFee: FinancialSettingsService.prototype.calculateCustomerDeliveryFee,
      };
      const service = new CartService(db as never, settings as never);
      const defaults = FinancialSettingsService.DEFAULT_SETTINGS;
      const expected = count === 0 ? 0 : defaults.customerDeliveryFee.baseDeliveryFeeAfterFree;

      await expect(service.getCart('customer')).resolves.toMatchObject({ deliveryFee: expected });
    },
  );
});
