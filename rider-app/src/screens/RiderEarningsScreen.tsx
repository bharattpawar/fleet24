import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/tokens';
import { riderApi, RiderEarningsSummary, RiderEarningRecord } from '../api/riderApi';
import { useRiderAuth } from '../context/RiderAuthContext';
import { mockRiderData } from '../api/mockData';

export const RiderEarningsScreen: React.FC = () => {
  const { isMockSession } = useRiderAuth();
  const [summary, setSummary] = useState<RiderEarningsSummary | null>(null);
  const [earningsList, setEarningsList] = useState<RiderEarningRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Payout Modal State
  const [isPayoutModalVisible, setIsPayoutModalVisible] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);

  const fetchData = useCallback(async () => {
    if (isMockSession) {
      setSummary(mockRiderData.getSummary());
      setEarningsList(mockRiderData.getRecentEarnings());
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const [sum, list] = await Promise.all([
        riderApi.getEarningsSummary(),
        riderApi.getEarnings({ limit: 30 }),
      ]);
      setSummary(sum);
      const items = Array.isArray((list as any)?.items)
        ? (list as any).items
        : Array.isArray((list as any)?.data)
        ? (list as any).data
        : [];
      setEarningsList(items);
    } catch (e: any) {
      console.warn('Error fetching earnings:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isMockSession]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const handleRequestPayout = async () => {
    const num = parseFloat(payoutAmount);
    if (isNaN(num) || num <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payout amount.');
      return;
    }

    const available = summary ? parseFloat(summary.availableBalance) : 0;
    if (num > available) {
      Alert.alert('Insufficient Balance', `You can withdraw up to ₹${available.toFixed(2)}.`);
      return;
    }

    setIsRequestingPayout(true);
    try {
      if (isMockSession) {
        await new Promise((r) => setTimeout(r, 400));
        Alert.alert('Mock Payout Request', 'Payout request submitted to admin for processing!');
        setIsPayoutModalVisible(false);
        setPayoutAmount('');
        return;
      }

      await riderApi.requestPayout(num);
      Alert.alert('Success', 'Payout request submitted to admin for processing!');
      setIsPayoutModalVisible(false);
      setPayoutAmount('');
      fetchData();
    } catch (err: any) {
      Alert.alert('Payout Error', err.message || 'Failed to submit payout request');
    } finally {
      setIsRequestingPayout(false);
    }
  };

  const availableBalance = summary?.availableBalance ? Number(summary.availableBalance).toFixed(2) : '0.00';
  const totalEarned = summary?.totalEarned ? Number(summary.totalEarned).toFixed(2) : '0.00';
  const totalDisbursed = summary?.totalDisbursed ? Number(summary.totalDisbursed).toFixed(2) : '0.00';
  const reservedPending = summary?.reservedPendingPayout ? Number(summary.reservedPendingPayout).toFixed(2) : '0.00';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Earnings & Payouts</Text>
        <Text style={styles.headerSub}>Greater Noida Delivery Partner</Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Balance Highlight Hero Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroSub}>WITHDRAWABLE BALANCE</Text>
          <View style={styles.heroAmountRow}>
            <Text style={styles.heroCurrency}>₹</Text>
            <Text style={styles.heroAmount}>{availableBalance}</Text>
          </View>

          <TouchableOpacity
            style={styles.payoutButton}
            onPress={() => setIsPayoutModalVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="wallet-outline" size={18} color={colors.primary} />
            <Text style={styles.payoutButtonText}>REQUEST PAYOUT</Text>
          </TouchableOpacity>
        </View>

        {/* Ledger Breakdown Cards */}
        <View style={styles.gridRow}>
          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>Total Earned</Text>
            <Text style={styles.gridValue}>₹{totalEarned}</Text>
          </View>
          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>Paid Out</Text>
            <Text style={styles.gridValue}>₹{totalDisbursed}</Text>
          </View>
        </View>

        <View style={styles.gridRow}>
          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>Pending Payouts</Text>
            <Text style={styles.gridValue}>₹{reservedPending}</Text>
          </View>
          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>Completed Trips</Text>
            <Text style={styles.gridValue}>{summary?.lifetimeCompletedDeliveries || 0}</Text>
          </View>
        </View>

        {/* Trips History Section */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Recent Delivery Earnings</Text>

          {isLoading ? (
            <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
          ) : earningsList.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="receipt-outline" size={32} color={colors.textSecondary} />
              <Text style={styles.emptyTitle}>No delivery records yet</Text>
              <Text style={styles.emptySub}>
                Accept and complete delivery orders to build up your earnings history.
              </Text>
            </View>
          ) : (
            earningsList.map((item) => {
              const distanceKm = item.distanceMeters
                ? (item.distanceMeters / 1000).toFixed(1)
                : '1.5';
              const dateStr = item.createdAt
                ? new Date(item.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Recent';
              const amountVal = item.earningAmount || item.amount || '0.00';
              const orderNum = item.orderNumber || (item.metadata?.orderNumber ? String(item.metadata.orderNumber) : item.orderId ? item.orderId.slice(0, 8) : 'Delivery');

              return (
                <View key={item.id} style={styles.earningItemCard}>
                  <View style={styles.itemHeaderRow}>
                    <View>
                      <Text style={styles.itemOrderNumber}>Order #{orderNum}</Text>
                      <Text style={styles.itemDate}>{dateStr}</Text>
                    </View>
                    <Text style={styles.itemAmount}>+₹{amountVal}</Text>
                  </View>

                  <View style={styles.itemDetailsRow}>
                    <View style={styles.chip}>
                      <Ionicons name="navigate-outline" size={12} color={colors.textSecondary} />
                      <Text style={styles.chipText}>{distanceKm} km</Text>
                    </View>
                    <View style={styles.chip}>
                      <Ionicons name="cash-outline" size={12} color={colors.textSecondary} />
                      <Text style={styles.chipText}>Base ₹{item.baseFare || '30'}</Text>
                    </View>
                    {item.distancePay && (
                      <View style={styles.chip}>
                        <Ionicons name="speedometer-outline" size={12} color={colors.textSecondary} />
                        <Text style={styles.chipText}>Dist ₹{item.distancePay}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Payout Withdrawal Request Modal */}
      <Modal
        visible={isPayoutModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPayoutModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Withdraw Earnings</Text>
              <TouchableOpacity onPress={() => setIsPayoutModalVisible(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Available balance: ₹{availableBalance}. Payouts are transferred to your registered bank account / UPI.
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputPrefix}>₹</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter amount"
                keyboardType="decimal-pad"
                value={payoutAmount}
                onChangeText={setPayoutAmount}
                autoFocus
              />
            </View>

            <View style={styles.quickAmounts}>
              {['100', '250', '500', availableBalance].map((amt, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.quickChip}
                  onPress={() => setPayoutAmount(amt)}
                >
                  <Text style={styles.quickChipText}>₹{amt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.submitPayoutButton}
              onPress={handleRequestPayout}
              disabled={isRequestingPayout}
              activeOpacity={0.85}
            >
              {isRequestingPayout ? (
                <ActivityIndicator color={colors.textWhite} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color={colors.textWhite} />
                  <Text style={styles.submitPayoutText}>CONFIRM WITHDRAWAL</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surfaceDark,
  },
  header: {
    backgroundColor: colors.surfaceDark,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textWhite,
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    marginTop: 2,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  heroSub: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.surfaceGreen,
    letterSpacing: 0.6,
  },
  heroAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: spacing.sm,
  },
  heroCurrency: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textWhite,
    marginRight: 4,
  },
  heroAmount: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.textWhite,
  },
  payoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    marginTop: spacing.xs,
  },
  payoutButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  gridCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  gridValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 4,
  },
  historySection: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontFamily: 'InstrumentSerifItalic',
    fontSize: 30,
    color: colors.primary,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  earningItemCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemOrderNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  itemDate: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.online,
  },
  itemDetailsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.xs,
  },
  chipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    height: 54,
    marginBottom: spacing.md,
  },
  inputPrefix: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickChip: {
    flex: 1,
    backgroundColor: colors.surfaceGreen,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  submitPayoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  submitPayoutText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textWhite,
    letterSpacing: 0.5,
  },
});

