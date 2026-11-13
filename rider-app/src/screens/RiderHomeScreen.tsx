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
    claimOrder,
    acceptActiveOffer,
    rejectActiveOffer,
    connectToLiveBackend,
  } = useRiderAuth();

  const [earningsSummary, setEarningsSummary] = useState<RiderEarningsSummary | null>(null);
  const [currentLocation, setCurrentLocation] = useState<RiderLocationUpdate | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('initializing');
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

    try {
      const summary = await riderApi.getEarningsSummary();
      setEarningsSummary(summary);
      await Promise.all([
        refreshActiveDelivery(),
        refreshAvailableOrders(),
      ]);
    } catch {
      // ignore
    }
  }, [isMockSession, refreshActiveDelivery, refreshAvailableOrders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refreshProfile(),
      loadData(),
      refreshAvailableOrders(),
      riderLocationService.getCurrentPosition(),
    ]);
    setIsRefreshing(false);
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

    setIsTogglingStatus(true);
    try {
      const ok = await toggleAvailability();
      if (ok && !currentLocation) {
        const loc = await riderLocationService.getCurrentPosition();
        if (loc) setCurrentLocation(loc);
      }
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
    if (isConnectingLive) return;
    setIsConnectingLive(true);
    setConnectionError(null);

    const targetPhone = profile?.user?.phone || '1234567890';
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

  const handleCheckOffers = async () => {
    setIsRefreshing(true);
    try {
      await checkForPendingOffers();
    } finally {
      setIsRefreshing(false);
    }
  };

  // If rider has an active delivery in progress, present the Active Delivery View
  if (activeDelivery) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <RiderHeader
          riderName={profile?.fullName}
          profileImageUrl={profile?.profileImageUrl}
          isOnline={isOnline}
          isSocketConnected={isSocketConnected}
          isMockMode={isMockSession}
          onProfilePress={() => onNavigateToTab?.('account')}
        />
        <ActiveDeliveryView
          delivery={activeDelivery}
          riderLocation={currentLocation}
          onRefresh={async () => {
            await refreshActiveDelivery();
            await loadData();
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <RiderHeader
        riderName={profile?.fullName}
        profileImageUrl={profile?.profileImageUrl}
        isOnline={isOnline}
        isSocketConnected={isSocketConnected}
        isMockMode={isMockSession}
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
                disabled={isConnectingLive}
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
          isMockMode={isMockSession}
          onToggle={handleToggle}
        />

        {/* Permission Denied Callout Banner */}
        {gpsStatus === 'permission_denied' && (
          <View style={styles.permissionCard}>
            <View style={styles.permissionIconCircle}>
              <Ionicons name="location-outline" size={20} color={colors.error} />
            </View>
            <View style={styles.permissionInfo}>
              <Text style={styles.permissionTitle}>Location Access Required</Text>
              <Text style={styles.permissionSub}>
                Allow Fleet24 Rider to access your real GPS location to receive delivery orders.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={handleOpenSettings}
              activeOpacity={0.8}
            >
              <Text style={styles.permissionButtonText}>SETTINGS</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Map View (~40% of screen height) with Expand Button */}
        <View style={styles.mapCard}>
          <RiderMap
            height={260}
            riderLocation={currentLocation}
            isOnline={isOnline}
            isMockMode={isMockSession}
            isSocketConnected={isSocketConnected}
            gpsStatus={gpsStatus}
            onRequestPermission={handleOpenSettings}
            onRecenter={handleRecenter}
            onExpand={() => setIsMapExpanded(true)}
          />
        </View>

        {/* Status Callout / Empty State */}
        {isOnline ? (
          <View style={styles.radarCard}>
            <View style={styles.radarIconBox}>
              <ActivityIndicator color={colors.primary} />
            </View>
            <View style={styles.radarInfo}>
              <Text style={styles.radarTitle}>
                {isMockSession ? 'Demo Mode Active' : 'Searching for Live Orders...'}
              </Text>
              <Text style={styles.radarSubtitle}>
                {isMockSession
                  ? 'Simulated offline preview mode. Tap "Connect to Live Backend" above to join live dispatch.'
                  : currentLocation?.latitude
                  ? `Active on live network at GPS: ${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}. Standing by for dispatch offers.`
                  : 'Acquiring GPS location... Standing by for delivery offers.'}
              </Text>
              {!isMockSession && (
                <View style={styles.liveEmptyStateRow}>
                  <Text style={styles.liveEmptyStateText}>
                    No active delivery offers right now. Standing by for incoming orders.
                  </Text>
                  <TouchableOpacity
                    style={styles.checkOffersBtn}
                    onPress={handleCheckOffers}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="refresh" size={14} color={colors.primary} />
                    <Text style={styles.checkOffersBtnText}>Check for Orders</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.offlineCard}>
            <Text style={styles.offlineTitle}>
              {isMockSession ? 'Demo Preview: Currently Offline' : 'Live Dispatch: Currently Offline'}
            </Text>
            <Text style={styles.offlineSubtitle}>
              Toggle your status switch above to go online and start receiving orders with Fleet24.
            </Text>
          </View>
        )}

        {/* Open Delivery Pool / Available Orders from Database */}
        <View style={styles.poolSection}>
          <View style={styles.poolHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.poolIconBadge}>
                <Ionicons name="cube" size={16} color={colors.primary} />
              </View>
              <Text style={styles.poolTitle}>Available Orders Pool</Text>
              <View style={styles.poolCountBadge}>
                <Text style={styles.poolCountText}>{availableOrders.length}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.poolRefreshBtn}
              onPress={() => refreshAvailableOrders()}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={14} color={colors.primary} />
              <Text style={styles.poolRefreshText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {availableOrders.length === 0 ? (
            <View style={styles.poolEmptyCard}>
              <Text style={styles.poolEmptyText}>
                No pending orders waiting for pickup in database right now.
              </Text>
              <Text style={styles.poolEmptySub}>
                When a customer order is confirmed or marked ready, it will appear here so you can pick it up immediately.
              </Text>
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
                      ₹{item.estimatedEarnings || '45.00'}
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
                    <Text style={styles.orderPoolOutletAddress} numberOfLines={1}>
                      {item.outlet?.address || 'Knowledge Park III'}
                    </Text>
                  </View>
                </View>

                {/* Delivery destination */}
                <View style={styles.orderPoolOutletRow}>
                  <Ionicons name="location" size={15} color="#D32F2F" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderPoolOutletName}>Deliver To</Text>
                    <Text style={styles.orderPoolOutletAddress} numberOfLines={1}>
                      {item.deliveryAddress?.addressLine1 ||
                        item.deliveryAddress?.city ||
                        'Customer Address'}
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
                      <Text style={styles.claimBtnText}>⚡ Pick Up / Claim This Order</Text>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surfaceDark,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(199, 71, 64, 0.3)',
    gap: spacing.sm,
  },
  permissionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionInfo: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.error,
  },
  permissionSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  permissionButton: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.xs,
  },
  permissionButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textWhite,
    letterSpacing: 0.5,
  },
  mapCard: {
    marginHorizontal: spacing.lg,
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
  radarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceGreen,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(40, 84, 63, 0.2)',
  },
  radarIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarInfo: {
    flex: 1,
  },
  radarTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  radarSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  offlineCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  offlineTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  offlineSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  fullScreenMapContainer: {
    flex: 1,
    backgroundColor: '#EBE9DF',
  },
  demoWarningBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
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
  liveEmptyStateRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(40, 84, 63, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  liveEmptyStateText: {
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
  checkOffersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  checkOffersBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  poolSection: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
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
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  poolEmptyText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  poolEmptySub: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
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
