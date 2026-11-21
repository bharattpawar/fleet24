import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/tokens';
import { useRestaurantAuth } from '../context/RestaurantAuthContext';
import { appStyles } from '../theme/appStyles';

interface KitchenHeaderProps {
  kitchen?: boolean;
  onOutletPress?: () => void;
  /** Kitchen only: live status chips (connection, sync, alerts) shown under the controls. */
  children?: React.ReactNode;
}

export const KitchenHeader: React.FC<KitchenHeaderProps> = ({ kitchen, onOutletPress, children }) => {
  const { activeOutlet, toggleOrderAcceptance, permissions } = useRestaurantAuth();

  const { width } = useWindowDimensions();
  const stacked = width < 650;
  const isAccepting = activeOutlet?.isAcceptingOrders ?? false;
  const isOutletActive = activeOutlet?.isActive ?? false;
  const hasOutlet = Boolean(activeOutlet);

  const canToggle = permissions.canToggleOrderAcceptance && hasOutlet && isOutletActive;

  const intakeLabel = !hasOutlet ? 'Select an outlet' : !isOutletActive ? 'Outlet inactive' : isAccepting ? 'Accepting orders' : 'Paused';
  const intakeHint = !hasOutlet ? 'Choose a kitchen to start' : !isOutletActive ? 'Ask an admin to activate it' : isAccepting ? 'Customers can order now' : 'Customers cannot order';
  const intakeTone = !hasOutlet || !isOutletActive ? styles.intakeMuted : isAccepting ? styles.intakeOn : styles.intakePaused;

  if (kitchen) {
    return (
      <View style={styles.kitchenBlock}>
        <View style={styles.kitchenInner}>
          <View style={[styles.kitchenTop, stacked && styles.stacked]}>
            <TouchableOpacity
              style={[styles.darkSelector, stacked && styles.fullWidth]}
              onPress={onOutletPress}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Active outlet: ${activeOutlet?.name || 'Select Outlet'}. Change outlet`}
            >
              <View style={styles.darkStoreIcon}><Ionicons name="storefront" size={18} color={colors.limeAccent} /></View>
              <View style={styles.outletTextContainer}>
                <Text accessibilityRole="header" style={[styles.kitchenTitle, width >= 1000 && styles.kitchenTitleWide]} numberOfLines={1}>
                  {activeOutlet?.restaurantName || 'Fleet24 Kitchen'}
                </Text>
                <View style={styles.outletSubRow}>
                  <Text style={styles.darkOutletName} numberOfLines={1}>{activeOutlet?.name || 'Select outlet'}</Text>
                  <Ionicons name="chevron-down" size={13} color="#CFE0D6" />
                </View>
              </View>
            </TouchableOpacity>

            <View style={[styles.intake, intakeTone, stacked && styles.fullWidth]}>
              <View style={styles.intakeCopy}>
                <Text style={[styles.intakeTitle, isAccepting && isOutletActive && styles.intakeTitleOn, (!hasOutlet || !isOutletActive) && styles.intakeTextMuted]}>{intakeLabel}</Text>
                <Text style={[styles.intakeHint, isAccepting && isOutletActive && styles.intakeHintOn, (!hasOutlet || !isOutletActive) && styles.intakeTextMuted]}>{intakeHint}</Text>
              </View>
              <Switch
                accessibilityLabel="Accepting orders"
                value={isAccepting && isOutletActive}
                disabled={!canToggle}
                onValueChange={(value) => toggleOrderAcceptance(value)}
                trackColor={{ false: '#7C8A82', true: colors.primary }}
                thumbColor={colors.textWhite}
              />
            </View>
          </View>
          {children}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.innerRow, stacked && styles.stacked]}>
        <TouchableOpacity
          style={[styles.outletSelector, stacked && styles.fullWidth]}
          onPress={onOutletPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Active outlet: ${activeOutlet?.name || 'Select Outlet'}`}
        >
          <View style={styles.storeIconWrapper}>
            <Ionicons name="storefront" size={16} color={colors.primary} />
          </View>
          <View style={styles.outletTextContainer}>
            <Text style={styles.brandTitle} numberOfLines={2}>
              {activeOutlet?.restaurantName || 'Fleet24 Kitchen'}
            </Text>
            <View style={styles.outletSubRow}>
              <Text style={styles.outletName} numberOfLines={1}>
                {activeOutlet?.name || 'Select Outlet'}
              </Text>
              <Ionicons name="chevron-down" size={12} color={colors.primary} />
            </View>
          </View>
        </TouchableOpacity>

        <View style={[styles.statusToggle, stacked && styles.fullWidth, stacked && styles.intakeRow]}>
          <View style={styles.intakeText}>
            <Text style={styles.statusLabel}>Accepting orders</Text>
            <Text style={[styles.intakeState, isAccepting && isOutletActive && { color: colors.online, fontWeight: '700' }]}>
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

const styles = appStyles({
  // Kitchen: dark operations block (same header language as the customer app's ScreenHeader)
  kitchenBlock: {
    backgroundColor: colors.surfaceDark,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  kitchenInner: { width: '100%', maxWidth: 1600, alignSelf: 'center', gap: 12 },
  kitchenTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  darkSelector: {
    flex: 1, minWidth: 0, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  darkStoreIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(217,240,120,0.14)', alignItems: 'center', justifyContent: 'center' },
  kitchenTitle: { color: '#FFFFFF', fontSize: 19, lineHeight: 24, fontWeight: '800', letterSpacing: -0.4 },
  kitchenTitleWide: { fontSize: 22, lineHeight: 28 },
  darkOutletName: { color: '#CFE0D6', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  intake: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14, paddingRight: 10, borderRadius: 18 },
  intakeOn: { backgroundColor: colors.limeAccent },
  intakePaused: { backgroundColor: '#FFE7C2' },
  intakeMuted: { backgroundColor: 'rgba(255,255,255,0.12)' },
  intakeCopy: { flex: 1, minWidth: 0 },
  intakeTitle: { color: '#3D2A0B', fontSize: 15, fontWeight: '800' },
  intakeTitleOn: { color: colors.surfaceDark },
  intakeHint: { color: '#6B4E1F', fontSize: 12, marginTop: 1 },
  intakeHintOn: { color: '#3E5A2B' },
  intakeTextMuted: { color: '#E4EEE8' },
  stacked: { flexDirection: 'column', alignItems: 'stretch', gap: 8 },
  fullWidth: { width: '100%', maxWidth: '100%', flex: 0 },
  intakeRow: { justifyContent: 'space-between' },

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
