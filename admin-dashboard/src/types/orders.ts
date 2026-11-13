export type OrderStatus =
  | 'pending_payment'
  | 'placed'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'rejected';

export type PaymentStatus =
  | 'pending'
  | 'captured'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export type DeliveryStatus =
  | 'unassigned'
  | 'assigned'
  | 'accepted'
  | 'at_restaurant'
  | 'picked_up'
  | 'arrived_customer'
  | 'completed'
  | 'cancelled';

export interface AdminOrderSummary {
  id: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  totalPayable: number;
  itemSubtotal: number;
  deliveryCharge: number;
  taxes: number;
  itemCount: number;
  createdAt: string;
  customer: {
    id: string;
    fullName: string | null;
    phone: string;
  };
  restaurant: {
    id: string;
    name: string;
    outletId: string;
    outletName: string;
  };
  payment: {
    id: string;
    status: PaymentStatus;
    amount: number;
    paymentMethod: string;
    refundedAmount: number;
  } | null;
  delivery: {
    id: string;
    status: DeliveryStatus;
    riderId: string | null;
    riderName: string | null;
    riderPhone: string | null;
  } | null;
}

export interface AdminOrderListResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  data: AdminOrderSummary[];
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  totalPrice: number;
  customizations?: any;
}

export interface OrderTimelineEvent {
  status: string;
  timestamp: string;
  reason?: string;
  changedBy?: string;
}

export interface AdminOrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalPayable: number;
  itemSubtotal: number;
  deliveryCharge: number;
  packagingCharge: number;
  taxes: number;
  discountAmount: number;
  deliveryAddress: any;
  deliveryInstructions: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  customer: {
    id: string;
    fullName: string | null;
    phone: string;
    email: string | null;
  };
  restaurant: {
    id: string;
    name: string;
    slug: string;
    outletId: string;
    outletName: string;
    outletAddress: string;
    outletPhone: string;
  };
  items: OrderItem[];
  payment: {
    id: string;
    status: PaymentStatus;
    amount: number;
    currency: string;
    method: string;
    gatewayPaymentId: string | null;
    refunds: Array<{
      id: string;
      amount: number;
      status: string;
      reason: string;
      createdAt: string;
    }>;
  } | null;
  delivery: {
    id: string;
    status: DeliveryStatus;
    pickupLatitude: string;
    pickupLongitude: string;
    deliveryLatitude: string;
    deliveryLongitude: string;
    rider: {
      id: string;
      fullName: string | null;
      phone: string;
      vehicleType: string;
      vehicleNumber: string | null;
    } | null;
    assignedAt: string | null;
    acceptedAt: string | null;
    pickedUpAt: string | null;
    completedAt: string | null;
  } | null;
  timeline: OrderTimelineEvent[];
}

export interface AdminOrderQuery {
  page?: number;
  limit?: number;
  search?: string;
  orderStatus?: string;
  paymentStatus?: string;
  deliveryStatus?: string;
}

export interface CancelOrderPayload {
  reason: string;
}

