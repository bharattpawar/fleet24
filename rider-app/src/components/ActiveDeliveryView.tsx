import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/tokens';
import { ActiveDeliveryDetails, RiderLocationUpdate } from '../api/riderApi';
import type { GpsStatus } from '../services/locationService';
import { RiderMap } from './RiderMap';
import { OtpVerificationSheet } from './OtpVerificationSheet';
import { riderApi } from '../api/riderApi';
import { useRiderAuth } from '../context/RiderAuthContext';
import { addressDetail, addressTitle } from '../utils/address';

interface ActiveDeliveryViewProps {
  delivery: ActiveDeliveryDetails;
  gpsStatus?: GpsStatus;
  isMockMode?: boolean;
  riderLocation?: RiderLocationUpdate | null;
  onRefresh: () => Promise<any>;
}

export const ActiveDeliveryView: React.FC<ActiveDeliveryViewProps> = ({
  delivery,
  riderLocation,
  gpsStatus,
  isMockMode,
  onRefresh,
}) => {
  const { refreshProfile } = useRiderAuth();
  const [showOtpSheet, setShowOtpSheet] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const status = (delivery?.status || (delivery as any)?.deliveryStatus || 'accepted').toLowerCase();

  // Map progress stages
  const STAGES = [
    { key: 'accepted', label: 'Accepted', icon: 'checkmark-circle' },
    { key: 'at_restaurant', label: 'At Restaurant', icon: 'restaurant' },
    { key: 'picked_up', label: 'Picked Up', icon: 'bag-check' },
    { key: 'arrived_customer', label: 'At Customer', icon: 'location' },
    { key: 'completed', label: 'Delivered', icon: 'shield-checkmark' },
  ];

  const getStageIndex = (s: string) => {
    switch (s) {
      case 'assigned':
      case 'accepted':
        return 0;
      case 'at_restaurant':
        return 1;
      case 'picked_up':
        return 2;
      case 'arrived_customer':
        return 3;
      case 'completed':
        return 4;
      default:
        return 0;
    }
  };

  const currentStageIndex = getStageIndex(status);

  // External Navigation Launcher
  const openMaps = (lat: number, lng: number, label: string) => {
    const scheme = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${label})`,
      web: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    });
    if (scheme) {
      Linking.openURL(scheme).catch(() => {
        Alert.alert('Error', 'Unable to open Google Maps or Apple Maps');
      });
    }
  };

  // Stage Action Execution
  const handleStageAction = async () => {
    if (isActionLoading) return;
    setIsActionLoading(true);

    try {
      if (status === 'assigned' || status === 'accepted') {
        // Stage 2: Arrived at Restaurant
        await riderApi.confirmArrival(delivery.orderId);
      } else if (status === 'at_restaurant') {
        // Stage 3: Picked Up Order
        await riderApi.confirmPickup(delivery.orderId);
      } else if (status === 'picked_up') {
        // Stage 4: Arrived at Customer Doorstep
        await riderApi.confirmArrivedCustomer(delivery.orderId);
      } else if (status === 'arrived_customer') {
        // Stage 5: Open OTP sheet
        setShowOtpSheet(true);
        setIsActionLoading(false);
        return;
      }
      await onRefresh();
    } catch (err: any) {
      Alert.alert('Action Failed', err.message || 'Could not update delivery state');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleVerifyOtp = async (otp: string) => {
    await riderApi.completeDelivery(delivery.orderId, otp);
    await onRefresh();
    await refreshProfile();
    Alert.alert('Success', 'Delivery completed successfully! Great job.');
  };

  // Dynamic Button Label & Target Coordinates
  let actionTitle = 'CONFIRM ARRIVAL AT RESTAURANT';
  let navTargetLat = delivery.outlet?.latitude || 28.4744;
  let navTargetLng = delivery.outlet?.longitude || 77.504;
  let navTargetName = delivery.outlet?.name || 'Restaurant';

  if (status === 'at_restaurant') {
    actionTitle = 'CONFIRM FOOD PICKED UP';
  } else if (status === 'picked_up') {
    actionTitle = 'CONFIRM ARRIVAL AT CUSTOMER';
    navTargetLat = delivery.deliveryAddress?.latitude || 28.4855;
    navTargetLng = delivery.deliveryAddress?.longitude || 77.5135;
    navTargetName = 'Customer Dropoff';
  } else if (status === 'arrived_customer') {
    actionTitle = 'ENTER CUSTOMER OTP TO DELIVER';
  }

  // Live distance from Rider's current GPS to next destination
  let toTargetDistanceText: string | null = null;
  const isDropoffStage = status === 'picked_up' || status === 'arrived_customer';
  const targetLat = isDropoffStage
    ? (delivery.deliveryAddress?.latitude || 28.4855)
    : (delivery.outlet?.latitude || 28.4744);
  const targetLon = isDropoffStage
    ? (delivery.deliveryAddress?.longitude || 77.5135)
    : (delivery.outlet?.longitude || 77.5040);

  if (riderLocation?.latitude && riderLocation?.longitude && targetLat && targetLon) {
    const latDiffKm = (targetLat - riderLocation.latitude) * 111.32;
    const lonDiffKm =
      (targetLon - riderLocation.longitude) *
      111.32 *
      Math.cos((riderLocation.latitude * Math.PI) / 180);
    const distKm = Math.sqrt(latDiffKm * latDiffKm + lonDiffKm * lonDiffKm);
    toTargetDistanceText =
      distKm < 1 ? `${Math.round(distKm * 1000)}m away` : `${distKm.toFixed(1)} km away`;
  }

  return (
    <ScrollView style={styles.container} bounces={false}>
      <View style={styles.sheetContent}>
        {/* Contextual Action Button */}
        <TouchableOpacity
          style={[
            styles.primaryActionButton,
            status === 'arrived_customer' ? styles.actionButtonOtp : null,
          ]}
          onPress={handleStageAction}
          disabled={isActionLoading}
          activeOpacity={0.85}
        >
          {isActionLoading ? (
            <ActivityIndicator color={colors.textWhite} />
          ) : (
            <>
              <Ionicons
                name={
                  status === 'arrived_customer'
                    ? 'keypad'
                    : status === 'picked_up'
                    ? 'home'
                    : 'checkmark-circle'
                }
                size={20}
                color={colors.textWhite}
              />
              <Text style={styles.primaryActionText}>{actionTitle}</Text>
            </>
          )}
        </TouchableOpacity>
        {/* Order Identifier & Active Status Banner */}
        <View style={styles.orderBanner}>
          <View>
            <Text style={styles.orderNumber}>ORDER #{delivery.orderNumber}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              <Text style={styles.orderStatusLabel}>
                {(status || 'accepted').toUpperCase().replace('_', ' ')}
              </Text>
              <View style={styles.distanceBadge}>
                <Ionicons name="bicycle" size={12} color={colors.primary} />
                <Text style={styles.distanceBadgeText}>
                  Trip: {delivery.distanceKm ? `${delivery.distanceKm} km` : '1.5 km'}
                </Text>
              </View>
              {toTargetDistanceText && (
                <View style={styles.proximityBadge}>
                  <Ionicons
                    name={isDropoffStage ? 'home' : 'restaurant'}
                    size={11}
                    color="#D84315"
                  />
                  <Text style={styles.proximityBadgeText}>
                    {isDropoffStage ? 'Drop: ' : 'Store: '}
                    {toTargetDistanceText}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.navChip}
            onPress={() => openMaps(navTargetLat, navTargetLng, navTargetName)}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate" size={16} color={colors.primary} />
            <Text style={styles.navChipText}>Directions</Text>
          </TouchableOpacity>
        </View>

        {/* 5-Stage Status Flow */}
        <View style={styles.trackerContainer}>
          <View style={styles.trackerRow}>
            {STAGES.map((st, i) => {
              const isPast = i < currentStageIndex;
              const isCurrent = i === currentStageIndex;
              return (
                <View key={st.key} style={styles.stageItem}>
                  <View
                    style={[
                      styles.stageCircle,
                      isPast ? styles.stagePast : null,
                      isCurrent ? styles.stageCurrent : null,
                    ]}
                  >
                    <Ionicons
                      name={st.icon as any}
                      size={14}
                      color={isPast || isCurrent ? colors.textWhite : colors.textMuted}
                    />
                  </View>
                  <Text
                    style={[
                      styles.stageLabel,
                      isCurrent ? styles.stageLabelCurrent : null,
                    ]}
                    numberOfLines={1}
                  >
                    {st.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Details Card */}
        <View style={styles.infoCard}>
          {/* Outlet Info */}
          <View style={styles.addressSection}>
            <View style={styles.pinCircleOutlet}>
              <Ionicons name="restaurant" size={14} color={colors.textWhite} />
            </View>
            <View style={styles.addressInfo}>
              <Text style={styles.addressType}>RESTAURANT PICKUP</Text>
              <Text style={styles.addressName}>{delivery.outlet?.name || 'Restaurant'}</Text>
              {delivery.outlet?.address ? <Text style={styles.addressSub}>{delivery.outlet.address}</Text> : null}
            </View>
            {delivery.outlet?.phone && (
              <TouchableOpacity
                style={styles.callIcon}
                onPress={() => Linking.openURL(`tel:${delivery.outlet.phone}`)}
              >
                <Ionicons name="call" size={16} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.addressDivider} />

          {/* Customer Info */}
          <View style={styles.addressSection}>
            <View style={styles.pinCircleCustomer}>
              <Ionicons name="person" size={14} color={colors.textWhite} />
            </View>
            <View style={styles.addressInfo}>
              <Text style={styles.addressType}>CUSTOMER DROPOFF</Text>
              <Text style={styles.addressName}>{addressTitle(delivery.deliveryAddress, 'Delivery address')}</Text>
              {addressDetail(delivery.deliveryAddress) ? (
                <Text style={styles.addressSub}>{addressDetail(delivery.deliveryAddress)}</Text>
              ) : null}
            </View>
            {delivery.customer?.phone && (
              <TouchableOpacity
                style={styles.callIcon}
                onPress={() => Linking.openURL(`tel:${delivery.customer?.phone}`)}
              >
                <Ionicons name="call" size={16} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Order Items Preview */}
        {delivery.items && delivery.items.length > 0 && (
          <View style={styles.orderItemsBox}>
            <Text style={styles.orderItemsHeader}>ITEMS IN THIS ORDER</Text>
            {delivery.items.map((item, idx) => (
              <View key={idx} style={styles.orderItemRow}>
                <Text style={styles.orderItemQty}>{item.quantity}x</Text>
                <Text style={styles.orderItemName}>{item.name}</Text>
              </View>
            ))}
          </View>
        )}

      </View>

      {/* Top Map Tracker (40-50% screen height) */}
      <RiderMap
        height={180}
        riderLocation={riderLocation}
        outletLocation={delivery.outlet}
        customerLocation={delivery.deliveryAddress}
        deliveryStatus={status}
        isOnline={true}
        gpsStatus={gpsStatus}
        isMockMode={isMockMode}
      />

      {/* OTP Modal Sheet */}
      <OtpVerificationSheet
        visible={showOtpSheet}
        orderNumber={delivery.orderNumber}
        onVerify={handleVerifyOtp}
        onClose={() => setShowOtpSheet(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  sheetContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,

    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  orderBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  orderStatusLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 2,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(40, 84, 63, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  distanceBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  proximityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FBE9E7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  proximityBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D84315',
  },
  navChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
  },
  navChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  trackerContainer: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  trackerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stageItem: {
    alignItems: 'center',
    flex: 1,
  },
  stageCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DCDCD4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stagePast: {
    backgroundColor: colors.primary,
  },
  stageCurrent: {
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  stageLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  stageLabelCurrent: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  addressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pinCircleOutlet: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinCircleCustomer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressInfo: {
    flex: 1,
  },
  addressType: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  addressName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  addressSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  callIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.sm,
    marginLeft: 46,
  },
  orderItemsBox: {
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  orderItemsHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  orderItemRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  orderItemQty: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  orderItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 54,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  actionButtonOtp: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textWhite,
    letterSpacing: 0.5,
  },
});

