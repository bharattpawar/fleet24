import { riderApi } from '../api/riderApi';
import { riderLocationService } from '../services/riderLocationService';
import { riderNotificationService } from '../services/riderNotificationService';

// Mock dependencies
jest.mock('../api/client', () => ({
  apiRequest: jest.fn(),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestBackgroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  watchPositionAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
  startLocationUpdatesAsync: jest.fn().mockResolvedValue(undefined),
  stopLocationUpdatesAsync: jest.fn().mockResolvedValue(undefined),
  hasStartedLocationUpdatesAsync: jest.fn().mockResolvedValue(false),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: {
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 5,
      heading: 90,
      speed: 4,
    },
    timestamp: Date.now(),
  }),
  Accuracy: { High: 4, Balanced: 3 },
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn().mockResolvedValue(false),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[mock-rider-token]' }),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  AndroidImportance: { MAX: 5 },
}));

import { apiRequest } from '../api/client';

describe('Rider Operations & Lifecycle (Phase 5.4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rider Profile & Availability API Client', () => {
    it('fetches rider profile correctly', async () => {
      const mockProfile = {
        id: 'rider-1',
        userId: 'user-1',
        verificationStatus: 'approved',
        availabilityStatus: 'available',
        isSuspended: false,
        vehicleType: 'motorcycle',
      };
      (apiRequest as jest.Mock).mockResolvedValueOnce(mockProfile);

      const res = await riderApi.getProfile();
      expect(apiRequest).toHaveBeenCalledWith('/riders/profile');
      expect(res.verificationStatus).toBe('approved');
      expect(res.availabilityStatus).toBe('available');
    });

    it('toggles rider availability status', async () => {
      (apiRequest as jest.Mock).mockResolvedValueOnce({
        availabilityStatus: 'available',
        isOnline: true,
      });

      const res = await riderApi.setAvailability('available');
      expect(apiRequest).toHaveBeenCalledWith('/riders/availability', {
        method: 'PATCH',
        body: JSON.stringify({ availabilityStatus: 'available' }),
      });
      expect(res.isOnline).toBe(true);
    });

    it('transmits GPS coordinates to /riders/location', async () => {
      (apiRequest as jest.Mock).mockResolvedValueOnce({
        id: 'loc-1',
        riderId: 'rider-1',
      });

      await riderApi.updateLocation({
        latitude: 12.9716,
        longitude: 77.5946,
        heading: 180,
        speed: 8.5,
      });

      expect(apiRequest).toHaveBeenCalledWith('/riders/location', {
        method: 'PATCH',
        body: JSON.stringify({
          latitude: 12.9716,
          longitude: 77.5946,
          heading: 180,
          speed: 8.5,
        }),
      });
    });
  });

  describe('Delivery Offer Acceptance & Rejection', () => {
    it('fetches pending offers correctly', async () => {
      const futureTime = new Date(Date.now() + 45000).toISOString();
      const mockOffers = [
        {
          deliveryId: 'del-1',
          orderId: 'order-101',
          orderNumber: 'ORD-101',
          distanceMeters: 1200,
          offerExpiresAt: futureTime,
          secondsRemaining: 45,
          outlet: {
            name: 'Burger Hub',
            address: '123 Food Street',
            phone: '9876543210',
            latitude: 12.9716,
            longitude: 77.5946,
          },
          deliveryAddress: { addressLine1: '456 Tech Park' },
          items: [{ name: 'Cheeseburger', quantity: 2 }],
        },
      ];

      (apiRequest as jest.Mock).mockResolvedValueOnce(mockOffers);

      const res = await riderApi.getOffers();
      expect(apiRequest).toHaveBeenCalledWith('/riders/orders/offers');
      expect(res.length).toBe(1);
      expect(res[0].orderId).toBe('order-101');
      expect(res[0].outlet.name).toBe('Burger Hub');
    });

    it('submits offer acceptance', async () => {
      (apiRequest as jest.Mock).mockResolvedValueOnce({
        orderId: 'order-101',
        deliveryId: 'del-1',
        status: 'accepted',
      });

      const res = await riderApi.acceptOffer('order-101');
      expect(apiRequest).toHaveBeenCalledWith('/riders/orders/order-101/accept', {
        method: 'POST',
      });
      expect(res.status).toBe('accepted');
    });

    it('submits offer decline with optional reason', async () => {
      (apiRequest as jest.Mock).mockResolvedValueOnce({
        orderId: 'order-101',
        status: 'rejected',
      });

      const res = await riderApi.rejectOffer('order-101', 'Too far from restaurant');
      expect(apiRequest).toHaveBeenCalledWith('/riders/orders/order-101/reject', {
        method: 'POST',
        body: JSON.stringify({ reason: 'Too far from restaurant' }),
      });
      expect(res.status).toBe('rejected');
    });
  });

  describe('Delivery Lifecycle Progression & OTP Verification', () => {
    it('signals arrival at restaurant', async () => {
      (apiRequest as jest.Mock).mockResolvedValueOnce({
        orderId: 'order-101',
        status: 'at_restaurant',
      });

      const res = await riderApi.confirmArrival('order-101');
      expect(apiRequest).toHaveBeenCalledWith('/riders/orders/order-101/arrived', {
        method: 'POST',
      });
      expect(res.status).toBe('at_restaurant');
    });

    it('signals pickup confirmation from restaurant', async () => {
      (apiRequest as jest.Mock).mockResolvedValueOnce({
        orderId: 'order-101',
        status: 'picked_up',
      });

      const res = await riderApi.confirmPickup('order-101');
      expect(apiRequest).toHaveBeenCalledWith('/riders/orders/order-101/pickup', {
        method: 'POST',
      });
      expect(res.status).toBe('picked_up');
    });

    it('signals arrival at customer doorstep', async () => {
      (apiRequest as jest.Mock).mockResolvedValueOnce({
        orderId: 'order-101',
        status: 'arrived_customer',
      });

      const res = await riderApi.confirmArrivedCustomer('order-101');
      expect(apiRequest).toHaveBeenCalledWith('/riders/orders/order-101/arrived-customer', {
        method: 'POST',
      });
      expect(res.status).toBe('arrived_customer');
    });

    it('completes delivery with validated 6-digit OTP', async () => {
      (apiRequest as jest.Mock).mockResolvedValueOnce({
        orderId: 'order-101',
        status: 'delivered',
      });

      const res = await riderApi.completeDelivery('order-101', '492815');
      expect(apiRequest).toHaveBeenCalledWith('/riders/orders/order-101/complete', {
        method: 'POST',
        body: JSON.stringify({ otp: '492815' }),
      });
      expect(res.status).toBe('delivered');
    });
  });

  describe('Rider Location Tracking Service', () => {
    it('manages foreground and background tracking state', async () => {
      expect(riderLocationService.getIsTracking()).toBe(false);

      const started = await riderLocationService.startTracking();
      expect(started).toBe(true);
      expect(riderLocationService.getIsTracking()).toBe(true);

      await riderLocationService.stopTracking();
      expect(riderLocationService.getIsTracking()).toBe(false);
    });
  });

  describe('Rider Push Notification Service', () => {
    it('registers push token and configures high-priority channel', async () => {
      const token = await riderNotificationService.registerForPushNotifications();
      expect(token).toBe('ExponentPushToken[mock-rider-token]');
    });
  });
});
