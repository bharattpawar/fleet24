import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/tokens';
import { DeliveryOfferItem } from '../api/riderApi';
import { addressDetail, addressTitle } from '../utils/address';

interface IncomingOfferSheetProps {
  offer: DeliveryOfferItem;
  onAccept: () => void;
  onReject: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const IncomingOfferSheet: React.FC<IncomingOfferSheetProps> = ({
  offer,
  onAccept,
  onReject,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    if (offer.offerExpiresAt) {
      const diff = Math.floor((new Date(offer.offerExpiresAt).getTime() - Date.now()) / 1000);
      return Math.max(0, diff);
    }
    return offer.secondsRemaining || 45;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const progressAnim = useRef(new Animated.Value(1)).current;

  // Countdown timer
  useEffect(() => {
    const initialRemaining = Math.max(1, secondsRemaining);

    Animated.timing(progressAnim, {
      toValue: 0,
      duration: initialRemaining * 1000,
      useNativeDriver: false,
    }).start();

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onReject();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const distanceKm =
    offer.distanceKm !== undefined && offer.distanceKm !== null
      ? String(offer.distanceKm)
      : offer.distanceMeters
      ? (offer.distanceMeters / 1000).toFixed(1)
      : '1.2';

  const estimatedEarnings = offer.estimatedEarnings || '45';

  const handleAccept = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    await onAccept();
  };

  const handleReject = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    await onReject();
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.sheetContainer}>
        {/* Progress Countdown Bar */}
        <View style={styles.progressBarBackground}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        {/* Top Header Badge */}
        <View style={styles.headerRow}>
          <View style={styles.offerBadge}>
            <Ionicons name="flash" size={14} color={colors.accent} />
            <Text style={styles.offerBadgeText}>NEW DELIVERY OFFER</Text>
          </View>
          <View style={styles.countdownBadge}>
            <Ionicons name="time-outline" size={14} color={colors.textWhite} />
            <Text style={styles.countdownText}>{secondsRemaining}s</Text>
          </View>
        </View>

        {/* Earning & Distance Callout */}
        <View style={styles.highlightCard}>
          <View>
            <Text style={styles.highlightLabel}>ESTIMATED PAY</Text>
            <Text style={styles.highlightPay}>₹{estimatedEarnings}</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View>
            <Text style={styles.highlightLabel}>TOTAL DISTANCE</Text>
            <Text style={styles.highlightDistance}>{distanceKm} km</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View>
            <Text style={styles.highlightLabel}>ORDER</Text>
            <Text style={styles.highlightOrder}>#{offer.orderNumber || 'FLEET'}</Text>
          </View>
        </View>

        {/* Pickup & Drop Details */}
        <View style={styles.detailsList}>
          {/* Pickup */}
          <View style={styles.locationItem}>
            <View style={styles.pickupDot}>
              <Ionicons name="restaurant" size={14} color={colors.textWhite} />
            </View>
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationType}>PICKUP RESTAURANT</Text>
              <Text style={styles.locationName} numberOfLines={1}>
                {offer.outlet?.name || (offer as any).outletName || 'Restaurant Partner'}
              </Text>
              {offer.outlet?.address || (offer as any).outletAddress ? (
                <Text style={styles.locationAddress} numberOfLines={1}>
                  {offer.outlet?.address || (offer as any).outletAddress}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Dotted connector */}
          <View style={styles.pathConnector} />

          {/* Drop */}
          <View style={styles.locationItem}>
            <View style={styles.dropDot}>
              <Ionicons name="location" size={14} color={colors.textWhite} />
            </View>
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationType}>CUSTOMER DROPOFF</Text>
              <Text style={styles.locationName} numberOfLines={1}>
                {addressTitle(offer.deliveryAddress, offer.deliveryAddress?.label || 'Customer address')}
              </Text>
              {addressDetail(offer.deliveryAddress) ? (
                <Text style={styles.locationAddress} numberOfLines={1}>
                  {addressDetail(offer.deliveryAddress)}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Order Items Preview */}
        {offer.items && offer.items.length > 0 && (
          <View style={styles.itemsBadge}>
            <Ionicons name="bag-check-outline" size={14} color={colors.primary} />
            <Text style={styles.itemsBadgeText}>
              {offer.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.declineButton}
            onPress={handleReject}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={18} color={colors.error} />
            <Text style={styles.declineButtonText}>DECLINE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.acceptButton}
            onPress={handleAccept}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-sharp" size={20} color={colors.textWhite} />
            <Text style={styles.acceptButtonText}>ACCEPT OFFER</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
    zIndex: 999,
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 10,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: 2,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  offerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.xs,
  },
  offerBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accentDark,
    letterSpacing: 0.5,
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textWhite,
  },
  highlightCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceGreen,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  verticalDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(40, 84, 63, 0.15)',
  },
  highlightLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  highlightPay: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary,
  },
  highlightDistance: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  highlightOrder: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  detailsList: {
    marginVertical: spacing.xs,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  pickupDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pathConnector: {
    width: 2,
    height: 18,
    backgroundColor: colors.border,
    marginLeft: 13,
    marginVertical: 2,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationType: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  locationName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  locationAddress: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  itemsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    marginVertical: spacing.md,
  },
  itemsBadgeText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  declineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 52,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.error,
    backgroundColor: colors.surface,
  },
  declineButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.error,
  },
  acceptButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textWhite,
    letterSpacing: 0.4,
  },
});

