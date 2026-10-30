import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { colors, borderRadius, spacing, typography } from '../theme/tokens';
import { VegBadge } from './VegBadge';
import { QuantityStepper } from './QuantityStepper';
import { Ionicons } from '@expo/vector-icons';

export interface MenuItemData {
  id: string;
  name: string;
  description: string | null;
  basePrice: string;
  effectivePrice: string;
  isVeg: boolean;
  imageUrl: string | null;
  effectiveIsAvailable: boolean;
  categoryName?: string;
  isOverridden?: boolean;
}

interface MenuItemCardProps {
  item: MenuItemData;
  quantityInCart: number;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  isOutletOpen: boolean;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({
  item,
  quantityInCart,
  onAdd,
  onIncrement,
  onDecrement,
  isOutletOpen,
}) => {
  const isAvailable = item.effectiveIsAvailable && isOutletOpen;
  const hasDiscount =
    parseFloat(item.basePrice) > parseFloat(item.effectivePrice);

  return (
    <View style={[styles.card, !isAvailable && styles.disabledCard]}>
      {/* Left Info Column */}
      <View style={styles.infoCol}>
        <View style={styles.badgeRow}>
          <VegBadge isVeg={item.isVeg} size={15} />
          {item.isOverridden && (
            <View style={styles.specialTag}>
              <Ionicons name="sparkles" size={10} color={colors.accent} />
              <Text style={styles.specialTagText}>CHEF'S PICK</Text>
            </View>
          )}
          {hasDiscount && (
            <View style={styles.discountTag}>
              <Text style={styles.discountTagText}>OFFER</Text>
            </View>
          )}
        </View>

        <Text style={styles.name} numberOfLines={2}>
          {item.name}
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.effectivePrice}>
            ₹{parseFloat(item.effectivePrice).toFixed(0)}
          </Text>
          {hasDiscount && (
            <Text style={styles.basePrice}>
              ₹{parseFloat(item.basePrice).toFixed(0)}
            </Text>
          )}
        </View>

        {item.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        {!isAvailable && (
          <View style={styles.unavailableRow}>
            <Ionicons name="alert-circle-outline" size={13} color={colors.error} />
            <Text style={styles.unavailableText}>
              {!isOutletOpen ? 'Outlet is currently closed' : 'Sold out for today'}
            </Text>
          </View>
        )}
      </View>

      {/* Right Photo & Action Column */}
      <View style={styles.actionCol}>
        <View style={styles.imageContainer}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderBox}>
              <Ionicons name="restaurant-outline" size={30} color={colors.primary} />
            </View>
          )}
        </View>

        {/* Floating Add Button / Stepper */}
        <View style={styles.buttonWrapper}>
          {isAvailable ? (
            quantityInCart > 0 ? (
              <QuantityStepper
                quantity={quantityInCart}
                onIncrement={onIncrement}
                onDecrement={onDecrement}
              />
            ) : (
              <TouchableOpacity
                style={styles.addBtn}
                activeOpacity={0.85}
                onPress={onAdd}
              >
                <Text style={styles.addBtnText}>ADD</Text>
                <Ionicons name="add" size={14} color={colors.primary} style={styles.addBtnPlus} />
              </TouchableOpacity>
            )
          ) : (
            <View style={styles.disabledBtn}>
              <Text style={styles.disabledBtnText}>Unavailable</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  disabledCard: {
    opacity: 0.65,
  },
  infoCol: {
    flex: 1,
    paddingRight: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  specialTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FAF3E8',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: borderRadius.sm,
    borderWidth: 0.5,
    borderColor: '#EBD7BE',
  },
  specialTagText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.3,
  },
  discountTag: {
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  discountTagText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.3,
  },
  name: {
    fontSize: 15.5,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 4,
    marginBottom: 4,
  },
  effectivePrice: {
    fontSize: 15.5,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  basePrice: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  description: {
    fontSize: 12.5,
    color: colors.textSecondary,
    lineHeight: 17,
    marginTop: 2,
  },
  unavailableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  unavailableText: {
    fontSize: 11.5,
    color: colors.error,
    fontWeight: '600',
  },
  actionCol: {
    width: 106,
    alignItems: 'center',
  },
  imageContainer: {
    width: 104,
    height: 104,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#EAE7DD',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderBox: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAE7DD',
  },
  buttonWrapper: {
    marginTop: -16,
    zIndex: 5,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 5,
    paddingHorizontal: 16,
    minWidth: 84,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addBtnText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 12.5,
    letterSpacing: 0.5,
  },
  addBtnPlus: {
    marginLeft: 2,
    fontWeight: '800',
  },
  disabledBtn: {
    backgroundColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  disabledBtnText: {
    color: colors.textMuted,
    fontSize: 10.5,
    fontWeight: '600',
  },
});
