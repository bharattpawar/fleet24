import { apiRequest } from './client';
import {
  RestaurantProfileResponse,
  RestaurantOrder,
  OrderOverviewStats,
  MenuCategory,
  MenuItem,
  OperatingOutlet,
} from '../types';

export const restaurantApi = {
  // ==========================================
  // AUTH & ONBOARDING
  // ==========================================
  requestOtp: async (phone: string): Promise<{ cooldownSeconds: number; expiresInSeconds: number }> => {
    return apiRequest<{ cooldownSeconds: number; expiresInSeconds: number }>('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  },

  verifyOtp: async (phone: string, otp: string): Promise<{
    user: any;
    tokens: { accessToken: string; refreshToken?: string };
  }> => {
    return apiRequest<{
      user: any;
      tokens: { accessToken: string; refreshToken?: string };
    }>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    });
  },

  getProfile: async (): Promise<RestaurantProfileResponse> => {
    return apiRequest<RestaurantProfileResponse>('/restaurant/profile', {
      method: 'GET',
    });
  },

  // ==========================================
  // OUTLET & OPERATIONS
  // ==========================================
  listOutlets: async (): Promise<OperatingOutlet[]> => {
    return apiRequest<OperatingOutlet[]>('/outlets', {
      method: 'GET',
    });
  },

  getOutletDetails: async (outletId: string): Promise<OperatingOutlet> => {
    return apiRequest<OperatingOutlet>(`/outlets/${outletId}`, {
      method: 'GET',
    });
  },

  updateOutlet: async (
    outletId: string,
    payload: {
      name?: string;
      phone?: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      deliveryRadiusKm?: number;
    },
  ): Promise<OperatingOutlet> => {
    return apiRequest<OperatingOutlet>(`/outlets/${outletId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  updateOrderAcceptance: async (outletId: string, isAcceptingOrders: boolean): Promise<OperatingOutlet> => {
    return apiRequest<OperatingOutlet>(`/outlets/${outletId}/order-acceptance`, {
      method: 'PATCH',
      body: JSON.stringify({ isAcceptingOrders }),
    });
  },

  getOperatingHours: async (outletId: string): Promise<any[]> => {
    return apiRequest<any[]>(`/outlets/${outletId}/operating-hours`, {
      method: 'GET',
    });
  },

  saveOperatingHours: async (
    outletId: string,
    days: Array<{
      dayOfWeek: number;
      openTime: string;
      closeTime: string;
      isClosed?: boolean;
    }>,
  ): Promise<any[]> => {
    return apiRequest<any[]>(`/outlets/${outletId}/operating-hours`, {
      method: 'PUT',
      body: JSON.stringify(days),
    });
  },

  // ==========================================
  // KITCHEN & ORDERS
  // ==========================================
  getOrdersOverview: async (outletId: string): Promise<OrderOverviewStats> => {
    return apiRequest<OrderOverviewStats>(`/restaurant/orders/overview?outletId=${outletId}`, {
      method: 'GET',
    });
  },

  listOrders: async (params: {
    outletId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ orders: RestaurantOrder[]; total: number; page: number; limit: number }> => {
    const q = new URLSearchParams();
    if (params.outletId) q.append('outletId', params.outletId);
    if (params.status && params.status !== 'all') q.append('status', params.status);
    if (params.page) q.append('page', params.page.toString());
    if (params.limit) q.append('limit', params.limit.toString());

    return apiRequest<{ orders: RestaurantOrder[]; total: number; page: number; limit: number }>(
      `/restaurant/orders?${q.toString()}`,
      { method: 'GET' },
    );
  },

  getOrderDetails: async (orderId: string): Promise<RestaurantOrder> => {
    return apiRequest<RestaurantOrder>(`/restaurant/orders/${orderId}`, {
      method: 'GET',
    });
  },

  updateOrderStatus: async (
    orderId: string,
    status: 'confirmed' | 'preparing' | 'ready_for_pickup' | 'rejected',
    reason?: string,
  ): Promise<RestaurantOrder> => {
    return apiRequest<RestaurantOrder>(`/restaurant/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    });
  },

  // ==========================================
  // MENU MANAGEMENT
  // ==========================================
  listCategories: async (outletId: string): Promise<MenuCategory[]> => {
    return apiRequest<MenuCategory[]>(`/outlets/${outletId}/menu/categories`, {
      method: 'GET',
    });
  },

  createCategory: async (
    outletId: string,
    name: string,
    displayOrder: number = 0,
  ): Promise<MenuCategory> => {
    return apiRequest<MenuCategory>(`/outlets/${outletId}/menu/categories`, {
      method: 'POST',
      body: JSON.stringify({ name, displayOrder }),
    });
  },

  listMenuItems: async (outletId: string): Promise<MenuItem[]> => {
    return apiRequest<MenuItem[]>(`/outlets/${outletId}/menu/items`, {
      method: 'GET',
    });
  },

  createMenuItem: async (
    outletId: string,
    payload: {
      categoryId: string;
      name: string;
      description?: string;
      basePrice: number;
      isVeg?: boolean;
      imageUrl?: string;
      isAvailable?: boolean;
    },
  ): Promise<MenuItem> => {
    return apiRequest<MenuItem>(`/outlets/${outletId}/menu/items`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateMenuItem: async (
    itemId: string,
    payload: {
      categoryId?: string;
      name?: string;
      description?: string;
      basePrice?: number;
      isVeg?: boolean;
      imageUrl?: string;
      isAvailable?: boolean;
      discountType?: 'percentage' | 'fixed_amount' | null;
      discountValue?: number;
    },
  ): Promise<MenuItem> => {
    return apiRequest<MenuItem>(`/menu/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  updateMenuItemAvailability: async (itemId: string, isAvailable: boolean): Promise<MenuItem> => {
    return apiRequest<MenuItem>(`/menu/items/${itemId}/availability`, {
      method: 'PATCH',
      body: JSON.stringify({ isAvailable }),
    });
  },

  setOutletOverride: async (
    outletId: string,
    itemId: string,
    payload: {
      isAvailable: boolean;
      customPrice?: number;
    },
  ): Promise<any> => {
    return apiRequest<any>(`/outlets/${outletId}/menu/items/${itemId}/override`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
};

