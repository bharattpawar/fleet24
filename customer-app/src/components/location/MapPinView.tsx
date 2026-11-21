import { appStyles } from '../../theme/appStyles';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import MapView, { Region } from 'react-native-maps';
import { MovingPin } from './MovingPin';

export interface MapPinViewProps {
  latitude: number;
  longitude: number;
  /** Bumped by the parent whenever it wants the map to jump to latitude/longitude (search result, GPS). */
  recenterKey: number;
  onMoveStart: () => void;
  onMoveEnd: (latitude: number, longitude: number) => void;
  style?: ViewStyle;
}

const DELTA = 0.004; // ~400 m across: street level

/** Native map (Apple Maps on iOS, Google Maps on Android) with a fixed centre pin. */
export function MapPinView({ latitude, longitude, recenterKey, onMoveStart, onMoveEnd, style }: MapPinViewProps) {
  const mapRef = useRef<MapView>(null);
  const [lift] = useState(() => new Animated.Value(0));
  const programmatic = useRef(false);

  useEffect(() => {
    programmatic.current = true;
    mapRef.current?.animateToRegion(
      { latitude, longitude, latitudeDelta: DELTA, longitudeDelta: DELTA },
      350,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);

  const setLifted = (up: boolean) =>
    Animated.spring(lift, { toValue: up ? 1 : 0, useNativeDriver: true, damping: 14, stiffness: 220 }).start();

  return (
    <View style={[styles.wrap, style]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude, longitude, latitudeDelta: DELTA, longitudeDelta: DELTA }}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onPanDrag={() => {
          if (!programmatic.current) {
            setLifted(true);
            onMoveStart();
          }
        }}
        onRegionChangeComplete={(region: Region) => {
          programmatic.current = false;
          setLifted(false);
          onMoveEnd(region.latitude, region.longitude);
        }}
        accessibilityLabel="Map. Drag to place the pin on your exact delivery spot."
      />
      <MovingPin lift={lift} />
    </View>
  );
}

const styles = appStyles({
  wrap: { overflow: 'hidden', backgroundColor: '#E3EADF' },
});
