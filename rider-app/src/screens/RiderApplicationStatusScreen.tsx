import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/tokens';
import { useRiderAuth } from '../context/RiderAuthContext';
import { VEHICLE_OPTIONS } from '../utils/riderOnboarding';

/** How often the waiting screen checks whether admin has approved the rider. */
export const APPROVAL_POLL_MS = 30_000;

interface Props {
  /** Rejected riders can edit their details and apply again. */
  onEditApplication: () => void;
}

/** Shown after applying: waiting for admin approval, or the rejection reason. Opens the app once approved. */
export const RiderApplicationStatusScreen: React.FC<Props> = ({ onEditApplication }) => {
  const { profile, refreshProfile, logout } = useRiderAuth();
  const [isChecking, setIsChecking] = useState(false);
  const isRejected = profile?.verificationStatus === 'rejected';

  // Check in the background while waiting; approval switches the app to the rider home by itself.
  useEffect(() => {
    if (isRejected) return;
    const timer = setInterval(() => {
      refreshProfile().catch(() => {});
    }, APPROVAL_POLL_MS);
    return () => clearInterval(timer);
  }, [isRejected, refreshProfile]);

  const checkNow = async () => {
    if (isChecking) return;
    setIsChecking(true);
    try {
      await refreshProfile();
    } finally {
      setIsChecking(false);
    }
  };

  const vehicleLabel = VEHICLE_OPTIONS.find((v) => v.value === profile?.vehicleType)?.label ?? profile?.vehicleType;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.iconCircle, isRejected && styles.iconCircleRejected]}>
          <Ionicons
            name={isRejected ? 'close-circle' : 'time'}
            size={36}
            color={isRejected ? colors.error : colors.primary}
          />
        </View>

        <Text style={styles.title}>{isRejected ? 'Application not approved' : 'Application submitted'}</Text>
        <Text style={styles.subtitle}>
          {isRejected
            ? 'Our team could not approve your application. Fix the details below and apply again.'
            : 'Thanks for applying. Our team is checking your details and will call you. Once you are approved, this screen opens your rider app by itself.'}
        </Text>

        {isRejected && profile?.rejectionReason ? (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Reason</Text>
            <Text style={styles.reasonText}>{profile.rejectionReason}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Row label="Name" value={profile?.fullName} />
          <Row label="Phone" value={profile?.user?.phone} />
          <Row label="Vehicle" value={vehicleLabel} />
          <Row label="Vehicle number" value={profile?.vehicleNumber} />
          <Row label="Licence number" value={profile?.licenseNumber} last />
        </View>

        {isRejected ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Edit details and apply again"
            style={styles.primaryBtn}
            onPress={onEditApplication}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Edit details and apply again</Text>
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

        <TouchableOpacity accessibilityRole="button" style={styles.linkBtn} onPress={logout}>
          <Text style={styles.linkText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const Row: React.FC<{ label: string; value?: string | null; last?: boolean }> = ({ label, value, last }) => (
  <View style={[styles.row, !last && styles.rowBorder]}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value || 'Not given'}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, alignItems: 'stretch' },
  iconCircle: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  iconCircleRejected: { backgroundColor: colors.errorLight },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  reasonBox: {
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  reasonLabel: { fontSize: 12, fontWeight: '700', color: colors.error },
  reasonText: { fontSize: 14, color: colors.textPrimary, marginTop: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md, gap: spacing.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  rowLabel: { fontSize: 13, color: colors.textSecondary },
  rowValue: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '800', color: colors.textWhite },
  linkBtn: { alignItems: 'center', paddingVertical: spacing.lg },
  linkText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
});
