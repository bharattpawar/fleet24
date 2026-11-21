import React, { useEffect, useState } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import { motion } from '../../theme/motion';
import { appStyles } from '../../theme/appStyles';
import { riderCycle, riderFrameTrack } from './riderFrames';

const POSTER = require('../../../assets/illustrations/rider/rider-poster.webp');
const CYCLE = require('../../../assets/illustrations/rider/rider-cycle.webp');

/** Every rendered pose has new leg, pedal and wheel positions, rather than moving a still image. */
export function RidingScene({ size, reduced }: { size: number; reduced: boolean }) {
  const [clock] = useState(() => new Animated.Value(0));
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    clock.setValue(0);
    if (reduced || !loaded || failed) return;
    const ride = Animated.loop(Animated.timing(clock, {
      toValue: 1, duration: riderCycle.durationMs, easing: Easing.linear,
      useNativeDriver: motion.native, isInteraction: false,
    }));
    ride.start();
    return () => ride.stop();
  }, [clock, loaded, failed, reduced]);
  const running = loaded && !failed && !reduced;
  const travel = size * 1.44;
  const scenePhase = running ? clock : 0;
  const roadX = typeof scenePhase === 'number' ? 0 : scenePhase.interpolate({ inputRange: [0, 1], outputRange: [0, -travel] });
  const backdropX = typeof scenePhase === 'number' ? 0 : scenePhase.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.6] });
  const stripe = size * 0.18;
  return <View style={{ width: size, height: size * 0.98 }} pointerEvents="none" accessible={false} testID="riding-scene">
    <View style={[s.halo, { width: size * 0.76, height: size * 0.76, borderRadius: size, left: size * 0.12, top: size * 0.02 }]} />
    <View style={[s.orbit, { width: size * 0.87, height: size * 0.87, borderRadius: size, left: size * 0.065, top: -size * 0.035 }]} />
    <View style={[s.skylineClip, { width: size, height: size * 0.36, top: size * 0.28 }]}>
      <Animated.View style={{ flexDirection: 'row', alignItems: 'flex-end', width: size * 1.8, height: '100%', transform: [{ translateX: backdropX }] }}>
        {[0, 1, 2].map(tile => <View key={tile} style={{ width: size * 0.6, height: '100%', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around' }}>
          {[0.13, 0.24, 0.17, 0.29].map((height, i) => <View key={i} style={[s.building, { width: size * 0.095, height: size * height, backgroundColor: i % 2 ? '#DEE8D4' : '#E1EBCF' }]}><View style={s.window} /><View style={s.window} /></View>)}
        </View>)}
      </Animated.View>
    </View>
    <View style={[s.roadBase, { width: size * 1.12, height: size * 0.28, top: size * 0.7, left: -size * 0.06, transform: [{ perspective: 700 }, { rotateX: '54deg' }, { rotateZ: '8deg' }] }]}>
      <View style={s.roadEdge} />
      <View style={s.roadSurface}>
        <Animated.View style={{ position: 'absolute', left: 0, top: '52%', width: stripe * 18, flexDirection: 'row', transform: [{ translateX: roadX }] }}>
          {Array.from({ length: 18 }, (_, i) => <View key={i} style={{ width: stripe, height: 4, paddingRight: stripe * 0.58 }}><View style={s.roadMark} /></View>)}
        </Animated.View>
      </View>
    </View>
    <View style={{ position: 'absolute', width: size, height: size, top: -size * 0.04, overflow: 'hidden' }}>
      {(!running || reduced) && <Image source={POSTER} style={{ width: size, height: size }} resizeMode="contain" accessible={false} fadeDuration={0} />}
      {!reduced && !failed && <Animated.Image source={CYCLE} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} accessible={false} fadeDuration={0} resizeMode="stretch"
        style={{ position: 'absolute', left: 0, top: 0, width: size * riderCycle.columns, height: size * riderCycle.rows, opacity: running ? 1 : 0,
          transform: [{ translateX: clock.interpolate(riderFrameTrack('x', size)) }, { translateY: clock.interpolate(riderFrameTrack('y', size)) }] }} />}
    </View>
    <View style={[s.leaf, { width: size * 0.075, height: size * 0.035, left: size * 0.09, top: size * 0.86 }]} />
    <View style={[s.leaf, { width: size * 0.045, height: size * 0.025, right: size * 0.045, top: size * 0.76, backgroundColor: '#A9BE76', transform: [{ rotate: '25deg' }] }]} />
  </View>;
}

const s = appStyles({
  halo: { position: 'absolute', backgroundColor: '#E5EECF' },
  orbit: { position: 'absolute', borderWidth: 1, borderColor: '#E1EACF' },
  skylineClip: { position: 'absolute', overflow: 'hidden', opacity: 0.75, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  building: { borderTopLeftRadius: 9, borderTopRightRadius: 9, paddingTop: 13, alignItems: 'center', gap: 8 },
  window: { width: 8, height: 8, borderRadius: 2, backgroundColor: '#F1F5E7' },
  roadBase: { position: 'absolute', borderRadius: 22, backgroundColor: '#CCD8BA', boxShadow: '0px 12px 22px rgba(46,74,29,0.08)' },
  roadEdge: { position: 'absolute', top: 6, left: 0, right: 0, bottom: -6, borderRadius: 22, backgroundColor: '#D2DEBC' },
  roadSurface: { width: '100%', height: '100%', backgroundColor: '#FAFCF4', borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#E1E9D5' },
  roadMark: { flex: 1, backgroundColor: '#DCE6CC', borderRadius: 4 },
  leaf: { position: 'absolute', backgroundColor: '#B7CC8C', borderTopLeftRadius: 18, borderBottomRightRadius: 18, transform: [{ rotate: '-20deg' }] },
});
