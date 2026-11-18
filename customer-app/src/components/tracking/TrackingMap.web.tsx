import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/tokens';
import { GOOGLE_MAPS_BROWSER_KEY, loadGoogleMaps } from '../../utils/googleMapsWeb';
import { isAfterPickup, pointsToFit, trackingStatusLabel, type MapPoint } from '../../utils/trackingMap';
import type { TrackingMapProps } from './TrackingMap';

export const TRACKING_MAP_HEIGHT = 280;

const toLatLng = (p: MapPoint) => ({ lat: p.latitude, lng: p.longitude });

/** Web tracking map (Google Maps JavaScript API). Shows a plain card when the browser key is missing. */
export function TrackingMap({
  restaurant,
  dropoff,
  rider,
  restaurantName,
  deliveryStatus,
  isStaleLocation,
}: TrackingMapProps) {
  const hostRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const markers = useRef<{ restaurant?: any; dropoff?: any; rider?: any }>({});
  const [failed, setFailed] = useState(!GOOGLE_MAPS_BROWSER_KEY);
  const [ready, setReady] = useState(false);
  const fitPoints = useMemo(
    () => pointsToFit({ restaurant, dropoff, rider }, deliveryStatus),
    [restaurant, dropoff, rider, deliveryStatus],
  );

  const fit = () => {
    const maps = window.google?.maps;
    if (!maps || !mapRef.current || fitPoints.length === 0) return;
    if (fitPoints.length === 1) {
      mapRef.current.setCenter(toLatLng(fitPoints[0]));
      mapRef.current.setZoom(15);
      return;
    }
    const bounds = new maps.LatLngBounds();
    fitPoints.forEach((p) => bounds.extend(toLatLng(p)));
    mapRef.current.fitBounds(bounds, 50);
  };

  useEffect(() => {
    if (!GOOGLE_MAPS_BROWSER_KEY || fitPoints.length === 0) return;
    let cancelled = false;
    loadGoogleMaps(GOOGLE_MAPS_BROWSER_KEY)
      .then((maps) => {
        if (cancelled || !hostRef.current) return;
        mapRef.current = new maps.Map(hostRef.current as unknown as HTMLElement, {
          center: toLatLng(fitPoints[0]),
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'cooperative',
          clickableIcons: false,
        });
        setReady(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitPoints.length > 0]);

  // Keep the three markers in sync with the latest points.
  useEffect(() => {
    const maps = window.google?.maps;
    if (!ready || !maps || !mapRef.current) return;
    const sync = (key: 'restaurant' | 'dropoff' | 'rider', point: MapPoint | null, options: Record<string, unknown>) => {
      const existing = markers.current[key];
      if (!point) {
        existing?.setMap(null);
        markers.current[key] = undefined;
        return;
      }
      if (existing) {
        existing.setPosition(toLatLng(point));
        existing.setOptions(options);
      } else {
        markers.current[key] = new maps.Marker({ map: mapRef.current, position: toLatLng(point), ...options });
      }
    };
    sync('restaurant', restaurant, { title: restaurantName, label: { text: 'R', color: '#FFFFFF', fontWeight: '700' } });
    sync('dropoff', dropoff, { title: 'Your delivery location', label: { text: 'You', color: '#FFFFFF', fontWeight: '700', fontSize: '10px' } });
    sync('rider', rider, {
      title: 'Your rider',
      zIndex: 10,
      icon: {
        path: maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: isStaleLocation ? colors.accent : colors.primary,
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 3,
      },
    });
  }, [ready, restaurant, dropoff, rider, restaurantName, isStaleLocation]);

  // Re-frame on pickup or when the rider first appears, not on every GPS tick.
  const phase = isAfterPickup(deliveryStatus);
  const hasRider = !!rider;
  useEffect(() => {
    if (ready) fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, phase, hasRider]);

  if (fitPoints.length === 0 || failed) {
    return (
      <View style={[styles.wrap, styles.empty]}>
        <Ionicons name="map-outline" size={28} color={colors.textMuted} />
        <Text style={styles.emptyText}>
          {fitPoints.length === 0
            ? 'Map will appear once the order has a location.'
            : `Map unavailable here. ${trackingStatusLabel(!!rider, isStaleLocation)}.`}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View ref={hostRef} style={StyleSheet.absoluteFill} accessibilityLabel="Map showing the restaurant, your delivery location and the rider" />

      <View style={styles.statusPill} pointerEvents="none">
        <View style={[styles.statusDot, { backgroundColor: !rider || isStaleLocation ? colors.accent : '#2ECC71' }]} />
        <Text style={styles.statusText}>{trackingStatusLabel(!!rider, isStaleLocation)}</Text>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Recenter map"
        style={styles.recenterBtn}
        onPress={fit}
        activeOpacity={0.85}
      >
        <Ionicons name="locate" size={18} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: TRACKING_MAP_HEIGHT,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#E3EADF',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 20,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statusPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  recenterBtn: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
