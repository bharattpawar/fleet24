export type RestaurantVerificationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'all';

export interface RestaurantOwner {
  id: string;
  fullName: string | null;
  phone: string;
  email: string | null;
}

export interface RestaurantSummary {
  id: string;
  name: string;
  slug: string;
  verificationStatus: 'pending' | 'approved' | 'rejected' | 'suspended';
  isActive: boolean;
  createdAt: string;
  owner: RestaurantOwner | null;
  outletCount: number;
  documentCount: number;
}

export interface RestaurantApplicationListResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  data: RestaurantSummary[];
}

export interface RestaurantDocument {
  id: string;
  restaurantId: string;
  documentType: string;
  documentNumber: string | null;
  documentUrl: string;
  storageProvider: string;
  storageKey: string | null;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantOutlet {
  id: string;
  restaurantId: string;
  name: string;
  phone: string;
  address: string;
  latitude: string;
  longitude: string;
  deliveryRadiusKm: string;
  isAcceptingOrders: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantDetail {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logoUrl: string | null;
    ownerId?: string | null;
    verificationStatus: 'pending' | 'approved' | 'rejected' | 'suspended';
    rejectionReason: string | null;
    suspensionReason: string | null;
    verifiedAt: string | null;
    isActive: boolean;
    createdAt: string;
  };
  owner: RestaurantOwner | null;
  outlets: RestaurantOutlet[];
  documents: RestaurantDocument[];
}

export interface RestaurantApplicationsQuery {
  page?: number;
  limit?: number;
  search?: string;
  verificationStatus?: RestaurantVerificationStatus;
  from?: string;
  to?: string;
}

export interface VerifyRestaurantPayload {
  verificationStatus: 'approved' | 'rejected';
  rejectionReason?: string;
}

export interface SuspendRestaurantPayload {
  suspensionReason: string;
}

export interface VerifyDocumentPayload {
  status: 'verified' | 'rejected';
  notes?: string;
}

export interface UpdateOutletOperationsPayload {
  isActive?: boolean;
  isAcceptingOrders?: boolean;
}

export interface CreateRestaurantPayload {
  name: string;
  slug?: string;
  description?: string;
  logoUrl?: string;
  ownerId?: string;
}

export interface UpdateRestaurantPayload {
  name?: string;
  description?: string;
  logoUrl?: string;
  ownerId?: string;
}

export interface CreateOutletPayload {
  name: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  deliveryRadiusKm?: number;
}

export interface UpdateOutletPayload {
  name?: string;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  deliveryRadiusKm?: number;
}

export interface MenuCategory {
  id: string;
  restaurantId: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  createdAt?: string;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string | null;
  basePrice: string | number;
  isVeg: boolean;
  imageUrl: string | null;
  isAvailable: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateMenuCategoryPayload {
  name: string;
  displayOrder?: number;
}

export interface UpdateMenuCategoryPayload {
  name?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface CreateMenuItemPayload {
  categoryId: string;
  name: string;
  description?: string;
  basePrice: number;
  isVeg?: boolean;
  imageUrl?: string;
  isAvailable?: boolean;
}

export interface UpdateMenuItemPayload {
  categoryId?: string;
  name?: string;
  description?: string;
  basePrice?: number;
  isVeg?: boolean;
  imageUrl?: string;
  isAvailable?: boolean;
}

