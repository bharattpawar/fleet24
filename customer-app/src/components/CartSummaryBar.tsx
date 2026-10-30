import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, borderRadius, spacing } from '../theme/tokens';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../context/CartContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CartSummaryBarProps {
  onPress: () => void;
  bottomOffset?: number;
}

export const CartSummaryBar: React.FC<CartSummaryBarProps> = ({ onPress, bottomOffset }) => {
  const { cart } = useCart();
  const insets = useSafeAreaInsets();

  if (!cart || cart.items.length === 0) {
    return null;
  }

  const effectiveBottom =
    bottomOffset !== undefined ? bottomOffset : Math.max(insets.bottom + 8, 16);

  return (
    <View style={[styles.outerContainer, { bottom: effectiveBottom }]}>
      <TouchableOpacity activeOpacity={0.9} style={styles.bar} onPress={onPress}>
        <View style={styles.leftCol}>
          <View style={styles.badgePill}>
            <Ionicons name="bag-handle" size={12} color="#FFFFFF" />
            <Text style={styles.countText}>
              {cart.itemCount} {cart.itemCount === 1 ? 'ITEM' : 'ITEMS'}
            </Text>
          </View>
          <Text style={styles.totalText}>₹{cart.totalPayable.toFixed(0)}</Text>
        </View>

        <View style={styles.rightCol}>
          <Text style={styles.viewCartText}>View Cart</Text>
          <View style={styles.arrowCircle}>
            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 999,
  },
  bar: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  leftCol: {
    flexDirection: 'column',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  countText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  totalText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewCartText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  arrowCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
