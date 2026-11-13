import type { DeliveryStatus } from './orders';

export interface ActiveDeliverySummary {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  deliveryStatus: DeliveryStatus;
  createdAt: string;
  assignedAt: string | null;
  pickedUpAt: string | null;
  restaurant: {
    name: string;
    outletName: string;
    address: string;
  };
  rider: {
    id: string;
    fullName: string | null;
    phone: string;
    vehicleType: string;
    vehicleNumber: string | null;
    isOnline: boolean;
  } | null;
  location: {
    latitude: number;
    longitude: number;
    updatedAt: string;
    freshness: 'fresh' | 'stale' | 'missing';
    ageSeconds: number;
  } | null;
  customerLocation: {
    latitude?: number;
    longitude?: number;
    address?: string;
  } | null;
  restaurantLocation: {
    latitude: number;
    longitude: number;
  } | null;
}

export interface ActiveDeliveriesResponse {
  total: number;
  data: ActiveDeliverySummary[];
}

export interface DeliveryDetail {
  id: string;
  orderId: string;
  order: {
    orderNumber: string;
    status: string;
    totalPayable: number;
  };
  restaurant: {
    id: string;
    name: string;
    outletId: string;
    outletName: string;
    address: string;
  };
  rider: {
    id: string;
    fullName: string | null;
    phone: string;
    vehicleType: string;
    vehicleNumber: string | null;
    verificationStatus: string;
    availabilityStatus: string;
  } | null;
  deliveryStatus: DeliveryStatus;
  pickupLatitude: string;
  pickupLongitude: string;
  deliveryLatitude: string;
  deliveryLongitude: string;
  latestLocation: {
    latitude: number;
    longitude: number;
    freshness: string;
    ageSeconds: number;
    updatedAt: string;
  } | null;
  assignmentHistory: Array<{
    id: string;
    status: string;
    offeredAt: string;
    respondedAt: string | null;
    rejectionReason: string | null;
    expiresAt: string;
    riderName: string;
  }>;
}

export interface DispatchRetryResponse {
  assigned: boolean;
  riderId?: string | null;
  message: string;
}

