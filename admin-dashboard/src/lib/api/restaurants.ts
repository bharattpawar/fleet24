import { apiClient } from './client';
import type {
  RestaurantApplicationsQuery,
  RestaurantApplicationListResponse,
  RestaurantDetail,
  RestaurantOutlet,
  RestaurantDocument,
  VerifyRestaurantPayload,
  SuspendRestaurantPayload,
  VerifyDocumentPayload,
  UpdateOutletOperationsPayload,
  CreateRestaurantPayload,
  UpdateRestaurantPayload,
  CreateOutletPayload,
  UpdateOutletPayload,
  MenuCategory,
  MenuItem,
  CreateMenuCategoryPayload,
  UpdateMenuCategoryPayload,
  CreateMenuItemPayload,
  UpdateMenuItemPayload,
} from '@/types/restaurants';

export const restaurantsApi = {
  /**
   * List restaurant onboarding applications / directory
   * Uses GET /api/v1/admin/restaurants/applications
   */
  listRestaurants: async (
    params?: RestaurantApplicationsQuery,
  ): Promise<RestaurantApplicationListResponse> => {
    const res = await apiClient.get<RestaurantApplicationListResponse>(
      '/admin/restaurants/applications',
      { params },
    );
    return res.data;
  },

  /**
   * Get single restaurant application / full profile details
   * Uses GET /api/v1/admin/restaurants/applications/:id
   */
  getRestaurantDetails: async (restaurantId: string): Promise<RestaurantDetail> => {
    const res = await apiClient.get<RestaurantDetail>(
      `/admin/restaurants/applications/${restaurantId}`,
    );
    return res.data;
  },

  /**
   * Approve or reject a restaurant KYC application
   * Uses PATCH /api/v1/admin/restaurants/:id/verification
   */
  verifyRestaurant: async (
    restaurantId: string,
    payload: VerifyRestaurantPayload,
  ): Promise<{ id: string; verificationStatus: string; message: string }> => {
    const res = await apiClient.patch(
      `/admin/restaurants/${restaurantId}/verification`,
      payload,
    );
    return res.data;
  },

  /**
   * Suspend a restaurant and deactivate all outlets from taking orders
   * Uses PATCH /api/v1/admin/restaurants/:id/suspension
   */
  suspendRestaurant: async (
    restaurantId: string,
    payload: SuspendRestaurantPayload,
  ): Promise<{ id: string; verificationStatus: string; message: string }> => {
    const res = await apiClient.patch(
      `/admin/restaurants/${restaurantId}/suspension`,
      payload,
    );
    return res.data;
  },

  /**
   * Reinstate a suspended restaurant
   * Uses PATCH /api/v1/admin/restaurants/:id/unsuspend
   */
  unsuspendRestaurant: async (
    restaurantId: string,
  ): Promise<{ id: string; verificationStatus: string; message: string }> => {
    const res = await apiClient.patch(
      `/admin/restaurants/${restaurantId}/unsuspend`,
    );
    return res.data;
  },

  /**
   * List outlets for a specific restaurant
   * Uses GET /api/v1/admin/restaurants/:id/outlets
   */
  listOutlets: async (restaurantId: string): Promise<RestaurantOutlet[]> => {
    const res = await apiClient.get<RestaurantOutlet[]>(
      `/admin/restaurants/${restaurantId}/outlets`,
    );
    return res.data;
  },

  /**
   * Operational override for outlet active and accepting-orders status
   * Uses PATCH /api/v1/admin/outlets/:outletId/operations
   */
  updateOutletOperations: async (
    outletId: string,
    payload: UpdateOutletOperationsPayload,
  ): Promise<RestaurantOutlet> => {
    const res = await apiClient.patch(
      `/admin/outlets/${outletId}/operations`,
      payload,
    );
    return res.data;
  },

  /**
   * Verify or reject an individual KYC document
   * Uses PATCH /api/v1/admin/documents/:documentId/verification
   */
  verifyDocument: async (
    documentId: string,
    payload: VerifyDocumentPayload,
  ): Promise<RestaurantDocument> => {
    const res = await apiClient.patch(
      `/admin/documents/${documentId}/verification`,
      payload,
    );
    return res.data;
  },

  /**
   * Create a restaurant (Admin)
   * Uses POST /api/v1/restaurants
   */
  createRestaurant: async (payload: CreateRestaurantPayload): Promise<any> => {
    const res = await apiClient.post('/restaurants', payload);
    return res.data;
  },

  /**
   * Update restaurant info (Admin)
   * Uses PATCH /api/v1/restaurants/:restaurantId
   */
  updateRestaurant: async (
    restaurantId: string,
    payload: UpdateRestaurantPayload,
  ): Promise<any> => {
    const res = await apiClient.patch(`/restaurants/${restaurantId}`, payload);
    return res.data;
  },

  /**
   * Create an outlet for a restaurant
   * Uses POST /api/v1/restaurants/:restaurantId/outlets
   */
  createOutlet: async (
    restaurantId: string,
    payload: CreateOutletPayload,
  ): Promise<RestaurantOutlet> => {
    const res = await apiClient.post(`/restaurants/${restaurantId}/outlets`, payload);
    return res.data;
  },

  /**
   * Update outlet info (including delivery radius, address, phone)
   * Uses PATCH /api/v1/outlets/:outletId
   */
  updateOutlet: async (
    outletId: string,
    payload: UpdateOutletPayload,
  ): Promise<RestaurantOutlet> => {
    const res = await apiClient.patch(`/outlets/${outletId}`, payload);
    return res.data;
  },

  /**
   * List menu categories for an outlet
   * Uses GET /api/v1/outlets/:outletId/menu/categories
   */
  listCategories: async (outletId: string): Promise<MenuCategory[]> => {
    const res = await apiClient.get<MenuCategory[]>(`/outlets/${outletId}/menu/categories`);
    return res.data;
  },

  /**
   * Create menu category
   * Uses POST /api/v1/outlets/:outletId/menu/categories
   */
  createCategory: async (
    outletId: string,
    payload: CreateMenuCategoryPayload,
  ): Promise<MenuCategory> => {
    const res = await apiClient.post<MenuCategory>(
      `/outlets/${outletId}/menu/categories`,
      payload,
    );
    return res.data;
  },

  /**
   * Update menu category
   * Uses PATCH /api/v1/menu/categories/:categoryId
   */
  updateCategory: async (
    categoryId: string,
    payload: UpdateMenuCategoryPayload,
  ): Promise<MenuCategory> => {
    const res = await apiClient.patch<MenuCategory>(
      `/menu/categories/${categoryId}`,
      payload,
    );
    return res.data;
  },

  /**
   * List menu items for an outlet
   * Uses GET /api/v1/outlets/:outletId/menu/items
   */
  listMenuItems: async (outletId: string): Promise<MenuItem[]> => {
    const res = await apiClient.get<MenuItem[]>(`/outlets/${outletId}/menu/items`);
    return res.data;
  },

  /**
   * Create menu item
   * Uses POST /api/v1/outlets/:outletId/menu/items
   */
  createMenuItem: async (
    outletId: string,
    payload: CreateMenuItemPayload,
  ): Promise<MenuItem> => {
    const res = await apiClient.post<MenuItem>(`/outlets/${outletId}/menu/items`, payload);
    return res.data;
  },

  /**
   * Update menu item
   * Uses PATCH /api/v1/menu/items/:itemId
   */
  updateMenuItem: async (
    itemId: string,
    payload: UpdateMenuItemPayload,
  ): Promise<MenuItem> => {
    const res = await apiClient.patch<MenuItem>(`/menu/items/${itemId}`, payload);
    return res.data;
  },

  /**
   * Toggle menu item availability
   * Uses PATCH /api/v1/menu/items/:itemId/availability
   */
  updateMenuItemAvailability: async (
    itemId: string,
    isAvailable: boolean,
  ): Promise<MenuItem> => {
    const res = await apiClient.patch<MenuItem>(`/menu/items/${itemId}/availability`, {
      isAvailable,
    });
    return res.data;
  },
};

