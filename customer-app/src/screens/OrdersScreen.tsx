import { appStyles } from '../theme/appStyles';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenEmptyState } from '../components/ScreenEmptyState';
import { useServiceAreas } from '../context/DeliveryLocationContext';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  AppState,
} from 'react-native';
import { colors, spacing, typography, borderRadius } from '../theme/tokens';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { apiRequest, API_BASE_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { USE_MOCK_DATA, MOCK_ORDERS } from '../api/mockData';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

WebBrowser.maybeCompleteAuthSession();

export interface OrderRefundSummary {
  amount: string | number;
  status: 'pending' | 'processed' | 'failed' | string;
  reason?: string;
  refundId?: string | null;
  createdAt?: string;
}

export interface OrderItemSummary {
  id: string;
  orderNumber: string;
  restaurantName: string;
  outletName: string;
  status: string;
  paymentStatus?: string;
  totalPayable: string;
  itemCount: number;
  createdAt: string;
  refund?: OrderRefundSummary | null;
}

interface OrdersScreenProps {
  onRequireAuth: () => void;
  onExploreFood?: () => void;
  onTrackOrder?: (orderId: string) => void;
}

export const OrdersScreen: React.FC<OrdersScreenProps> = ({
  onRequireAuth,
  onExploreFood,
  onTrackOrder,
}) => {
  const serviceAreas = useServiceAreas();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<OrderItemSummary[]>(USE_MOCK_DATA ? MOCK_ORDERS : []);
  const [isLoading, setIsLoading] = useState(!USE_MOCK_DATA);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);

  const requestVersion = useRef(0);
  const retryLock = useRef(false);
  const [paymentNotice, setPaymentNotice] = useState<string>();
  const [verifyingOrderId, setVerifyingOrderId] = useState<string>();
  const fetchOrders = useCallback(async () => {
    const version = ++requestVersion.current;
    if (USE_MOCK_DATA) {
      setOrders(MOCK_ORDERS);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await apiRequest<{ orders: OrderItemSummary[] }>('/orders');
      if (version === requestVersion.current) setOrders(res.orders || []);
    } catch {
      // Keep the last snapshot if a background refresh fails.
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void Promise.resolve().then(() => fetchOrders());
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') fetchOrders();
    });
    return () => {
      requestVersion.current++;
      subscription.remove();
    };
  }, [fetchOrders]);

  const hasPending = orders.some(
    (order) =>
      (order.status === 'pending_payment' &&
        (order.paymentStatus !== 'failed' || order.id === verifyingOrderId)) ||
      order.status === 'payment_conflict' ||
      (order.refund && order.refund.status === 'pending'),
  );
  useEffect(() => {
    if (!isAuthenticated || USE_MOCK_DATA || !hasPending || payingOrderId) return;
    let attempts = 0;
    const timer = setInterval(() => {
      if (++attempts >= 12) {
        clearInterval(timer);
        setVerifyingOrderId(undefined);
      }
      fetchOrders();
    }, 5000);
    return () => clearInterval(timer);
  }, [fetchOrders, hasPending, isAuthenticated, payingOrderId]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchOrders();
  };

  const handlePayNow = async (order: OrderItemSummary) => {
    if (retryLock.current || (verifyingOrderId === order.id && order.paymentStatus !== 'failed')) return;
    if (USE_MOCK_DATA) {
      Alert.alert('Payment (Mock Mode)', 'Mock payment successful! Order marked as placed.');
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: 'placed' } : o)),
      );
      return;
    }

    retryLock.current = true;
    try {
      setPayingOrderId(order.id);
      setPaymentNotice(undefined);
      setVerifyingOrderId(undefined);
      const latest = await apiRequest<{ status: string; payment?: { status: string } }>(`/orders/${order.id}`);
      if (latest.status !== 'pending_payment' || latest.payment?.status === 'captured') {
        return;
      }

      // 1. Request Payment Session
      const session = await apiRequest<{
        orderId: string;
        orderNumber: string;
        razorpayOrderId: string;
        keyId: string;
        amount: number;
        currency: string;
        status: string;
        checkoutUrl?: string;
      }>(`/orders/${order.id}/payment-session`, {
        method: 'POST',
      });

      // 2. Open Hosted Razorpay Checkout
      const returnUrl = Linking.createURL('payment-callback');
      const checkoutEndpoint = `${API_BASE_URL}/payments/checkout/${order.id}?returnUrl=${encodeURIComponent(returnUrl)}`;

      const browserResult = await WebBrowser.openAuthSessionAsync(checkoutEndpoint, returnUrl);

      // 3. Process Result
      if (browserResult.type === 'success' && browserResult.url) {
        const parsed = Linking.parse(browserResult.url);
        const params = parsed.queryParams || {};

        if (params.status === 'cancelled') {
          setPaymentNotice('Checkout cancelled. Check the order below for the latest payment status.');
          return;
        }

        setVerifyingOrderId(order.id);
        const rzpPaymentId = params.razorpay_payment_id as string;
        const rzpOrderId = (params.razorpay_order_id as string) || session.razorpayOrderId;
        const rzpSignature = params.razorpay_signature as string;

        if (rzpPaymentId && rzpSignature) {
          const verifyResult = await apiRequest<{
            verified: boolean;
            orderId: string;
            orderStatus: string;
            paymentStatus: string;
          }>('/payments/verify', {
            method: 'POST',
            body: JSON.stringify({
              razorpayOrderId: rzpOrderId,
              razorpayPaymentId: rzpPaymentId,
              razorpaySignature: rzpSignature,
            }),
          });

          if (verifyResult.verified && verifyResult.orderId === order.id && verifyResult.paymentStatus === 'captured' && verifyResult.orderStatus === 'placed') {
            Alert.alert('Payment Successful!', `Order #${order.orderNumber} is confirmed.`);
            return;
          }
        }
        setPaymentNotice('Verifying payment. This order will update once capture is confirmed.');
      } else {
        setPaymentNotice('Checkout closed. Check the order below for the latest payment status.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment attempt failed';
      setPaymentNotice(msg + ' Check the order below for the latest payment status.');
    } finally {
      await fetchOrders();
      retryLock.current = false;
      setPayingOrderId(null);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
      { text: 'Keep Order', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          if (USE_MOCK_DATA) {
            setOrders((prev) =>
              prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelled' } : o)),
            );
            Alert.alert('Order Cancelled', 'Your order was successfully cancelled.');
            return;
          }

          try {
            await apiRequest(`/orders/${orderId}/cancel`, {
              method: 'POST',
              body: JSON.stringify({ reason: 'Customer requested cancellation from app' }),
            });
            Alert.alert('Order Cancelled', 'Your order was successfully cancelled.');
            fetchOrders();
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Cannot cancel order';
            Alert.alert('Cancellation Notice', msg);
          }
        },
      },
    ]);
  };

  if (!isAuthenticated && !USE_MOCK_DATA) {
    return (
      <ScreenEmptyState icon="receipt-outline" title="Sign in to view your orders" subtitle="Follow your food from the kitchen to your door, or order your favourites again." action="Log In / Sign Up" onPress={onRequireAuth} />
    );
  }

  const renderStatusBadge = (status: string, paymentStatus?: string, verifying = false, refund?: OrderRefundSummary | null) => {
    switch (status) {
      case 'placed':
        return (
          <View style={[styles.statusBadge, styles.statusPlaced]}>
            <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.statusBadgeText, { color: colors.primaryDark }]}>CONFIRMED</Text>
          </View>
        );
      case 'confirmed':
        return (
          <View style={[styles.statusBadge, styles.statusPlaced]}>
            <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.statusBadgeText, { color: colors.primaryDark }]}>ACCEPTED BY RESTAURANT</Text>
          </View>
        );
      case 'preparing':
        return (
          <View style={[styles.statusBadge, styles.statusPlaced]}>
            <Ionicons name="restaurant-outline" size={12} color={colors.primary} />
            <Text style={[styles.statusBadgeText, { color: colors.primaryDark }]}>PREPARING FOOD</Text>
          </View>
        );
      case 'ready_for_pickup':
        return (
          <View style={[styles.statusBadge, styles.statusPlaced]}>
            <Ionicons name="bag-check-outline" size={12} color={colors.primary} />
            <Text style={[styles.statusBadgeText, { color: colors.primaryDark }]}>READY FOR PICKUP</Text>
          </View>
        );
      case 'out_for_delivery':
        return (
          <View style={[styles.statusBadge, styles.statusPlaced]}>
            <Ionicons name="bicycle-outline" size={12} color={colors.primary} />
            <Text style={[styles.statusBadgeText, { color: colors.primaryDark }]}>OUT FOR DELIVERY</Text>
          </View>
        );
      case 'delivered':
        return (
          <View style={[styles.statusBadge, styles.statusPlaced]}>
            <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
            <Text style={[styles.statusBadgeText, { color: colors.primaryDark }]}>DELIVERED</Text>
          </View>
        );
      case 'pending_payment':
        return (
          <View style={[styles.statusBadge, styles.statusPending]}>
            <Ionicons name="time-outline" size={12} color={colors.accent} />
            <Text style={[styles.statusBadgeText, { color: colors.accent }]}>
              {paymentStatus === 'failed'
                ? 'PAYMENT FAILED'
                : verifying
                ? 'VERIFYING PAYMENT'
                : 'AWAITING PAYMENT'}
            </Text>
          </View>
        );
      case 'payment_conflict':
        return (
          <View style={[styles.statusBadge, styles.statusConflict]}>
            <Ionicons name="shield-outline" size={12} color="#92400E" />
            <Text style={[styles.statusBadgeText, { color: '#92400E' }]}>
              {refund?.status === 'processed'
                ? 'REFUND COMPLETED'
                : refund?.status === 'pending'
                ? 'REFUND IN PROGRESS'
                : refund?.status === 'failed'
                ? 'REFUND NEEDS REVIEW'
                : 'PAYMENT UNDER REVIEW'}
            </Text>
          </View>
        );
      case 'cancelled':
        return (
          <View style={[styles.statusBadge, styles.statusCancelled]}>
            <View style={[styles.statusDot, { backgroundColor: colors.error }]} />
            <Text style={[styles.statusBadgeText, { color: colors.error }]}>
              {refund?.status === 'processed'
                ? 'CANCELLED & REFUNDED'
                : refund?.status === 'pending'
                ? 'CANCELLED • REFUND IN PROGRESS'
                : 'CANCELLED'}
            </Text>
          </View>
        );
      case 'rejected':
        return (
          <View style={[styles.statusBadge, styles.statusCancelled]}>
            <View style={[styles.statusDot, { backgroundColor: colors.error }]} />
            <Text style={[styles.statusBadgeText, { color: colors.error }]}>REJECTED</Text>
          </View>
        );
      default:
        // Neutral fallback for any unknown future status without misleading financial claim
        return (
          <View style={[styles.statusBadge, styles.statusNeutral]}>
            <View style={[styles.statusDot, { backgroundColor: '#6B7280' }]} />
            <Text style={[styles.statusBadgeText, { color: '#4B5563' }]}>
              {status ? status.replace(/_/g, ' ').toUpperCase() : 'ORDER RECORDED'}
            </Text>
          </View>
        );
    }
  };

  const renderHeader = () => (
    <ScreenHeader title="My orders" subtitle={`${orders.length} orders · Your latest deliveries and favourite meals`} icon="receipt-outline">
      {paymentNotice && <Text accessibilityRole="alert" style={styles.paymentHeaderNotice}>{paymentNotice}</Text>}
    </ScreenHeader>
  );

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={[styles.centerContainer, { paddingTop: insets.top + 60 }]}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading your orders...</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 16 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => {
            const isCancellable =
              item.status === 'pending_payment' || item.status === 'placed';
            const isPendingPayment = item.status === 'pending_payment';

            return (
              <View style={styles.orderCard}>
                {/* Top: Restaurant Header & Status */}
                <View style={styles.cardHeader}>
                  <View style={styles.outletIconCircle}>
                    <Ionicons name="restaurant-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.headerTextCol}>
                    <Text style={styles.restName} numberOfLines={2}>
                      {item.restaurantName}
                    </Text>
                    <Text style={styles.outletName} numberOfLines={1}>
                      {item.outletName}
                    </Text>
                  </View>
                </View>
                <View style={styles.orderStatusRow}>
                  {renderStatusBadge(
                    item.status,
                    item.paymentStatus,
                    verifyingOrderId === item.id,
                    item.refund,
                  )}
                </View>

                {/* Conflict Notice Card for payment_conflict orders */}
                {item.status === 'payment_conflict' && (
                  <View style={styles.conflictCardBox}>
                    <View style={styles.conflictHeaderRow}>
                      <Ionicons name="alert-circle" size={16} color="#92400E" />
                      <Text style={styles.conflictHeading}>Payment Received, Under Review</Text>
                    </View>
                    <Text style={styles.conflictBodyText}>
                      We received your payment of ₹{parseFloat(item.totalPayable).toFixed(0)}, but this
                      order could not be placed because another order is already active. Our team is
                      reviewing the payment for refund approval.
                    </Text>
                    {item.refund && (
                      <View style={styles.refundSnippetBox}>
                        <View style={styles.refundSnippetRow}>
                          <Text style={styles.refundSnippetLabel}>Refund Status:</Text>
                          <Text style={styles.refundSnippetValue}>
                            {item.refund.status === 'processed'
                              ? 'Completed'
                              : item.refund.status === 'pending'
                              ? 'In Progress'
                              : item.refund.status === 'failed'
                              ? 'Needs Review'
                              : item.refund.status}
                          </Text>
                        </View>
                        {item.refund.refundId && (
                          <View style={styles.refundSnippetRow}>
                            <Text style={styles.refundSnippetLabel}>Reference:</Text>
                            <Text style={[styles.refundSnippetValue, { fontFamily: 'monospace' }]}>
                              {item.refund.refundId}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}

                {/* Refund Information Banner for cancelled orders with refund details */}
                {item.status === 'cancelled' && item.refund && (
                  <View style={styles.refundInfoBox}>
                    <Ionicons
                      name={item.refund.status === 'processed' ? 'checkmark-circle' : 'time-outline'}
                      size={15}
                      color={item.refund.status === 'processed' ? '#065F46' : '#92400E'}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.refundInfoTitle}>
                        {item.refund.status === 'processed'
                          ? `Refund of ₹${parseFloat(String(item.refund.amount || item.totalPayable)).toFixed(0)} Completed`
                          : item.refund.status === 'pending'
                          ? `Refund of ₹${parseFloat(String(item.refund.amount || item.totalPayable)).toFixed(0)} In Progress`
                          : 'Refund Requires Operations Review'}
                      </Text>
                      {item.refund.refundId && (
                        <Text style={styles.refundInfoSub}>
                          Gateway Ref: {item.refund.refundId}
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                {/* Middle: Order metadata */}
                <View style={styles.cardDivider} />

                <View style={styles.cardMetaRow}>
                  <View style={styles.metaLeftCol}>
                    <View style={styles.orderNumberCapsule}>
                      <Text style={styles.orderNum}>#{item.orderNumber}</Text>
                    </View>
                    <View style={styles.dateTimeRow}>
                      <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
                      <Text style={styles.itemsCount}>
                        {item.itemCount} {item.itemCount === 1 ? 'item' : 'items'} •{' '}
                        {new Date(item.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.priceCol}>
                    <Text style={styles.priceLabel}>TOTAL</Text>
                    <Text style={styles.totalPrice}>₹{parseFloat(item.totalPayable).toFixed(0)}</Text>
                  </View>
                </View>

                {/* Bottom: Action row */}
                {isPendingPayment ? (
                  <View style={styles.actionRowContainer}>
                    <TouchableOpacity
                      style={styles.payNowBtn}
                      activeOpacity={0.88}
                      disabled={Boolean(payingOrderId) || (verifyingOrderId === item.id && item.paymentStatus !== 'failed')}
                      onPress={() => handlePayNow(item)}
                    >
                      {payingOrderId === item.id || (verifyingOrderId === item.id && item.paymentStatus !== 'failed') ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="card-outline" size={16} color="#FFFFFF" />
                          <Text style={styles.payNowBtnText}>
                            Complete Payment • ₹{parseFloat(item.totalPayable).toFixed(0)}
                          </Text>
                          <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.cancelTextBtn}
                      activeOpacity={0.7}
                      onPress={() => handleCancelOrder(item.id)}
                    >
                      <Text style={styles.cancelTextBtnLabel}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : item.status === 'payment_conflict' ? (
                  // Strictly NO Pay Now, NO Retry, NO Live Tracking for conflict orders
                  null
                ) : (
                  <View style={styles.actionRowContainer}>
                    {/* Live Tracking Button for active in-flight deliveries */}
                    {['placed', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered'].includes(item.status) &&
                      (USE_MOCK_DATA || item.paymentStatus === 'captured') && (
                      <TouchableOpacity
                        style={styles.trackOrderBtn}
                        activeOpacity={0.88}
                        onPress={() => onTrackOrder?.(item.id)}
                      >
                        <Ionicons name="navigate-circle" size={16} color="#FFFFFF" />
                        <Text style={styles.trackOrderBtnText}>
                          {item.status === 'delivered' ? 'View Delivery Summary' : 'Live Delivery Tracking'}
                        </Text>
                        <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}

                    {isCancellable && (
                      <TouchableOpacity
                        style={styles.cancelTextBtn}
                        activeOpacity={0.7}
                        onPress={() => handleCancelOrder(item.id)}
                      >
                        <Text style={styles.cancelTextBtnLabel}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="fast-food-outline" size={40} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No orders placed yet</Text>
              <Text style={styles.emptySub}>
                Explore delicious meals from top restaurants in {serviceAreas} and enjoy lightning-fast delivery.
              </Text>
              {onExploreFood && (
                <TouchableOpacity
                  style={styles.exploreBtn}
                  onPress={onExploreFood}
                  activeOpacity={0.85}
                >
                  <Text style={styles.exploreBtnText}>Browse Restaurants</Text>
                  <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = appStyles({
  paymentHeaderNotice: { color: '#FFFFFF', fontSize: 12, lineHeight: 18, marginTop: 12 },
  orderStatusRow: { alignItems: 'flex-start', marginTop: 12 },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },
  header: {
    marginBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  screenHeading: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  orderCountBadge: {
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  orderCountBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  headerSub: {
    fontSize: 13.5,
    color: colors.textSecondary,
    marginTop: 4,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md + 2,
    marginBottom: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  outletIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  restName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  outletName: {
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: borderRadius.full,
  },
  statusPlaced: {
    backgroundColor: colors.surfaceGreen,
  },
  statusPending: {
    backgroundColor: '#FEF6EE',
  },
  statusCancelled: {
    backgroundColor: '#FDF2F2',
  },
  statusConflict: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusNeutral: {
    backgroundColor: '#F3F4F6',
  },
  conflictCardBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  conflictHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  conflictHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  conflictBodyText: {
    fontSize: 11.5,
    color: '#78350F',
    lineHeight: 16,
  },
  refundSnippetBox: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
    gap: 2,
  },
  refundSnippetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  refundSnippetLabel: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
  },
  refundSnippetValue: {
    fontSize: 11,
    color: '#78350F',
    fontWeight: '700',
  },
  refundInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  refundInfoTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#166534',
  },
  refundInfoSub: {
    fontSize: 10.5,
    color: '#15803D',
    fontFamily: 'monospace',
    marginTop: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaLeftCol: {
    flex: 1,
  },
  orderNumberCapsule: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F2EB',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginBottom: 4,
  },
  orderNum: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  itemsCount: {
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  priceCol: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  actionRowContainer: {
    marginTop: spacing.md,
    gap: 8,
  },
  payNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: borderRadius.md,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  payNowBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  trackOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: borderRadius.md,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  trackOrderBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  cancelTextBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  cancelTextBtnLabel: {
    fontSize: 12.5,
    color: colors.textMuted,
    fontWeight: '600',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  kitchenStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  kitchenStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  cancelOrderSmallBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cancelOrderSmallText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.error,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 13.5,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: spacing.lg,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13.5,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: borderRadius.full,
    marginTop: spacing.lg,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 3,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  loginBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: borderRadius.full,
    marginTop: spacing.lg,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
