import { appStyles } from '../../theme/appStyles';
import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { motion, useReducedMotion } from '../../theme/motion';
import { Wordmark, brand } from '../brand/BrandArt';
import { RidingScene } from './RidingScene';

const ENTER = 400;
const MIN_RIDE = 1700; // Allow one full pedal cycle, including the entrance.
const EXIT = 300;
const REVEAL = 240;
const MAX_WAIT = 4000; // Never hold the app behind a stalled request.

/**
 * Cold-start splash drawn over the real app. The app renders and loads underneath from the first
 * frame, so the splash only covers work that is already happening; it leaves once `ready` is true
 * (the existing auth check has settled) and one short riding cycle has played.
 */
export function StartupSplash({ ready }: { ready: boolean }) {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const [gone, setGone] = useState(false);
  const [entered, setEntered] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [enter] = useState(() => new Animated.Value(0));
  const [exit] = useState(() => new Animated.Value(0));
  const [veil] = useState(() => new Animated.Value(1));
  const sceneSize = Math.max(180, Math.min(width - 32, height * 0.48, 360));

  useEffect(() => {
    const hold = setTimeout(() => setEntered(true), reduced ? 140 : MIN_RIDE);
    if (reduced) { enter.setValue(1); return () => clearTimeout(hold); }
    const entrance = Animated.timing(enter, { toValue: 1, duration: ENTER, easing: motion.easing.out, useNativeDriver: motion.native, isInteraction: false });
    entrance.start();
    return () => { clearTimeout(hold); entrance.stop(); };
  }, [enter, reduced]);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), MAX_WAIT);
    return () => clearTimeout(timer);
  }, []);

  const leave = (ready || timedOut) && entered;
  useEffect(() => {
    if (!leave) return;
    const fadeOut = Animated.timing(veil, { toValue: 0, duration: reduced ? 150 : REVEAL, easing: motion.easing.standard, useNativeDriver: motion.native });
    const sequence = reduced
      ? fadeOut
      : Animated.parallel([
          Animated.timing(exit, { toValue: 1, duration: EXIT, easing: motion.easing.in, useNativeDriver: motion.native }),
          Animated.sequence([Animated.delay(120), fadeOut]),
        ]);
    sequence.start(({ finished }) => { if (finished) setGone(true); });
    const fallback = setTimeout(() => setGone(true), EXIT + REVEAL + 200);
    return () => { clearTimeout(fallback); sequence.stop(); };
  }, [leave, reduced, exit, veil]);

  if (gone) return null;

  const rise = enter.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 14, 0] });
  const riderX = exit.interpolate({ inputRange: [0, 1], outputRange: [0, reduced ? 0 : 48] });
  const wordFade = Animated.multiply(enter, exit.interpolate({ inputRange: [0, 0.7], outputRange: [1, 0], extrapolate: 'clamp' }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { opacity: veil }]}
      pointerEvents={leave ? 'none' : 'auto'}
      accessibilityLabel="Fleet24 is loading"
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
    >
      <View style={[styles.topGlow, { width: width * 1.3, height: width * 1.3, borderRadius: width, top: -width * 0.94 }]} />
      <Animated.View style={[styles.content, { opacity: enter, transform: [{ translateY: rise }] }]}>
        <View style={styles.eyebrow}><View style={styles.dot} /><Text style={styles.eyebrowText}>A LITTLE JOY, DELIVERED</Text></View>
        <Animated.View style={{ transform: [{ translateX: riderX }] }}>
          <RidingScene size={sceneSize} reduced={reduced} />
        </Animated.View>
        <Animated.View style={[styles.word, { opacity: wordFade }]}>
          <Wordmark size={height < 650 ? 34 : 40} />
          <Text style={styles.tagline}>Good food. On its way.</Text>
          <View style={styles.detail}><View style={styles.rule} /><Text style={styles.detailText}>FRESH PICKS · HAPPY DOORSTEPS</Text><View style={styles.rule} /></View>
        </Animated.View>
      </Animated.View>
      <Text style={[styles.footer, { bottom: Math.max(22, height * 0.055) }]}>YOUR NEXT DELICIOUS MOMENT</Text>
    </Animated.View>
  );
}

const styles = appStyles({
  root: { backgroundColor: '#F3F7EE', alignItems: 'center', justifyContent: 'center', zIndex: 100, elevation: 100, overflow: 'hidden' },
  topGlow: { position: 'absolute', alignSelf: 'center', backgroundColor: '#E9F0DC' },
  content: { width: '100%', alignItems: 'center', paddingBottom: 24 },
  eyebrow: { flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: '#E6EFD9', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 99, marginBottom: 8 },
  dot: { height: 5, width: 5, borderRadius: 3, backgroundColor: brand.green },
  eyebrowText: { fontSize: 9, letterSpacing: 1.8, color: '#637A4E', fontWeight: '700' },
  word: { alignItems: 'center', marginTop: -8 },
  tagline: { marginTop: 7, fontSize: 16, lineHeight: 24, letterSpacing: -0.2, fontWeight: '500', color: '#698060' },
  detail: { flexDirection: 'row', gap: 9, alignItems: 'center', marginTop: 24 },
  rule: { width: 20, height: 1, backgroundColor: '#CCDBBD' },
  detailText: { fontSize: 8, lineHeight: 14, letterSpacing: 1.4, color: '#91A17F', fontWeight: '600' },
  footer: { position: 'absolute', fontSize: 8, letterSpacing: 2.1, color: '#A4B291', fontWeight: '600', textAlign: 'center', paddingHorizontal: 16 },
});
