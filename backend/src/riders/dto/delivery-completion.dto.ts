export interface CustomerDeliveryTrackingResponse {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  deliveryStatus: string;
  /** True once the rider has picked up the order and it is not yet delivered. */
  canConfirmDelivery: boolean;
  restaurant: {
    name: string;
    address: string;
    phone: string;
    /** Outlet pin for the customer's tracking map; null if the outlet has no usable coordinates. */
    latitude: number | null;
    longitude: number | null;
  };
  rider?: {
    fullName: string | null;
    vehicleType: string;
    vehicleNumber: string | null;
    location?: {
      latitude: number;
      longitude: number;
      accuracy?: number | null;
      heading?: number | null;
      speed?: number | null;
      capturedAt?: Date | null;
      updatedAt: Date;
      freshness: string;
      ageSeconds: number;
    } | null;
  } | null;
  timestamps: {
    placedAt: Date | null;
    confirmedAt: Date | null;
    assignedAt: Date | null;
    pickedUpAt: Date | null;
    arrivedCustomerAt: Date | null;
    deliveredAt: Date | null;
  };
  deliveryAddress: any;
}

