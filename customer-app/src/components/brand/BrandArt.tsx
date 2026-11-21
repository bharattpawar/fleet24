import { appStyles } from '../../theme/appStyles';
import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/tokens';

/**
 * The splash and sign-in artwork. No Fleet24 rider illustration exists in the repo yet, so this
 * draws a placeholder from the brand green and the bicycle glyph the app already uses for riders.
 * When the illustration arrives, set it here and both screens pick it up:
 *   const RIDER_ARTWORK: ImageSourcePropType | null = require('../../../assets/images/rider.png');
 */
const RIDER_ARTWORK: ImageSourcePropType | null = null;

export const brand = {
  green: colors.primary, // #24533F, the app's deep green
  greenPressed: colors.primaryPressed,
  pale: colors.surfaceGreen, // #EAF2EC
  lime: '#D9F078',
  midGreen: '#3F7D5C',
};

type Tone = 'onPale' | 'onGreen';

export function BrandArt({ size = 168, tone = 'onPale' }: { size?: number; tone?: Tone }) {
  if (RIDER_ARTWORK) {
    return <Image source={RIDER_ARTWORK} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />;
  }
  const badge = Math.round(size * 0.5);
  const onGreen = tone === 'onGreen';
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: size / 2, backgroundColor: onGreen ? 'rgba(255,255,255,0.12)' : 'rgba(36,83,63,0.08)' },
        ]}
      />
      <View style={styles.speedLines}>
        {[0.34, 0.24, 0.3].map((w, i) => (
          <View
            key={i}
            style={{
              width: size * w,
              height: Math.max(3, size * 0.024),
              borderRadius: 4,
              marginVertical: size * 0.022,
              marginLeft: i === 1 ? size * 0.08 : 0,
              backgroundColor: onGreen ? 'rgba(217,240,120,0.75)' : 'rgba(36,83,63,0.28)',
            }}
          />
        ))}
      </View>
      <View
        style={{
          width: badge,
          height: badge,
          borderRadius: badge * 0.32,
          marginLeft: size * 0.16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: onGreen ? brand.lime : brand.green,
        }}
      >
        <Ionicons name="bicycle" size={badge * 0.62} color={onGreen ? brand.green : '#FFFFFF'} />
      </View>
    </View>
  );
}

export function Wordmark({ size = 34, tone = 'onPale' }: { size?: number; tone?: Tone }) {
  const onGreen = tone === 'onGreen';
  return (
    <Text
      accessibilityRole="header"
      style={{ fontFamily: 'HomeBold', fontSize: size, lineHeight: size * 1.2, fontWeight: '800', letterSpacing: -size * 0.03, color: onGreen ? '#FFFFFF' : brand.green }}
    >
      Fleet<Text style={{ color: onGreen ? brand.lime : brand.midGreen }}>24</Text>
    </Text>
  );
}

const styles = appStyles({
  speedLines: { position: 'absolute', left: '8%', top: 0, bottom: 0, justifyContent: 'center' },
});
