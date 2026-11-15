export type OrderStatus =
  | 'pending_payment'
  | 'placed'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'rejected'
  | 'payment_conflict';

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
  id: string;
  eventType: string;
  description: string;
  timestamp: string;
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
    address: string;
    outletPhone: string;
  };
  items: OrderItem[];
  payment: {
    id: string;
    status: PaymentStatus;
    amount: number;
    currency: string;
    provider: string;
    providerOrderId: string | null;
    providerPaymentId: string | null;
    paidAt: string | null;
    refunds: Array<{
      id: string;
      amount: number;
      status: string;
      reason: string;
      providerRefundId: string | null;
      isManualReviewRequired: boolean;
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
  customerId?: string;
  deliveryStatus?: string;
}

export interface CancelOrderPayload {
  reason: string;
}

export type ConflictFilterStatus =
  | 'all'
  | 'pending_review'
  | 'refund_pending'
  | 'refund_failed'
  | 'refund_completed';

export interface PaymentConflictSummary {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  authoritativeStatus: 'pending_review' | 'refund_pending' | 'refund_failed' | 'refund_completed';
  totalPayable: number;
  currency: string;
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  restaurant: {
    name: string;
    outletName: string;
  };
  payment: {
    id: string;
    provider: string;
    providerPaymentId: string | null;
    providerOrderId: string | null;
    amount: number;
    status: PaymentStatus;
    paidAt: string | null;
  } | null;
  conflictDetails: {
    conflictType: string;
    detectedAt: string;
    detectionSource?: string;
    resolutionStatus?: string;
    resolutionNotes?: string;
    approvedByAdminUserId?: string;
    approvedAt?: string;
    approvalReason?: string;
    conflictingActiveOrder?: {
      id: string;
      orderNumber: string;
      status: string;
      placedAt?: string | null;
    } | null;
  } | null;
  refund: {
    id: string;
    amount: number;
    status: string;
    reason: string;
    providerRefundId: string | null;
    attemptCount: number;
    approvedByUserId: string | null;
    lastErrorMessage: string | null;
    createdAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentConflictListResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  metrics?: {
    total: number;
    pendingReview: number;
    refundPending: number;
    refundFailed: number;
    refundCompleted: number;
  };
  data: PaymentConflictSummary[];
}

export interface PaymentConflictDetail extends PaymentConflictSummary {
  auditEvents: Array<{
    id: string;
    action: string;
    performedByUserId: string | null;
    details: any;
    createdAt: string;
  }>;
  statusHistory: Array<{
    id: string;
    previousStatus: OrderStatus | null;
    newStatus: OrderStatus;
    reason: string | null;
    changedByUserId: string | null;
    createdAt: string;
  }>;
}

export interface ApproveConflictRefundPayload {
  reason?: string;
}

export interface ApproveConflictRefundResponse {
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  refund: {
    refundId: string;
    providerRefundId: string | null;
    paymentId: string;
    amount: string;
    status: string;
    message: string;
  };
  message: string;
}


