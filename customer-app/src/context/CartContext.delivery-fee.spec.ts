import { recalculateCart, type CartData, type CartItem } from './CartContext';

jest.mock('expo-secure-store', () => ({}));
jest.mock('./AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/client', () => ({ apiRequest: jest.fn() }));

const item: CartItem = {
  id: 'item', menuItemId: 'dish', name: 'Dish', quantity: 1, unitPrice: 100,
  totalPrice: 100, isAvailable: true, imageUrl: null,
};
const cart: CartData = {
  cartId: 'cart', outletId: 'outlet', restaurantName: 'Restaurant', outletName: 'Outlet',
  isOutletOperational: true, items: [], itemCount: 0, itemTotal: 0,
  deliveryFee: 0, taxAmount: 0, discountAmount: 0, totalPayable: 0,
};

it('leaves the delivery fee pending on a guest cart with no server quote', () => {
  expect(recalculateCart({ ...cart, deliveryFeePending: true }, [item]))
    .toMatchObject({ deliveryFee: 0, deliveryFeePending: true, totalPayable: 105 });
});

it.each([0, 42])('preserves a server delivery fee of %i', (deliveryFee) => {
  expect(recalculateCart({ ...cart, deliveryFee }, [item]))
    .toMatchObject({ deliveryFee, deliveryFeePending: false, totalPayable: 105 + deliveryFee });
});
