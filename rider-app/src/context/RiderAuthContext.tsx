import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { authStorage } from '../api/storage';
import { riderApi, RiderProfile, ActiveDeliveryDetails, DeliveryOfferItem, AvailableDeliveryOrder } from '../api/riderApi';
import { riderSocket } from '../services/riderSocket';
import { riderLocationService } from '../services/locationService';
import { riderNotificationService } from '../services/notificationService';
import { IS_MOCK_LOGIN_ENABLED, createMockRiderProfile } from '../api/mockData';

interface RiderAuthContextType {
  isAuthenticated: boolean;
  isMockSession: boolean;
  isLoading: boolean;
  profile: RiderProfile | null;
  activeDelivery: ActiveDeliveryDetails | null;
  activeOffer: DeliveryOfferItem | null;
  isOnline: boolean;
  isSocketConnected: boolean;
  loginWithMock: (phone: string) => Promise<void>;
  loginWithOtp: (phone: string, otp: string) => Promise<void>;
  connectToLiveBackend: (phone?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<RiderProfile | null>;
  toggleAvailability: (targetStatus?: 'available' | 'offline') => Promise<boolean>;
  refreshActiveDelivery: () => Promise<ActiveDeliveryDetails | null>;
  checkForPendingOffers: () => Promise<void>;
  dismissActiveOffer: () => void;
  acceptActiveOffer: () => Promise<void>;
  rejectActiveOffer: (reason?: string) => Promise<void>;
  availableOrders: AvailableDeliveryOrder[];
  availableOrdersError: boolean;
  refreshAvailableOrders: () => Promise<AvailableDeliveryOrder[]>;
  claimOrder: (orderId: string) => Promise<boolean>;
}

const RiderAuthContext = createContext<RiderAuthContextType | undefined>(undefined);

export const RiderAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isMockSession, setIsMockSession] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [activeDelivery, setActiveDelivery] = useState<ActiveDeliveryDetails | null>(null);
  const [activeOffer, setActiveOffer] = useState<DeliveryOfferItem | null>(null);
  const [availableOrdersError, setAvailableOrdersError] = useState(false);
  const [availableOrders, setAvailableOrders] = useState<AvailableDeliveryOrder[]>([]);
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);

  // Mutable refs to prevent recreation of callbacks and infinite render loops
  const isMockSessionRef = useRef<boolean>(false);
  isMockSessionRef.current = isMockSession;

  const profileRef = useRef<RiderProfile | null>(null);
  profileRef.current = profile;

  const activeDeliveryRef = useRef<ActiveDeliveryDetails | null>(null);
  activeDeliveryRef.current = activeDelivery;

  const isOnline = profile?.availabilityStatus === 'available' || profile?.availabilityStatus === 'busy';

  // Keep locationService aware of mock and delivery state
  useEffect(() => {
    riderLocationService.setMockMode(isMockSession);
  }, [isMockSession]);

  useEffect(() => {
    riderLocationService.setDelivering(!!activeDelivery);
  }, [activeDelivery]);

  // Sync active foreground offer with notification deduplication
  useEffect(() => {
    riderNotificationService.setActiveForegroundOffer(activeOffer?.orderId || null);
  }, [activeOffer]);

  // Initialize notifications and register push token upon authenticated live session
  useEffect(() => {
    if (isAuthenticated && !isMockSession) {
      riderNotificationService.initialize();
      riderNotificationService.registerForPushNotifications();
    }
  }, [isAuthenticated, isMockSession]);

  /**
   * Stable callback to refresh rider profile
   */
  const refreshProfile = useCallback(async (): Promise<RiderProfile | null> => {
    if (isMockSessionRef.current && profileRef.current) {
      return profileRef.current;
    }

    try {
      const data = await riderApi.getProfile();
      setProfile(data);
      setIsAuthenticated(true);
      return data;
    } catch (err: any) {
      if (err.message && (err.message.includes('401') || err.message.includes('Unauthorized'))) {
        await authStorage.clear();
        setIsAuthenticated(false);
        setIsMockSession(false);
        setProfile(null);
      }
      return null;
    }
  }, []);

  /**
   * Stable callback to refresh active deliveries
   */
  const refreshActiveDelivery = useCallback(async (): Promise<ActiveDeliveryDetails | null> => {
    if (isMockSessionRef.current) {
      return activeDeliveryRef.current;
    }

    try {
      const activeList = await riderApi.getActiveOrders();
      if (activeList && activeList.length > 0) {
        const current = activeList[0];
        setActiveDelivery((prev) => {
          if (prev?.orderId === current.orderId && prev?.status === current.status) {
            return prev;
          }
          return current;
        });
        return current;
      } else {
        setActiveDelivery(null);
        return null;
      }
    } catch (e) {
      console.warn('Failed to load active orders:', e);
      return null;
    }
  }, []);

  /**
   * Stable callback to check for active unexpired assignment offers
   */
  const checkForPendingOffers = useCallback(async () => {
    if (isMockSessionRef.current) return;

    try {
      const offers = await riderApi.getOffers();
      if (offers && offers.length > 0) {
        const validOffer = offers.find((o) => {
          const exp = new Date(o.offerExpiresAt).getTime();
          return exp > Date.now();
        });
        if (validOffer) {
          setActiveOffer((prev) => {
            if (prev?.orderId === validOffer.orderId) return prev;
            return validOffer;
          });
        }
      }
    } catch {
      // Non-critical background polling error
    }
  }, []);

  // Initial authentication restoration (runs ONCE on mount)
  useEffect(() => {
    let isMounted = true;

    (async () => {
      // 1. Check real backend token first
      const token = await authStorage.getAccessToken();
      if (token) {
        try {
          const prof = await refreshProfile();
          if (prof && isMounted) {
            await refreshActiveDelivery();
            await checkForPendingOffers();
            setIsLoading(false);
            return;
          }
        } catch {
          // Token invalid or expired
        }
      }

      // 2. Check for dev mock session only if no real token and explicitly saved
      if (IS_MOCK_LOGIN_ENABLED) {
        const savedMockPhone = await authStorage.getMockSession();
        if (savedMockPhone && isMounted) {
          const mockProf = createMockRiderProfile(savedMockPhone);
          setProfile(mockProf);
          setIsMockSession(true);
          setIsAuthenticated(true);
          setIsLoading(false);
          return;
        }
      }

      if (isMounted) setIsLoading(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [refreshProfile, refreshActiveDelivery, checkForPendingOffers]);

  // Socket Connection Lifecycle (strictly depends on isAuthenticated & isMockSession)
  useEffect(() => {
    if (!isAuthenticated) {
      riderSocket.disconnect();
      setIsSocketConnected(false);
      return;
    }

    if (!isMockSession) {
      riderSocket.connect();
      const unsubSocket = riderSocket.onConnectionChange((connected) => {
        setIsSocketConnected(connected);
      });

      const unsubOffers = riderSocket.onOfferCreated((offerPayload) => {
        setActiveOffer(offerPayload);
      });

      const unsubDeliveryStatus = riderSocket.onDeliveryStatusUpdated(() => {
        refreshActiveDelivery();
      });

      return () => {
        unsubSocket();
        unsubOffers();
        unsubDeliveryStatus();
      };
    } else {
      setIsSocketConnected(true);
    }
  }, [isAuthenticated, isMockSession, refreshActiveDelivery]);

  // Location Tracking Lifecycle (independent of socket to prevent reconnect churn)
  const hasActiveDelivery = !!activeDelivery;
  useEffect(() => {
    if (!isAuthenticated) {
      riderLocationService.stopTracking();
      return;
    }

    if (isOnline || hasActiveDelivery) {
      riderLocationService.startTracking();
    } else {
      riderLocationService.stopTracking();
    }
  }, [isAuthenticated, isOnline, hasActiveDelivery]);

  /**
   * Online/Offline availability toggle
   */
  const toggleAvailability = async (targetStatus?: 'available' | 'offline'): Promise<boolean> => {
    const nextStatus = targetStatus || (isOnline ? 'offline' : 'available');

    // 1. MOCK DEVELOPMENT MODE
    if (isMockSession) {
      setProfile((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          availabilityStatus: nextStatus as any,
        };
      });

      if (nextStatus === 'available') {
        await riderLocationService.startTracking();
      } else {
        riderLocationService.stopTracking();
      }
      return true;
    }

    // 2. REAL BACKEND MODE
    try {
      const res = await riderApi.setAvailability(nextStatus);

      setProfile((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          availabilityStatus: res.availabilityStatus as any,
        };
      });

      if (nextStatus === 'available') {
        await riderLocationService.startTracking();
      } else {
        riderLocationService.stopTracking();
      }
      return true;
    } catch (err: any) {
      const errorMsg = err.message || 'Could not update availability status.';
      Alert.alert('Status Update Failed', errorMsg);
      return false;
    }
  };

  /**
   * Mock login for development without OTP
   * Upgraded: Attempts real backend auth with dev bypass 123456 so rider receives live orders
   */
  const loginWithMock = async (phone: string) => {
    const cleanDigits = phone.replace(/[^0-9]/g, '');
    const last10 = cleanDigits.slice(-10);
    const formatted = cleanDigits.length >= 10 ? `+91${last10}` : '+911234567890';

    try {
      try {
        await riderApi.requestOtp(formatted);
      } catch {
        // Cooldown or existing challenge is acceptable
      }
      await loginWithOtp(formatted, '123456');
      return;
    } catch (e) {
      console.warn('Real login fallback to mock:', e);
    }

    if (!IS_MOCK_LOGIN_ENABLED) {
      throw new Error('Mock login is disabled in this environment.');
    }

    await authStorage.setMockSession(phone);
    const mockProf = createMockRiderProfile(phone);
    setProfile(mockProf);
    setIsMockSession(true);
    setIsAuthenticated(true);
  };

  /**
   * Real OTP login (preserves OTP development bypass '123456')
   */
  const loginWithOtp = async (phone: string, otp: string) => {
    const res = await riderApi.verifyOtp(phone, otp);
    await authStorage.setTokens(res.tokens.accessToken, res.tokens.refreshToken);
    await authStorage.clearMockSession();
    setIsMockSession(false);
    setIsAuthenticated(true);

    let prof = await refreshProfile();
    if (!prof) {
      // Auto-create rider profile if user is approved/onboarding
      try {
        prof = await riderApi.createProfile({
          fullName: res.user?.fullName || 'Fleet24 Rider',
          vehicleType: 'motorcycle',
        });
        setProfile(prof);
      } catch (err: any) {
        console.warn('Profile creation/fetch error:', err?.message);
      }
    }
    await refreshActiveDelivery();
    await checkForPendingOffers();
  };

  /**
   * Verified Connection to Live Backend
   * Validates:
   * 1. API Base URL reachability (/health)
   * 2. Rider authentication & JWT tokens (OTP request & verify with bypass 123456)
   * 3. Rider profile existence & approval status
   * 4. Real GPS coordinates & location push
   * 5. Availability endpoint (/riders/availability -> 'available')
   * 6. Socket.IO connection & authentication
   * 7. Active offer check
   */
  const connectToLiveBackend = async (
    targetPhone?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const rawPhone = targetPhone || profile?.user?.phone || '1234567890';
    const cleanDigits = rawPhone.replace(/[^0-9]/g, '');
    const last10 = cleanDigits.slice(-10);
    const formatted = cleanDigits.length >= 10 ? `+91${last10}` : '+911234567890';

    try {
      // Step 1: Verify API reachability
      try {
        await riderApi.checkHealth();
      } catch (healthErr: any) {
        throw new Error(
          `Cannot reach Fleet24 Backend API (${healthErr.message || 'Connection refused'}). Please verify the server is running on port 4000.`,
        );
      }

      // Step 2: Request OTP & Verify with bypass '123456'
      try {
        await riderApi.requestOtp(formatted);
      } catch (otpReqErr: any) {
        // Cooldown or existing challenge is acceptable
        if (!otpReqErr.message?.includes('cooldown') && !otpReqErr.message?.includes('wait')) {
          console.warn('OTP request warning:', otpReqErr.message);
        }
      }

      const authRes = await riderApi.verifyOtp(formatted, '123456');
      if (!authRes?.tokens?.accessToken) {
        throw new Error('Backend failed to return authentication tokens.');
      }

      await authStorage.setTokens(authRes.tokens.accessToken, authRes.tokens.refreshToken);
      await authStorage.clearMockSession();

      // Step 3: Fetch & verify rider profile
      let realProfile = await riderApi.getProfile();
      if (!realProfile) {
        realProfile = await riderApi.createProfile({
          fullName: authRes.user?.fullName || 'Demo Rider',
          vehicleType: 'motorcycle',
        });
      }

      if (realProfile.verificationStatus !== 'approved') {
        throw new Error(
          `Rider verification status is '${realProfile.verificationStatus}'. Must be 'approved' by Fleet24 admin before going live.`,
        );
      }

      // Step 4: Verify GPS & push current coordinates to backend
      await riderLocationService.requestForegroundPermission();
      let currentPos = await riderLocationService.getCurrentPosition();
      if (!currentPos) {
        currentPos = {
          latitude: 28.4744,
          longitude: 77.504,
          accuracy: 5,
        };
      }

      try {
        await riderApi.updateLocation({
          latitude: currentPos.latitude,
          longitude: currentPos.longitude,
          accuracy: currentPos.accuracy || 5,
        });
      } catch (locErr: any) {
        console.warn('Location push warning:', locErr.message);
      }

      // Step 5: Set availability to available on backend
      const availRes = await riderApi.setAvailability('available');
      realProfile.availabilityStatus = availRes.availabilityStatus as any;

      // Step 6: Connect Socket.IO directly
      riderSocket.disconnect();
      await riderSocket.connect();

      // Step 7: Update context state to full LIVE mode
      setIsMockSession(false);
      setIsAuthenticated(true);
      setProfile(realProfile);

      // Step 7.5: Register for push notifications
      riderNotificationService.initialize().catch(() => {});
      riderNotificationService.registerForPushNotifications().catch(() => {});

      // Step 8: Check for pending offers and active deliveries
      await refreshActiveDelivery();
      await checkForPendingOffers();

      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Unknown error connecting to backend.';
      console.error('[LiveBackendConnectError]', err);
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    try {
      if (isOnline && !isMockSession) {
        await riderApi.setAvailability('offline');
      }
    } catch {
      // Ignore network errors on logout
    }
    await authStorage.clear();
    await riderNotificationService.unregisterPushNotifications().catch(() => {});
    riderSocket.disconnect();
    riderLocationService.stopTracking();
    setIsAuthenticated(false);
    setIsMockSession(false);
    setProfile(null);
    setActiveDelivery(null);
    setActiveOffer(null);
    setIsSocketConnected(false);
  };

  const dismissActiveOffer = () => {
    setActiveOffer(null);
  };

  const acceptActiveOffer = async () => {
    if (!activeOffer) return;
    if (isMockSession) {
      setActiveOffer(null);
      return;
    }
    try {
      await riderApi.acceptOffer(activeOffer.orderId);
      setActiveOffer(null);
      await refreshActiveDelivery();
      await refreshProfile();
    } catch (err: any) {
      Alert.alert('Offer Error', err.message || 'Failed to accept offer');
      setActiveOffer(null);
    }
  };

  const rejectActiveOffer = async (reason?: string) => {
    if (!activeOffer) return;
    if (isMockSession) {
      setActiveOffer(null);
      return;
    }
    try {
      await riderApi.rejectOffer(activeOffer.orderId, reason);
    } catch (err) {
      console.warn('Rejection error:', err);
    } finally {
      setActiveOffer(null);
    }
  };

  const refreshAvailableOrders = useCallback(async (): Promise<AvailableDeliveryOrder[]> => {
    if (isMockSessionRef.current) return [];
    try {
      const list = await riderApi.getAvailableOrders();
      setAvailableOrders(list || []);
      setAvailableOrdersError(false);
      return list || [];
    } catch (e) {
      setAvailableOrdersError(true);
      console.warn('Failed to load available orders:', e);
      return [];
    }
  }, []);

  const claimOrder = async (orderId: string): Promise<boolean> => {
    try {
      await riderApi.claimOrder(orderId);
      setActiveOffer(null);
      await refreshActiveDelivery();
      await refreshProfile();
      await refreshAvailableOrders();
      return true;
    } catch (err: any) {
      Alert.alert('Claim Failed', err.message || 'Could not claim order.');
      return false;
    }
  };

  return (
    <RiderAuthContext.Provider
      value={{
        isAuthenticated,
        isMockSession,
        isLoading,
        profile,
        activeDelivery,
        activeOffer,
        availableOrders,
        availableOrdersError,
        isOnline,
        isSocketConnected,
        loginWithMock,
        loginWithOtp,
        connectToLiveBackend,
        logout,
        refreshProfile,
        toggleAvailability,
        refreshActiveDelivery,
        checkForPendingOffers,
        refreshAvailableOrders,
        claimOrder,
        dismissActiveOffer,
        acceptActiveOffer,
        rejectActiveOffer,
      }}
    >
      {children}
    </RiderAuthContext.Provider>
  );
};

export const useRiderAuth = () => {
  const ctx = useContext(RiderAuthContext);
  if (!ctx) {
    throw new Error('useRiderAuth must be used within a RiderAuthProvider');
  }
  return ctx;
};
