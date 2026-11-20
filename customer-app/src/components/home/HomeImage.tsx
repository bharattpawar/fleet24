import React, { useState } from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HOME_ART, HomeArtKey } from '../../theme/homeArt';
import { resolveImage } from '../../utils/imageRef';
import { home } from '../../theme/homeTheme';

/**
 * Image with a fixed fallback order so the app never shows a broken image:
 * 1. the admin's image (uploaded media, built-in illustration or URL)
 * 2. the built-in illustration `fallback`
 * 3. a neutral placeholder
 */
export function HomeImage({ source, fallback, alt, style, fit = 'cover' }: {
  source?: string | null;
  fallback?: HomeArtKey;
  alt?: string;
  style?: StyleProp<ImageStyle>;
  fit?: 'cover' | 'contain';
}) {
  const primary = resolveImage(source);
  const [stage, setStage] = useState<0 | 1 | 2>(primary ? 0 : fallback ? 1 : 2);
  const src = stage === 0 ? primary : stage === 1 && fallback ? HOME_ART[fallback] : null;

  if (!src) {
    return (
      <View style={[styles.placeholder, style as object]} accessible={Boolean(alt)} accessibilityLabel={alt}>
        <Ionicons name="restaurant-outline" size={22} color={home.muted} />
      </View>
    );
  }
  return (
    <Image
      source={src}
      style={[styles.fill, style]}
      resizeMode={fit}
      accessible={Boolean(alt)}
      accessibilityLabel={alt}
      alt={alt}
      onError={() => setStage(current => (current === 0 && fallback ? 1 : 2))}
    />
  );
}

const styles = StyleSheet.create({
  // Explicit size: on web a bundled image otherwise takes its natural 512px size.
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  placeholder: { ...StyleSheet.absoluteFill, backgroundColor: home.pill, alignItems: 'center', justifyContent: 'center' },
});
