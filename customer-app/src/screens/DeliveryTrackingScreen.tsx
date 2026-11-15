import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius } from '../theme/tokens';
import { apiRequest } from '../api/client';
import {
  getTrackingSocket,
  disconnectTrackingSocket,
  DELIVERY_WS_EVENTS,
  DeliveryLocationEvent,
  DeliveryRiderAssignedEvent,
  DeliveryStatusUpdatedEvent,
  DeliveryCompletedEvent,
  DeliveryCancelledEvent,
  DeliveryErrorEvent,
} from '../api/trackingSocket';
import { DeliveryMapView } from '../components/DeliveryMapView';

export interface CustomerDeliveryResponse {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus?: string;
  deliveryStatus: string;
  deliveryOtp?: string;
  otpExpiresAt?: string | null;
  restaurant: {
    name: string;
    address: string;
    phone: string;
  };
  rider?: {
    fullName: string | null;
    vehicleType: string;
    vehicleNumber: string | null;
    location?: {
      latitude: number;
      longitude: number;
      accuracy?: number | null;
      heading?: number | null;
      speed?: number | null;
      capturedAt?: string | null;
      updatedAt: string;
      freshness: string;
      ageSeconds: number;
    } | null;
  } | null;
  timestamps: {
    placedAt: string | null;
    confirmedAt: string | null;
    assignedAt: string | null;
    pickedUpAt: string | null;
    arrivedCustomerAt: string | null;
    deliveredAt: string | null;
  };
  deliveryAddress: any;
}

interface DeliveryTrackingScreenProps {
  onViewOrders: () => void;
  orderId: string;
  onBack: () => void;
}

export const DeliveryTrackingScreen: React.FC<DeliveryTrackingScreenProps> = ({
  orderId,
  onViewOrders,
  onBack,
}) => {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<CustomerDeliveryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [riderCoords, setRiderCoords] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [isStaleLocation, setIsStaleLocation] = useState(false);
  const [lastLocationTime, setLastLocationTime] = useState<string | null>(null);

  const socketRef = useRef<any>(null);
  const isSubscribedRef = useRef(false);

  // 1. Initial REST Snapshot fetch
  const fetchDeliverySnapshot = useCallback(async () => {
    try {
      const [res, order] = await Promise.all([
        apiRequest<CustomerDeliveryResponse>(`/orders/${orderId}/delivery`),
        apiRequest<{ status: string; payment?: { status: string } }>(`/orders/${orderId}`),
      ]);
      res.orderStatus = order.status;
      res.paymentStatus = order.payment?.status;
      setData(res);

      if (res.rider?.location) {
        setRiderCoords({
          latitude: res.rider.location.latitude,
          longitude: res.rider.location.longitude,
        });
        setIsStaleLocation(res.rider.location.freshness === 'stale');
        setLastLocationTime(res.rider.location.updatedAt);
      }
    } catch (err: any) {
      Alert.alert('Tracking Unavailable', err.message || 'Could not load order tracking details.');
    } finally {
      setIsLoading(false);
      setIsReconnecting(false);
    }
  }, [orderId]);

  // 2. Setup WebSocket Connection & Event Subscriptions
  useEffect(() => {
    let isMounted = true;

    async function initSocket() {
      // First fetch the REST snapshot
      await fetchDeliverySnapshot();

      if (!isMounted) return;

      const socket = await getTrackingSocket();
      if (!socket || !isMounted) return;

      socketRef.current = socket;

      function onConnect() {
        if (!isMounted || !socket) return;
        setIsWsConnected(true);
        setIsReconnecting(false);

        // Subscribe to this order's delivery room
        socket.emit(DELIVERY_WS_EVENTS.SUBSCRIBE, { orderId });
      }

      function onDisconnect() {
        if (!isMounted) return;
        setIsWsConnected(false);
        setIsReconnecting(true);
        isSubscribedRef.current = false;
      }

      function onSubscribed() {
        if (!isMounted) return;
        isSubscribedRef.current = true;
      }

      function onLocationUpdated(evt: DeliveryLocationEvent) {
        if (!isMounted || evt.orderId !== orderId) return;

        setRiderCoords({
          latitude: evt.latitude,
          longitude: evt.longitude,
        });
        setIsStaleLocation(false);
        setLastLocationTime(evt.updatedAt);
      }

      function onRiderAssigned(evt: DeliveryRiderAssignedEvent) {
        if (!isMounted || evt.orderId !== orderId) return;

        setData((prev) =>
          prev
            ? {
                ...prev,
                deliveryStatus: 'assigned',
                rider: {
                  fullName: evt.rider.fullName,
                  vehicleType: evt.rider.vehicleType,
                  vehicleNumber: evt.rider.vehicleNumber,
                  location: prev.rider?.location,
                },
              }
            : prev,
        );
      }

      function onStatusUpdated(evt: DeliveryStatusUpdatedEvent) {
        if (!isMounted || evt.orderId !== orderId) return;

        setData((prev) =>
          prev
            ? {
                ...prev,
                deliveryStatus: evt.status,
                orderStatus: evt.orderStatus,
              }
            : prev,
        );
      }

      function onCompleted(evt: DeliveryCompletedEvent) {
        if (!isMounted || evt.orderId !== orderId) return;

        setData((prev) =>
          prev
            ? {
                ...prev,
                deliveryStatus: 'completed',
                orderStatus: 'delivered',
                deliveryOtp: undefined, // Clear OTP upon completion
              }
            : prev,
        );
        Alert.alert('Delivered!', evt.message || 'Your order has been delivered. Enjoy your meal!');
      }

      function onCancelled(evt: DeliveryCancelledEvent) {
        if (!isMounted || evt.orderId !== orderId) return;

        setData((prev) =>
          prev
            ? {
                ...prev,
                deliveryStatus: 'cancelled',
                orderStatus: 'cancelled',
                deliveryOtp: undefined,
              }
            : prev,
        );
        Alert.alert('Order Cancelled', evt.reason || 'This delivery has been cancelled.');
      }

      function onError(evt: DeliveryErrorEvent) {
        if (!isMounted) return;
        if (evt.code === 'DELIVERY_NOT_TRACKABLE') {
          // Normal when order reaches terminal state
          setIsWsConnected(false);
        }
      }

      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on(DELIVERY_WS_EVENTS.SUBSCRIBED, onSubscribed);
      socket.on(DELIVERY_WS_EVENTS.LOCATION_UPDATED, onLocationUpdated);
      socket.on(DELIVERY_WS_EVENTS.RIDER_ASSIGNED, onRiderAssigned);
      socket.on(DELIVERY_WS_EVENTS.STATUS_UPDATED, onStatusUpdated);
      socket.on(DELIVERY_WS_EVENTS.COMPLETED, onCompleted);
      socket.on(DELIVERY_WS_EVENTS.CANCELLED, onCancelled);
      socket.on(DELIVERY_WS_EVENTS.ERROR, onError);

      if (socket.connected) {
        onConnect();
      }
    }

    initSocket();

    // App state listener for foreground resume recovery
    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        fetchDeliverySnapshot();
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit(DELIVERY_WS_EVENTS.SUBSCRIBE, { orderId });
        }
      }
    });

    return () => {
      isMounted = false;
      appStateSub.remove();
      if (socketRef.current) {
        socketRef.current.emit(DELIVERY_WS_EVENTS.UNSUBSCRIBE, { orderId });
        socketRef.current.off('connect');
        socketRef.current.off('disconnect');
        socketRef.current.off(DELIVERY_WS_EVENTS.SUBSCRIBED);
        socketRef.current.off(DELIVERY_WS_EVENTS.LOCATION_UPDATED);
        socketRef.current.off(DELIVERY_WS_EVENTS.RIDER_ASSIGNED);
        socketRef.current.off(DELIVERY_WS_EVENTS.STATUS_UPDATED);
        socketRef.current.off(DELIVERY_WS_EVENTS.COMPLETED);
        socketRef.current.off(DELIVERY_WS_EVENTS.CANCELLED);
        socketRef.current.off(DELIVERY_WS_EVENTS.ERROR);
      }
    };
  }, [orderId, fetchDeliverySnapshot]);

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Connecting to live delivery...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={styles.errorText}>Order delivery details not found.</Text>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (data.orderStatus === 'pending_payment' || data.paymentStatus !== 'captured') {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>
          {['cancelled', 'rejected'].includes(data.orderStatus) ? 'Order cancelled' :
            data.paymentStatus === 'failed' ? 'Payment failed' : 'Awaiting payment confirmation'}
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={onViewOrders}>
          <Text style={styles.backButtonText}>View Orders</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { deliveryStatus, orderNumber, restaurant, rider, deliveryOtp } = data;

  // Determine active step index
  const getStepIndex = () => {
    switch (deliveryStatus) {
      case 'unassigned':
        return -1;
      case 'assigned':
        return 0;
      case 'accepted':
        return 1;
      case 'at_restaurant':
        return 2;
      case 'picked_up':
        return 3;
      case 'arrived_customer':
        return 4;
      case 'completed':
        return 5;
      default:
        return -1;
    }
  };

  const currentStep = getStepIndex();
  const isFinished = deliveryStatus === 'completed';
  const isCancelled = deliveryStatus === 'cancelled' || ['cancelled', 'rejected'].includes(data.orderStatus);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 1. Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>Tracking Order #{orderNumber}</Text>
          <View style={styles.wsStatusRow}>
            <View
              style={[
                styles.wsStatusDot,
                {
                  backgroundColor: isWsConnected
                    ? '#2ECC71'
                    : isReconnecting
                    ? colors.accent
                    : colors.textSecondary,
                },
              ]}
            />
            <Text style={styles.wsStatusText}>
              {isWsConnected
                ? 'Live WebSocket Connected'
                : isReconnecting
                ? 'Reconnecting Live...'
                : 'Offline Fallback'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 2. Map View */}
        <DeliveryMapView
          restaurantName={restaurant.name}
          deliveryStatus={deliveryStatus}
          riderLocation={riderCoords}
          isStaleLocation={isStaleLocation}
        />

        {/* 3. Customer Delivery OTP Card (Only displayed for in-flight active handoff) */}
        {deliveryOtp && !isFinished && !isCancelled && (
          <View style={styles.otpCard}>
            <View style={styles.otpHeader}>
              <View style={styles.otpIconBadge}>
                <Ionicons name="key-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.otpHeaderTextCol}>
                <Text style={styles.otpTitle}>Customer Delivery OTP</Text>
                <Text style={styles.otpSub}>Share this 6-digit code with your rider upon arrival</Text>
              </View>
            </View>

            <View style={styles.otpCodeContainer}>
              {deliveryOtp.split('').map((digit, i) => (
                <View key={i} style={styles.otpDigitBox}>
                  <Text style={styles.otpDigitText}>{digit}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 4. Rider Information Card */}
        {rider ? (
          <View style={styles.riderCard}>
            <View style={styles.riderAvatar}>
              <Ionicons name="person" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.riderDetails}>
              <Text style={styles.riderName}>{rider.fullName || 'Fleet24 Rider'}</Text>
              <Text style={styles.riderVehicle}>
                {rider.vehicleType.toUpperCase()} {rider.vehicleNumber ? `• ${rider.vehicleNumber}` : ''}
              </Text>
              {lastLocationTime && (
                <Text style={styles.locationFreshnessText}>
                  {isStaleLocation ? 'GPS updating...' : `GPS refreshed ${new Date(lastLocationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
                </Text>
              )}
            </View>
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
              <Text style={styles.verifiedBadgeText}>Verified</Text>
            </View>
          </View>
        ) : !isCancelled && (
          <View style={styles.riderWaitingCard}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.riderWaitingText}>Assigning nearby delivery partner...</Text>
          </View>
        )}

        {/* 5. Delivery Progress Timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.timelineHeading}>Delivery Progress</Text>

          {[
            { label: 'Rider Assigned', desc: 'Partner accepted the assignment' },
            { label: 'Order Confirmed', desc: 'Partner is on the way to kitchen' },
            { label: 'At Restaurant', desc: 'Partner arrived at food counter' },
            { label: 'Order Picked Up', desc: 'Food is out for doorstep delivery' },
            { label: 'Arrived at Doorstep', desc: 'Rider is at your delivery address' },
            { label: 'Delivered', desc: 'Order handoff successfully completed' },
          ].map((step, idx) => {
            const isCompletedStep = currentStep >= idx && !isCancelled;
            const isCurrent = currentStep === idx && !isCancelled;

            return (
              <View key={idx} style={styles.timelineStepRow}>
                <View style={styles.stepIndicatorCol}>
                  <View
                    style={[
                      styles.stepDot,
                      isCompletedStep && styles.stepDotCompleted,
                      isCurrent && styles.stepDotCurrent,
                    ]}
                  >
                    {isCompletedStep ? (
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    ) : (
                      <View style={styles.stepDotInner} />
                    )}
                  </View>
                  {idx < 5 && (
                    <View
                      style={[
                        styles.stepLine,
                        currentStep > idx && !isCancelled && styles.stepLineCompleted,
                      ]}
                    />
                  )}
                </View>

                <View style={styles.stepInfoCol}>
                  <Text
                    style={[
                      styles.stepLabel,
                      isCompletedStep && styles.stepLabelCompleted,
                      isCurrent && styles.stepLabelCurrent,
                    ]}
                  >
                    {step.label}
                  </Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
              </View>
            );
          })}
        </View>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  loadingText: {
    ...typography.body,
    marginTop: spacing.md,
    color: colors.textSecondary,
  },
  errorText: {
    ...typography.body,
    marginTop: spacing.md,
    color: colors.error,
    textAlign: 'center',
  },
  backButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerTitleBox: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  wsStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 5,
  },
  wsStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  wsStatusText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  otpCard: {
    margin: spacing.lg,
    backgroundColor: colors.surfaceGreen,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#CDE3D3',
  },
  otpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  otpIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpHeaderTextCol: {
    flex: 1,
  },
  otpTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  otpSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  otpCodeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
  },
  otpDigitBox: {
    width: 44,
    height: 50,
    borderRadius: borderRadius.sm,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 2,
  },
  otpDigitText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 1,
  },
  riderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  riderAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  riderDetails: {
    flex: 1,
  },
  riderName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  riderVehicle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  locationFreshnessText: {
    fontSize: 11,
    color: colors.accent,
    marginTop: 3,
    fontWeight: '500',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  riderWaitingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  riderWaitingText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  timelineCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  timelineHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  timelineStepRow: {
    flexDirection: 'row',
    minHeight: 52,
  },
  stepIndicatorCol: {
    alignItems: 'center',
    width: 28,
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  stepDotCompleted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepDotCurrent: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceGreen,
  },
  stepDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 2,
  },
  stepLineCompleted: {
    backgroundColor: colors.primary,
  },
  stepInfoCol: {
    flex: 1,
    marginLeft: spacing.sm,
    paddingBottom: spacing.sm,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  stepLabelCompleted: {
    color: colors.textPrimary,
  },
  stepLabelCurrent: {
    color: colors.primary,
    fontWeight: '700',
  },
  stepDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
