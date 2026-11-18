import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, spacing } from '../theme/tokens';
import type { CartPromo } from '../context/CartContext';

interface Props {
  promo: CartPromo | null | undefined;
  canUseCoupons: boolean;
  onApply: (code: string) => Promise<void>;
  onRemove: () => Promise<void>;
  onLogin?: () => void;
}

/** Coupon code box in the cart: enter a code, see what it saves, or why it does not apply. */
export const CouponSection: React.FC<Props> = ({ promo, canUseCoupons, onApply, onRemove, onLogin }) => {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async () => {
    if (!code.trim()) {
      setError('Enter a coupon code.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onApply(code);
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This coupon cannot be used.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await onRemove();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the coupon.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="pricetag-outline" size={15} color={colors.primary} />
        <Text style={styles.header}>OFFERS & COUPONS</Text>
      </View>

      {promo ? (
        <View style={styles.appliedRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.code}>{promo.code}</Text>
            {promo.applied ? (
              <Text style={styles.saved}>You save ₹{promo.discountAmount.toFixed(0)} with this coupon</Text>
            ) : (
              <Text style={styles.notApplied}>{promo.message ?? 'This coupon does not apply right now.'}</Text>
            )}
          </View>
          <TouchableOpacity onPress={remove} disabled={busy} accessibilityRole="button" accessibilityLabel={`Remove coupon ${promo.code}`}>
            {busy ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.action}>Remove</Text>}
          </TouchableOpacity>
        </View>
      ) : canUseCoupons ? (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Enter coupon code"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            value={code}
            onChangeText={(t) => {
              setCode(t);
              if (error) setError(null);
            }}
            onSubmitEditing={apply}
            maxLength={30}
            accessibilityLabel="Coupon code"
          />
          <TouchableOpacity onPress={apply} disabled={busy} accessibilityRole="button" accessibilityLabel="Apply coupon">
            {busy ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.action}>APPLY</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={onLogin} disabled={!onLogin} accessibilityRole="button">
          <Text style={styles.loginText}>Log in to use a coupon</Text>
        </TouchableOpacity>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  header: { fontSize: 10.5, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm + 4,
  },
  input: { flex: 1, paddingVertical: 10, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  action: { fontSize: 13, fontWeight: '800', color: colors.primary, paddingVertical: 8 },
  appliedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceGreen,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 4,
  },
  code: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, letterSpacing: 0.5 },
  saved: { fontSize: 12.5, color: colors.success, marginTop: 2, fontWeight: '600' },
  notApplied: { fontSize: 12.5, color: colors.warning, marginTop: 2, fontWeight: '600' },
  loginText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  error: { fontSize: 12.5, color: colors.error, marginTop: 6 },
});
