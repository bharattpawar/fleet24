import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, minTouchTarget, shadows } from '../theme/tokens';
import { useRestaurantAuth } from '../context/RestaurantAuthContext';

interface RestaurantProfileScreenProps {
  onNavigateToOutlets?: () => void;
}

export const RestaurantProfileScreen: React.FC<RestaurantProfileScreenProps> = ({
  onNavigateToOutlets,
}) => {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const { staffUser, activeOutlet, logout, outlets, permissions } = useRestaurantAuth();

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to log out of this kitchen terminal session?');
      if (confirmed) {
        logout();
      }
      return;
    }
    Alert.alert(
      'Log Out Kitchen Partner',
      'Are you sure you want to log out of this kitchen terminal session?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: () => logout() },
      ],
    );
  };

  const getInitials = (name?: string | null) => {
    if (!name) return 'FP';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const designationBadge = (() => {
    if (staffUser?.isOwner || staffUser?.resolvedRole === 'owner') {
      return {
        label: 'RESTAURANT OWNER',
        color: colors.limeAccent,
        bgColor: 'rgba(217, 240, 120, 0.15)',
        borderColor: 'rgba(217, 240, 120, 0.35)',
        icon: 'ribbon-outline' as const,
      };
    }
    if (staffUser?.resolvedRole === 'manager' || staffUser?.designation?.toLowerCase().includes('manager')) {
      return {
        label: (staffUser?.designation || 'STORE MANAGER').toUpperCase(),
        color: '#93C5FD',
        bgColor: 'rgba(147, 197, 253, 0.15)',
        borderColor: 'rgba(147, 197, 253, 0.4)',
        icon: 'briefcase-outline' as const,
      };
    }
    if (staffUser?.resolvedRole === 'admin') {
      return {
        label: 'SUPERVISOR / ADMIN',
        color: colors.limeAccent,
        bgColor: 'rgba(217, 240, 120, 0.15)',
        borderColor: 'rgba(217, 240, 120, 0.35)',
        icon: 'shield-checkmark-outline' as const,
      };
    }
    return {
      label: (staffUser?.designation || 'KITCHEN CREW').toUpperCase(),
      color: '#E5E7EB',
      bgColor: 'rgba(255, 255, 255, 0.12)',
      borderColor: 'rgba(255, 255, 255, 0.25)',
      icon: 'restaurant-outline' as const,
    };
  })();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.mainWrapper, isWide && styles.wideWrapper]}>
        {/* 1. Partner Identity Header Card (Deep Forest Background with High Contrast White/Lime Text) */}
        <View style={styles.headerCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>{getInitials(staffUser?.fullName)}</Text>
            </View>
            <View style={styles.activeDot} />
          </View>

          <Text style={styles.userName}>{staffUser?.fullName || 'Restaurant Partner'}</Text>
          <Text style={styles.restaurantBrandName}>{staffUser?.restaurantName || 'Fleet24 Partner'}</Text>
          <Text style={styles.userPhone}>{staffUser?.phone || 'No Phone Registered'}</Text>

          <View
            style={[
              styles.designationBadge,
              {
                backgroundColor: designationBadge.bgColor,
                borderColor: designationBadge.borderColor,
              },
            ]}
          >
            <Ionicons
              name={designationBadge.icon}
              size={14}
              color={designationBadge.color}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.designationText, { color: designationBadge.color }]}>
              {designationBadge.label}
            </Text>
          </View>
        </View>

        {/* 2. Currently Operating Outlet (Pure White Card with Crisp Charcoal Text) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>CURRENTLY OPERATING OUTLET</Text>
            <View
              style={[
                styles.activePill,
                activeOutlet?.isAcceptingOrders ? styles.activePillOpen : styles.activePillPaused,
              ]}
            >
              <View
                style={[
                  styles.liveIndicator,
                  activeOutlet?.isAcceptingOrders ? styles.indicatorOpen : styles.indicatorPaused,
                ]}
              />
              <Text
                style={[
                  styles.activePillText,
                  activeOutlet?.isAcceptingOrders ? styles.pillTextOpen : styles.pillTextPaused,
                ]}
              >
                {activeOutlet?.isAcceptingOrders ? 'Accepting Orders' : 'Kitchen Paused'}
              </Text>
            </View>
          </View>

          <View style={styles.surfaceCard}>
            <View style={styles.outletHeaderRow}>
              <View style={styles.outletIconBox}>
                <Ionicons name="storefront" size={22} color={colors.primary} />
              </View>
              <View style={styles.outletNameCol}>
                <Text style={styles.outletTitle}>
                  {activeOutlet?.name || 'No Operating Outlet Selected'}
                </Text>
                <Text style={styles.outletBrand}>
                  {activeOutlet?.restaurantName || staffUser?.restaurantName}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.outletDetailRow}>
              <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.outletAddress} numberOfLines={2}>
                {activeOutlet?.address || 'Address not configured'}
              </Text>
            </View>

            <View style={styles.outletDetailRow}>
              <Ionicons name="call-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.outletPhone}>
                {activeOutlet?.phone || 'No contact phone'}
              </Text>
            </View>

            <View style={styles.outletStatsRow}>
              <View style={styles.statChip}>
                <Text style={styles.statChipLabel}>DELIVERY RADIUS</Text>
                <Text style={styles.statChipVal}>{activeOutlet?.deliveryRadiusKm || 5} km</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statChipLabel}>ROLE / DESIGNATION</Text>
                <Text style={styles.statChipVal}>
                  {(activeOutlet?.designation || staffUser?.designation || 'Staff').toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 3. Switch Operating Kitchen Action */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AUTHORIZED OUTLETS</Text>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={onNavigateToOutlets}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Switch operating kitchen"
          >
            <View style={styles.actionLeft}>
              <View style={styles.iconSquare}>
                <Ionicons name="git-network-outline" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.actionTitle}>Switch Operating Kitchen</Text>
                <Text style={styles.actionSubtitle}>
                  You have access to {outlets.length} {outlets.length === 1 ? 'outlet terminal' : 'outlet terminals'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* 4. Operational Capabilities & Permissions Matrix */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>OPERATIONAL CAPABILITIES</Text>
          <View style={styles.surfaceCard}>
            <View style={styles.permRow}>
              <View style={styles.permLabelCol}>
                <Text style={styles.permLabel}>Live Orders & Cooking Flow</Text>
                <Text style={styles.permSub}>Accept, advance to cooking, and mark ready for pickup</Text>
              </View>
              <Ionicons
                name={permissions.canUpdateKitchenStatus ? 'checkmark-circle' : 'close-circle'}
                size={22}
                color={permissions.canUpdateKitchenStatus ? colors.ready : colors.textMuted}
              />
            </View>

            <View style={styles.permRow}>
              <View style={styles.permLabelCol}>
                <Text style={styles.permLabel}>Stock Availability Toggling</Text>
                <Text style={styles.permSub}>Toggle dishes in-stock or out-of-stock</Text>
              </View>
              <Ionicons
                name={permissions.canToggleItemAvailability ? 'checkmark-circle' : 'close-circle'}
                size={22}
                color={permissions.canToggleItemAvailability ? colors.ready : colors.textMuted}
              />
            </View>

            <View style={styles.permRow}>
              <View style={styles.permLabelCol}>
                <Text style={styles.permLabel}>Menu Catalog Management</Text>
                <Text style={styles.permSub}>Add dishes, categories and update base prices</Text>
              </View>
              <Ionicons
                name={permissions.canManageMenu ? 'checkmark-circle' : 'close-circle'}
                size={22}
                color={permissions.canManageMenu ? colors.ready : colors.textMuted}
              />
            </View>

            <View style={styles.permRow}>
              <View style={styles.permLabelCol}>
                <Text style={styles.permLabel}>Outlet Settings & Hours</Text>
                <Text style={styles.permSub}>Modify operating schedule and delivery radius</Text>
              </View>
              <Ionicons
                name={permissions.canManageOutletInfo ? 'checkmark-circle' : 'close-circle'}
                size={22}
                color={permissions.canManageOutletInfo ? colors.ready : colors.textMuted}
              />
            </View>

            <View style={[styles.permRow, { borderBottomWidth: 0 }]}>
              <View style={styles.permLabelCol}>
                <Text style={styles.permLabel}>Financial Settlements</Text>
                <Text style={styles.permSub}>View daily revenue, payouts and deductions</Text>
              </View>
              <Ionicons
                name={permissions.canViewFinancials ? 'checkmark-circle' : 'close-circle'}
                size={22}
                color={permissions.canViewFinancials ? colors.ready : colors.textMuted}
              />
            </View>
          </View>
        </View>

        {/* 5. Terminal Environment Diagnostics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TERMINAL STATUS & SECURITY</Text>
          <View style={styles.surfaceCard}>
            <View style={styles.diagRow}>
              <Text style={styles.diagLabel}>Session Authentication</Text>
              <Text style={[styles.diagVal, { color: colors.online }]}>JWT with Auto-Refresh</Text>
            </View>
            <View style={styles.diagRow}>
              <Text style={styles.diagLabel}>Socket Synchronization</Text>
              <Text style={[styles.diagVal, { color: colors.online }]}>Bi-directional WebSocket</Text>
            </View>
            <View style={[styles.diagRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.diagLabel}>Terminal Application</Text>
              <Text style={styles.diagVal}>Fleet24 Kitchen OS (v1.0.0)</Text>
            </View>
          </View>
        </View>

        {/* 6. Logout CTA Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Log out of kitchen terminal"
        >
          <Ionicons name="log-out-outline" size={20} color={colors.rejected} />
          <Text style={styles.logoutText}>Log Out of Kitchen Terminal</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
  },
  mainWrapper: {
    width: '100%',
    alignSelf: 'center',
  },
  wideWrapper: {
    maxWidth: 800,
  },
  headerCard: {
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDark,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.limeAccent,
  },
  avatarInitials: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.limeAccent,
  },
  activeDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.online,
    borderWidth: 2.5,
    borderColor: colors.surfaceDark,
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textWhite,
    marginTop: spacing.xs,
  },
  restaurantBrandName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.limeAccent,
    marginTop: 2,
  },
  userPhone: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  designationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    marginTop: spacing.md,
  },
  designationText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  activePillOpen: {
    backgroundColor: colors.surfaceGreen,
    borderColor: 'rgba(5, 150, 105, 0.3)',
  },
  activePillPaused: {
    backgroundColor: colors.pendingLight,
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  indicatorOpen: {
    backgroundColor: colors.online,
  },
  indicatorPaused: {
    backgroundColor: colors.pending,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  pillTextOpen: {
    color: colors.readyDark,
  },
  pillTextPaused: {
    color: colors.pendingDark,
  },
  surfaceCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  outletHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  outletIconBox: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  outletNameCol: {
    flex: 1,
  },
  outletTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  outletBrand: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },
  outletDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xs + 2,
  },
  outletAddress: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  outletPhone: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  outletStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statChip: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  statChipLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  statChipVal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: spacing.md + 2,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: minTouchTarget,
    ...shadows.card,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconSquare: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  actionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.md,
  },
  permLabelCol: {
    flex: 1,
  },
  permLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  permSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  diagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  diagLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  diagVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.rejectedLight,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    minHeight: minTouchTarget,
    marginTop: spacing.md,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.rejectedDark,
  },
});
