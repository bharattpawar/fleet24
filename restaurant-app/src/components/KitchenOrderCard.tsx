import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, minTouchTarget, shadows } from '../theme/tokens';
import { RestaurantOrder, KitchenOrderStatus } from '../types';

interface KitchenOrderCardProps {
  order: RestaurantOrder;
  onAccept?: () => void;
  onReject?: () => void;
  onStartPreparing?: () => void;
  onMarkReady?: () => void;
  onPressDetails?: () => void;
  actionLoading?: boolean;
}

export const KitchenOrderCard: React.FC<KitchenOrderCardProps> = ({
  order,
  onAccept,
  onReject,
  onStartPreparing,
  onMarkReady,
  onPressDetails,
  actionLoading,
}) => {
  // Elapsed time with human-friendly units (never show 2000m ago)
  const { elapsedLabel, urgency } = useMemo(() => {
    const created = new Date(order.createdAt).getTime();
    const now = Date.now();
    const diffMinutes = Math.max(0, Math.floor((now - created) / 60000));

    let timeStr: string;
    if (diffMinutes === 0) {
      timeStr = 'Just now';
    } else if (diffMinutes < 60) {
      timeStr = `${diffMinutes}m ago`;
    } else if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      timeStr = `${hours}h ago`;
    } else {
      const days = Math.floor(diffMinutes / 1440);
      timeStr = `${days}d ago`;
    }

    const urg =
      diffMinutes < 15 ? ('normal' as const) : diffMinutes < 30 ? ('warning' as const) : ('urgent' as const);

    return { elapsedLabel: timeStr, urgency: urg };
  }, [order.createdAt]);

  const getStatusBadge = (status: KitchenOrderStatus) => {
    switch (status) {
      case 'placed':
        return {
          label: 'NEW ORDER',
          bg: colors.pendingLight,
          text: colors.pendingDark,
          borderColor: colors.pending,
          icon: 'alert-circle' as const,
        };
      case 'confirmed':
        return {
          label: 'ACCEPTED',
          bg: colors.confirmedLight,
          text: colors.confirmedDark,
          borderColor: colors.confirmed,
          icon: 'checkmark-circle' as const,
        };
      case 'preparing':
        return {
          label: 'COOKING',
          bg: colors.preparingLight,
          text: colors.preparingDark,
          borderColor: colors.preparing,
          icon: 'flame' as const,
        };
      case 'ready_for_pickup':
        return {
          label: 'READY FOR RIDER',
          bg: colors.readyLight,
          text: colors.readyDark,
          borderColor: colors.ready,
          icon: 'bag-check' as const,
        };
      case 'delivered':
        return {
          label: 'DELIVERED',
          bg: colors.deliveredLight,
          text: colors.deliveredDark,
          borderColor: colors.delivered,
          icon: 'checkmark-done' as const,
        };
      case 'rejected':
      case 'cancelled':
        return {
          label: status.toUpperCase(),
          bg: colors.rejectedLight,
          text: colors.rejectedDark,
          borderColor: colors.rejected,
          icon: 'close-circle' as const,
        };
      default:
        return {
          label: status.toUpperCase(),
          bg: colors.surfaceMuted,
          text: colors.textSecondary,
          borderColor: colors.borderMedium,
          icon: 'ellipse' as const,
        };
    }
  };

  const badge = getStatusBadge(order.status);
  const formattedTime = new Date(order.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const customerDisplayName =
    order.customerName ||
    (order as any).customer?.fullName ||
    'Customer';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPressDetails}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`Order #${order.orderNumber}, Status: ${badge.label}`}
    >
      {/* 1. Header Top Row: Order ID on Left, Status Badge on Right */}
      <View style={styles.cardHeaderRow}>
        <View style={styles.orderIdGroup}>
          <View style={styles.receiptIconBox}>
            <Ionicons name="receipt-outline" size={14} color={colors.primaryDark} />
          </View>
          <Text style={styles.orderNumber} numberOfLines={1}>
            #{order.orderNumber}
          </Text>
        </View>

        <View
          style={[
            styles.badge,
            { backgroundColor: badge.bg, borderColor: badge.borderColor },
          ]}
        >
          <Ionicons name={badge.icon} size={11} color={badge.text} />
          <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
        </View>
      </View>

      {/* 2. Meta Sub-Row: Formatted Time · Elapsed Chip (Left) & Customer Name · Item Count (Right) */}
      <View style={styles.cardSubMetaRow}>
        <View style={styles.timeElapsedGroup}>
          <Text style={styles.orderTimestamp}>{formattedTime}</Text>
          <Text style={styles.dotSeparator}>·</Text>
          <View
            style={[
              styles.elapsedChip,
              urgency === 'urgent'
                ? styles.elapsedUrgent
                : urgency === 'warning'
                ? styles.elapsedWarning
                : styles.elapsedNormal,
            ]}
          >
            <Ionicons
              name="time-outline"
              size={10}
              color={
                urgency === 'urgent'
                  ? colors.textRed
                  : urgency === 'warning'
                  ? colors.textAmber
                  : colors.textSecondary
              }
            />
            <Text
              style={[
                styles.elapsedText,
                urgency === 'urgent'
                  ? styles.elapsedTextUrgent
                  : urgency === 'warning'
                  ? styles.elapsedTextWarning
                  : styles.elapsedTextNormal,
              ]}
            >
              {elapsedLabel}
            </Text>
          </View>
        </View>

        <View style={styles.customerMetaGroup}>
          <Ionicons name="person-circle-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.customerName} numberOfLines={1}>
            {customerDisplayName}
          </Text>
          <View style={styles.itemCountChip}>
            <Text style={styles.itemCountText}>
              {order.itemCount || order.items.length} {order.items.length === 1 ? 'item' : 'items'}
            </Text>
          </View>
        </View>
      </View>

      {/* 3. Items List Container */}
      <View style={styles.itemsContainer}>
        {order.items.slice(0, 4).map((item, idx) => {
          // Robust item name resolution (backend sends item.itemName)
          const itemName = item.name || item.itemName || 'Item';

          // Robust price resolution (backend sends item.unitPrice, item.totalPrice)
          const lineTotal =
            item.totalPrice != null
              ? Number(item.totalPrice)
              : item.unitPrice != null
              ? Number(item.unitPrice) * (item.quantity || 1)
              : item.price != null
              ? Number(item.price) * (item.quantity || 1)
              : 0;

          return (
            <View key={item.id || idx} style={styles.itemRow}>
              <View style={styles.qtyBadge}>
                <Text style={styles.qtyText}>{item.quantity || 1}x</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {itemName}
                </Text>
                {item.notes ? (
                  <View style={styles.itemNoteBox}>
                    <Ionicons name="chatbubble-ellipses-outline" size={10} color={colors.accentDark} />
                    <Text style={styles.itemNoteText} numberOfLines={2}>
                      {item.notes}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.itemPrice}>₹{lineTotal.toFixed(0)}</Text>
            </View>
          );
        })}

        {order.items.length > 4 && (
          <View style={styles.moreItemsRow}>
            <Text style={styles.moreItemsText}>
              +{order.items.length - 4} more items in this order
            </Text>
          </View>
        )}

        {/* Rejection reason (if present) */}
        {order.rejectionReason && (
          <View style={styles.rejectionNotice}>
            <Ionicons name="information-circle" size={13} color={colors.rejectedDark} />
            <Text style={styles.rejectionNoticeText}>
              Reason: {order.rejectionReason}
            </Text>
          </View>
        )}
      </View>

      {/* 4. Footer & Touch-First Action Buttons (min 44px height) */}
      <View style={styles.footerRow}>
        <View style={styles.totalBlock}>
          <Text style={styles.totalLabel}>TOTAL AMOUNT</Text>
          <Text style={styles.totalValue}>₹{Number(order.totalPayable || 0).toFixed(2)}</Text>
        </View>

        <View style={styles.actionsContainer}>
          {actionLoading ? (
            <View style={styles.actionLoadingBox}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.actionLoadingText}>Updating...</Text>
            </View>
          ) : (
            <>
              {order.status === 'placed' && (
                <>
                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={onReject}
                    disabled={actionLoading}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Reject Order"
                  >
                    <Ionicons name="close" size={15} color={colors.rejected} />
                    <Text style={styles.rejectButtonText}>Reject</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={onAccept}
                    disabled={actionLoading}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Accept Order"
                  >
                    <Ionicons name="checkmark" size={15} color={colors.textWhite} />
                    <Text style={styles.acceptButtonText}>Accept Order</Text>
                  </TouchableOpacity>
                </>
              )}

              {order.status === 'confirmed' && (
                <TouchableOpacity
                  style={styles.preparingButton}
                  onPress={onStartPreparing}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Start Cooking Order"
                >
                  <Ionicons name="flame" size={16} color={colors.textWhite} />
                  <Text style={styles.actionButtonText}>Start Cooking</Text>
                </TouchableOpacity>
              )}

              {order.status === 'preparing' && (
                <TouchableOpacity
                  style={styles.readyButton}
                  onPress={onMarkReady}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Mark Order Ready for Rider"
                >
                  <Ionicons name="bag-check" size={16} color={colors.textWhite} />
                  <Text style={styles.actionButtonText}>Mark Ready for Rider</Text>
                </TouchableOpacity>
              )}

              {order.status === 'ready_for_pickup' && (
                <View style={styles.readyPill}>
                  <Ionicons name="bicycle" size={15} color={colors.readyDark} />
                  <Text style={styles.readyPillText}>Awaiting Rider Pickup</Text>
                </View>
              )}

              {order.status === 'delivered' && (
                <View style={styles.deliveredPill}>
                  <Ionicons name="checkmark-done" size={15} color={colors.deliveredDark} />
                  <Text style={styles.deliveredPillText}>Order Completed</Text>
                </View>
              )}

              {(order.status === 'rejected' || order.status === 'cancelled') && (
                <View style={styles.rejectedPill}>
                  <Ionicons name="close-circle" size={15} color={colors.rejectedDark} />
                  <Text style={styles.rejectedPillText}>Order Cancelled</Text>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    gap: spacing.sm,
  },
  orderIdGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 6,
  },
  receiptIconBox: {
    width: 26,
    height: 26,
    borderRadius: borderRadius.xs,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    fontFamily: 'monospace',
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: 3,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardSubMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  timeElapsedGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  orderTimestamp: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  dotSeparator: {
    fontSize: 12,
    color: colors.textMuted,
  },
  elapsedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  elapsedNormal: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderMedium,
  },
  elapsedWarning: {
    backgroundColor: colors.pendingLight,
    borderColor: 'rgba(217, 119, 6, 0.4)',
  },
  elapsedUrgent: {
    backgroundColor: colors.rejectedLight,
    borderColor: 'rgba(220, 38, 38, 0.4)',
  },
  elapsedText: {
    fontSize: 10,
    fontWeight: '700',
  },
  elapsedTextNormal: {
    color: colors.textSecondary,
  },
  elapsedTextWarning: {
    color: colors.textAmber,
  },
  elapsedTextUrgent: {
    color: colors.textRed,
  },
  customerMetaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  customerName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    maxWidth: 100,
  },
  itemCountChip: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  itemCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  itemsContainer: {
    marginVertical: spacing.sm,
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  qtyBadge: {
    backgroundColor: colors.surfaceDark,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  qtyText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.limeAccent,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  itemNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.accentLight,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    marginTop: 2,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
  },
  itemNoteText: {
    fontSize: 10,
    color: colors.accentDark,
    fontWeight: '600',
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  moreItemsRow: {
    paddingVertical: 2,
  },
  moreItemsText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  rejectionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.rejectedLight,
    padding: 6,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.25)',
  },
  rejectionNoticeText: {
    fontSize: 11,
    color: colors.rejectedDark,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  totalBlock: {
    justifyContent: 'center',
  },
  totalLabel: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  actionLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: spacing.md,
  },
  actionLoadingText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.rejectedLight,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.35)',
    justifyContent: 'center',
  },
  rejectButtonText: {
    color: colors.rejectedDark,
    fontSize: 12,
    fontWeight: '700',
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 38,
    paddingHorizontal: spacing.md + 4,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    ...shadows.kpi,
  },
  acceptButtonText: {
    color: colors.textWhite,
    fontSize: 12,
    fontWeight: '800',
  },
  preparingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 38,
    paddingHorizontal: spacing.md + 4,
    borderRadius: borderRadius.md,
    backgroundColor: colors.preparing,
    justifyContent: 'center',
    ...shadows.kpi,
  },
  readyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 38,
    paddingHorizontal: spacing.md + 4,
    borderRadius: borderRadius.md,
    backgroundColor: colors.ready,
    justifyContent: 'center',
    ...shadows.kpi,
  },
  actionButtonText: {
    color: colors.textWhite,
    fontSize: 12,
    fontWeight: '800',
  },
  readyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.readyLight,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.3)',
    minHeight: 36,
  },
  readyPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.readyDark,
  },
  deliveredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.deliveredLight,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: 36,
  },
  deliveredPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.deliveredDark,
  },
  rejectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.rejectedLight,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    minHeight: 36,
  },
  rejectedPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.rejectedDark,
  },
});
