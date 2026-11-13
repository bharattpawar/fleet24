import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/tokens';
import { useRestaurantAuth } from '../context/RestaurantAuthContext';

interface KitchenHeaderProps {
  onOutletPress?: () => void;
}

export const KitchenHeader: React.FC<KitchenHeaderProps> = ({ onOutletPress }) => {
  const { activeOutlet, toggleOrderAcceptance, permissions } = useRestaurantAuth();

  const isAccepting = activeOutlet?.isAcceptingOrders ?? false;
  const isOutletActive = activeOutlet?.isActive ?? false;
  const hasOutlet = Boolean(activeOutlet);

  const canToggle = permissions.canToggleOrderAcceptance && hasOutlet && isOutletActive;

  return (
    <View style={styles.container}>
      <View style={styles.innerRow}>
        {/* Outlet Selector Pill with Expanded Width */}
        <TouchableOpacity
          style={styles.outletSelector}
          onPress={onOutletPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Active outlet: ${activeOutlet?.name || 'Select Outlet'}`}
        >
          <View style={styles.storeIconWrapper}>
            <Ionicons name="storefront" size={16} color={colors.limeAccent} />
          </View>
          <View style={styles.outletTextContainer}>
            <Text style={styles.brandTitle} numberOfLines={1}>
              {activeOutlet?.restaurantName || 'Fleet24 Kitchen'}
            </Text>
            <View style={styles.outletSubRow}>
              <Text style={styles.outletName} numberOfLines={1}>
                {activeOutlet?.name || 'Select Outlet'}
              </Text>
              <Ionicons name="chevron-down" size={12} color={colors.limeAccent} />
            </View>
          </View>
        </TouchableOpacity>

        {/* Compact, Space-Efficient Order Acceptance Toggle */}
        <View
          style={[
            styles.statusToggle,
            !hasOutlet || !isOutletActive
              ? styles.toggleInactive
              : isAccepting
              ? styles.toggleOnline
              : styles.toggleOffline,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              !hasOutlet || !isOutletActive
                ? styles.dotInactive
                : isAccepting
                ? styles.dotOnline
                : styles.dotOffline,
            ]}
          />
          <Text
            style={[
              styles.statusLabel,
              !hasOutlet || !isOutletActive
                ? styles.labelInactive
                : isAccepting
                ? styles.labelOnline
                : styles.labelOffline,
            ]}
          >
            {!hasOutlet
              ? 'NO OUTLET'
              : !isOutletActive
              ? 'INACTIVE'
              : isAccepting
              ? 'ONLINE'
              : 'PAUSED'}
          </Text>

          <Switch
            value={isAccepting && isOutletActive && hasOutlet}
            disabled={!canToggle}
            onValueChange={(val) => toggleOrderAcceptance(val)}
            trackColor={{ false: '#4B5563', true: colors.online }}
            thumbColor={colors.textWhite}
            ios_backgroundColor="#4B5563"
            style={styles.switch}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceDark,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  outletSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: spacing.sm,
    minHeight: 44,
  },
  storeIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: 'rgba(217, 240, 120, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outletTextContainer: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textWhite,
    letterSpacing: 0.2,
  },
  outletSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  outletName: {
    fontSize: 11,
    color: colors.limeAccent,
    fontWeight: '700',
    flexShrink: 1,
  },
  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingLeft: spacing.sm,
    paddingRight: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: 4,
    minHeight: 38,
  },
  toggleOnline: {
    backgroundColor: 'rgba(5, 150, 105, 0.18)',
    borderColor: 'rgba(5, 150, 105, 0.45)',
  },
  toggleOffline: {
    backgroundColor: 'rgba(217, 119, 6, 0.16)',
    borderColor: 'rgba(217, 119, 6, 0.4)',
  },
  toggleInactive: {
    backgroundColor: 'rgba(156, 163, 175, 0.12)',
    borderColor: 'rgba(156, 163, 175, 0.25)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotOnline: {
    backgroundColor: colors.limeAccent,
  },
  dotOffline: {
    backgroundColor: '#F59E0B',
  },
  dotInactive: {
    backgroundColor: '#9CA3AF',
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  labelOnline: {
    color: colors.limeAccent,
  },
  labelOffline: {
    color: '#F59E0B',
  },
  labelInactive: {
    color: '#9CA3AF',
  },
  switch: {
    transform: [{ scaleX: 0.72 }, { scaleY: 0.72 }],
  },
});
