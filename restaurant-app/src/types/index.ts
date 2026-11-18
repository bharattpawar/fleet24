export interface StaffUser {
  id: string;
  phone: string;
  fullName: string | null;
  email: string | null;
  roles: string[];
  designation: string;
  resolvedRole: 'owner' | 'manager' | 'staff' | 'admin';
  restaurantName: string;
  isOwner: boolean;
}

export interface OperatingHour {
  id?: string;
  outletId?: string;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  openTime: string;
  closeTime: string;
  isClosed?: boolean;
}

export interface OperatingOutlet {
  id: string;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  name: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  deliveryRadiusKm: number;
  isActive: boolean;
  isAcceptingOrders: boolean;
  role: 'owner' | 'manager' | 'staff' | 'admin';
  designation?: string;
  operatingHours?: OperatingHour[];
}

export interface RestaurantProfileResponse {
  staffUser: StaffUser;
  outlets: OperatingOutlet[];
}

export type KitchenOrderStatus =
  | 'placed'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'rejected';

export interface OrderItem {
  id: string;
  menuItemId: string;
  name?: string;
  itemName?: string;
  quantity: number;
  price?: number;
  unitPrice?: number;
  totalPrice?: number;
  itemTotal?: number;
  notes?: string | null;
}

export interface RestaurantOrder {
  id: string;
  orderNumber: string;
  status: KitchenOrderStatus;
  outletId: string;
  customerId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  itemTotal?: string | number;
  taxAmount?: string | number;
  deliveryFee?: string | number;
  discountAmount?: string | number;
  customer?: { fullName?: string | null };
  totalPayable: number | string;
  rejectionReason?: string | null;
  items: OrderItem[];
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderOverviewStats {
  outletId?: string;
  timestamp?: string;
  counts: {
    newOrders: number;
    confirmed: number;
    preparing: number;
    readyForPickup: number;
    outForDelivery: number;
    completedToday: number;
  };
  recentOrders?: Array<{
    id: string;
    orderNumber: string;
    status: KitchenOrderStatus;
    itemTotal: string;
    totalPayable: string;
    itemCount: number;
    itemsSummary: string;
    customerName: string;
    createdAt: string;
  }>;
}

export interface MenuCategory {
  id: string;
  outletId: string;
  name: string;
  description?: string | null;
  displayOrder: number;
  isActive: boolean;
  itemCount?: number;
}

export interface MenuItem {
  id: string;
  restaurantId?: string;
  outletId?: string;
  categoryId: string;
  categoryName?: string;
  name: string;
  description?: string | null;
  basePrice?: string | number;
  effectivePrice?: string | number;
  /** Price the customer pays after the dish discount. */
  finalPrice?: string;
  discountType?: 'percentage' | 'fixed_amount' | null;
  discountValue?: string | null;
  discountLabel?: string | null;
  price?: number;
  imageUrl?: string | null;
  isVeg: boolean;
  isAvailable: boolean;
  effectiveIsAvailable?: boolean;
  isOverridden?: boolean;
  preparationTimeMinutes?: number;
}

