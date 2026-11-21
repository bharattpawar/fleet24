import { appStyles } from '../theme/appStyles';
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

export interface PaymentConflictDetails {
  orderId: string;
  orderNumber: string;
  capturedAmount: string | number;
  currency?: string;
  paymentId?: string;
  providerPaymentId?: string;
  restaurantName?: string;
  outletName?: string;
  detectedAt?: string;
}

interface PaymentConflictModalProps {
  visible: boolean;
  conflict: PaymentConflictDetails | null;
  onViewOrders: () => void;
  onClose: () => void;
}

export const PaymentConflictModal: React.FC<PaymentConflictModalProps> = ({
  visible,
  conflict,
  onViewOrders,
  onClose,
}) => {
  if (!conflict) return null;

  const formattedAmount = (() => {
    const num =
      typeof conflict.capturedAmount === 'string'
        ? parseFloat(conflict.capturedAmount)
        : conflict.capturedAmount;
    if (isNaN(num)) return `₹${conflict.capturedAmount}`;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: conflict.currency || 'INR',
      maximumFractionDigits: 2,
    }).format(num);
  })();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.iconCircle}>
              <Ionicons name="shield-checkmark" size={38} color="#92400E" />
            </View>

            <Text style={styles.heroTitle}>Payment Received, Under Review</Text>
            <Text style={styles.orderNumberText}>Order #{conflict.orderNumber}</Text>

            {/* Authoritative Badge */}
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>PAYMENT CAPTURED • AWAITING REVIEW</Text>
            </View>

            <Text style={styles.heroDescription}>
              Your payment was received, but this order could not be placed because another order
              is already in progress. Our team will review the payment and refund status.
            </Text>
          </View>

          {/* Captured Payment Evidence Card */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="receipt-outline" size={18} color="#92400E" />
              <Text style={styles.cardHeaderTitle}>Captured Payment Summary</Text>
            </View>

            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>AMOUNT PAID</Text>
              <Text style={styles.amountValue}>{formattedAmount}</Text>
              <View style={styles.capturedBadge}>
                <Ionicons name="checkmark-circle" size={12} color="#065F46" />
                <Text style={styles.capturedBadgeText}>CONFIRMED BY GATEWAY</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Order Reference</Text>
              <Text style={styles.detailValue}>#{conflict.orderNumber}</Text>
            </View>

            {conflict.providerPaymentId && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Payment ID</Text>
                <Text style={[styles.detailValue, styles.monoText]}>
                  {conflict.providerPaymentId}
                </Text>
              </View>
            )}

            {conflict.restaurantName && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Restaurant</Text>
                <Text style={styles.detailValue}>
                  {conflict.restaurantName}
                  {conflict.outletName ? ` (${conflict.outletName})` : ''}
                </Text>
              </View>
            )}
          </View>

          {/* Operational Policy & Fulfillment Notice */}
          <View style={styles.noticeCard}>
            <Ionicons name="information-circle-outline" size={20} color="#92400E" style={styles.noticeIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitle}>Why did fulfillment not start?</Text>
              <Text style={styles.noticeBody}>
                Fleet24 fulfills one active delivery per customer at a time. Because an earlier
                order is already active, this new order was not sent to the kitchen.
              </Text>
              <Text style={[styles.noticeBody, { marginTop: spacing.sm }]}>
                Your payment is confirmed by the gateway and will be reviewed by our operations
                team for full refund approval. No further action is required on your part.
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <Button
              title="View Orders & History"
              onPress={onViewOrders}
              variant="primary"
              style={styles.primaryBtn}
            />

            <TouchableOpacity style={styles.closeBtn} activeOpacity={0.7} onPress={onClose}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = appStyles({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F5',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + 10,
    paddingBottom: spacing.xxl,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#FDE68A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  orderNumberText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: spacing.xs,
    fontFamily: 'monospace',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
    marginRight: spacing.xs,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  heroDescription: {
    fontSize: 13,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  amountBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  amountLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.8,
  },
  amountValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  capturedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    marginTop: spacing.xs,
  },
  capturedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065F46',
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  monoText: {
    fontFamily: 'monospace',
  },
  noticeCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  noticeIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  noticeBody: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 17,
  },
  actionsContainer: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
  },
  closeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
});
