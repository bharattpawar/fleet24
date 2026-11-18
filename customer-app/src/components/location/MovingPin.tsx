import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/tokens';

/** Centre pin that lifts while the map is moving and drops when it settles. */
export function MovingPin({ lift }: { lift: Animated.Value }) {
  const translateY = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const shadowScale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] });
  return (
    <View pointerEvents="none" style={styles.layer} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.shadow, { transform: [{ scale: shadowScale }] }]} />
      <Animated.View style={[styles.pin, { transform: [{ translateY }] }]}>
        <Ionicons name="location" size={44} color={colors.primary} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  // The pin tip sits on the exact map centre: icon is 44 tall, so lift it by half.
  pin: { position: 'absolute', marginTop: -44 },
  shadow: { position: 'absolute', width: 14, height: 5, borderRadius: 7, backgroundColor: 'rgba(23,33,27,0.35)' },
});
