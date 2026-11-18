import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../theme/tokens';

interface ConfirmDeliveryCardProps {
  /** Calls POST /orders/:id/delivery/confirm. Rejects with the server's message on failure. */
  onConfirm: () => Promise<void>;
}

/**
 * "I got my order" card on the tracking screen. Two taps (button, then "Yes, I got it")
 * so an accidental tap doesn't close the order.
 */
export const ConfirmDeliveryCard: React.FC<ConfirmDeliveryCardProps> = ({ onConfirm }) => {
  const [isAsking, setIsAsking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm();
      setIsAsking(false);
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : 'Could not confirm delivery. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Ionicons name="bag-check-outline" size={18} color={colors.primary} />
        </View>
        <View style={styles.headerTextCol}>
          <Text style={styles.title}>Got your order?</Text>
          <Text style={styles.sub}>Tap below once the rider has handed it to you.</Text>
        </View>
      </View>

      {!isAsking ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="I got my order"
          style={styles.primaryBtn}
          onPress={() => setIsAsking(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>I got my order</Text>
        </TouchableOpacity>
      ) : (
        <View>
          <Text style={styles.question}>Did you receive your order?</Text>
          <View style={styles.row}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Not yet"
              style={styles.secondaryBtn}
              onPress={() => {
                setIsAsking(false);
                setError(null);
              }}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryBtnText}>Not yet</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Yes, I got it"
              style={[styles.primaryBtn, styles.rowBtn]}
              onPress={handleConfirm}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Yes, I got it</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerTextCol: {
    flex: 1,
  },
  title: {
    ...typography.itemTitle,
    color: colors.textPrimary,
  },
  sub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  question: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowBtn: {
    flex: 1,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    ...typography.itemTitle,
    color: '#FFFFFF',
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: {
    ...typography.itemTitle,
    color: colors.textPrimary,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.sm,
  },
});
