export type RiderVehicleType = 'bicycle' | 'motorcycle' | 'scooter' | 'ev' | 'other';
export type RiderVerificationStatus = 'pending' | 'approved' | 'rejected' | 'all';
export type RiderAvailabilityStatus = 'offline' | 'available' | 'busy' | 'all';

export interface RiderUser {
  phone?: string;
  email?: string;
  isActive?: boolean;
}

export interface RiderSummary {
  id: string;
  userId: string;
  fullName: string | null;
  vehicleType: RiderVehicleType;
  vehicleNumber: string | null;
  licenseNumber: string | null;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  availabilityStatus: 'offline' | 'available' | 'busy';
  isSuspended: boolean;
  suspensionReason: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  user: RiderUser;
}

export interface RiderPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface RiderListResponse {
  data: RiderSummary[];
  pagination: RiderPagination;
}

export interface RiderDetail extends RiderSummary {
  profileImageUrl: string | null;
  dateOfBirth: string | null;
  currentActiveOrdersCount: number;
  maxActiveOrders: number;
  isVerified: boolean;
  isOnline: boolean;
  updatedAt: string;
  approver?: {
    id: string;
    fullName: string | null;
    phone: string;
  } | null;
}

export interface RiderQueryFilters {
  page?: number;
  limit?: number;
  search?: string;
  verificationStatus?: 'pending' | 'approved' | 'rejected';
  availabilityStatus?: 'offline' | 'available' | 'busy';
}

export interface VerifyRiderPayload {
  verificationStatus: 'approved' | 'rejected';
  rejectionReason?: string;
}

export interface SuspendRiderPayload {
  suspensionReason: string;
}

