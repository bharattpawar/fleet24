import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { exploreColors } from '../theme/tokens';

export function ExplorePhoto({ uri }: { uri: string | null }) {
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View style={styles.placeholder} accessibilityLabel="Image unavailable">
        <Ionicons name="restaurant-outline" size={26} color={exploreColors.green} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={StyleSheet.absoluteFill}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    ...StyleSheet.absoluteFill,
    backgroundColor: exploreColors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
