import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/tokens';
import { useRestaurantAuth } from '../context/RestaurantAuthContext';

interface KitchenHeaderProps {
  kitchen?: boolean;
  onOutletPress?: () => void;
}

export const KitchenHeader: React.FC<KitchenHeaderProps> = ({ kitchen, onOutletPress }) => {
  const { activeOutlet, toggleOrderAcceptance, permissions } = useRestaurantAuth();

  const { width } = useWindowDimensions();
  const stacked = width < 650;
  const isAccepting = activeOutlet?.isAcceptingOrders ?? false;
  const isOutletActive = activeOutlet?.isActive ?? false;
  const hasOutlet = Boolean(activeOutlet);

  const canToggle = permissions.canToggleOrderAcceptance && hasOutlet && isOutletActive;

  return (
    <View style={[styles.container, kitchen && styles.kitchen]}>
      {kitchen && <Text accessibilityRole="header" style={[styles.heading, width >= 1000 && styles.headingWide]}>Kitchen orders</Text>}
      <View style={[styles.innerRow, stacked && styles.stacked, kitchen && styles.kitchenRow]}>
        {/* Outlet Selector Pill with Expanded Width */}
        <TouchableOpacity
          style={[styles.outletSelector, kitchen && styles.lightSelector, stacked && styles.fullWidth]}
          onPress={onOutletPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Active outlet: ${activeOutlet?.name || 'Select Outlet'}`}
        >
          <View style={!kitchen && styles.storeIconWrapper}>
            <Ionicons name="storefront" size={16} color={colors.primary} />
          </View>
          <View style={styles.outletTextContainer}>
            <Text style={[styles.brandTitle, kitchen && styles.lightBrand]} numberOfLines={2}>
              {activeOutlet?.restaurantName || 'Fleet24 Kitchen'}
            </Text>
            <View style={styles.outletSubRow}>
              <Text style={[styles.outletName, kitchen && styles.lightOutlet]} numberOfLines={1}>
                {activeOutlet?.name || 'Select Outlet'}
              </Text>
              <Ionicons name="chevron-down" size={12} color={colors.primary} />
            </View>
          </View>
        </TouchableOpacity>

        <View style={[styles.statusToggle, stacked && styles.fullWidth, stacked && styles.intakeRow]}>
          <View style={styles.intakeText}>
            <Text style={[styles.statusLabel, kitchen && styles.lightBrand]}>Accepting orders</Text>
            <Text style={[styles.intakeState, kitchen && styles.lightOutlet]}>
              {!hasOutlet ? 'Select an outlet' : !isOutletActive ? 'Outlet inactive' : isAccepting ? 'On' : 'Paused'}
            </Text>
          </View>
          <Switch
            accessibilityLabel="Accepting orders"
            value={isAccepting && isOutletActive}
            disabled={!canToggle}
            onValueChange={(value) => toggleOrderAcceptance(value)}
            trackColor={{ false: colors.textMuted, true: colors.online }}
            thumbColor={colors.textWhite}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  kitchen: { backgroundColor: '#FFFFFF', borderBottomWidth: 0, paddingHorizontal: 14 },
  heading: { fontSize: 28, fontWeight: '800', letterSpacing: -0.7, color: colors.textPrimary, marginBottom: 12 },
  headingWide: { fontSize: 32 },
  kitchenRow: { maxWidth: '100%' },
  stacked: { flexDirection: 'column', alignItems: 'stretch', gap: 4 },
  lightSelector: { backgroundColor: '#FFFFFF', borderColor: '#E2E5E3', maxWidth: 480 },
  fullWidth: { width: '100%', maxWidth: '100%', flex: 0 },
  intakeRow: { justifyContent: 'space-between' },
  lightBrand: { color: colors.textPrimary },
  lightOutlet: { color: colors.textSecondary },

  container: {
    backgroundColor: colors.surface,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    minHeight: 44,
  },
  storeIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surfaceGreen,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outletTextContainer: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  outletSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  outletName: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '700',
    flexShrink: 1,
  },
  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
  },
  intakeText: { gap: 2 },
  statusLabel: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
  intakeState: { color: colors.textSecondary, fontSize: 11 },
});
