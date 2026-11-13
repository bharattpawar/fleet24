import { RiderProfile, RiderEarningsSummary, ActiveDeliveryDetails, DeliveryOfferItem } from './riderApi';

/**
 * Development-only Mock Configuration
 * STRICT REQUIREMENT: Mock login is strictly disabled in production (`process.env.NODE_ENV === 'production'`).
 */
export const IS_MOCK_LOGIN_ENABLED = __DEV__ && process.env.NODE_ENV !== 'production';

export interface MockRiderSession {
  type: 'mock';
  phone: string;
  fullName: string;
  vehicleType: string;
  vehicleNumber: string;
  createdAt: string;
}

export function createMockRiderProfile(phone: string): RiderProfile {
  // Normalize phone
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.length === 10 ? `+91${cleanPhone}` : phone;

  return {
    id: 'mock-rider-uuid-001',
    userId: 'mock-user-uuid-001',
    fullName: 'Demo Rider',
    profileImageUrl: null,
    dateOfBirth: '1998-05-15',
    vehicleType: 'motorcycle',
    vehicleNumber: 'UP16 AB 1234',
    licenseNumber: 'DL142026009876',
    verificationStatus: 'approved',
    availabilityStatus: 'offline',
    isSuspended: false,
    suspensionReason: null,
    approvedAt: new Date().toISOString(),
    user: {
      id: 'mock-user-uuid-001',
      phone: formattedPhone,
      email: 'demo.rider@fleet24.app',
      isActive: true,
    },
  };
}

export const mockRiderData = {
  getSummary(): RiderEarningsSummary {
    return {
      riderId: 'mock-rider-uuid-001',
      totalEarned: '1450.00',
      totalDisbursed: '900.00',
      reservedPendingPayout: '0.00',
      availableBalance: '550.00',
      lifetimeCompletedDeliveries: 18,
      todayEarned: '320.00',
      todayDeliveries: 4,
    };
  },

  getRecentEarnings() {
    return [
      {
        id: 'earn-mock-1',
        orderId: 'order-mock-1',
        orderNumber: 'F24-8921',
        earningAmount: '65.00',
        baseFare: '30.00',
        distancePay: '35.00',
        distanceMeters: 2800,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        outletName: 'The Biryani Project',
      },
      {
        id: 'earn-mock-2',
        orderId: 'order-mock-2',
        orderNumber: 'F24-8915',
        earningAmount: '50.00',
        baseFare: '30.00',
        distancePay: '20.00',
        distanceMeters: 1600,
        createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        outletName: 'Burger Hub Sector Alpha',
      },
      {
        id: 'earn-mock-3',
        orderId: 'order-mock-3',
        orderNumber: 'F24-8890',
        earningAmount: '80.00',
        baseFare: '30.00',
        distancePay: '50.00',
        distanceMeters: 4200,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        outletName: 'Pizza Roma',
      },
    ];
  },
};

