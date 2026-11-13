import { apiRequest } from './client';

export interface RiderProfile {
  id: string;
  userId: string;
  fullName: string | null;
  profileImageUrl: string | null;
  dateOfBirth: string | null;
  vehicleType: string;
  vehicleNumber: string | null;
  licenseNumber: string | null;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  availabilityStatus: 'available' | 'busy' | 'offline';
  isSuspended: boolean;
  suspensionReason: string | null;
  approvedAt: string | null;
  user: {
    id: string;
    phone: string | null;
    email: string | null;
    isActive: boolean;
  };
}

export interface DeliveryOfferItem {
  deliveryId: string;
  orderId: string;
  orderNumber: string;
  distanceMeters: number;
  distanceKm?: number;
  offerExpiresAt: string;
  secondsRemaining: number;
  estimatedEarnings?: string;
  outlet: {
    name: string;
    address: string;
    phone: string;
    latitude: number;
    longitude: number;
  };
  deliveryAddress: {
    label?: string;
    street?: string;
    addressLine1?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    landmark?: string;
  };
  items: Array<{
    name: string;
    quantity: number;
  }>;
}

export interface ActiveDeliveryDetails {
  orderId: string;
  deliveryId: string;
  orderNumber: string;
  status: string; // 'assigned' | 'accepted' | 'at_restaurant' | 'picked_up' | 'arrived_customer' | 'completed'
  orderStatus: string;
  distanceMeters?: number;
  distanceKm?: number;
  outlet: {
    name: string;
    address: string;
    phone: string;
    latitude: number;
    longitude: number;
  };
  deliveryAddress: {
    street?: string;
    addressLine1?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    landmark?: string;
  };
  items?: Array<{
    name: string;
    quantity: number;
  }>;
  customer?: {
    name: string;
    phone: string;
  };
  totalAmount?: string;
  paymentMethod?: string;
}

export interface AvailableDeliveryOrder {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  deliveryId?: string | null;
  deliveryStatus: string;
  isClaimedByYou?: boolean;
  totalPayable: string;
  itemTotal: string;
  placedAt?: string;
  itemsCount: number;
  itemsSummary: string;
  distanceMeters: number;
  distanceKm: number;
  estimatedEarnings: string;
  outlet: {
    id: string;
    name: string;
    address: string;
    phone: string;
    latitude: number;
    longitude: number;
  };
  deliveryAddress: {
    addressLine1: string;
    city?: string;
    landmark?: string;
    latitude?: number;
    longitude?: number;
  };
}

export interface RiderEarningsSummary {
  riderId: string;
  totalEarned: string;
  totalDisbursed: string;
  reservedPendingPayout: string;
  availableBalance: string;
  lifetimeCompletedDeliveries: number;
  todayEarned?: string;
  todayDeliveries?: number;
}

export interface RiderEarningRecord {
  id: string;
  orderId?: string;
  orderNumber?: string;
  earningAmount?: string;
  amount?: string;
  baseFare?: string;
  distancePay?: string;
  surgePay?: string;
  tipAmount?: string;
  distanceMeters?: number;
  createdAt: string;
  outletName?: string;
  metadata?: any;
}

export interface RiderEarningsListResponse {
  data: RiderEarningRecord[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface RiderLocationUpdate {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  capturedAt?: string | null;
}

export const riderApi = {
  /**
   * Health check for API server connectivity
   */
  async checkHealth(): Promise<{ status: string }> {
    return apiRequest<{ status: string }>('/health');
  },

  /**
   * Request OTP for rider login/authentication
   */
  async requestOtp(phone: string): Promise<{ cooldownSeconds: number; expiresInSeconds: number }> {
    return apiRequest<{ cooldownSeconds: number; expiresInSeconds: number }>('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  },

  /**
   * Verify OTP for rider login
   */
  async verifyOtp(phone: string, otp: string): Promise<{
    user: any;
    tokens: { accessToken: string; refreshToken: string };
  }> {
    return apiRequest<{
      user: any;
      tokens: { accessToken: string; refreshToken: string };
    }>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    });
  },

  /**
   * Create/Register rider profile for authenticated user
   */
  async createProfile(payload: {
    fullName: string;
    vehicleType: string;
    vehicleNumber?: string;
    licenseNumber?: string;
    dateOfBirth?: string;
  }): Promise<RiderProfile> {
    return apiRequest<RiderProfile>('/riders/profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Fetch authenticated rider profile
   */
  async getProfile(): Promise<RiderProfile> {
    return apiRequest<RiderProfile>('/riders/profile');
  },

  /**
   * Update rider profile details
   */
  async updateProfile(payload: {
    fullName?: string;
    vehicleType?: string;
    vehicleNumber?: string;
    licenseNumber?: string;
    dateOfBirth?: string;
  }): Promise<RiderProfile> {
    return apiRequest<RiderProfile>('/riders/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Toggle rider availability: 'available' or 'offline'
   */
  async setAvailability(status: 'available' | 'offline'): Promise<{ availabilityStatus: string; isOnline: boolean }> {
    return apiRequest<{ availabilityStatus: string; isOnline: boolean }>('/riders/availability', {
      method: 'PATCH',
      body: JSON.stringify({ availabilityStatus: status }),
    });
  },

  /**
   * Post GPS location telemetry (POST /api/v1/riders/location)
   */
  async updateLocation(payload: RiderLocationUpdate): Promise<any> {
    return apiRequest('/riders/location', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Fetch active, unexpired delivery assignment offers
   */
  async getOffers(): Promise<DeliveryOfferItem[]> {
    return apiRequest<DeliveryOfferItem[]>('/riders/orders/offers');
  },

  /**
   * Fetch all open/available delivery orders in the database pool
   */
  async getAvailableOrders(): Promise<AvailableDeliveryOrder[]> {
    return apiRequest<AvailableDeliveryOrder[]>('/riders/orders/available');
  },

  /**
   * Instantly claim and accept an open delivery order from the pool
   */
  async claimOrder(orderId: string): Promise<{ orderId: string; deliveryId: string; status: string; message: string }> {
    return apiRequest(`/riders/orders/${orderId}/claim`, {
      method: 'POST',
    });
  },

  /**
   * Accept an assigned delivery offer
   */
  async acceptOffer(orderId: string): Promise<{ orderId: string; deliveryId: string; status: string }> {
    return apiRequest(`/riders/orders/${orderId}/accept`, {
      method: 'POST',
    });
  },

  /**
   * Reject an assigned delivery offer
   */
  async rejectOffer(orderId: string, reason?: string): Promise<{ orderId: string; status: string }> {
    return apiRequest(`/riders/orders/${orderId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || 'Rider declined offer' }),
    });
  },

  /**
   * Get active/in-flight deliveries
   */
  async getActiveOrders(): Promise<ActiveDeliveryDetails[]> {
    return apiRequest<ActiveDeliveryDetails[]>('/riders/orders/active');
  },

  /**
   * Stage 2: Confirm rider arrival at restaurant (accepted -> at_restaurant)
   */
  async confirmArrival(orderId: string): Promise<{ orderId: string; status: string }> {
    return apiRequest(`/riders/orders/${orderId}/arrived`, {
      method: 'POST',
    });
  },

  /**
   * Stage 3: Confirm order pickup from kitchen (at_restaurant -> picked_up)
   */
  async confirmPickup(orderId: string): Promise<{ orderId: string; status: string }> {
    return apiRequest(`/riders/orders/${orderId}/pickup`, {
      method: 'POST',
    });
  },

  /**
   * Stage 4: Confirm rider arrival at customer doorstep (picked_up -> arrived_customer)
   */
  async confirmArrivedCustomer(orderId: string): Promise<{ orderId: string; status: string }> {
    return apiRequest(`/riders/orders/${orderId}/arrived-customer`, {
      method: 'POST',
    });
  },

  /**
   * Stage 5: Complete delivery using 6-digit customer OTP verification
   */
  async completeDelivery(orderId: string, otp: string): Promise<{ orderId: string; status: string }> {
    return apiRequest(`/riders/orders/${orderId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ otp }),
    });
  },

  /**
   * Fetch Rider Earnings Summary
   */
  async getEarningsSummary(): Promise<RiderEarningsSummary> {
    const raw = await apiRequest<any>('/riders/earnings/summary');
    return {
      riderId: raw?.riderId || '',
      totalEarned: raw?.totalEarned || '0.00',
      totalDisbursed: raw?.totalWithdrawn || raw?.totalDisbursed || '0.00',
      reservedPendingPayout: raw?.reservedPending || raw?.reservedPendingPayout || '0.00',
      availableBalance: raw?.availableBalance || '0.00',
      lifetimeCompletedDeliveries: raw?.lifetimeCompletedDeliveries ?? raw?.completedDeliveries ?? 0,
      todayEarned: raw?.todayEarned || '0.00',
      todayDeliveries: raw?.todayDeliveries || 0,
    };
  },

  /**
   * List paginated rider order-wise earnings
   */
  async getEarnings(query: { page?: number; limit?: number; from?: string; to?: string } = {}): Promise<RiderEarningsListResponse> {
    const params = new URLSearchParams();
    if (query.page) params.append('page', String(query.page));
    if (query.limit) params.append('limit', String(query.limit));
    if (query.from) params.append('from', query.from);
    if (query.to) params.append('to', query.to);
    const queryString = params.toString();
    return apiRequest<RiderEarningsListResponse>(`/riders/earnings${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Request withdrawal / payout of available earnings balance
   */
  async requestPayout(amount: number): Promise<{ payoutId: string; amount: string; status: string }> {
    return apiRequest('/riders/payouts/request', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  },

  /**
   * Register device push notification token with backend
   */
  async registerDeviceToken(token: string, platform: 'android' | 'ios' | 'web'): Promise<{ success: boolean }> {
    return apiRequest('/riders/device-token', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    });
  },

  /**
   * Unregister device push notification token on logout
   */
  async unregisterDeviceToken(): Promise<{ success: boolean }> {
    return apiRequest('/riders/device-token', {
      method: 'DELETE',
    });
  },
};

