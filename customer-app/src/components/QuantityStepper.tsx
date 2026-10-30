import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, borderRadius, spacing } from '../theme/tokens';

interface QuantityStepperProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
}

export const QuantityStepper: React.FC<QuantityStepperProps> = ({
  quantity,
  onIncrement,
  onDecrement,
  disabled = false,
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.btn}
        onPress={onDecrement}
        disabled={disabled}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
      >
        <Text style={styles.btnText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.quantityText}>{quantity}</Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={onIncrement}
        disabled={disabled}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
      >
        <Text style={styles.btnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: borderRadius.sm,
    height: 30,
    minWidth: 74,
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  btn: {
    paddingHorizontal: 8,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  quantityText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    minWidth: 18,
    textAlign: 'center',
  },
});
