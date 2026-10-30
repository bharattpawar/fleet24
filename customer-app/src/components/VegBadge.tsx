import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, borderRadius } from '../theme/tokens';

interface VegBadgeProps {
  isVeg: boolean;
  size?: number;
}

export const VegBadge: React.FC<VegBadgeProps> = ({ isVeg, size = 16 }) => {
  const color = isVeg ? colors.veg : colors.nonVeg;

  return (
    <View
      style={[
        styles.outer,
        {
          width: size,
          height: size,
          borderColor: color,
        },
      ]}
    >
      <View
        style={[
          styles.inner,
          {
            width: size / 2,
            height: size / 2,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    borderWidth: 1.5,
    borderRadius: borderRadius.sm - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    borderRadius: 999,
  },
});
