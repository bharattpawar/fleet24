import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '../theme/tokens';
import { riderApi, RiderProfile, DeliveryOfferItem } from '../api/riderApi';
import { riderLocationService } from '../services/riderLocationService';
import { riderNotificationService } from '../services/riderNotificationService';
import { DeliveryOfferCard } from '../components/DeliveryOfferCard';
import { ActiveDeliveryView, ActiveDeliveryData } from '../components/ActiveDeliveryView';

interface RiderDashboardScreenProps {
  onBackToCustomerMode: () => void;
}

export const RiderDashboardScreen: React.FC<RiderDashboardScreenProps> = ({
  onBackToCustomerMode,
}) => {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [offers, setOffers] = useState<DeliveryOfferItem[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<ActiveDeliveryData | null>(null);

  // 1. Initial Profile & Status Fetch
  const loadRiderData = useCallback(async () => {
    try {
      const p = await riderApi.getProfile();
      setProfile(p);
      setIsOnline(p.availabilityStatus === 'available' || p.availabilityStatus === 'busy');

      if (p.verificationStatus === 'approved' && !p.isSuspended) {
        // Register push token
        riderNotificationService.registerForPushNotifications().catch(() => {});

        // Fetch offers if online
        if (p.availabilityStatus === 'available') {
          const incomingOffers = await riderApi.getOffers();
          setOffers(incomingOffers);
        }
      }
    } catch (err: any) {
      Alert.alert('Rider Profile', err.message || 'Could not load rider profile.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadRiderData());
  }, [loadRiderData]);

  // Periodic poll for offers when online and available
  useEffect(() => {
    if (!isOnline || activeDelivery) return;

    const interval = setInterval(async () => {
      try {
        const incoming = await riderApi.getOffers();
        setOffers(incoming);
      } catch {
        // Silent poll error
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isOnline, activeDelivery]);

  // Toggle Online / Offline Availability
  const handleToggleAvailability = async (value: boolean) => {
    if (!profile) return;

    if (profile.verificationStatus !== 'approved') {
      Alert.alert(
        'Approval Pending',
        'Your rider profile is currently pending verification. You can go online once verified by administrators.',
      );
      return;
    }

    if (profile.isSuspended) {
      Alert.alert(
        'Account Suspended',
        `Your rider account is suspended: ${profile.suspensionReason || 'Contact support.'}`,
      );
      return;
    }

    setIsTogglingStatus(true);
    try {
      const targetStatus = value ? 'available' : 'offline';
      await riderApi.setAvailability(targetStatus);
      setIsOnline(value);

      if (value) {
        // Start live GPS tracking (foreground and background)
        const started = await riderLocationService.startTracking();
        if (!started) {
          Alert.alert(
            'Location Permission Required',
            'Fleet24 requires location access to assign and track food deliveries.',
          );
        }
        const incoming = await riderApi.getOffers();
        setOffers(incoming);
      } else {
        await riderLocationService.stopTracking();
        setOffers([]);
      }
    } catch (err: any) {
      Alert.alert('Status Error', err.message || 'Could not update availability.');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadRiderData();
  };

  // Handle Offer Acceptance
  const handleOfferAccepted = (orderId: string) => {
    const acceptedOffer = offers.find((o) => o.orderId === orderId);
    setOffers([]); // Clear other offers

    if (acceptedOffer) {
      setActiveDelivery({
        orderId: acceptedOffer.orderId,
        deliveryId: acceptedOffer.deliveryId,
        orderNumber: acceptedOffer.orderNumber,
        status: 'accepted',
        restaurant: {
          name: acceptedOffer.outlet.name,
          address: acceptedOffer.outlet.address,
          phone: acceptedOffer.outlet.phone,
          latitude: acceptedOffer.outlet.latitude,
          longitude: acceptedOffer.outlet.longitude,
        },
        customer: {
          name: acceptedOffer.deliveryAddress?.contactName || 'Customer',
          address: acceptedOffer.deliveryAddress?.addressLine || 'Customer Address',
          phone: acceptedOffer.deliveryAddress?.contactPhone,
        },
        items: acceptedOffer.items,
      });
    }
  };

  const handleOfferRejected = (orderId: string) => {
    setOffers((prev) => prev.filter((o) => o.orderId !== orderId));
  };

  const handleDeliveryFinished = (status: string) => {
    if (status === 'completed') {
      setActiveDelivery(null);
      loadRiderData();
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading rider profile...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 1. Header with Mode Switch */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Fleet24 Rider Ops</Text>
          <Text style={styles.headerSubtitle}>{profile?.fullName || 'Partner'}</Text>
        </View>

        <TouchableOpacity
          style={styles.customerModeBtn}
          onPress={onBackToCustomerMode}
          activeOpacity={0.7}
        >
          <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
          <Text style={styles.customerModeBtnText}>Customer App</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        {/* 2. Verification / Account Status Alert */}
        {profile?.verificationStatus === 'pending' && (
          <View style={styles.warningCard}>
            <Ionicons name="time" size={20} color={colors.accent} />
            <View style={styles.warningTextCol}>
              <Text style={styles.warningTitle}>Verification in Progress</Text>
              <Text style={styles.warningDesc}>
                Your profile and vehicle documents are under review by Fleet24 fleet managers.
              </Text>
            </View>
          </View>
        )}

        {profile?.isSuspended && (
          <View style={[styles.warningCard, { backgroundColor: '#FDECEB', borderColor: colors.error }]}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <View style={styles.warningTextCol}>
              <Text style={[styles.warningTitle, { color: colors.error }]}>Account Suspended</Text>
              <Text style={styles.warningDesc}>{profile.suspensionReason || 'Contact support'}</Text>
            </View>
          </View>
        )}

        {/* 3. Availability & GPS Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusTextCol}>
              <View style={styles.statusIndicatorRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: isOnline ? '#2ECC71' : colors.textMuted },
                  ]}
                />
                <Text style={styles.statusHeadline}>
                  {isOnline ? "You're Online" : "You're Offline"}
                </Text>
              </View>
              <Text style={styles.statusSubtext}>
                {isOnline
                  ? 'Transmitting live GPS • Ready for offers'
                  : 'Go online to receive nearby delivery assignments'}
              </Text>
            </View>

            {isTogglingStatus ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Switch
                value={isOnline}
                onValueChange={handleToggleAvailability}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            )}
          </View>
        </View>

        {/* 4. Active Delivery Management (If on delivery) */}
        {activeDelivery ? (
          <View>
            <Text style={styles.sectionHeading}>Current Active Delivery</Text>
            <ActiveDeliveryView
              delivery={activeDelivery}
              onStatusChanged={handleDeliveryFinished}
            />
          </View>
        ) : (
          /* 5. Incoming Offers Section */
          <View style={styles.offersSection}>
            <View style={styles.offersHeaderRow}>
              <Text style={styles.sectionHeading}>
                Incoming Offers ({offers.length})
              </Text>
              {isOnline && (
                <View style={styles.radarPill}>
                  <Ionicons name="radio-outline" size={14} color={colors.primary} />
                  <Text style={styles.radarPillText}>Radar Active</Text>
                </View>
              )}
            </View>

            {offers.length === 0 ? (
              <View style={styles.emptyOffersCard}>
                <Ionicons
                  name={isOnline ? 'bicycle-outline' : 'moon-outline'}
                  size={42}
                  color={colors.textMuted}
                />
                <Text style={styles.emptyOffersTitle}>
                  {isOnline ? 'Looking for deliveries...' : 'Go online to start receiving orders'}
                </Text>
                <Text style={styles.emptyOffersSub}>
                  {isOnline
                    ? 'Orders within 3 KM radius will appear here with a 60-second timer.'
                    : 'Turn on your availability toggle above to receive offers.'}
                </Text>
              </View>
            ) : (
              offers.map((offer) => (
                <DeliveryOfferCard
                  key={offer.orderId}
                  offer={offer}
                  onAccepted={handleOfferAccepted}
                  onRejected={handleOfferRejected}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  customerModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceGreen,
  },
  customerModeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.accentLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  warningTextCol: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  warningDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  statusCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusTextCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusHeadline: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statusSubtext: {
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 3,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  offersSection: {
    marginTop: spacing.xs,
  },
  offersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  radarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  radarPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  emptyOffersCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
  },
  emptyOffersTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptyOffersSub: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
});
