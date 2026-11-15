import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Vibration,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../theme/tokens';
import { useRestaurantAuth } from '../context/RestaurantAuthContext';
import { restaurantApi } from '../api/restaurantApi';
import {
  RestaurantOrder,
  OrderOverviewStats,
} from '../types';
import { KitchenHeader } from '../components/KitchenHeader';
import { KitchenOrderCard } from '../components/KitchenOrderCard';
import {
  getRestaurantSocket,
  RESTAURANT_WS_EVENTS,
  OrderCreatedSocketPayload,
} from '../api/restaurantSocket';
import { Socket } from 'socket.io-client';

type FilterTab = 'placed' | 'preparing' | 'ready_for_pickup' | 'history';

const EMPTY_QUEUE: Record<FilterTab, string> = {
  placed: 'Orders waiting for acceptance will appear here.',
  preparing: 'Accepted orders and orders being prepared will appear here.',
  ready_for_pickup: 'Orders waiting for rider pickup will appear here.',
  history: 'Orders that have left the kitchen will appear here.',
};

const QUICK_REJECTION_REASONS = [
  'Kitchen overload',
  'Item out of stock',
  'Kitchen closing soon',
  'Power / equipment issue',
];

export const RestaurantOrdersScreen: React.FC<{ onNavigateToOutlets?: () => void }> = ({
  onNavigateToOutlets,
}) => {
  const { width } = useWindowDimensions();
  const isWide = width >= 1000;

  const { activeOutlet, permissions } = useRestaurantAuth();
  const [selectedTab, setSelectedTab] = useState<FilterTab>('placed');
  const [selection, setSelection] = useState<{ outletId: string; orderId: string | null }>();
  const [loadedOutletId, setLoadedOutletId] = useState<string>();
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [overview, setOverview] = useState<OrderOverviewStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ outletId: string | undefined; message: string } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Connection & Sync Diagnostics
  const [connectionStatus, setConnectionStatus] = useState<'Connected' | 'Reconnecting' | 'Offline'>('Offline');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [newOrderBanner, setNewOrderBanner] = useState<{
    orderNumber: string;
    itemCount: number;
    totalAmount: string;
  } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Rejection Modal
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [orderToReject, setOrderToReject] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Socket, Polling, and In-Flight Request References
  const socketRef = useRef<Socket | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const actionLock = useRef(false);
  const activeOutletIdRef = useRef(activeOutlet?.id);
  activeOutletIdRef.current = activeOutlet?.id;
  const currentReqRef = useRef<number>(0);

  /**
   * 1. Fetch Orders and Overview from Authoritative Backend REST API
   */
  const fetchOrdersAndOverview = useCallback(
    async (isSilent = false) => {
      if (!activeOutlet?.id) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const reqId = ++currentReqRef.current;
      if (!isSilent) {
        setLoading(true);
        setFetchError(null);
      }

      try {
        const [ordersRes, overviewRes] = await Promise.all([
          restaurantApi.listOrders({
            outletId: activeOutlet.id,
          }),
          restaurantApi.getOrdersOverview(activeOutlet.id),
        ]);

        if (reqId !== currentReqRef.current) return;

        const rawOrders = Array.isArray(ordersRes)
          ? ordersRes
          : Array.isArray((ordersRes as any)?.orders)
          ? (ordersRes as any).orders
          : [];

        setOrders(rawOrders);
        setLoadedOutletId(activeOutlet.id);
        setOverview(overviewRes);
        setLastSyncedAt(new Date());
        setFetchError(null);

        for (const ord of rawOrders) {
          seenOrderIdsRef.current.add(ord.id);
        }
      } catch (err: any) {
        if (reqId === currentReqRef.current) {
          console.warn('[Kitchen] Failed to fetch orders/overview:', err?.message);
          if (!isSilent) {
            setFetchError(err?.message || 'Failed to fetch kitchen orders. Please check connection.');
          }
        }
      } finally {
        if (reqId === currentReqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [activeOutlet?.id],
  );

  /**
   * 2. Initial Fetch & Outlet Isolation
   */
  useEffect(() => {
    currentReqRef.current++;
    setOrders([]);
    setLoadedOutletId(undefined);
    setSelection(undefined);
    setRejectModalVisible(false);
    setOrderToReject(null);
    setOverview(null);
    setFetchError(null);
    seenOrderIdsRef.current.clear();
    setNewOrderBanner(null);

    if (activeOutlet?.id) {
      fetchOrdersAndOverview(false);
    } else {
      setLoading(false);
      setConnectionStatus('Offline');
    }
  }, [activeOutlet?.id, fetchOrdersAndOverview]);

  /**
   * 3. Socket.IO Real-Time Connection
   */
  useEffect(() => {
    if (!activeOutlet?.id) {
      setConnectionStatus('Offline');
      return;
    }

    let isMounted = true;
    const currentOutletId = activeOutlet.id;

    async function setupSocket() {
      try {
        const socket = await getRestaurantSocket();
        if (!isMounted) return;
        socketRef.current = socket;

        const updateStatus = () => {
          if (!isMounted) return;
          if (socket.connected) {
            setConnectionStatus('Connected');
          } else {
            setConnectionStatus('Reconnecting');
          }
        };

        socket.on('connect', () => {
          if (!isMounted) return;
          setConnectionStatus('Connected');
          socket.emit(RESTAURANT_WS_EVENTS.SUBSCRIBE_OUTLET, {
            outletId: currentOutletId,
          });
        });

        socket.on('disconnect', () => {
          if (!isMounted) return;
          setConnectionStatus('Offline');
        });

        socket.on('connect_error', () => {
          if (!isMounted) return;
          setConnectionStatus('Reconnecting');
        });

        socket.on(RESTAURANT_WS_EVENTS.ORDER_CREATED, (payload: OrderCreatedSocketPayload) => {
          if (!isMounted || !currentOutletId) return;
          if (payload && payload.outletId === currentOutletId) {
            setNewOrderBanner({
              orderNumber: payload.orderNumber,
              itemCount: payload.itemCount || 1,
              totalAmount: payload.totalAmount || '0.00',
            });

            if (soundEnabled) {
              Vibration.vibrate(Platform.OS === 'android' ? [0, 250, 150, 250] : 400);
            }

            fetchOrdersAndOverview(true);
          }
        });

        socket.on(RESTAURANT_WS_EVENTS.STATUS_UPDATED, () => {
          if (isMounted) {
            fetchOrdersAndOverview(true);
          }
        });

        if (socket.connected) {
          socket.emit(RESTAURANT_WS_EVENTS.SUBSCRIBE_OUTLET, {
            outletId: currentOutletId,
          });
          setConnectionStatus('Connected');
        } else {
          socket.connect();
          updateStatus();
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('[Kitchen] Socket initialization failed:', err?.message);
          setConnectionStatus('Offline');
        }
      }
    }

    setupSocket();

    pollingIntervalRef.current = setInterval(() => {
      fetchOrdersAndOverview(true);
    }, 15000);

    return () => {
      isMounted = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      if (socketRef.current) {
        socketRef.current.emit(RESTAURANT_WS_EVENTS.UNSUBSCRIBE_OUTLET, {
          outletId: currentOutletId,
        });
        socketRef.current.off(RESTAURANT_WS_EVENTS.ORDER_CREATED);
        socketRef.current.off(RESTAURANT_WS_EVENTS.STATUS_UPDATED);
        socketRef.current.off('connect');
        socketRef.current.off('disconnect');
        socketRef.current.off('connect_error');
      }
    };
  }, [activeOutlet?.id, fetchOrdersAndOverview, soundEnabled]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrdersAndOverview(false);
  };

  /**
   * 5. Order State Machine Transitions
   */
  const handleUpdateStatus = async (
    orderId: string,
    status: 'confirmed' | 'preparing' | 'ready_for_pickup' | 'rejected',
    reason?: string,
  ) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setActionError(null);
    setActionLoadingId(orderId);

    try {
      await restaurantApi.updateOrderStatus(orderId, status, reason);
      if (activeOutletIdRef.current === activeOutlet?.id) await fetchOrdersAndOverview(true);
    } catch (err: any) {
      setActionError({ outletId: activeOutlet?.id, message: err?.message || 'Could not update order status.' });
    } finally {
      actionLock.current = false;
      setActionLoadingId(null);
    }
  };

  const openRejectModal = (orderId: string) => {
    setOrderToReject(orderId);
    setRejectionReason('Kitchen overload');
    setRejectModalVisible(true);
  };

  const confirmRejection = async () => {
    if (!orderToReject) return;
    const targetId = orderToReject;
    setRejectModalVisible(false);
    await handleUpdateStatus(targetId, 'rejected', rejectionReason || 'Kitchen overload');
    setOrderToReject(null);
  };

  const outletId = activeOutlet?.id;
  const outletOrders = loadedOutletId === outletId ? orders : [];
  const visibleOrders = outletOrders.filter(({ status }) => {
    if (selectedTab === 'preparing') return status === 'confirmed' || status === 'preparing';
    if (selectedTab === 'history') return ['out_for_delivery', 'delivered', 'rejected', 'cancelled'].includes(status);
    return status === selectedTab;
  });
  const selectedOrder = (
    selection?.outletId === outletId
      ? visibleOrders.find(order => order.id === selection?.orderId)
      : undefined
  ) ?? (isWide ? visibleOrders[0] : undefined);

  useEffect(() => {
    if (!outletId || (!isWide && !selection?.orderId)) return;
    if (selection?.outletId === outletId && selectedOrder?.id === (selection.orderId ?? undefined)) return;
    setSelection({ outletId, orderId: selectedOrder?.id ?? null });
  }, [isWide, outletId, selection, selectedOrder?.id]);

  const tabs: Array<{ key: FilterTab; label: string; count?: number; tone?: string }> = [
    { key: 'placed', label: 'New', count: overview?.counts.newOrders, tone: colors.pendingLight },
    { key: 'preparing', label: 'Preparing', count: (overview?.counts.confirmed ?? 0) + (overview?.counts.preparing ?? 0), tone: colors.confirmedLight },
    { key: 'ready_for_pickup', label: 'Ready', count: overview?.counts.readyForPickup, tone: colors.readyLight },
    { key: 'history', label: 'History' },
  ];

  const renderOrder = (item: RestaurantOrder, detail = false) => (
    <KitchenOrderCard
      order={item}
      mode={detail ? 'detail' : isWide ? 'queue' : 'accordion'}
      selected={selectedOrder?.id === item.id}
      onPressDetails={detail ? undefined : () => setSelection({
        outletId: item.outletId,
        orderId: !isWide && selectedOrder?.id === item.id ? null : item.id,
      })}
      actionLoading={actionLoadingId === item.id}
      actionsDisabled={Boolean(actionLoadingId)}
      onAccept={permissions.canAcceptOrders ? () => handleUpdateStatus(item.id, 'confirmed') : undefined}
      onReject={permissions.canAcceptOrders ? () => openRejectModal(item.id) : undefined}
      onStartPreparing={permissions.canUpdateKitchenStatus ? () => handleUpdateStatus(item.id, 'preparing') : undefined}
      onMarkReady={permissions.canUpdateKitchenStatus ? () => handleUpdateStatus(item.id, 'ready_for_pickup') : undefined}
    />
  );

  return (
    <View style={styles.container}>
      <KitchenHeader kitchen onOutletPress={onNavigateToOutlets} />

      {/* Telemetry & Connection Diagnostic Bar */}
      <View style={styles.telemetryBar}>
        <View style={styles.telemetryInner}>
          <View style={styles.telemetryLeft}>
            <View
              style={[
                styles.connectionDot,
                connectionStatus === 'Connected'
                  ? styles.dotConnected
                  : connectionStatus === 'Reconnecting'
                  ? styles.dotReconnecting
                  : styles.dotOffline,
              ]}
            />
            <Text style={styles.connectionText}>{connectionStatus}</Text>
            {lastSyncedAt && (
              <Text style={styles.lastSyncedText}>
                · {lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </View>

          <View style={styles.telemetryRight}>
            <TouchableOpacity
              style={styles.syncBtn}
              onPress={() => fetchOrdersAndOverview(false)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Sync kitchen orders"
            >
              <Ionicons name="refresh-outline" size={16} color={colors.primary} />
              <Text style={styles.syncText}>Sync</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.soundToggle}
              onPress={() => setSoundEnabled((prev) => !prev)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={soundEnabled ? 'Mute alerts' : 'Enable alerts'}
            >
              <Ionicons
                name={soundEnabled ? 'volume-high-outline' : 'volume-mute-outline'}
                size={13}
                color={soundEnabled ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.soundText, { color: soundEnabled ? colors.primary : colors.textMuted }]}>
                {soundEnabled ? 'Alerts ON' : 'Muted'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* New Order Banner */}
      {newOrderBanner && (
        <View style={styles.alertBanner}>
          <View style={styles.alertInner}>
            <View style={styles.alertLeft}>
              <View style={styles.alertPulse}>
                <Ionicons name="notifications" size={16} color={colors.surfaceDark} />
              </View>
              <View>
                <Text style={styles.alertTitle}>New Order #{newOrderBanner.orderNumber}</Text>
                <Text style={styles.alertSub}>
                  {newOrderBanner.itemCount} {newOrderBanner.itemCount === 1 ? 'item' : 'items'} · ₹{newOrderBanner.totalAmount}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.alertDismissBtn}
              onPress={() => setNewOrderBanner(null)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss banner"
            >
              <Ionicons name="close" size={16} color={colors.surfaceDark} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.tabBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={tabs}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.tabsList}
          renderItem={({ item }) => {
            const isSelected = selectedTab === item.key;
            return (
              <TouchableOpacity
                style={[styles.tabButton, isSelected && styles.tabButtonActive]}
                onPress={() => {
                  setSelectedTab(item.key);
                  setSelection(undefined);
                }}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[styles.tabLabel, isSelected && styles.tabLabelActive]}>
                  {item.label}
                </Text>
                {item.count !== undefined && item.count > 0 && (
                  <View style={[styles.tabBadge, { backgroundColor: item.tone }]}>
                    <Text style={[styles.tabBadgeText]}>
                      {item.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {actionError && actionError.outletId === activeOutlet?.id && (
        <Text accessibilityRole="alert" style={styles.actionError}>{actionError.message}</Text>
      )}

      {/* Main Body */}
      {!activeOutlet ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="storefront-outline" size={38} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No Outlet Selected</Text>
          <Text style={styles.emptySubtitle}>
            Please select an authorized kitchen outlet to view its live incoming orders and terminal telemetry.
          </Text>
          {onNavigateToOutlets && (
            <TouchableOpacity
              style={styles.selectOutletActionBtn}
              onPress={onNavigateToOutlets}
              activeOpacity={0.8}
            >
              <Ionicons name="storefront" size={16} color={colors.textWhite} />
              <Text style={styles.selectOutletActionText}>Select Outlet</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (loading || (loadedOutletId !== outletId && !fetchError)) ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching kitchen orders for {activeOutlet.name}...</Text>
        </View>
      ) : fetchError ? (
        <View style={styles.centerContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.rejectedLight }]}>
            <Ionicons name="alert-circle-outline" size={38} color={colors.rejected} />
          </View>
          <Text style={styles.emptyTitle}>Unable to Load Orders</Text>
          <Text style={styles.emptySubtitle}>{fetchError}</Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => fetchOrdersAndOverview(false)}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={15} color={colors.primary} />
            <Text style={styles.refreshButtonText}>Retry Sync</Text>
          </TouchableOpacity>
        </View>
      ) : visibleOrders.length === 0 ? (
        <View style={styles.emptyQueue}>
          <Ionicons name="receipt-outline" size={24} color={colors.primary} />
          <Text style={styles.emptyTitle}>Queue is empty</Text>
          <Text style={styles.emptySubtitle}>{EMPTY_QUEUE[selectedTab]}</Text>
        </View>
      ) : (
        <View style={[styles.queueLayout, isWide && styles.queueLayoutWide]}>
          <FlatList
            style={isWide ? styles.queuePanel : undefined}
            data={visibleOrders}
            extraData={selectedOrder?.id}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.ordersList}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
            renderItem={({ item }) => renderOrder(item)}
          />
          {isWide && selectedOrder && (
            <ScrollView style={styles.detailPanel} contentContainerStyle={styles.detailContent}>
              {renderOrder(selectedOrder, true)}
            </ScrollView>
          )}
        </View>
      )}

      {/* Reject Order Confirmation Modal */}
      <Modal visible={rejectModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalAlertIcon}>
                <Ionicons name="alert-circle" size={22} color={colors.rejected} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Reject Order</Text>
                <Text style={styles.modalSubtitle}>
                  Select a kitchen reason. Fleet24 will automatically initiate a refund.
                </Text>
              </View>
            </View>

            <View style={styles.quickChipsContainer}>
              {QUICK_REJECTION_REASONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.quickChip,
                    rejectionReason === r && styles.quickChipActive,
                  ]}
                  onPress={() => setRejectionReason(r)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.quickChipText,
                      rejectionReason === r && styles.quickChipTextActive,
                    ]}
                  >
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.modalInput}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="e.g. Kitchen overload / Item out of stock"
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setRejectModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={confirmRejection}
                activeOpacity={0.8}
              >
                <Text style={styles.modalConfirmText}>Confirm Rejection</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  actionError: { color: colors.textRed, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  emptyQueue: { alignItems: 'center', padding: spacing.xl, gap: spacing.xs },
  telemetryBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E5E3',
  },
  telemetryInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  telemetryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  telemetryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  dotConnected: {
    backgroundColor: colors.primary,
  },
  dotReconnecting: {
    backgroundColor: colors.pending,
  },
  dotOffline: {
    backgroundColor: colors.rejected,
  },
  connectionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  lastSyncedText: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: 3,
    fontVariant: ['tabular-nums'],
  },
  syncBtn: {
    minHeight: 44,
    minWidth: 54,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    backgroundColor: colors.surfaceGreen,
  },
  syncText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  soundToggle: {
    minHeight: 44,
    minWidth: 54,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  soundText: {
    fontSize: 10,
    fontWeight: '700',
  },
  alertBanner: {
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  alertInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  alertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  alertPulse: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(25, 59, 44, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.surfaceDark,
  },
  alertSub: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.surfaceDark,
    opacity: 0.85,
  },
  alertDismissBtn: {
    padding: spacing.xs,
  },
  tabBar: { marginHorizontal: 14, borderBottomWidth: 1, borderColor: '#E2E5E3' },
  tabsList: { gap: 2 },
  tabButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 4, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabButtonActive: { borderBottomColor: colors.primary },
  tabLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: '500' },
  tabLabelActive: { color: colors.primary, fontWeight: '800' },
  tabBadge: { borderRadius: 12, minWidth: 18, alignItems: 'center', paddingHorizontal: 4 },
  tabBadgeText: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
  queueLayout: { flex: 1, paddingHorizontal: 14, paddingTop: 12 },
  queueLayoutWide: { flexDirection: 'row', gap: 14, paddingBottom: 16 },
  queuePanel: { flex: 2, borderWidth: 1, borderColor: '#E2E5E3', borderRadius: 12 },
  detailPanel: { flex: 3, borderWidth: 1, borderColor: '#E2E5E3', borderRadius: 12 },
  detailContent: { padding: 24 },
  ordersList: { paddingBottom: 20 },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 300,
    marginBottom: spacing.md,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.lg,
    minHeight: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    justifyContent: 'center',
  },
  refreshButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  selectOutletActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.xl,
    minHeight: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
  },
  selectOutletActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textWhite,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 25, 21, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.modal,
  },
  modalHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  modalAlertIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.rejectedLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  quickChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginVertical: spacing.sm,
  },
  quickChip: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  quickChipActive: {
    backgroundColor: colors.rejectedLight,
    borderColor: colors.rejected,
  },
  quickChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  quickChipTextActive: {
    color: colors.rejectedDark,
    fontWeight: '800',
  },
  modalInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: 13,
    color: colors.textPrimary,
    minHeight: 42,
    marginBottom: spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  modalCancelButton: {
    paddingHorizontal: spacing.md,
    minHeight: 38,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modalConfirmButton: {
    paddingHorizontal: spacing.lg,
    minHeight: 38,
    borderRadius: borderRadius.md,
    backgroundColor: colors.rejected,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textWhite,
  },
});
