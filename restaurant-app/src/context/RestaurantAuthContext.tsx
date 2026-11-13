import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { authStorage } from '../api/storage';
import { restaurantApi } from '../api/restaurantApi';
import { setAuthFailureListener, resetAuthFailureState } from '../api/client';
import { disconnectRestaurantSocket } from '../api/restaurantSocket';
import { StaffUser, OperatingOutlet } from '../types';
import { resolvePermissions, RestaurantPermissions } from '../utils/permissions';

interface RestaurantAuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  staffUser: StaffUser | null;
  outlets: OperatingOutlet[];
  activeOutlet: OperatingOutlet | null;
  permissions: RestaurantPermissions;
  setActiveOutlet: (outlet: OperatingOutlet) => Promise<void>;
  requestOtp: (phone: string) => Promise<{ cooldownSeconds: number; expiresInSeconds: number }>;
  verifyOtp: (phone: string, otp: string) => Promise<void>;
  loginWithPhoneOnly: (phone: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  toggleOrderAcceptance: (isAccepting: boolean, targetOutletId?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const RestaurantAuthContext = createContext<RestaurantAuthContextType | undefined>(undefined);

export const RestaurantAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null);
  const [outlets, setOutlets] = useState<OperatingOutlet[]>([]);
  const [activeOutlet, setActiveOutletState] = useState<OperatingOutlet | null>(null);

  /**
   * Centralized complete logout cleanup
   */
  const logout = useCallback(async () => {
    try {
      await authStorage.clear();
    } catch {
      // Storage clear failure non-blocking
    }
    disconnectRestaurantSocket();
    resetAuthFailureState();
    setIsAuthenticated(false);
    setStaffUser(null);
    setOutlets([]);
    setActiveOutletState(null);
  }, []);

  /**
   * Fetch authenticated restaurant profile and resolve active outlet
   */
  const loadProfile = useCallback(async (): Promise<boolean> => {
    try {
      const res: any = await restaurantApi.getProfile();
      const rawStaff = res?.staff || res?.staffUser;
      const rawOutlets: any[] = res?.authorizedOutlets || res?.outlets || [];

      if (!rawStaff && rawOutlets.length === 0) {
        return false;
      }

      if (rawStaff) {
        setStaffUser({
          id: rawStaff.id,
          phone: rawStaff.phone || '',
          fullName: rawStaff.name || rawStaff.fullName || null,
          email: rawStaff.email || null,
          roles: Array.isArray(rawStaff.roles) ? rawStaff.roles : ['restaurant_staff'],
          designation: rawStaff.designation || (rawStaff.isOwner ? 'Owner' : 'Staff Member'),
          resolvedRole: rawStaff.resolvedRole || (rawStaff.isOwner ? 'owner' : 'staff'),
          restaurantName: rawStaff.restaurantName || 'Fleet24 Kitchen',
          isOwner: Boolean(rawStaff.isOwner),
        });
      }

      const formattedOutlets: OperatingOutlet[] = rawOutlets.map((o: any) => ({
        id: o.id || o.outletId,
        restaurantId: o.restaurantId || o.restaurant?.id,
        restaurantName: o.restaurantName || o.restaurant?.name || rawStaff?.restaurantName || 'Fleet24 Kitchen',
        restaurantSlug: o.restaurantSlug || o.restaurant?.slug || '',
        name: o.name || o.outletName || 'Main Kitchen',
        phone: o.phone || '',
        address: o.address || '',
        latitude: o.latitude ? parseFloat(o.latitude) : 0,
        longitude: o.longitude ? parseFloat(o.longitude) : 0,
        deliveryRadiusKm: o.deliveryRadiusKm ? parseFloat(o.deliveryRadiusKm) : 3,
        isActive: Boolean(o.isActive !== false),
        isAcceptingOrders: Boolean(o.isAcceptingOrders),
        role: o.role || 'staff',
        designation: o.designation,
        operatingHours: o.operatingHours || [],
      }));

      setOutlets(formattedOutlets);

      // Resolve active outlet with persistent storage validation
      const savedOutletId = await authStorage.getActiveOutletId();
      let selected = formattedOutlets.find((o) => o.id === savedOutletId);

      if (!selected) {
        if (formattedOutlets.length === 1) {
          selected = formattedOutlets[0];
          await authStorage.setActiveOutletId(selected.id);
        } else if (formattedOutlets.length > 1) {
          selected = formattedOutlets.find((o) => o.isActive) || formattedOutlets[0];
          if (selected) {
            await authStorage.setActiveOutletId(selected.id);
          }
        }
      }

      setActiveOutletState(selected || null);
      return true;
    } catch (err: any) {
      console.warn('[RestaurantAuthContext] Failed to load profile:', err?.message);
      throw err;
    }
  }, []);

  /**
   * Initialize session restoration on mount
   */
  const initAuth = useCallback(async () => {
    try {
      const token = await authStorage.getAccessToken();
      if (!token) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      const success = await loadProfile();
      if (success) {
        setIsAuthenticated(true);
      } else {
        await logout();
      }
    } catch (err: any) {
      const isAuthError =
        err?.message?.includes('expired') ||
        err?.message?.includes('401') ||
        err?.message?.includes('Unauthorized') ||
        err?.message?.includes('session has expired');

      if (isAuthError) {
        await logout();
      } else {
        console.warn('[RestaurantAuthContext] Network or transient error during session restoration:', err?.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [loadProfile, logout]);

  // Setup single-flight auth failure listener
  useEffect(() => {
    setAuthFailureListener((reason) => {
      logout();
      if (reason === 'session_expired') {
        Alert.alert('Session Expired', 'Your session has expired. Please log in again.');
      }
    });

    initAuth();

    return () => {
      setAuthFailureListener(null);
    };
  }, [initAuth, logout]);

  const setActiveOutlet = async (outlet: OperatingOutlet) => {
    setActiveOutletState(outlet);
    await authStorage.setActiveOutletId(outlet.id);
  };

  const requestOtp = async (phone: string) => {
    return restaurantApi.requestOtp(phone);
  };

  const verifyOtp = async (phone: string, otp: string) => {
    const res = await restaurantApi.verifyOtp(phone, otp);
    if (res.tokens?.accessToken) {
      await authStorage.setTokens(res.tokens.accessToken, res.tokens.refreshToken);
      resetAuthFailureState();
      const success = await loadProfile();
      if (success) {
        setIsAuthenticated(true);
      }
    }
  };

  const loginWithPhoneOnly = async (phone: string) => {
    // 1. Request OTP (creates OTP challenge on backend)
    await restaurantApi.requestOtp(phone);
    // 2. Immediately verify with dev bypass OTP '123456'
    const res = await restaurantApi.verifyOtp(phone, '123456');
    if (res.tokens?.accessToken) {
      await authStorage.setTokens(res.tokens.accessToken, res.tokens.refreshToken);
      resetAuthFailureState();
      const success = await loadProfile();
      if (success) {
        setIsAuthenticated(true);
      }
    }
  };

  const refreshProfile = async () => {
    await loadProfile();
  };

  const toggleOrderAcceptance = async (isAccepting: boolean, targetOutletId?: string) => {
    const outletId = targetOutletId || activeOutlet?.id;
    if (!outletId) return;

    // Optimistic state update
    setActiveOutletState((prev) =>
      prev && prev.id === outletId ? { ...prev, isAcceptingOrders: isAccepting } : prev,
    );
    setOutlets((prev) =>
      prev.map((o) => (o.id === outletId ? { ...o, isAcceptingOrders: isAccepting } : o)),
    );

    try {
      const updated = await restaurantApi.updateOrderAcceptance(outletId, isAccepting);
      setActiveOutletState((prev) =>
        prev && prev.id === outletId ? { ...prev, isAcceptingOrders: updated.isAcceptingOrders } : prev,
      );
      setOutlets((prev) =>
        prev.map((o) => (o.id === outletId ? { ...o, isAcceptingOrders: updated.isAcceptingOrders } : o)),
      );
    } catch (err: any) {
      // Revert optimistic update on failure
      setActiveOutletState((prev) =>
        prev && prev.id === outletId ? { ...prev, isAcceptingOrders: !isAccepting } : prev,
      );
      setOutlets((prev) =>
        prev.map((o) => (o.id === outletId ? { ...o, isAcceptingOrders: !isAccepting } : o)),
      );
      Alert.alert('Status Update Failed', err?.message || 'Could not update order acceptance status.');
    }
  };

  const permissions = resolvePermissions(staffUser, activeOutlet);

  return (
    <RestaurantAuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        staffUser,
        outlets,
        activeOutlet,
        permissions,
        setActiveOutlet,
        requestOtp,
        verifyOtp,
        loginWithPhoneOnly,
        refreshProfile,
        toggleOrderAcceptance,
        logout,
      }}
    >
      {children}
    </RestaurantAuthContext.Provider>
  );
};

export const useRestaurantAuth = (): RestaurantAuthContextType => {
  const context = useContext(RestaurantAuthContext);
  if (!context) {
    throw new Error('useRestaurantAuth must be used within a RestaurantAuthProvider');
  }
  return context;
};
