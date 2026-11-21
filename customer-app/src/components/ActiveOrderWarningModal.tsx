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

export interface ActiveOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  placedAt?: string;
  totalPayable?: string;
  restaurantName?: string;
  outletName?: string;
  itemCount?: number;
}

interface ActiveOrderWarningModalProps {
  visible: boolean;
  activeOrder: ActiveOrderSummary | null;
  onTrackOrder: (orderId: string) => void;
  onClose: () => void;
}

export const ActiveOrderWarningModal: React.FC<ActiveOrderWarningModalProps> = ({
  visible,
  activeOrder,
  onTrackOrder,
  onClose,
}) => {
  if (!activeOrder) return null;

  const formatStatus = (st: string) => {
    switch (st) {
      case 'placed':
        return 'Order Confirmed';
      case 'confirmed':
        return 'Accepted by Restaurant';
      case 'preparing':
        return 'Food Being Prepared';
      case 'ready_for_pickup':
        return 'Ready for Pickup';
      case 'out_for_delivery':
        return 'Out for Delivery';
      default:
        return st.replace(/_/g, ' ').toUpperCase();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Header Icon & Title */}
            <View style={styles.headerBox}>
              <View style={styles.iconCircle}>
                <Ionicons name="time" size={32} color="#D97706" />
              </View>
              <Text style={styles.title}>You Have an Order in Progress</Text>
              <Text style={styles.orderNumberText}>Order #{activeOrder.orderNumber}</Text>
            </View>

            {/* Status Card */}
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <Ionicons name="restaurant-outline" size={16} color={colors.primary} />
                <Text style={styles.restaurantText} numberOfLines={1}>
                  {activeOrder.restaurantName || 'Active Restaurant'}
                  {activeOrder.outletName ? ` (${activeOrder.outletName})` : ''}
                </Text>
              </View>

              <View style={styles.pillRow}>
                <View style={styles.statusPill}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusPillText}>{formatStatus(activeOrder.status)}</Text>
                </View>
                {activeOrder.totalPayable && (
                  <Text style={styles.amountText}>
                    ₹{parseFloat(activeOrder.totalPayable).toFixed(0)}
                  </Text>
                )}
              </View>
            </View>

            {/* Policy & Guidance Note */}
            <View style={styles.policyCard}>
              <Ionicons name="information-circle-outline" size={18} color="#92400E" style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.policyText}>
                  Your current order is still being prepared or delivered. You can keep adding items
                  to your cart and place your next order once this one is completed.
                </Text>
                <Text style={[styles.policySubtext, { marginTop: spacing.xs }]}>
                  Your cart items have been safely preserved.
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionsBox}>
              <Button
                title="Track Current Order"
                onPress={() => onTrackOrder(activeOrder.id)}
                variant="primary"
                style={styles.primaryBtn}
              />
              <TouchableOpacity
                style={styles.keepCartBtn}
                activeOpacity={0.7}
                onPress={onClose}
              >
                <Text style={styles.keepCartText}>Keep Cart for Later</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = appStyles({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    maxHeight: '85%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 10,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  orderNumberText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 3,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  statusCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  restaurantText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1F2937',
  },
  pillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#FCD34D',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  amountText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  policyCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: spacing.md,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  policyText: {
    fontSize: 12.5,
    color: '#78350F',
    lineHeight: 18,
    fontWeight: '500',
  },
  policySubtext: {
    fontSize: 11.5,
    color: '#92400E',
    fontWeight: '700',
  },
  actionsBox: {
    gap: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
  },
  keepCartBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  keepCartText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
});
