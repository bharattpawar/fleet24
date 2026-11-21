import { appStyles } from '../../theme/appStyles';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { MovingPin } from './MovingPin';
import type { MapPinViewProps } from './MapPinView';
import { colors } from '../../theme/tokens';
import { GOOGLE_MAPS_BROWSER_KEY as BROWSER_KEY, loadGoogleMaps } from '../../utils/googleMapsWeb';

/** Web map (Google Maps JavaScript API) with the same fixed centre pin as native. */
export function MapPinView({ latitude, longitude, recenterKey, onMoveStart, onMoveEnd, style }: MapPinViewProps) {
  const hostRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const [lift] = useState(() => new Animated.Value(0));
  const [failed, setFailed] = useState(!BROWSER_KEY);
  const callbacks = useRef({ onMoveStart, onMoveEnd });
  useEffect(() => {
    callbacks.current = { onMoveStart, onMoveEnd };
  }, [onMoveStart, onMoveEnd]);

  const setLifted = (up: boolean) =>
    Animated.spring(lift, { toValue: up ? 1 : 0, useNativeDriver: false, damping: 14, stiffness: 220 }).start();

  useEffect(() => {
    if (!BROWSER_KEY) return;
    let cancelled = false;
    loadGoogleMaps(BROWSER_KEY)
      .then((maps) => {
        if (cancelled || !hostRef.current) return;
        const map = new maps.Map(hostRef.current as unknown as HTMLElement, {
          center: { lat: latitude, lng: longitude },
          zoom: 17,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          clickableIcons: false,
        });
        map.addListener('dragstart', () => {
          setLifted(true);
          callbacks.current.onMoveStart();
        });
        map.addListener('idle', () => {
          setLifted(false);
          const c = map.getCenter();
          if (c) callbacks.current.onMoveEnd(c.lat(), c.lng());
        });
        mapRef.current = map;
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mapRef.current?.panTo({ lat: latitude, lng: longitude });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);

  if (failed) {
    return (
      <View style={[styles.wrap, styles.fallback, style]}>
        <Text style={styles.fallbackTitle}>Map preview unavailable</Text>
        <Text style={styles.fallbackText}>
          Use search or your current location. Location: {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      <View ref={hostRef} style={StyleSheet.absoluteFill} accessibilityLabel="Map. Drag to place the pin on your exact delivery spot." />
      <MovingPin lift={lift} />
    </View>
  );
}

const styles = appStyles({
  wrap: { overflow: 'hidden', backgroundColor: '#E3EADF' },
  fallback: { alignItems: 'center', justifyContent: 'center', padding: 20, gap: 6 },
  fallbackTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  fallbackText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
});
