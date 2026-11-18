import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { apiRequest } from '../api/client';
import { useAuth } from './AuthContext';
import { USE_MOCK_DATA, MOCK_CART, MOCK_MENUS, DEFAULT_MOCK_MENU } from '../api/mockData';
import { estimateTaxes, type CartTaxes } from '../utils/taxes';

export interface CartItem {
  id: string; // cart item id
  menuItemId: string;
  name: string;
  quantity: number;
  /** Price per unit after the restaurant's dish discount. */
  unitPrice: number;
  /** Price before the dish discount (server carts only). */
  originalUnitPrice?: number;
  /** e.g. "20% OFF" when the restaurant discounts this dish. */
  discountLabel?: string | null;
  totalPrice: number;
  isAvailable: boolean;
  imageUrl: string | null;
}

/** Coupon applied to the cart; `applied: false` with a message when it does not apply now. */
export interface CartPromo {
  promotionId: string;
  code: string;
  description: string | null;
  applied: boolean;
  discountAmount: number;
  message: string | null;
}

export interface CartData {
  cartId: string;
  outletId: string;
  restaurantName: string;
  outletName: string;
  isOutletOperational: boolean;
  items: CartItem[];
  itemCount: number;
  itemTotal: number;
  deliveryFee: number;
  deliveryFeePending?: boolean;
  taxAmount: number;
  /** GST rates and split, set by the admin (missing on older servers). */
  taxes?: CartTaxes;
  /** Coupon discount. */
  discountAmount: number;
  promo?: CartPromo | null;
  /** What the customer saves on restaurant dish discounts. */
  dishSavings?: number;
  totalPayable: number;
}

interface CartContextType {
  cart: CartData | null;
  isLoading: boolean;
  error: string | null;
  fetchCart: () => Promise<void>;
  addItem: (
    outletId: string,
    menuItemId: string,
    quantity?: number,
    itemDetails?: {
      name?: string;
      unitPrice?: number;
      imageUrl?: string | null;
      outletName?: string;
      restaurantName?: string;
    },
  ) => Promise<void>;
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>;
  removeItem: (cartItemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  /** Applies a coupon code; throws with the reason when it cannot be used. */
  applyPromo: (code: string) => Promise<void>;
  removePromo: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const GUEST_CART_STORAGE_KEY = 'fleet24_guest_cart';

// Helper to safely persist guest cart
const saveGuestCartToStorage = async (guestCart: CartData | null): Promise<void> => {
  try {
    if (guestCart) {
      const serialized = JSON.stringify(guestCart);
      if (Platform.OS === 'web') {
        localStorage.setItem(GUEST_CART_STORAGE_KEY, serialized);
      } else {
        await SecureStore.setItemAsync(GUEST_CART_STORAGE_KEY, serialized);
      }
    } else {
      if (Platform.OS === 'web') {
        localStorage.removeItem(GUEST_CART_STORAGE_KEY);
      } else {
        await SecureStore.deleteItemAsync(GUEST_CART_STORAGE_KEY);
      }
    }
  } catch {
    // Non-fatal fallback
  }
};

// Helper to safely load guest cart
const restoreGuestCart = (data: string): CartData => {
  const stored: CartData = JSON.parse(data);
  // Legacy guest carts persisted a locally invented fee.
  return stored.deliveryFeePending === undefined
    ? recalculateCart({ ...stored, deliveryFeePending: true }, stored.items)
    : stored;
};

const getGuestCartFromStorage = async (): Promise<CartData | null> => {
  try {
    if (Platform.OS === 'web') {
      const data = localStorage.getItem(GUEST_CART_STORAGE_KEY);
      return data ? restoreGuestCart(data) : null;
    }
    const data = await SecureStore.getItemAsync(GUEST_CART_STORAGE_KEY);
    return data ? restoreGuestCart(data) : null;
  } catch {
    return null;
  }
};

// Helper to recalculate cart totals
export const recalculateCart = (currentCart: CartData, items: CartItem[]): CartData => {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const itemTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const deliveryFeePending = currentCart.deliveryFeePending === true;
  const deliveryFee = items.length > 0 && !deliveryFeePending ? currentCart.deliveryFee : 0;
  const taxes = estimateTaxes(itemTotal, deliveryFee, currentCart.taxes);
  const taxAmount = taxes.taxAmount;
  const discountAmount = 0.0;
  const totalPayable = Number((itemTotal + deliveryFee + taxAmount - discountAmount).toFixed(2));

  return {
    ...currentCart,
    items,
    itemCount,
    itemTotal,
    deliveryFee,
    deliveryFeePending,
    taxAmount,
    taxes,
    discountAmount,
    totalPayable,
  };
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState<CartData | null>(USE_MOCK_DATA ? MOCK_CART : null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCart = async () => {
    if (USE_MOCK_DATA) {
      if (!cart) setCart(MOCK_CART);
      return;
    }

    if (!isAuthenticated) {
      const stored = await getGuestCartFromStorage();
      setCart(stored);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Check if there was a guest cart waiting to be synced to backend
      const storedGuestCart = await getGuestCartFromStorage();
      if (storedGuestCart && storedGuestCart.items.length > 0) {
        for (const item of storedGuestCart.items) {
          try {
            await apiRequest('/cart/items', {
              method: 'POST',
              body: JSON.stringify({
                outletId: storedGuestCart.outletId,
                menuItemId: item.menuItemId,
                quantity: item.quantity,
              }),
            });
          } catch (syncErr) {
            console.warn('Guest cart item sync notice:', syncErr);
          }
        }
        await saveGuestCartToStorage(null);
      }

      const data = await apiRequest<CartData | null>('/cart');
      setCart(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch cart';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => fetchCart());
  }, [isAuthenticated]);

  const addItem = async (
    outletId: string,
    menuItemId: string,
    quantity: number = 1,
    itemDetails?: {
      name?: string;
      unitPrice?: number;
      imageUrl?: string | null;
      outletName?: string;
      restaurantName?: string;
    },
  ) => {
    if (USE_MOCK_DATA) {
      setCart((prev) => {
        const activeCart = prev || { ...MOCK_CART, outletId, items: [] };
        if (activeCart.outletId && activeCart.outletId !== outletId && activeCart.items.length > 0) {
          const err = new Error('Cart already contains items from another outlet');
          setError(err.message);
          throw err;
        }

        const allItems = Object.values(MOCK_MENUS).flat();
        const found = allItems.find((i) => i.id === menuItemId) || DEFAULT_MOCK_MENU[0];
        const unitPrice = parseFloat((found as { finalPrice?: string }).finalPrice ?? found.effectivePrice);

        const existingIndex = activeCart.items.findIndex((i) => i.menuItemId === menuItemId);
        let newItems: CartItem[];

        if (existingIndex >= 0) {
          newItems = activeCart.items.map((item, idx) =>
            idx === existingIndex
              ? {
                  ...item,
                  quantity: item.quantity + quantity,
                  totalPrice: (item.quantity + quantity) * item.unitPrice,
                }
              : item,
          );
        } else {
          newItems = [
            ...activeCart.items,
            {
              id: `mock-ci-${Date.now()}`,
              menuItemId,
              name: found.name,
              quantity,
              unitPrice,
              totalPrice: unitPrice * quantity,
              isAvailable: true,
              imageUrl: found.imageUrl,
            },
          ];
        }

        return recalculateCart(activeCart, newItems);
      });
      return;
    }

    if (!isAuthenticated) {
      // Guest Cart Mode: allows adding and adjusting food items before login
      if (cart && cart.outletId && cart.outletId !== outletId && cart.items.length > 0) {
        const err = new Error('Cart already contains items from another outlet');
        setError(err.message);
        throw err;
      }

      const activeCart: CartData =
        cart && cart.outletId === outletId
          ? cart
          : {
              cartId: `guest-cart-${Date.now()}`,
              outletId,
              restaurantName: itemDetails?.restaurantName || 'Restaurant',
              outletName: itemDetails?.outletName || 'Outlet',
              isOutletOperational: true,
              items: [],
              itemCount: 0,
              itemTotal: 0,
              deliveryFee: 0,
              deliveryFeePending: true,
              taxAmount: 0,
              discountAmount: 0,
              totalPayable: 0,
            };

      const existingIndex = activeCart.items.findIndex((i) => i.menuItemId === menuItemId);
      const unitPrice = itemDetails?.unitPrice ?? 0;
      let newItems: CartItem[];

      if (existingIndex >= 0) {
        newItems = activeCart.items.map((item, idx) =>
          idx === existingIndex
            ? {
                ...item,
                quantity: item.quantity + quantity,
                totalPrice: (item.quantity + quantity) * item.unitPrice,
              }
            : item,
        );
      } else {
        newItems = [
          ...activeCart.items,
          {
            id: `guest-ci-${Date.now()}-${Math.random().toString(36).substring(5)}`,
            menuItemId,
            name: itemDetails?.name || 'Item',
            quantity,
            unitPrice,
            totalPrice: unitPrice * quantity,
            isAvailable: true,
            imageUrl: itemDetails?.imageUrl || null,
          },
        ];
      }

      const updated = recalculateCart(activeCart, newItems);
      setCart(updated);
      await saveGuestCartToStorage(updated);
      return;
    }

    // Authenticated Mode: persistent backend DB cart
    try {
      setIsLoading(true);
      setError(null);
      const updatedCart = await apiRequest<CartData>('/cart/items', {
        method: 'POST',
        body: JSON.stringify({ outletId, menuItemId, quantity }),
      });
      setCart(updatedCart);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add item';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuantity = async (cartItemId: string, quantity: number) => {
    if ((USE_MOCK_DATA || !isAuthenticated) && cart) {
      if (quantity <= 0) {
        return removeItem(cartItemId);
      }
      const newItems = cart.items.map((i) =>
        i.id === cartItemId
          ? { ...i, quantity, totalPrice: quantity * i.unitPrice }
          : i,
      );
      const updated = recalculateCart(cart, newItems);
      setCart(updated);
      if (!isAuthenticated && !USE_MOCK_DATA) {
        await saveGuestCartToStorage(updated);
      }
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const updatedCart = await apiRequest<CartData>(`/cart/items/${cartItemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity }),
      });
      setCart(updatedCart);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update quantity';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const removeItem = async (cartItemId: string) => {
    if ((USE_MOCK_DATA || !isAuthenticated) && cart) {
      const newItems = cart.items.filter((i) => i.id !== cartItemId);
      if (newItems.length === 0) {
        setCart(null);
        if (!isAuthenticated && !USE_MOCK_DATA) {
          await saveGuestCartToStorage(null);
        }
      } else {
        const updated = recalculateCart(cart, newItems);
        setCart(updated);
        if (!isAuthenticated && !USE_MOCK_DATA) {
          await saveGuestCartToStorage(updated);
        }
      }
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const updatedCart = await apiRequest<CartData | null>(`/cart/items/${cartItemId}`, {
        method: 'DELETE',
      });
      setCart(updatedCart);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove item';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const clearCart = async () => {
    if (USE_MOCK_DATA || !isAuthenticated) {
      setCart(null);
      if (!isAuthenticated && !USE_MOCK_DATA) {
        await saveGuestCartToStorage(null);
      }
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await apiRequest('/cart', { method: 'DELETE' });
      setCart(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to clear cart';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const applyPromo = async (code: string) => {
    if (!isAuthenticated || USE_MOCK_DATA) {
      throw new Error('Log in to use a coupon.');
    }
    const updatedCart = await apiRequest<CartData | null>('/cart/promo', {
      method: 'POST',
      body: JSON.stringify({ code: code.trim() }),
    });
    setCart(updatedCart);
  };

  const removePromo = async () => {
    if (!isAuthenticated || USE_MOCK_DATA) return;
    const updatedCart = await apiRequest<CartData | null>('/cart/promo', { method: 'DELETE' });
    setCart(updatedCart);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        isLoading,
        error,
        fetchCart,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        applyPromo,
        removePromo,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
