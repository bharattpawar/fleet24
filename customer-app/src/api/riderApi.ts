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
  offerExpiresAt: string;
  secondsRemaining: number;
  outlet: {
    name: string;
    address: string;
    phone: string;
    latitude: number;
    longitude: number;
  };
  deliveryAddress: any;
  items: Array<{
    name: string;
    quantity: number;
  }>;
}

export interface ActiveDeliveryDetails {
  orderId: string;
  deliveryId: string;
  orderNumber: string;
  status: string; // assigned, accepted, at_restaurant, picked_up, arrived_customer, completed
  orderStatus: string;
  outlet: {
    name: string;
    address: string;
    phone: string;
    latitude: number;
    longitude: number;
  };
  deliveryAddress: any;
  items?: Array<{
    name: string;
    quantity: number;
  }>;
  customer?: {
    name: string;
    phone: string;
  };
}

export const riderApi = {
  /**
   * Fetch authenticated rider profile
   */
  async getProfile(): Promise<RiderProfile> {
    return apiRequest<RiderProfile>('/riders/profile');
  },

  /**
   * Toggle availability: 'available' or 'offline'
   */
  async setAvailability(status: 'available' | 'offline'): Promise<{ availabilityStatus: string; isOnline: boolean }> {
    return apiRequest<{ availabilityStatus: string; isOnline: boolean }>('/riders/availability', {
      method: 'PATCH',
      body: JSON.stringify({ availabilityStatus: status }),
    });
  },

  /**
   * Send GPS coordinates update
   */
  async updateLocation(payload: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
    capturedAt?: string | null;
  }): Promise<any> {
    return apiRequest('/riders/location', {
      method: 'PATCH',
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
   * Confirm rider arrival at restaurant (accepted -> at_restaurant)
   */
  async confirmArrival(orderId: string): Promise<{ orderId: string; status: string }> {
    return apiRequest(`/riders/orders/${orderId}/arrived`, {
      method: 'POST',
    });
  },

  /**
   * Confirm order pickup from kitchen (at_restaurant -> picked_up)
   */
  async confirmPickup(orderId: string): Promise<{ orderId: string; status: string }> {
    return apiRequest(`/riders/orders/${orderId}/pickup`, {
      method: 'POST',
    });
  },

  /**
   * Confirm arrival at customer doorstep (picked_up -> arrived_customer)
   */
  async confirmArrivedCustomer(orderId: string): Promise<{ orderId: string; status: string }> {
    return apiRequest(`/riders/orders/${orderId}/arrived-customer`, {
      method: 'POST',
    });
  },

  /**
   * Complete delivery using customer OTP
   */
  async completeDelivery(orderId: string, otp: string): Promise<{ orderId: string; status: string }> {
    return apiRequest(`/riders/orders/${orderId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ otp }),
    });
  },
};

