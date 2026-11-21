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
import { StateView } from '../components/ui/StateView';
import { BOARD_COLUMNS, BOARD_MIN_WIDTH, groupForBoard, liveOrderCount } from '../utils/kitchenBoard';
import { KitchenHeader } from '../components/KitchenHeader';
import { KitchenOrderCard } from '../components/KitchenOrderCard';
import {
  getRestaurantSocket,
  RESTAURANT_WS_EVENTS,
  OrderCreatedSocketPayload,
} from '../api/restaurantSocket';
import { Socket } from 'socket.io-client';
import { appStyles } from '../theme/appStyles';

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
  // Kitchen display: New / Preparing / Ready side by side on large tablets and screens.
  const isBoard = width >= BOARD_MIN_WIDTH;

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

  const boardMode = isBoard && selectedTab !== 'history';
  const boardTone: Record<string, [string, string]> = {
    placed: [colors.pending, colors.pendingLight],
    preparing: [colors.preparing, colors.preparingLight],
    ready_for_pickup: [colors.ready, colors.readyLight],
  };
  const boardOrders = groupForBoard(outletOrders);
  const liveCount = liveOrderCount(outletOrders);
  const shownTabs: typeof tabs = isBoard
    ? [{ key: 'placed', label: 'Live board', count: liveCount, tone: colors.surfaceGreen }, tabs[3]]
    : tabs;

  const renderBoardOrder = (item: RestaurantOrder) => (
    <KitchenOrderCard
      order={item}
      mode="accordion"
      selected={selection?.outletId === outletId && selection?.orderId === item.id}
      onPressDetails={() => setSelection({ outletId: item.outletId, orderId: selection?.orderId === item.id ? null : item.id })}
      actionLoading={actionLoadingId === item.id}
      actionsDisabled={Boolean(actionLoadingId)}
      onAccept={permissions.canAcceptOrders ? () => handleUpdateStatus(item.id, 'confirmed') : undefined}
      onReject={permissions.canAcceptOrders ? () => openRejectModal(item.id) : undefined}
      onStartPreparing={permissions.canUpdateKitchenStatus ? () => handleUpdateStatus(item.id, 'preparing') : undefined}
      onMarkReady={permissions.canUpdateKitchenStatus ? () => handleUpdateStatus(item.id, 'ready_for_pickup') : undefined}
    />
  );

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
      <KitchenHeader kitchen onOutletPress={onNavigateToOutlets}>
        <View style={styles.telemetryInner} accessibilityLabel={`Kitchen connection ${connectionStatus}`}>
          <View style={styles.chip}>
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
            <Text style={styles.chipText}>{connectionStatus}</Text>
            {lastSyncedAt && (
              <Text style={styles.chipMuted}>
                · {lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </View>
          <View style={styles.telemetryRight}>
            <TouchableOpacity
              style={styles.chipButton}
              onPress={() => fetchOrdersAndOverview(false)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Sync kitchen orders"
            >
              <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
              <Text style={styles.chipText}>Sync</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chipButton, !soundEnabled && styles.chipButtonOff]}
              onPress={() => setSoundEnabled((prev) => !prev)}
              activeOpacity={0.7}
              accessibilityRole="switch"
              accessibilityState={{ checked: soundEnabled }}
              accessibilityLabel="Sound alerts for new orders"
            >
              <Ionicons name={soundEnabled ? 'volume-high-outline' : 'volume-mute-outline'} size={16} color="#FFFFFF" />
              {width >= 480 && <Text style={styles.chipText}>{soundEnabled ? 'Alerts on' : 'Muted'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KitchenHeader>

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
          data={shownTabs}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.tabsList}
          renderItem={({ item }) => {
            const isSelected = boardMode ? item.key !== 'history' : selectedTab === item.key;
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
                {item.count !== undefined && (
                  <View style={[styles.tabBadge, { backgroundColor: isSelected ? colors.limeAccent : item.tone }]}>
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
        <StateView
          icon="storefront-outline"
          title="Choose a kitchen"
          message="Select the outlet you are running to see its live orders."
          actionLabel={onNavigateToOutlets ? 'Select outlet' : undefined}
          onAction={onNavigateToOutlets}
        />
      ) : (loading || (loadedOutletId !== outletId && !fetchError)) ? (
        <StateView loading title="Loading orders" message={`Fetching live orders for ${activeOutlet.name}.`} />
      ) : fetchError ? (
        <StateView
          tone="error"
          icon="cloud-offline-outline"
          title="Couldn’t load orders"
          message={fetchError}
          actionLabel="Try again"
          onAction={() => fetchOrdersAndOverview(false)}
        />
      ) : boardMode ? (
        <ScrollView horizontal style={styles.boardScroll} contentContainerStyle={styles.board} showsHorizontalScrollIndicator={false}>
          {BOARD_COLUMNS.map(column => {
            const columnOrders = boardOrders[column.key];
            const [tone, toneLight] = boardTone[column.key];
            return (
              <View key={column.key} style={styles.boardColumn} accessibilityLabel={`${column.label}, ${columnOrders.length} orders`}>
                <View style={[styles.boardHeader, { borderTopColor: tone }]}>
                  <Text style={styles.boardTitle}>{column.label}</Text>
                  <View style={[styles.boardCount, { backgroundColor: toneLight }]}>
                    <Text style={[styles.boardCountText, { color: tone }]}>{columnOrders.length}</Text>
                  </View>
                </View>
                <FlatList
                  data={columnOrders}
                  keyExtractor={(item) => item.id}
                  extraData={selection?.orderId}
                  contentContainerStyle={styles.boardList}
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
                  ListEmptyComponent={<StateView compact icon="checkmark-done-outline" title="Nothing here" message={column.empty} />}
                  renderItem={({ item }) => renderBoardOrder(item)}
                />
              </View>
            );
          })}
        </ScrollView>
      ) : visibleOrders.length === 0 ? (
        <StateView compact icon="receipt-outline" title={selectedTab === 'history' ? 'No past orders yet' : 'Queue is clear'} message={EMPTY_QUEUE[selectedTab]} />
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

const styles = appStyles({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  actionError: { color: colors.textRed, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  emptyQueue: { alignItems: 'center', padding: spacing.xl, gap: spacing.xs },
  // Live status chips inside the dark kitchen header
  telemetryInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  telemetryRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { flexShrink: 1, minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  chipButton: { minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)' },
  chipButtonOff: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  chipText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  chipMuted: { color: '#B9CCC1', fontSize: 12, fontVariant: ['tabular-nums'] },
  connectionDot: { width: 8, height: 8, borderRadius: 4 },
  dotConnected: { backgroundColor: colors.limeAccent },
  dotReconnecting: { backgroundColor: '#F5B84A' },
  dotOffline: { backgroundColor: '#F87171' },
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
  tabBar: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4, width: '100%', maxWidth: 1600, alignSelf: 'center' },
  tabsList: { gap: 8 },
  tabButton: {
    minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 8, borderRadius: 999,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  tabButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  tabLabelActive: { color: '#FFFFFF' },
  tabBadge: { borderRadius: 12, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  tabBadgeText: { color: colors.textPrimary, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  queueLayout: { flex: 1, paddingHorizontal: 14, paddingTop: 12, width: '100%', maxWidth: 1600, alignSelf: 'center' },
  boardScroll: { flex: 1 },
  board: { flexGrow: 1, gap: 14, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 16 },
  boardColumn: { flex: 1, minWidth: 360, backgroundColor: colors.surfaceMuted, borderRadius: 22, overflow: 'hidden' },
  boardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 4, backgroundColor: colors.surface },
  boardTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  boardCount: { minWidth: 32, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  boardCountText: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  boardList: { padding: 10, gap: 10, flexGrow: 1 },
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
