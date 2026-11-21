import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import metadata from '../../../assets/illustrations/startup/character-cycle.json';
import { startupTiming as timing } from '../../utils/startupCycle';
import { CharacterScene } from './CharacterScene';
import { startupMotion as motion, useStartupReducedMotion } from './useStartupMotion';
import { appStyles } from '../../theme/appStyles';

const copy = metadata.role === 'rider' ? {
  label: 'Fleet24 Rider', role: 'RIDER PARTNER', eyebrow: 'EVERY DELIVERY, A LITTLE JOY',
  tagline: 'Good rides. Great deliveries.', detail: 'ON THE MOVE · MAKING SOMEONE’S DAY', footer: 'YOUR NEXT GREAT DELIVERY',
} : {
  label: 'Fleet24 Restaurant', role: 'RESTAURANT PARTNER', eyebrow: 'A LITTLE CARE IN EVERY PLATE',
  tagline: 'Made with care. Served with joy.', detail: 'FRESH PREP · HAPPY CUSTOMERS', footer: 'LET’S GET SOMETHING GOOD COOKING',
};

/** Mounted once above every auth/onboarding/app route. No navigation or permission changes. */
export function StartupSplash({ ready }: { ready: boolean }) {
  const reduced = useStartupReducedMotion();
  const { width, height } = useWindowDimensions();
  const [gone, setGone] = useState(false), [held, setHeld] = useState(false), [timedOut, setTimedOut] = useState(false);
  const [enter] = useState(() => new Animated.Value(0)), [exit] = useState(() => new Animated.Value(0)), [veil] = useState(() => new Animated.Value(1));
  const size = Math.max(180, Math.min(width - 32, height * 0.48, 360));
  useEffect(() => {
    const hold = setTimeout(() => setHeld(true), reduced ? timing.reducedMinimum : timing.minimum);
    if (reduced) { enter.setValue(1); return () => clearTimeout(hold); }
    const entrance = Animated.timing(enter, { toValue: 1, duration: timing.entrance, easing: motion.out, useNativeDriver: motion.native, isInteraction: false });
    entrance.start();
    return () => { clearTimeout(hold); entrance.stop(); };
  }, [enter, reduced]);
  useEffect(() => { const deadline = setTimeout(() => setTimedOut(true), timing.networkDeadline); return () => clearTimeout(deadline); }, []);
  const leave = held && (ready || timedOut);
  useEffect(() => {
    if (!leave) return;
    const fade = Animated.timing(veil, { toValue: 0, duration: reduced ? 150 : timing.fade, easing: motion.standard, useNativeDriver: motion.native });
    const finish = reduced ? fade : Animated.parallel([
      Animated.timing(exit, { toValue: 1, duration: timing.exit, easing: motion.in, useNativeDriver: motion.native }),
      Animated.sequence([Animated.delay(120), fade]),
    ]);
    finish.start(({ finished }) => { if (finished) setGone(true); });
    const fallback = setTimeout(() => setGone(true), timing.exit + timing.fade + 200);
    return () => { clearTimeout(fallback); finish.stop(); };
  }, [leave, reduced, exit, veil]);
  if (gone) return null;
  return <Animated.View style={[StyleSheet.absoluteFill, s.root, { opacity: veil }]} pointerEvents={leave ? 'none' : 'auto'}
    accessibilityRole="progressbar" accessibilityLabel={`${copy.label} is loading`} accessibilityState={{ busy: true }}>
    <View style={[s.glow, { width: width * 1.3, height: width * 1.3, borderRadius: width, top: -width * 0.94 }]} />
    <Animated.View style={[s.content, { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 14, 0] }) }] }]}>
      <View style={s.eyebrow}><View style={s.dot} /><Text style={s.eyebrowText}>{copy.eyebrow}</Text></View>
      <Animated.View style={{ transform: [{ translateX: exit.interpolate({ inputRange: [0, 1], outputRange: [0, !reduced && metadata.role === 'rider' ? 48 : 0] }) }] }}>
        <CharacterScene size={size} reduced={reduced} />
      </Animated.View>
      <Animated.View style={[s.brand, { opacity: exit.interpolate({ inputRange: [0, 0.7], outputRange: [1, 0], extrapolate: 'clamp' }) }]}>
        <Text style={[s.wordmark, { fontSize: height < 650 ? 34 : 40 }]} accessibilityRole="header">Fleet<Text style={s.wordmarkAccent}>24</Text></Text>
        <Text style={s.role}>{copy.role}</Text>
        <Text style={s.tagline}>{copy.tagline}</Text>
        <View style={s.detail}><View style={s.rule} /><Text style={s.detailText}>{copy.detail}</Text><View style={s.rule} /></View>
      </Animated.View>
    </Animated.View>
    <Text style={[s.footer, { bottom: Math.max(22, height * 0.055) }]}>{copy.footer}</Text>
  </Animated.View>;
}

const s = appStyles({
  root: { backgroundColor: '#F3F7EE', alignItems: 'center', justifyContent: 'center', zIndex: 100, elevation: 100, overflow: 'hidden' },
  glow: { position: 'absolute', alignSelf: 'center', backgroundColor: '#E9F0DC' },
  content: { width: '100%', alignItems: 'center', paddingBottom: 24 },
  eyebrow: { flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: '#E6EFD9', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 99, marginBottom: 8 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#24533F' },
  eyebrowText: { fontFamily: 'StartupBold', fontSize: 8, letterSpacing: 1.5, color: '#637A4E' },
  brand: { alignItems: 'center', marginTop: -8 },
  wordmark: { fontFamily: 'StartupBold', lineHeight: 48, letterSpacing: -1.2, color: '#24533F' },
  wordmarkAccent: { color: '#3F7D5C' },
  role: { fontFamily: 'StartupBold', fontSize: 8, letterSpacing: 2.5, color: '#71855B', marginTop: 2 },
  tagline: { fontFamily: 'StartupRegular', marginTop: 12, fontSize: 15, lineHeight: 23, color: '#698060', textAlign: 'center', paddingHorizontal: 16 },
  detail: { flexDirection: 'row', gap: 7, alignItems: 'center', marginTop: 22 },
  rule: { width: 15, height: 1, backgroundColor: '#CCDBBD' },
  detailText: { fontFamily: 'StartupRegular', fontSize: 7, lineHeight: 14, letterSpacing: 1.1, color: '#91A17F' },
  footer: { position: 'absolute', fontFamily: 'StartupRegular', fontSize: 8, letterSpacing: 1.7, color: '#A4B291', textAlign: 'center', paddingHorizontal: 16 },
});
