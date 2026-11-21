import React, { useEffect, useState } from 'react';
import { Animated, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './Button';
import { colors } from '../theme/tokens';
import { appStyles } from '../theme/appStyles';
import { motion, useReducedMotion } from '../theme/motion';
import type { ComingSoonFeature } from '../utils/homeFeed';

const FEATURES: Record<ComingSoonFeature, { label: string; icon: keyof typeof Ionicons.glyphMap; message: string }> = {
  instant: { label: 'Fleet24 Instant', icon: 'bag-handle-outline', message: 'Everyday essentials, a little closer. We’re getting Instant ready for you.' },
  dineout: { label: 'Fleet24 Dineout', icon: 'restaurant-outline', message: 'New tables. New favourites. Your next dining experience is on its way.' },
  scenes: { label: 'Fleet24 Scenes', icon: 'sparkles-outline', message: 'Good plans. Great company. A new way to discover what’s happening is on its way.' },
};

export function LaunchingSoonModal({ feature, onClose, onExploreFood }: {
  feature: ComingSoonFeature | null;
  onClose: () => void;
  onExploreFood: () => void;
}) {
  return feature ? <LaunchingSoonContent key={feature} feature={feature} onClose={onClose} onExploreFood={onExploreFood} /> : null;
}

function LaunchingSoonContent({ feature, onClose, onExploreFood }: {
  feature: ComingSoonFeature;
  onClose: () => void;
  onExploreFood: () => void;
}) {
  const info = FEATURES[feature];
  const reduced = useReducedMotion();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = height < 740;
  const [appear] = useState(() => new Animated.Value(0));
  const [float] = useState(() => new Animated.Value(0));
  const [shimmer] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduced) {
      appear.setValue(1); float.setValue(0.5); shimmer.setValue(0.5);
      return;
    }
    const entrance = Animated.spring(appear, { toValue: 1, tension: 65, friction: 9, useNativeDriver: motion.native });
    const hover = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1900, easing: motion.easing.standard, useNativeDriver: motion.native, isInteraction: false }),
      Animated.timing(float, { toValue: 0, duration: 1900, easing: motion.easing.standard, useNativeDriver: motion.native, isInteraction: false }),
    ]));
    const sparkle = Animated.loop(Animated.sequence([
      Animated.timing(shimmer, { toValue: 1, duration: 1300, easing: motion.easing.standard, useNativeDriver: motion.native, isInteraction: false }),
      Animated.timing(shimmer, { toValue: 0, duration: 1300, easing: motion.easing.standard, useNativeDriver: motion.native, isInteraction: false }),
    ]));
    entrance.start(); hover.start(); sparkle.start();
    return () => { entrance.stop(); hover.stop(); sparkle.stop(); };
  }, [appear, float, shimmer, reduced]);

  const lift = float.interpolate({ inputRange: [0, 1], outputRange: [6, -6] });
  const orbit = float.interpolate({ inputRange: [0, 1], outputRange: [-5, 5] });
  const twinkle = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] });

  return (
    <Modal transparent visible animationType="fade" hardwareAccelerated statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.center, { paddingTop: Math.max(20, insets.top + 12), paddingBottom: Math.max(20, insets.bottom + 12) }]} bounces={false} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} accessibilityRole="button" accessibilityLabel="Dismiss launching soon" onPress={onClose} />
          <Animated.View
            role="dialog"
            aria-modal
            accessibilityLabel={`${info.label} launching soon`}
            accessibilityViewIsModal
            onAccessibilityEscape={onClose}
            onStartShouldSetResponder={() => true}
            style={[styles.card, { opacity: appear, transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [32, 0] }) }, { scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]}
          >
            <View style={styles.topRow}>
              <View style={styles.featureBadge}><Ionicons name={info.icon} size={15} color={colors.primary} /><Text style={styles.featureName}>{info.label}</Text></View>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close launching soon" onPress={onClose} style={styles.close} hitSlop={6}><Ionicons name="close" size={20} color={colors.primaryDark} /></TouchableOpacity>
            </View>

            <View style={[styles.stage, compact && { height: 190 }]} pointerEvents="none">
              <View style={styles.haloPosition}><Animated.View style={[styles.halo, compact && { width: 170, height: 170 }, { transform: [{ scale: shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] }) }] }]} /></View>
              <View style={styles.ground} />
              <Animated.View style={[styles.mascot, { transform: [{ translateY: lift }, { rotate: float.interpolate({ inputRange: [0, 1], outputRange: ['-1.5deg', '1.5deg'] }) }] }]}>
                <Image source={require('../../assets/illustrations/launching-soon-boy.webp')} style={styles.mascotImage} resizeMode="contain" accessible={false} alt="" />
              </Animated.View>
              <Animated.View style={[styles.orbitCard, styles.orbitLeft, { transform: [{ translateY: orbit }, { rotate: '-12deg' }] }]}><Ionicons name="bag-handle-outline" size={23} color={colors.primary} /></Animated.View>
              <Animated.View style={[styles.orbitCard, styles.orbitRight, { transform: [{ translateY: lift }, { rotate: '12deg' }] }]}><Ionicons name={info.icon} size={25} color={colors.primary} /></Animated.View>
              <Animated.View style={[styles.sparkle, styles.sparkleTop, { opacity: twinkle, transform: [{ scale: twinkle }] }]}><Ionicons name="sparkles" size={25} color="#D0AD38" /></Animated.View>
              <Animated.View style={[styles.sparkle, styles.sparkleBottom, { opacity: twinkle, transform: [{ scale: twinkle }] }]}><Ionicons name="star" size={13} color={colors.primary} /></Animated.View>
              <View style={[styles.dot, { top: 18, left: 58 }]} /><View style={[styles.dot, { bottom: 40, right: 22, width: 5, height: 5 }]} />
            </View>

            <View style={styles.launchBadge}><View style={styles.statusDot} /><Text style={styles.launchLabel}>SOMETHING GOOD IS COMING</Text></View>
            <Text accessibilityRole="header" style={styles.title}>Launching Soon</Text>
            <Text style={styles.message}>{info.message}</Text>
            <Button title="Back to Food" onPress={onExploreFood} icon={<Ionicons name="arrow-forward" size={17} color="#FFFFFF" />} style={styles.button} size="lg" />
            <Text style={styles.footnote}>A little wait. A lot to look forward to.</Text>
          </Animated.View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = appStyles({
  overlay: { flex: 1, backgroundColor: 'rgba(12,35,25,0.62)' },
  scroll: { flex: 1 },
  center: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  card: { width: '100%', maxWidth: 440, backgroundColor: '#FEFFFC', borderRadius: 30, padding: 24, borderWidth: 1, borderColor: '#E2ECDF', boxShadow: '0px 24px 80px rgba(0,0,0,0.18)' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  featureBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceGreen, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  featureName: { fontSize: 12, lineHeight: 17, fontWeight: '700', color: colors.primary },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F4EE', alignItems: 'center', justifyContent: 'center' },
  stage: { height: 234, marginTop: 8, marginBottom: 8 },
  haloPosition: { position: 'absolute', top: 14, left: 0, right: 0, alignItems: 'center' },
  halo: { width: 210, height: 210, borderRadius: 105, backgroundColor: '#EAF2D9' },
  ground: { position: 'absolute', width: 144, height: 18, borderRadius: 72, backgroundColor: 'rgba(36,83,63,0.09)', bottom: 0, alignSelf: 'center' },
  mascot: { position: 'absolute', left: 36, right: 36, top: 0, bottom: 0 },
  mascotImage: { width: '100%', height: '100%' },
  orbitCard: { position: 'absolute', width: 47, height: 47, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1EAD9', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 6px 16px rgba(36,83,63,0.09)' },
  orbitLeft: { left: 4, top: 48 },
  orbitRight: { right: 2, bottom: 36, backgroundColor: colors.citrusLime, borderColor: '#CBE273' },
  sparkle: { position: 'absolute' },
  sparkleTop: { top: 16, right: 24 },
  sparkleBottom: { bottom: 35, left: 30 },
  dot: { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: '#A5C291' },
  launchBadge: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6, backgroundColor: '#F0F5E8', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#4B7A43' },
  launchLabel: { color: '#4B6C3F', fontSize: 8, lineHeight: 12, fontWeight: '700', letterSpacing: 1.1 },
  title: { fontSize: 31, lineHeight: 39, letterSpacing: -1.1, fontWeight: '800', color: colors.primaryDark, textAlign: 'center', marginTop: 12 },
  message: { fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'center', marginTop: 9 },
  button: { width: '100%', marginTop: 24, borderRadius: 16 },
  footnote: { fontSize: 10, lineHeight: 16, color: '#83917D', textAlign: 'center', marginTop: 14 },
});
