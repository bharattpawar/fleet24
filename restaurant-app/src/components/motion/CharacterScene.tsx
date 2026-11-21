import React, { useEffect, useState } from 'react';
import { Animated, AppState, Easing, Image, StyleSheet, View } from 'react-native';
import metadata from '../../../assets/illustrations/startup/character-cycle.json';
import { characterFrameTrack } from '../../utils/startupCycle';
import { startupMotion } from './useStartupMotion';

const POSTER = require('../../../assets/illustrations/startup/character-poster.webp');
const CYCLE = require('../../../assets/illustrations/startup/character-cycle.webp');

/** Local 3D poses play using native transforms; React does not rerender on every frame. */
export function CharacterScene({ size, reduced }: { size: number; reduced: boolean }) {
  const [clock] = useState(() => new Animated.Value(0));
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    clock.setValue(0);
    if (reduced || !loaded || failed || !active) return;
    const animation = Animated.loop(Animated.timing(clock, { toValue: 1, duration: metadata.durationMs, easing: Easing.linear, useNativeDriver: startupMotion.native, isInteraction: false }));
    animation.start();
    return () => animation.stop();
  }, [clock, reduced, loaded, failed, active]);
  const running = loaded && !failed && !reduced && active;
  const isRider = metadata.role === 'rider';
  const roadX = running ? clock.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 1.44] }) : 0;
  const backdropX = running ? clock.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.6] }) : 0;
  const stripe = size * 0.18;
  return <View style={{ width: size, height: size * 0.98 }} pointerEvents="none" accessible={false} testID="startup-character-scene">
    <View style={[s.halo, { width: size * 0.78, height: size * 0.78, borderRadius: size, left: size * 0.11, top: size * 0.03 }]} />
    <View style={[s.orbit, { width: size * 0.89, height: size * 0.89, borderRadius: size, left: size * 0.055, top: -size * 0.025 }]} />
    {isRider ? <>
      <View style={[s.backdropClip, { width: size, height: size * 0.34, top: size * 0.3 }]}>
        <Animated.View style={{ width: size * 1.8, height: '100%', flexDirection: 'row', transform: [{ translateX: backdropX }] }}>
          {[0, 1, 2].map(tile => <View key={tile} style={{ width: size * 0.6, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around' }}>
            {[0.13, 0.23, 0.18, 0.28].map((height, i) => <View key={i} style={[s.building, { width: size * 0.095, height: size * height }]}><View style={s.window} /><View style={s.window} /></View>)}
          </View>)}
        </Animated.View>
      </View>
      <View style={[s.road, { width: size * 1.1, height: size * 0.26, top: size * 0.73, left: -size * 0.05, transform: [{ perspective: 700 }, { rotateX: '54deg' }, { rotateZ: '8deg' }] }]}>
        <View style={s.roadSide} /><View style={s.roadSurface}>
          <Animated.View style={{ position: 'absolute', left: 0, top: '52%', width: stripe * 18, flexDirection: 'row', transform: [{ translateX: roadX }] }}>
            {Array.from({ length: 18 }, (_, i) => <View key={i} style={{ width: stripe, height: 4, paddingRight: stripe * 0.58 }}><View style={s.roadMark} /></View>)}
          </Animated.View>
        </View>
      </View>
    </> : <>
      <View style={[s.kitchenWall, { width: size * 0.74, height: size * 0.45, top: size * 0.22, left: size * 0.13 }]}>
        {[0, 1, 2, 3].map(i => <View key={i} style={[s.jar, { left: size * (0.08 + i * 0.15), top: size * 0.06, height: size * (i % 2 ? 0.09 : 0.12), width: size * 0.055 }]}><View style={s.jarLid} /></View>)}
        <View style={[s.shelf, { top: size * 0.18 }]} />
      </View>
      <View style={[s.kitchenFloor, { width: size * 1.02, height: size * 0.18, top: size * 0.79, left: -size * 0.01, transform: [{ perspective: 700 }, { rotateX: '57deg' }, { rotateZ: '4deg' }] }]} />
    </>}
    <View style={{ position: 'absolute', width: size, height: size, top: -size * 0.025, overflow: 'hidden' }}>
      {!running && <Image source={POSTER} style={{ width: size, height: size }} resizeMode="contain" fadeDuration={0} accessible={false} />}
      {!reduced && !failed && <Animated.Image source={CYCLE} accessible={false} fadeDuration={0} resizeMode="stretch" onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
        style={{ position: 'absolute', left: 0, top: 0, width: size * metadata.columns, height: size * metadata.rows, opacity: running ? 1 : 0,
          transform: [{ translateX: clock.interpolate(characterFrameTrack(metadata, 'x', size)) }, { translateY: clock.interpolate(characterFrameTrack(metadata, 'y', size)) }] }} />}
    </View>
  </View>;
}

const s = StyleSheet.create({
  halo: { position: 'absolute', backgroundColor: '#E5EECF' },
  orbit: { position: 'absolute', borderWidth: 1, borderColor: '#DFE9CE' },
  backdropClip: { position: 'absolute', overflow: 'hidden', opacity: 0.75, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  building: { borderTopLeftRadius: 9, borderTopRightRadius: 9, backgroundColor: '#DEE8D3', paddingTop: 12, gap: 8, alignItems: 'center' },
  window: { width: 8, height: 8, backgroundColor: '#F1F6E6', borderRadius: 2 },
  road: { position: 'absolute', borderRadius: 22, backgroundColor: '#CEDBBB', boxShadow: '0px 12px 22px rgba(46,74,29,0.08)' },
  roadSide: { position: 'absolute', top: 6, left: 0, right: 0, bottom: -6, borderRadius: 22, backgroundColor: '#D2DEBC' },
  roadSurface: { width: '100%', height: '100%', backgroundColor: '#FAFCF4', borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#E1E9D5' },
  roadMark: { flex: 1, backgroundColor: '#DCE6CC', borderRadius: 4 },
  kitchenWall: { position: 'absolute', borderRadius: 24, backgroundColor: '#E9EFDB', opacity: 0.75 },
  shelf: { position: 'absolute', left: 10, right: 10, height: 4, backgroundColor: '#D3E0BE', borderRadius: 3 },
  jar: { position: 'absolute', backgroundColor: '#D8E3C4', borderRadius: 5 },
  jarLid: { position: 'absolute', top: -3, left: -1, right: -1, height: 5, borderRadius: 2, backgroundColor: '#BFCFA7' },
  kitchenFloor: { position: 'absolute', borderRadius: 22, backgroundColor: '#FAFCF3', borderWidth: 1, borderColor: '#D8E4C6', boxShadow: '0px 8px 18px rgba(46,74,29,0.06)' },
});
