import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/tokens';
import { useRestaurantAuth } from '../context/RestaurantAuthContext';

/** How often the waiting screen checks whether admin has approved the restaurant. */
export const APPROVAL_POLL_MS = 30_000;

interface Props {
  onEditApplication: () => void;
}

/** Under review, rejected (with reason) or suspended. Opens the kitchen by itself once approved. */
export const RestaurantApplicationStatusScreen: React.FC<Props> = ({ onEditApplication }) => {
  const { myApplication, checkApplication, logout } = useRestaurantAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const status = myApplication?.status;
  const isPending = status === 'pending';

  useEffect(() => {
    if (!isPending) return;
    const timer = setInterval(() => {
      checkApplication().catch(() => {});
    }, APPROVAL_POLL_MS);
    return () => clearInterval(timer);
  }, [isPending, checkApplication]);

  const checkNow = async () => {
    if (isChecking) return;
    setIsChecking(true);
    setCheckError(null);
    try {
      await checkApplication();
    } catch {
      setCheckError('Could not check right now. Try again in a moment.');
    } finally {
      setIsChecking(false);
    }
  };

  const content =
    status === 'rejected'
      ? {
          icon: 'close-circle' as const,
          tint: colors.rejected,
          bg: colors.rejectedLight,
          title: 'Application not approved',
          body: 'Our team could not approve your restaurant. Fix the details and submit again.',
        }
      : status === 'suspended'
        ? {
            icon: 'pause-circle' as const,
            tint: colors.pending,
            bg: colors.pendingLight,
            title: 'Restaurant suspended',
            body: 'Your restaurant is paused on Fleet24. Please contact the Fleet24 team to resolve it.',
          }
        : {
            icon: 'time' as const,
            tint: colors.primary,
            bg: colors.primaryLight,
            title: 'Application under review',
            body: 'Thanks for registering. Our team is verifying your FSSAI, PAN and bank details and may call you. Once approved, this screen opens your kitchen and you can add your menu.',
          };

  const submitted = myApplication?.submittedAt ? new Date(myApplication.submittedAt) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: content.bg }]}>
          <Ionicons name={content.icon} size={36} color={content.tint} />
        </View>
        <Text style={styles.title}>{content.title}</Text>
        {myApplication?.restaurantName ? <Text style={styles.restaurantName}>{myApplication.restaurantName}</Text> : null}
        <Text style={styles.subtitle}>{content.body}</Text>

        {status === 'rejected' && myApplication?.rejectionReason ? (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Reason</Text>
            <Text style={styles.reasonText}>{myApplication.rejectionReason}</Text>
          </View>
        ) : null}

        {submitted && !Number.isNaN(submitted.getTime()) ? (
          <Text style={styles.meta}>Submitted {submitted.toLocaleDateString()}</Text>
        ) : null}

        {status === 'rejected' ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Edit and submit again"
            style={styles.primaryBtn}
            onPress={onEditApplication}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Edit and submit again</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Check status"
            style={styles.primaryBtn}
            onPress={checkNow}
            disabled={isChecking}
            activeOpacity={0.85}
          >
            {isChecking ? <ActivityIndicator color={colors.textWhite} /> : <Text style={styles.primaryBtnText}>Check status</Text>}
          </TouchableOpacity>
        )}
        {checkError ? <Text style={styles.errorText}>{checkError}</Text> : null}

        <TouchableOpacity accessibilityRole="button" style={styles.linkBtn} onPress={logout}>
          <Text style={styles.linkText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, maxWidth: 560, width: '100%', alignSelf: 'center' },
  iconCircle: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.huge,
    marginBottom: spacing.lg,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  restaurantName: { fontSize: 15, fontWeight: '700', color: colors.primary, textAlign: 'center', marginTop: spacing.xs },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  reasonBox: { backgroundColor: colors.rejectedLight, borderRadius: borderRadius.sm, padding: spacing.md, marginTop: spacing.lg },
  reasonLabel: { fontSize: 12, fontWeight: '700', color: colors.rejectedDark },
  reasonText: { fontSize: 14, color: colors.textPrimary, marginTop: spacing.xs },
  meta: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '800', color: colors.textWhite },
  errorText: { fontSize: 12, color: colors.rejected, textAlign: 'center', marginTop: spacing.sm },
  linkBtn: { alignItems: 'center', paddingVertical: spacing.lg },
  linkText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
});
