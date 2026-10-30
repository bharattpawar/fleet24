import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { useAuth } from './AuthContext';
import { USE_MOCK_DATA, MOCK_CART, MOCK_MENUS, DEFAULT_MOCK_MENU } from '../api/mockData';

export interface CartItem {
  id: string; // cart item id
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  isAvailable: boolean;
  imageUrl: string | null;
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
  taxAmount: number;
  discountAmount: number;
  totalPayable: number;
}

interface CartContextType {
  cart: CartData | null;
  isLoading: boolean;
  error: string | null;
  fetchCart: () => Promise<void>;
  addItem: (outletId: string, menuItemId: string, quantity?: number) => Promise<void>;
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>;
  removeItem: (cartItemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Helper to recalculate cart totals
const recalculateCart = (currentCart: CartData, items: CartItem[]): CartData => {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const itemTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const deliveryFee = items.length > 0 ? 30.0 : 0.0;
  const taxAmount = Number((itemTotal * 0.05).toFixed(2));
  const discountAmount = 0.0;
  const totalPayable = Number((itemTotal + deliveryFee + taxAmount - discountAmount).toFixed(2));

  return {
    ...currentCart,
    items,
    itemCount,
    itemTotal,
    deliveryFee,
    taxAmount,
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
      setCart(null);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
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
    fetchCart();
  }, [isAuthenticated]);

  const addItem = async (outletId: string, menuItemId: string, quantity: number = 1) => {
    if (USE_MOCK_DATA) {
      setCart((prev) => {
        const activeCart = prev || { ...MOCK_CART, outletId, items: [] };
        // Check for cross-outlet conflict in mock mode too
        if (activeCart.outletId && activeCart.outletId !== outletId && activeCart.items.length > 0) {
          const err = new Error('Cart already contains items from another outlet');
          setError(err.message);
          throw err;
        }

        // Find item in mock menus
        const allItems = Object.values(MOCK_MENUS).flat();
        const found = allItems.find((i) => i.id === menuItemId) || DEFAULT_MOCK_MENU[0];
        const unitPrice = parseFloat(found.effectivePrice);

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
    if (USE_MOCK_DATA && cart) {
      if (quantity <= 0) {
        return removeItem(cartItemId);
      }
      const newItems = cart.items.map((i) =>
        i.id === cartItemId
          ? { ...i, quantity, totalPrice: quantity * i.unitPrice }
          : i,
      );
      setCart(recalculateCart(cart, newItems));
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
    if (USE_MOCK_DATA && cart) {
      const newItems = cart.items.filter((i) => i.id !== cartItemId);
      if (newItems.length === 0) {
        setCart(null);
      } else {
        setCart(recalculateCart(cart, newItems));
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
    if (USE_MOCK_DATA) {
      setCart(null);
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
