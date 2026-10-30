import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { colors, borderRadius, spacing, typography } from '../theme/tokens';
import { Ionicons } from '@expo/vector-icons';

export interface OutletSummary {
  id: string;
  restaurantName: string;
  outletName: string;
  slug: string;
  logoUrl: string | null;
  address: string;
  deliveryRadiusKm: string;
  isAcceptingOrders: boolean;
}

interface RestaurantCardProps {
  outlet: OutletSummary;
  onPress: () => void;
}

export const RestaurantCard: React.FC<RestaurantCardProps> = ({ outlet, onPress }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[styles.card, !outlet.isAcceptingOrders && styles.cardDisabled]}
    >
      <View style={styles.imageContainer}>
        {outlet.logoUrl ? (
          <Image source={{ uri: outlet.logoUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="restaurant-outline" size={32} color={colors.textSecondary} />
          </View>
        )}
        
        {/* Floating Status Pill over image */}
        <View style={styles.imageBadgeContainer}>
          <View
            style={[
              styles.floatingStatusBadge,
              outlet.isAcceptingOrders ? styles.badgeOpen : styles.badgeClosed,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                outlet.isAcceptingOrders ? styles.dotOpen : styles.dotClosed,
              ]}
            />
            <Text
              style={[
                styles.floatingStatusText,
                outlet.isAcceptingOrders ? styles.textOpen : styles.textClosed,
              ]}
            >
              {outlet.isAcceptingOrders ? 'Open Now' : 'Closed'}
            </Text>
          </View>
        </View>

        {!outlet.isAcceptingOrders && (
          <View style={styles.closedOverlay}>
            <Text style={styles.closedText}>Currently Closed</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.restaurantName} numberOfLines={1}>
            {outlet.restaurantName}
          </Text>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={11} color="#FFFFFF" />
            <Text style={styles.ratingText}>4.7</Text>
          </View>
        </View>

        <Text style={styles.outletAddress} numberOfLines={1}>
          {outlet.outletName} • {outlet.address}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.deliveryBadge}>
            <Ionicons name="bicycle-outline" size={13} color={colors.primary} />
            <Text style={styles.deliveryText}>Up to {outlet.deliveryRadiusKm} km</Text>
          </View>

          <View style={styles.locationTag}>
            <Ionicons name="navigate-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.locationText}>Greater Noida</Text>
          </View>

          <View style={styles.timeTag}>
            <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.locationText}>25-35 min</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    shadowColor: colors.cardShadowMedium,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  cardDisabled: {
    opacity: 0.85,
  },
  imageContainer: {
    width: '100%',
    height: 175,
    position: 'relative',
    backgroundColor: colors.borderLight,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageBadgeContainer: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    zIndex: 2,
  },
  floatingStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: borderRadius.full,
    gap: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  badgeOpen: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
  },
  badgeClosed: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotOpen: {
    backgroundColor: colors.success,
  },
  dotClosed: {
    backgroundColor: colors.error,
  },
  floatingStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textOpen: {
    color: colors.primary,
  },
  textClosed: {
    color: colors.error,
  },
  closedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(23, 33, 27, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  content: {
    padding: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  restaurantName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    gap: 3,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  outletAddress: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  deliveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceGreen,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: borderRadius.full,
    gap: 5,
  },
  deliveryText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
