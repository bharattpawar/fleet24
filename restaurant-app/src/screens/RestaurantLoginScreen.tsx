import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, minTouchTarget, shadows } from '../theme/tokens';
import { useRestaurantAuth } from '../context/RestaurantAuthContext';

export const RestaurantLoginScreen: React.FC = () => {
  const { loginWithPhoneOnly } = useRestaurantAuth();
  const [phone, setPhone] = useState('+919876543210');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    const cleaned = phone.trim();
    if (!cleaned || cleaned.length < 13) {
      setError('Please enter a valid 10-digit Indian phone number (e.g. +919876543210)');
      return;
    }

    setLoading(true);
    try {
      await loginWithPhoneOnly(cleaned);
    } catch (err: any) {
      setError(err?.message || 'Failed to authenticate. Please check phone number.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentWrapper}>
          {/* Header Branding */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="restaurant" size={36} color={colors.limeAccent} />
            </View>
            <Text style={styles.brandTitle}>FLEET24</Text>
            <Text style={styles.brandSubtitle}>Restaurant & Kitchen Operations</Text>
          </View>

          {/* Card Form */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Kitchen Terminal Login</Text>
            <Text style={styles.cardDescription}>
              Enter your registered restaurant staff mobile number to access your live order display and kitchen terminal.
            </Text>

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color={colors.rejected} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>RESTAURANT PHONE NUMBER</Text>
              <View style={styles.phoneInputContainer}>
                <Ionicons name="call-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="+919876543210"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Open Kitchen Terminal"
              >
                {loading ? (
                  <ActivityIndicator color={colors.textWhite} />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Open Kitchen Terminal</Text>
                    <Ionicons name="arrow-forward" size={18} color={colors.textWhite} />
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Quick Demo Credentials Pill */}
            <TouchableOpacity
              style={styles.demoPill}
              onPress={() => setPhone('+919876543210')}
              activeOpacity={0.7}
            >
              <Ionicons name="key-outline" size={14} color={colors.primary} />
              <Text style={styles.demoPillText}>Test Partner Mobile: +919876543210</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Encrypted Operational Access · Fleet24 Partner Network
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceDark,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.limeAccent,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textWhite,
    letterSpacing: 2,
  },
  brandSubtitle: {
    fontSize: 13,
    color: colors.limeAccent,
    marginTop: 2,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.modal,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  cardDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.rejectedLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  errorText: {
    fontSize: 12,
    color: colors.rejectedDark,
    fontWeight: '600',
    flex: 1,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.6,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    minHeight: minTouchTarget + 4,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    minHeight: minTouchTarget + 6,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    ...shadows.kpi,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textWhite,
  },
  demoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surfaceGreen,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(36, 83, 63, 0.2)',
  },
  demoPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '500',
  },
});
