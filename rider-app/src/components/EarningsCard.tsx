import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../theme/tokens';
import { RiderEarningsSummary } from '../api/riderApi';
import { appStyles } from '../theme/appStyles';

interface EarningsCardProps {
  summary: RiderEarningsSummary | null;
  onViewDetails?: () => void;
}

export const EarningsCard: React.FC<EarningsCardProps> = ({ summary, onViewDetails }) => {
  const availableBal = summary?.availableBalance ? Number(summary.availableBalance).toFixed(2) : '0.00';
  const totalEarned = summary?.totalEarned ? Number(summary.totalEarned).toFixed(2) : '0.00';
  const lifetimeCompleted = summary?.lifetimeCompletedDeliveries || 0;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.label}>TODAY & AVAILABLE BALANCE</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currencySymbol}>₹</Text>
            <Text style={styles.amountText}>{availableBal}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.detailsButton}
          onPress={onViewDetails}
          activeOpacity={0.7}
        >
          <Text style={styles.detailsButtonText}>Pockets</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{lifetimeCompleted}</Text>
          <Text style={styles.statLabel}>Completed Trips</Text>
        </View>

        <View style={styles.statSeparator} />

        <View style={styles.statItem}>
          <Text style={styles.statValue}>₹{totalEarned}</Text>
          <Text style={styles.statLabel}>Lifetime Earned</Text>
        </View>

        <View style={styles.statSeparator} />

        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.online }]}>100%</Text>
          <Text style={styles.statLabel}>Pay Guaranteed</Text>
        </View>
      </View>
    </View>
  );
};

const styles = appStyles({
  container: {
    backgroundColor: colors.surface,
    // The home scroll view already pads the sides; a margin here inset this card more than its neighbours.
    marginBottom: spacing.sm,
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginRight: 2,
  },
  amountText: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  detailsButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 2,
  },
  statSeparator: {
    width: 1,
    height: 24,
    backgroundColor: colors.borderLight,
  },
});

