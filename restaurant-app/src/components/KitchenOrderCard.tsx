import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/tokens';
import { KitchenOrderStatus, RestaurantOrder } from '../types';

interface KitchenOrderCardProps {
  order: RestaurantOrder;
  mode: 'queue' | 'detail' | 'accordion';
  selected: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onStartPreparing?: () => void;
  onMarkReady?: () => void;
  onPressDetails?: () => void;
  actionLoading?: boolean;
  actionsDisabled?: boolean;
}

const statuses: Record<KitchenOrderStatus, [string, string, string]> = {
  placed: ['New', colors.pendingLight, colors.pendingDark],
  confirmed: ['Accepted', colors.confirmedLight, colors.confirmedDark],
  preparing: ['Preparing', colors.confirmedLight, colors.confirmedDark],
  ready_for_pickup: ['Ready', colors.readyLight, colors.readyDark],
  out_for_delivery: ['Out for delivery', colors.deliveredLight, colors.deliveredDark],
  delivered: ['Completed', colors.deliveredLight, colors.deliveredDark],
  rejected: ['Declined', colors.rejectedLight, colors.rejectedDark],
  cancelled: ['Cancelled', colors.rejectedLight, colors.rejectedDark],
};

const money = (value: number | string) => '₹' + Number(value).toFixed(2);

function orderAge(createdAt: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  if (!Number.isFinite(minutes)) return 'Time unavailable';
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return minutes + 'm ago';
  if (minutes < 1440) return Math.floor(minutes / 60) + 'h ago';
  return Math.floor(minutes / 1440) + 'd ago';
}

export function KitchenOrderCard({
  order, mode, selected, onPressDetails, onAccept, onReject, onStartPreparing, onMarkReady,
  actionLoading, actionsDisabled,
}: KitchenOrderCardProps) {
  const [label, badgeBackground, badgeColor] = statuses[order.status] ??
    [order.status, colors.deliveredLight, colors.deliveredDark];
  const age = orderAge(order.createdAt);
  const itemCount = order.itemCount ?? order.items.length;
  const firstItem = order.items[0];
  const customer = order.customerName || order.customer?.fullName;
  const action = {
    placed: { label: 'Accept order', run: onAccept },
    confirmed: { label: 'Start preparing', run: onStartPreparing },
    preparing: { label: 'Mark ready', run: onMarkReady },
  }[order.status as 'placed' | 'confirmed' | 'preparing'];
  const decline = order.status === 'placed' ? onReject : undefined;
  const breakdown: Array<[string, number | string | undefined]> = [
    ['Subtotal', order.itemTotal],
    ['Tax', order.taxAmount],
    ['Delivery fee', order.deliveryFee],
    ['Discount', order.discountAmount == null || Number(order.discountAmount) === 0 ? undefined : -Number(order.discountAmount)],
  ];

  const badge = (
    <View style={[styles.badge, { backgroundColor: badgeBackground }]}>
      <Text style={[styles.badgeText, { color: badgeColor }]}>{label}</Text>
    </View>
  );

  return (
    <View style={mode === 'accordion' ? styles.card : undefined}>
      {mode === 'detail' ? (
        <View style={styles.detailHeader}>
          <View style={styles.grow}>
            <Text accessibilityRole="header" style={styles.detailTitle}>Order #{order.orderNumber}</Text>
            <Text style={styles.meta}>{age} · {itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
          </View>
          {badge}
        </View>
      ) : (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={mode === 'queue' ? { selected } : { expanded: selected }}
          onPress={onPressDetails}
          style={[styles.ticket, mode === 'queue' && styles.queueTicket, mode === 'queue' && selected && styles.selectedTicket]}
        >
          <Ionicons name="receipt-outline" size={19} color={colors.textPrimary} />
          <View style={styles.grow}>
            <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
            {mode === 'queue' && firstItem ? (
              <Text style={styles.meta} numberOfLines={1}>
                {firstItem.quantity}× {firstItem.itemName || firstItem.name || 'Item'}{order.items.length > 1 ? ' +' + (order.items.length - 1) + ' more' : ''}
              </Text>
            ) : <Text style={styles.meta}>{age}</Text>}
          </View>
          <View style={styles.ticketStatus}>
            {mode === 'queue' && <Text style={styles.meta}>{age}</Text>}
            {badge}
          </View>
          {mode === 'accordion' && <Ionicons name={selected ? 'chevron-up' : 'chevron-down'} size={17} color={colors.textPrimary} />}
        </TouchableOpacity>
      )}

      {(mode === 'detail' || (mode === 'accordion' && selected)) && (
        <View style={mode === 'accordion' && styles.expanded}>
          {customer && <Text style={styles.meta}>{customer}</Text>}
          <View style={styles.section}>
            {order.items.map(item => {
              const unit = item.unitPrice ?? item.price;
              const total = item.totalPrice ?? item.itemTotal ?? (unit == null ? undefined : Number(unit) * item.quantity);
              return (
                <View key={item.id} style={styles.line}>
                  <Text style={styles.quantity}>{item.quantity}×</Text>
                  <View style={styles.grow}>
                    <Text style={styles.itemName}>{item.itemName || item.name || 'Item'}</Text>
                    {unit != null && <Text style={styles.meta}>{money(unit)} each</Text>}
                    {item.notes && <Text style={styles.meta}>{item.notes}</Text>}
                  </View>
                  {total != null && <Text style={styles.itemName}>{money(total)}</Text>}
                </View>
              );
            })}
          </View>
          {mode === 'detail' && breakdown.map(([name, value]) => value != null && (
            <View key={name} style={styles.amountRow}>
              <Text style={styles.meta}>{name}</Text>
              <Text style={styles.meta}>{money(value)}</Text>
            </View>
          ))}
          <View style={[styles.amountRow, styles.total]}>
            <Text style={styles.totalText}>Total</Text>
            <Text style={styles.totalText}>{money(order.totalPayable)}</Text>
          </View>
          {order.rejectionReason && <Text style={styles.meta}>{order.rejectionReason}</Text>}
          {(action?.run || decline) && (
            <View style={[styles.actions, mode === 'detail' && styles.actionsWide]}>
              {action?.run && (
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={action.label}
                  accessibilityState={{ busy: actionLoading, disabled: actionsDisabled }}
                  disabled={actionsDisabled} onPress={action.run} style={[styles.primary, actionsDisabled && styles.disabled]}>
                  {actionLoading ? <ActivityIndicator color={colors.textWhite} /> : (
                    <>
                      <Text style={styles.primaryText}>{action.label}</Text>
                      <Ionicons name="arrow-forward" size={18} color={colors.textWhite} />
                    </>
                  )}
                </TouchableOpacity>
              )}
              {decline && (
                <TouchableOpacity accessibilityRole="button" disabled={actionsDisabled} onPress={decline} style={styles.secondary}>
                  <Text style={styles.itemName}>Decline</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const lineColor = '#E2E5E3';

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: lineColor, borderRadius: 16, marginBottom: 12, backgroundColor: '#FFFFFF' },
  ticket: { minHeight: 76, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  queueTicket: { marginHorizontal: 8, borderBottomWidth: 1, borderBottomColor: lineColor, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  selectedTicket: { backgroundColor: colors.surfaceGreen, borderLeftColor: colors.primary, borderRadius: 8 },
  grow: { flex: 1, minWidth: 0 },
  orderNumber: { color: colors.textPrimary, fontWeight: '700', fontSize: 15, lineHeight: 21 },
  meta: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  ticketStatus: { alignItems: 'flex-end', gap: 3 },
  badge: { borderRadius: 9, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  detailTitle: { color: colors.textPrimary, fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  expanded: { paddingHorizontal: 14, paddingBottom: 16 },
  section: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: lineColor, marginTop: 6, marginBottom: 6, paddingVertical: 8, gap: 10 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  quantity: { minWidth: 24, fontWeight: '700', color: colors.textPrimary },
  itemName: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.textPrimary },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 4 },
  total: { paddingVertical: 10 },
  totalText: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  actions: { gap: 8, marginTop: 10 },
  actionsWide: { flexDirection: 'row', marginTop: 20 },
  primary: { minHeight: 46, flexGrow: 1, borderRadius: 10, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14 },
  primaryText: { color: colors.textWhite, fontWeight: '800', fontSize: 15 },
  secondary: { minHeight: 44, borderWidth: 1, borderColor: lineColor, borderRadius: 10, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.65 },
});
