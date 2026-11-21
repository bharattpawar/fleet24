import { appStyles } from '../theme/appStyles';
import { useServiceAreas } from '../context/DeliveryLocationContext';
import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, borderRadius } from '../theme/tokens';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';

export interface ConfirmedOrderDetails {
  id: string;
  orderNumber: string;
  status: string;
  totalPayable: string;
  itemTotal: string;
  deliveryFee: string;
  taxAmount: string;
  /** Coupon discount, if any. */
  discountAmount?: string;
  restaurantName: string;
  outletName: string;
  deliveryAddress: {
    label?: string;
    addressLine1: string;
    addressLine2?: string;
    city?: string;
    postalCode?: string;
  };
  itemCount: number;
  placedAt: string;
  paymentStatus: string;
  customerInstructions?: string;
}

interface OrderConfirmationModalProps {
  visible: boolean;
  order: ConfirmedOrderDetails | null;
  onTrackOrder?: () => void;
  onViewOrders: () => void;
  onClose: () => void;
}

export const OrderConfirmationModal: React.FC<OrderConfirmationModalProps> = ({
  visible,
  order,
  onViewOrders,
  onTrackOrder,
  onClose,
}) => {
  const serviceAreas = useServiceAreas();
  if (!order) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Success / Status Hero Header */}
          <View style={styles.heroSection}>
            <View style={styles.iconCircle}>
              <Ionicons name="checkmark-sharp" size={40} color="#FFFFFF" />
            </View>
            <Text style={styles.heroTitle}>
              {order.status === 'pending_payment'
                ? 'Awaiting Payment'
                : order.status === 'placed'
                ? 'Order Sent to Restaurant'
                : 'Order Confirmed'}
            </Text>
            <Text style={styles.orderNumberText}>Order #{order.orderNumber}</Text>

            {/* Status Pill */}
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>
                {order.status.replace(/_/g, ' ').toUpperCase()}
              </Text>
            </View>

            <Text style={styles.statusDescription}>
              {order.status === 'pending_payment'
                ? 'Your order request has been created in Fleet24. Orders are sent to the restaurant once payment verification completes.'
                : `Your order has been received by the restaurant partner in ${serviceAreas}.`}
            </Text>
          </View>

          {/* Restaurant & Delivery Address Card */}
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Ionicons name="restaurant" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeaderTitle}>{order.restaurantName}</Text>
                <Text style={styles.cardSubText}>{order.outletName}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.cardRow}>
              <Ionicons name="location" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeaderTitle}>
                  Deliver to {order.deliveryAddress.label || 'Saved Address'}
                </Text>
                <Text style={styles.cardSubText}>
                  {order.deliveryAddress.addressLine1}
                  {order.deliveryAddress.addressLine2 ? `, ${order.deliveryAddress.addressLine2}` : ''}
                </Text>
                <Text style={styles.cardSubText}>
                  {[order.deliveryAddress.city, order.deliveryAddress.postalCode].filter(Boolean).join(' ')}
                </Text>
              </View>
            </View>

            {order.customerInstructions ? (
              <>
                <View style={styles.divider} />
                <View style={styles.cardRow}>
                  <Ionicons name="chatbubble-ellipses" size={18} color={colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardHeaderTitle}>Delivery Instructions</Text>
                    <Text style={styles.cardSubText}>{`"${order.customerInstructions}"`}</Text>
                  </View>
                </View>
              </>
            ) : null}
          </View>

          {/* Bill Summary Card */}
          <View style={styles.card}>
            <Text style={styles.billSectionHeader}>PAYMENT BREAKDOWN</Text>

            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Items ({order.itemCount})</Text>
              <Text style={styles.billValue}>₹{parseFloat(order.itemTotal).toFixed(0)}</Text>
            </View>

            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery Partner Fee</Text>
              <Text style={styles.billValue}>₹{parseFloat(order.deliveryFee).toFixed(0)}</Text>
            </View>

            {parseFloat(order.discountAmount ?? '0') > 0 && (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Coupon discount</Text>
                <Text style={styles.billValue}>-₹{parseFloat(order.discountAmount ?? '0').toFixed(0)}</Text>
              </View>
            )}

            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Govt Taxes (GST)</Text>
              <Text style={styles.billValue}>₹{parseFloat(order.taxAmount).toFixed(0)}</Text>
            </View>

            <View style={[styles.billRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Payable</Text>
              <Text style={styles.totalValue}>₹{parseFloat(order.totalPayable).toFixed(0)}</Text>
            </View>

            <View style={styles.paymentNotice}>
              <Ionicons name="card-outline" size={16} color={colors.primary} />
              <Text style={styles.paymentNoticeText}>
                Prepaid Mode: Payment gateway verification pending (Phase 2 testing mode).
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <Button
            title="View Orders"
            variant="primary"
            size="lg"
            onPress={onViewOrders}
            style={{ width: '100%', marginBottom: spacing.xs }}
          />
          {onTrackOrder && <Button title="Track Order" onPress={onTrackOrder} />}
          <TouchableOpacity onPress={onClose} style={styles.dismissBtn}>
            <Text style={styles.dismissBtnText}>Back to Discovery</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = appStyles({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  orderNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF6E9',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: '#F3D4A0',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.warning,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9E6400',
    letterSpacing: 0.5,
  },
  statusDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardSubText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.sm,
  },
  billSectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  billLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  billValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.sm,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  paymentNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EAF3EE',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.md,
  },
  paymentNoticeText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
    flex: 1,
    lineHeight: 15,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    alignItems: 'center',
  },
  dismissBtn: {
    paddingVertical: spacing.xs,
  },
  dismissBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});

