import { appStyles } from '../theme/appStyles';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/tokens';
import { DeliveryOfferItem, riderApi } from '../api/riderApi';

interface DeliveryOfferCardProps {
  offer: DeliveryOfferItem;
  onAccepted: (orderId: string) => void;
  onRejected: (orderId: string) => void;
}

export const DeliveryOfferCard: React.FC<DeliveryOfferCardProps> = ({
  offer,
  onAccepted,
  onRejected,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(
      0,
      Math.floor((new Date(offer.offerExpiresAt).getTime() - Date.now()) / 1000),
    ),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(offer.offerExpiresAt).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        onRejected(offer.orderId); // Auto-expire trigger
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [offer.offerExpiresAt, offer.orderId, onRejected]);

  const handleAccept = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await riderApi.acceptOffer(offer.orderId);
      onAccepted(offer.orderId);
    } catch (err: any) {
      Alert.alert('Offer Unavailable', err.message || 'Offer may have expired or been reassigned.');
      onRejected(offer.orderId);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await riderApi.rejectOffer(offer.orderId, 'Rider manually declined offer');
      onRejected(offer.orderId);
    } catch (err: any) {
      onRejected(offer.orderId);
    } finally {
      setIsSubmitting(false);
    }
  };

  const distanceKm = (offer.distanceMeters / 1000).toFixed(1);

  return (
    <View style={styles.card}>
      {/* Header with 60s Countdown Bar */}
      <View style={styles.headerRow}>
        <View style={styles.newOfferBadge}>
          <Ionicons name="flash" size={12} color="#FFFFFF" />
          <Text style={styles.newOfferBadgeText}>NEW DELIVERY OFFER</Text>
        </View>

        <View style={[styles.timerBadge, secondsLeft <= 15 && styles.timerBadgeUrgent]}>
          <Ionicons
            name="time-outline"
            size={13}
            color={secondsLeft <= 15 ? colors.error : colors.primary}
          />
          <Text style={[styles.timerText, secondsLeft <= 15 && styles.timerTextUrgent]}>
            {secondsLeft}s
          </Text>
        </View>
      </View>

      {/* Restaurant Pickup Info */}
      <View style={styles.infoSection}>
        <View style={styles.iconCircle}>
          <Ionicons name="restaurant" size={18} color={colors.primary} />
        </View>
        <View style={styles.infoCol}>
          <Text style={styles.restaurantName}>{offer.outlet.name}</Text>
          <Text style={styles.addressText} numberOfLines={2}>
            {offer.outlet.address}
          </Text>
        </View>
      </View>

      {/* Distance and Order Items metadata */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="navigate-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText}>{distanceKm} km to pickup</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="bag-handle-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText}>
            {offer.items.length} {offer.items.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
      </View>

      {/* Action Buttons: Large touch target for riders on the road */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.rejectBtn}
          onPress={handleReject}
          disabled={isSubmitting}
          activeOpacity={0.7}
        >
          <Text style={styles.rejectBtnText}>Decline</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={handleAccept}
          disabled={isSubmitting || secondsLeft <= 0}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.acceptBtnText}>Accept Delivery</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = appStyles({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginVertical: spacing.sm,
    borderWidth: 1.5,
    borderColor: '#CDE3D3',
    shadowColor: colors.cardShadowMedium,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  newOfferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  newOfferBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  timerBadgeUrgent: {
    backgroundColor: '#FDECEB',
  },
  timerText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  timerTextUrgent: {
    color: colors.error,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  addressText: {
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderLight,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  rejectBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  acceptBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  acceptBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});

