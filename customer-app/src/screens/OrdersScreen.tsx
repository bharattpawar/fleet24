import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
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

export interface OrderItemSummary {
  id: string;
  orderNumber: string;
  restaurantName: string;
  outletName: string;
  status: string;
  totalPayable: string;
  itemCount: number;
  createdAt: string;
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
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<OrderItemSummary[]>(USE_MOCK_DATA ? MOCK_ORDERS : []);
  const [isLoading, setIsLoading] = useState(!USE_MOCK_DATA);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);

  const fetchOrders = async () => {
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
      setOrders(res.orders || []);
    } catch {
      setOrders([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [isAuthenticated]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchOrders();
  };

  const handlePayNow = async (order: OrderItemSummary) => {
    if (payingOrderId) return;
    if (USE_MOCK_DATA) {
      Alert.alert('Payment (Mock Mode)', 'Mock payment successful! Order marked as placed.');
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: 'placed' } : o)),
      );
      return;
    }

    try {
      setPayingOrderId(order.id);

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
          Alert.alert('Checkout Cancelled', 'Payment was cancelled. You can retry whenever you are ready.');
          return;
        }

        const rzpPaymentId = params.razorpay_payment_id as string;
        const rzpOrderId = (params.razorpay_order_id as string) || session.razorpayOrderId;
        const rzpSignature = params.razorpay_signature as string;

        if (rzpPaymentId && rzpSignature) {
          const verifyResult = await apiRequest<{
            verified: boolean;
            orderId: string;
            orderStatus: string;
          }>('/payments/verify', {
            method: 'POST',
            body: JSON.stringify({
              razorpayOrderId: rzpOrderId,
              razorpayPaymentId: rzpPaymentId,
              razorpaySignature: rzpSignature,
            }),
          });

          if (verifyResult.verified && verifyResult.orderStatus === 'placed') {
            Alert.alert('Payment Successful!', `Order #${order.orderNumber} is confirmed.`);
            fetchOrders();
            return;
          }
        }
      }

      await fetchOrders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment attempt failed';
      Alert.alert('Payment Notice', msg);
    } finally {
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
      <View style={[styles.centerContainer, { paddingTop: insets.top + 40 }]}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="receipt-outline" size={42} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>Sign in to view your orders</Text>
        <Text style={styles.emptySub}>
          Track your active food deliveries and review past orders easily.
        </Text>
        <TouchableOpacity style={styles.loginBtn} activeOpacity={0.85} onPress={onRequireAuth}>
          <Text style={styles.loginBtnText}>Log In / Sign Up</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'placed':
        return (
          <View style={[styles.statusBadge, styles.statusPlaced]}>
            <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.statusBadgeText, { color: colors.primaryDark }]}>CONFIRMED</Text>
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
            <Text style={[styles.statusBadgeText, { color: colors.accent }]}>AWAITING PAYMENT</Text>
          </View>
        );
      case 'cancelled':
      case 'rejected':
      default:
        return (
          <View style={[styles.statusBadge, styles.statusCancelled]}>
            <View style={[styles.statusDot, { backgroundColor: colors.error }]} />
            <Text style={[styles.statusBadgeText, { color: colors.error }]}>CANCELLED</Text>
          </View>
        );
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTitleRow}>
        <Text style={styles.screenHeading}>My Orders</Text>
        <View style={styles.orderCountBadge}>
          <Text style={styles.orderCountBadgeText}>{orders.length}</Text>
        </View>
      </View>
      <Text style={styles.headerSub}>Active deliveries & culinary history</Text>
    </View>
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
                    <Text style={styles.restName} numberOfLines={1}>
                      {item.restaurantName}
                    </Text>
                    <Text style={styles.outletName} numberOfLines={1}>
                      {item.outletName}
                    </Text>
                  </View>
                  {renderStatusBadge(item.status)}
                </View>

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
                      disabled={payingOrderId === item.id}
                      onPress={() => handlePayNow(item)}
                    >
                      {payingOrderId === item.id ? (
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
                ) : (
                  <View style={styles.actionRowContainer}>
                    {/* Live Tracking Button for active in-flight deliveries */}
                    {item.status !== 'cancelled' && item.status !== 'rejected' && (
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
                Explore delicious meals from top restaurants in Greater Noida and enjoy lightning-fast delivery.
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

const styles = StyleSheet.create({
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
