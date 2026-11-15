import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme/tokens';
import { ExplorePhoto } from './ExplorePhoto';
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
            ₹{Number(item.effectivePrice).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </Text>
          {hasDiscount && (
            <Text style={styles.basePrice}>
              ₹{Number(item.basePrice).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
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
          <ExplorePhoto key={item.imageUrl} uri={item.imageUrl} />
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
                accessibilityRole="button"
                accessibilityLabel={`Add ${item.name} to cart`}
                activeOpacity={0.85}
                onPress={onAdd}
              >
                <Text style={styles.addBtnText}>Add</Text>
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
  card: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: '#ECEDEB', alignItems: 'flex-start' },
  disabledCard: { opacity: 0.65 },
  infoCol: { flex: 1, minWidth: 0, paddingRight: 18 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  discountTag: { backgroundColor: '#EAF5ED', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  discountTagText: { color: colors.primary, fontSize: 9, fontWeight: '700' },
  name: { fontSize: 17, lineHeight: 23, fontWeight: '700', letterSpacing: -0.3, color: '#202326' },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 7, marginTop: 7 },
  effectivePrice: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: '#202326' },
  basePrice: { fontSize: 12, color: '#85898D', textDecorationLine: 'line-through' },
  description: { fontSize: 13, lineHeight: 19, color: '#777B80', marginTop: 8 },
  unavailableRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  unavailableText: { flex: 1, fontSize: 11, color: '#8B5149' },
  actionCol: { width: 116, alignItems: 'center', paddingBottom: 2 },
  imageContainer: { width: 116, height: 116, borderRadius: 18, overflow: 'hidden', backgroundColor: '#F3F4F1' },
  buttonWrapper: { marginTop: -14, zIndex: 5 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8E5DC', borderRadius: 12, minHeight: 44, minWidth: 98, boxShadow: '0px 3px 10px rgba(20, 55, 30, 0.09)' },
  addBtnText: { fontSize: 16, fontWeight: '800', color: colors.primary },
  addBtnPlus: { marginLeft: 10 },
  disabledBtn: { backgroundColor: '#F0F1EE', borderRadius: 10, padding: 10 },
  disabledBtnText: { fontSize: 11, color: '#737773' },
});
