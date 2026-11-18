import { useRiderServiceArea } from '../hooks/useRiderServiceArea';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Linking,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/tokens';
import { useRiderAuth } from '../context/RiderAuthContext';
import { RiderHeader } from '../components/RiderHeader';
import { AvailabilityControl } from '../components/AvailabilityControl';
import { RiderMap } from '../components/RiderMap';
import { EarningsCard } from '../components/EarningsCard';
import { IncomingOfferSheet } from '../components/IncomingOfferSheet';
import { ActiveDeliveryView } from '../components/ActiveDeliveryView';
import { riderApi, RiderEarningsSummary, RiderLocationUpdate } from '../api/riderApi';
import { riderLocationService, GpsStatus } from '../services/locationService';
import { mockRiderData } from '../api/mockData';
import { addressDetail, addressTitle } from '../utils/address';

interface RiderHomeScreenProps {
  onNavigateToTab?: (tab: 'earnings' | 'account') => void;
}

export const RiderHomeScreen: React.FC<RiderHomeScreenProps> = ({ onNavigateToTab }) => {
  const {
    profile,
    isMockSession,
    isOnline,
    isSocketConnected,
    activeDelivery,
    activeOffer,
    toggleAvailability,
    refreshProfile,
    refreshActiveDelivery,
    checkForPendingOffers,
    refreshAvailableOrders,
    availableOrders,
    availableOrdersError,
    claimOrder,
    acceptActiveOffer,
    rejectActiveOffer,
    connectToLiveBackend,
  } = useRiderAuth();

  const [earningsSummary, setEarningsSummary] = useState<RiderEarningsSummary | null>(null);
  const [currentLocation, setCurrentLocation] = useState<RiderLocationUpdate | null>(null);
  const serviceArea = useRiderServiceArea(currentLocation);
  const targetPhone = profile?.user?.phone;
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('initializing');
  const [poolLoading, setPoolLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isConnectingLive, setIsConnectingLive] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [claimingOrderId, setClaimingOrderId] = useState<string | null>(null);

  // 1. Request foreground permission & obtain initial real GPS position on mount
  useEffect(() => {
    let isMounted = true;

    (async () => {
      const permResult = await riderLocationService.requestForegroundPermission();
      if (permResult.status === 'granted') {
        const initialPos = await riderLocationService.getCurrentPosition();
        if (isMounted && initialPos) {
          setCurrentLocation(initialPos);
        }
      } else {
        if (isMounted) setGpsStatus('permission_denied');
      }
    })();

    // Listen to live GPS coordinate changes with change deduplication to prevent render loops
    const unsubLocation = riderLocationService.onLocationChange((loc) => {
      if (isMounted) {
        setCurrentLocation((prev) => {
          if (
            prev &&
            prev.latitude === loc.latitude &&
            prev.longitude === loc.longitude &&
            prev.heading === loc.heading
          ) {
            return prev;
          }
          return loc;
        });
      }
    });

    // Listen to live GPS service/permission status changes
    const unsubStatus = riderLocationService.onStatusChange((status) => {
      if (isMounted) setGpsStatus(status);
    });

    return () => {
      isMounted = false;
      unsubLocation();
      unsubStatus();
    };
  }, []);

  // Sync position immediately when mock session is active or restored
  useEffect(() => {
    if (isMockSession) {
      riderLocationService.setMockMode(true);
      riderLocationService.getCurrentPosition().then((pos) => {
        if (pos) setCurrentLocation(pos);
      });
    }
  }, [isMockSession]);

  const loadData = useCallback(async () => {
    if (isMockSession) {
      setEarningsSummary(mockRiderData.getSummary());
      return;
    }
    await Promise.all([
      riderApi.getEarningsSummary().then(setEarningsSummary).catch(() => undefined),
      refreshActiveDelivery(),
    ]);
  }, [isMockSession, refreshActiveDelivery]);

  const refreshQueue = useCallback(async () => {
    setPoolLoading(true);
    try {
      await refreshAvailableOrders();
    } finally {
      setPoolLoading(false);
    }
  }, [refreshAvailableOrders]);

  useEffect(() => {
    void loadData();
    void refreshQueue();
  }, [loadData, refreshQueue]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshProfile(),
        loadData(),
        refreshQueue(),
        checkForPendingOffers(),
        riderLocationService.getCurrentPosition(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClaimOrder = async (orderId: string) => {
    if (claimingOrderId) return;
    setClaimingOrderId(orderId);
    try {
      const success = await claimOrder(orderId);
      if (success) {
        Alert.alert('Order Accepted!', 'You have picked up this order. Opening delivery navigation.');
      }
    } finally {
      setClaimingOrderId(null);
    }
  };

  const handleToggle = async () => {
    if (isTogglingStatus) return; // Prevent rapid multiple taps

    if (activeDelivery) {
      Alert.alert(
        'Delivery In Progress',
        'You cannot go offline while delivering active orders. Complete your delivery first.',
      );
      return;
    }

    setAvailabilityError(null);
    setIsTogglingStatus(true);
    try {
      const ok = await toggleAvailability();
      if (ok) void refreshQueue();
      if (!ok) setAvailabilityError('Could not update availability. Try again.');
      if (ok && !currentLocation) {
        const loc = await riderLocationService.getCurrentPosition();
        if (loc) setCurrentLocation(loc);
      }
    } catch {
      setAvailabilityError('Could not update availability. Try again.');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleRecenter = async () => {
    const loc = await riderLocationService.getCurrentPosition();
    if (loc) {
      setCurrentLocation(loc);
    }
  };

  const handleOpenSettings = () => {
    Linking.openSettings();
  };

  const handleConnectLive = async () => {
    if (isConnectingLive || !targetPhone) return;
    setIsConnectingLive(true);
    setConnectionError(null);

    const result = await connectToLiveBackend(targetPhone);

    if (result.success) {
      Alert.alert(
        'Connected to Live Backend',
        `Successfully authenticated as ${profile?.fullName || 'Demo Rider'} (${targetPhone}). You are now ONLINE on the Fleet24 live dispatch network.`,
      );
      await loadData();
    } else {
      const errMsg = result.error || 'Failed to connect to backend.';
      setConnectionError(errMsg);
      Alert.alert('Connection Failed', errMsg);
    }
    setIsConnectingLive(false);
  };

  // If rider has an active delivery in progress, present the Active Delivery View
  if (activeDelivery) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.frame}>
        <RiderHeader
          serviceArea={serviceArea}
          profileImageUrl={profile?.profileImageUrl}
          onProfilePress={() => onNavigateToTab?.('account')}
        />
        <ActiveDeliveryView
          delivery={activeDelivery}
          gpsStatus={gpsStatus}
          isMockMode={isMockSession}
          riderLocation={currentLocation}
          onRefresh={async () => {
            await refreshActiveDelivery();
            await loadData();
          }}
        />
        </View>
    </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.frame}>
      <RiderHeader
          serviceArea={serviceArea}
          profileImageUrl={profile?.profileImageUrl}
          onProfilePress={() => onNavigateToTab?.('account')}
        />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Prominent Demo Warning & Live Connection Banner in Mock Mode */}
        {isMockSession && (
          <View style={styles.demoWarningBanner}>
            <View style={styles.demoWarningIconBox}>
              <Ionicons name="information-circle" size={24} color="#E65100" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.demoWarningTitle}>DEMO PREVIEW ACTIVE</Text>
              <Text style={styles.demoWarningSub}>
                You are in local simulation mode. Real backend dispatch orders are not received in demo mode.
              </Text>
              <TouchableOpacity
                style={styles.connectLiveBtn}
                activeOpacity={0.85}
                disabled={isConnectingLive || !targetPhone}
                onPress={handleConnectLive}
              >
                {isConnectingLive ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="flash" size={16} color="#FFFFFF" />
                    <Text style={styles.connectLiveBtnText}>Connect to Live Backend</Text>
                  </>
                )}
              </TouchableOpacity>
              {!targetPhone && <Text style={styles.connectErrorText}>Add a phone number to connect to the live backend.</Text>}
              {connectionError ? (
                <Text style={styles.connectErrorText}>⚠️ {connectionError}</Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Availability Toggle */}
        <AvailabilityControl
          isOnline={isOnline}
          isLoading={isTogglingStatus}
          error={availabilityError}
          onToggle={handleToggle}
        />

        {isOnline && !isSocketConnected && !isMockSession && (
          <Text accessibilityLiveRegion="polite" style={styles.connectionNotice}>
            Live dispatch is reconnecting. Refresh to check for orders.
          </Text>
        )}

        {/* Map View (~40% of screen height) with Expand Button */}
        <View style={styles.mapCard}>
          <RiderMap
            height={236}
            riderLocation={currentLocation}
            isOnline={isOnline}
            isMockMode={isMockSession}
            gpsStatus={gpsStatus}
            onRequestPermission={handleOpenSettings}
            onRecenter={handleRecenter}
            onExpand={() => setIsMapExpanded(true)}
          />
        </View>

        <View style={styles.poolSection}>
          <View style={styles.poolHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.poolIconBadge}>
                <Ionicons name="cube" size={16} color={colors.primary} />
              </View>
              <Text style={styles.poolTitle}>Available orders</Text>
              <View style={styles.poolCountBadge}>
                <Text style={styles.poolCountText}>{isOnline ? availableOrders.length : 0}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.poolRefreshBtn}
              onPress={handleRefresh}
              disabled={isRefreshing || poolLoading}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={14} color={colors.primary} />
              <Text style={styles.poolRefreshText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {!isOnline || poolLoading || availableOrdersError || availableOrders.length === 0 ? (
            <View style={styles.poolEmptyCard}>
              {isOnline && poolLoading ? <ActivityIndicator color={colors.primary} /> :
                <Ionicons name={!isOnline ? 'moon-outline' : availableOrdersError ? 'alert-circle-outline' : 'receipt-outline'} size={24} color={colors.primary} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.poolEmptyText}>
                  {!isOnline ? 'You’re offline' : poolLoading ? 'Checking for orders…' :
                    availableOrdersError ? 'Couldn’t load orders' : 'Waiting for orders'}
                </Text>
                <Text style={styles.poolEmptySub}>
                  {!isOnline ? 'Go online to receive delivery offers.' : poolLoading ? 'Looking for available deliveries.' :
                    availableOrdersError ? 'Tap Refresh to try again.' : 'New deliveries will appear here.'}
                </Text>
              </View>
            </View>
          ) : (
            availableOrders.map((item) => (
              <View key={item.orderId} style={styles.orderPoolCard}>
                <View style={styles.orderPoolTopRow}>
                  <View>
                    <Text style={styles.orderPoolNumber}>#{item.orderNumber}</Text>
                    <View style={styles.statusPillRow}>
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor:
                              item.orderStatus === 'ready_for_pickup' ? '#2E7D32' : '#F57C00',
                          },
                        ]}
                      />
                      <Text style={styles.orderPoolStatus}>
                        {item.orderStatus === 'ready_for_pickup'
                          ? 'Ready for Pickup'
                          : 'Kitchen Preparing'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.orderPoolEarningsBox}>
                    <Text style={styles.orderPoolEarningsLabel}>Rider Earning</Text>
                    <Text style={styles.orderPoolEarningsVal}>
                      {item.estimatedEarnings ? `₹${item.estimatedEarnings}` : '—'}
                    </Text>
                  </View>
                </View>

                {/* Outlet info */}
                <View style={styles.orderPoolOutletRow}>
                  <Ionicons name="restaurant" size={15} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderPoolOutletName}>
                      {item.outlet?.name || 'Restaurant Outlet'}
                    </Text>
                    {item.outlet?.address ? (
                      <Text style={styles.orderPoolOutletAddress} numberOfLines={1}>
                        {item.outlet.address}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Delivery destination */}
                <View style={styles.orderPoolOutletRow}>
                  <Ionicons name="location" size={15} color="#D32F2F" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderPoolOutletName}>Deliver To</Text>
                    <Text style={styles.orderPoolOutletAddress} numberOfLines={2}>
                      {[addressTitle(item.deliveryAddress), addressDetail(item.deliveryAddress)]
                        .filter(Boolean)
                        .join(', ')}
                    </Text>
                  </View>
                </View>

                {/* Meta details */}
                <View style={styles.orderPoolMetaRow}>
                  <Text style={styles.orderPoolMetaText}>
                    📦 {item.itemsSummary || `${item.itemsCount} items`}
                  </Text>
                  <Text style={styles.orderPoolMetaText}>
                    📏 {item.distanceKm ? `${item.distanceKm.toFixed(1)} km` : 'Near you'}
                  </Text>
                  <Text style={styles.orderPoolMetaText}>
                    💵 ₹{item.totalPayable}
                  </Text>
                </View>

                {/* Claim / Pick up button */}
                <TouchableOpacity
                  style={[
                    styles.claimBtn,
                    claimingOrderId === item.orderId && styles.claimBtnDisabled,
                  ]}
                  activeOpacity={0.85}
                  disabled={claimingOrderId === item.orderId}
                  onPress={() => handleClaimOrder(item.orderId)}
                >
                  {claimingOrderId === item.orderId ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="flash" size={16} color="#FFFFFF" />
                      <Text style={styles.claimBtnText}>⚡ Claim order</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Earnings Card */}
        <EarningsCard
          summary={earningsSummary}
          onViewDetails={() => onNavigateToTab?.('earnings')}
        />
      </ScrollView>

      {/* Expandable Full-Screen Map Modal */}
      <Modal
        visible={isMapExpanded}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsMapExpanded(false)}
      >
        <View style={styles.fullScreenMapContainer}>
          <RiderMap
            riderLocation={currentLocation}
            isOnline={isOnline}
            gpsStatus={gpsStatus}
            isMockMode={isMockSession}
            isExpanded={true}
            onCloseExpanded={() => setIsMapExpanded(false)}
            onRecenter={handleRecenter}
            onRequestPermission={handleOpenSettings}
          />
        </View>
      </Modal>

      {/* Incoming Delivery Offer Sheet Modal */}
      {activeOffer && (
        <IncomingOfferSheet
          offer={activeOffer}
          onAccept={acceptActiveOffer}
          onReject={rejectActiveOffer}
        />
      )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  frame: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: 680 },
  connectionNotice: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, paddingHorizontal: 4 },
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  mapCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  fullScreenMapContainer: {
    flex: 1,
    backgroundColor: '#EBE9DF',
  },
  demoWarningBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: '#FFE0B2',
    gap: spacing.sm,
  },
  demoWarningIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFE0B2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoWarningTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#E65100',
    letterSpacing: 0.5,
  },
  demoWarningSub: {
    fontSize: 11,
    color: '#795548',
    marginTop: 2,
    lineHeight: 15,
  },
  connectLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: borderRadius.sm,
    marginTop: 10,
    alignSelf: 'flex-start',
    gap: 6,
  },
  connectLiveBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  connectErrorText: {
    fontSize: 11,
    color: colors.error,
    fontWeight: '700',
    marginTop: 6,
  },
  poolSection: {
  },
  poolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  poolIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(40, 84, 63, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  poolTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  poolCountBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  poolCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  poolRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: borderRadius.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  poolRefreshText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  poolEmptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  poolEmptyText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  poolEmptySub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 15,
  },
  orderPoolCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(40, 84, 63, 0.25)',
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  orderPoolTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  orderPoolNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statusPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  orderPoolStatus: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  orderPoolEarningsBox: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(40, 84, 63, 0.08)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: borderRadius.xs,
  },
  orderPoolEarningsLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  orderPoolEarningsVal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  orderPoolOutletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  orderPoolOutletName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  orderPoolOutletAddress: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  orderPoolMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  orderPoolMetaText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E7D32',
    paddingVertical: 10,
    borderRadius: borderRadius.sm,
    marginTop: 10,
    gap: 6,
  },
  claimBtnDisabled: {
    backgroundColor: '#A5D6A7',
  },
  claimBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
