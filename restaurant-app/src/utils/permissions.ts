import { StaffUser, OperatingOutlet } from '../types';

export interface RestaurantPermissions {
  canViewOrders: boolean;
  canAcceptOrders: boolean;
  canUpdateKitchenStatus: boolean;
  canManageMenu: boolean;
  canToggleItemAvailability: boolean;
  canManageOutletInfo: boolean;
  canToggleOrderAcceptance: boolean;
  canUpdateOperatingHours: boolean;
  canViewFinancials: boolean;
  canManageStaff: boolean;
}

/**
 * Centralized Restaurant Permission Resolver
 * Maps authenticated user identity, role, and outlet-specific designation to operational capabilities.
 * 
 * Hierarchy:
 * - Owner: Full access to all business, menu, outlet, and financial functions for owned brand/outlets.
 * - Admin: Platform administration fallback across all operational and supervisory functions.
 * - Manager: Operational control over assigned outlet, including accepting orders, menu editing, and outlet hours.
 * - Staff (Kitchen/Chef): Operational kitchen terminal actions (view orders, update preparation status, toggle item stock).
 */
export function resolvePermissions(
  staffUser: StaffUser | null,
  activeOutlet: OperatingOutlet | null,
): RestaurantPermissions {
  if (!staffUser) {
    return {
      canViewOrders: false,
      canAcceptOrders: false,
      canUpdateKitchenStatus: false,
      canManageMenu: false,
      canToggleItemAvailability: false,
      canManageOutletInfo: false,
      canToggleOrderAcceptance: false,
      canUpdateOperatingHours: false,
      canViewFinancials: false,
      canManageStaff: false,
    };
  }

  // 1. Direct Restaurant Owner or Platform Super Admin
  if (staffUser.isOwner || staffUser.resolvedRole === 'owner' || staffUser.resolvedRole === 'admin') {
    return {
      canViewOrders: true,
      canAcceptOrders: true,
      canUpdateKitchenStatus: true,
      canManageMenu: true,
      canToggleItemAvailability: true,
      canManageOutletInfo: true,
      canToggleOrderAcceptance: true,
      canUpdateOperatingHours: true,
      canViewFinancials: true,
      canManageStaff: staffUser.isOwner || staffUser.resolvedRole === 'admin',
    };
  }

  // 2. Outlet-specific role derivation
  const outletRole = activeOutlet?.role || staffUser.resolvedRole;
  const designationLower = (activeOutlet?.designation || staffUser.designation || '').toLowerCase();
  const isManager = outletRole === 'manager' || designationLower.includes('manager') || designationLower.includes('lead');

  if (isManager) {
    return {
      canViewOrders: true,
      canAcceptOrders: true,
      canUpdateKitchenStatus: true,
      canManageMenu: true,
      canToggleItemAvailability: true,
      canManageOutletInfo: true,
      canToggleOrderAcceptance: true,
      canUpdateOperatingHours: true,
      canViewFinancials: true,
      canManageStaff: false,
    };
  }

  // 3. Operational Staff (Kitchen Crew, Chef, Prep Staff)
  return {
    canViewOrders: true,
    canAcceptOrders: true,
    canUpdateKitchenStatus: true,
    canManageMenu: false, // Cannot add/delete items or change prices
    canToggleItemAvailability: true, // Can mark items in-stock / sold-out
    canManageOutletInfo: false,
    canToggleOrderAcceptance: true, // Can pause/resume kitchen terminal
    canUpdateOperatingHours: false,
    canViewFinancials: false,
    canManageStaff: false,
  };
}

