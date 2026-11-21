import { appStyles } from '../../theme/appStyles';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/tokens';
import {
  isAfterPickup,
  pointsToFit,
  regionForPoints,
  trackingStatusLabel,
  type MapPoint,
} from '../../utils/trackingMap';

export interface TrackingMapProps {
  restaurant: MapPoint | null;
  dropoff: MapPoint | null;
  rider: MapPoint | null;
  restaurantName: string;
  deliveryStatus: string;
  isStaleLocation: boolean;
}

export const TRACKING_MAP_HEIGHT = 280;
const EDGE_PADDING = { top: 70, right: 50, bottom: 50, left: 50 };

/**
 * Live tracking map: restaurant pin, drop-off pin and the rider's real GPS position.
 * Google Maps on Android (needs the Maps SDK key in the build), Apple Maps on iOS.
 */
export function TrackingMap({
  restaurant,
  dropoff,
  rider,
  restaurantName,
  deliveryStatus,
  isStaleLocation,
}: TrackingMapProps) {
  const mapRef = useRef<MapView>(null);
  const isReady = useRef(false);
  const fitPoints = useMemo(
    () => pointsToFit({ restaurant, dropoff, rider }, deliveryStatus),
    [restaurant, dropoff, rider, deliveryStatus],
  );
  // MapView only reads initialRegion on mount; later framing goes through fit().
  const initialRegion = useMemo(() => regionForPoints(fitPoints), [fitPoints]);

  const fit = (animated: boolean) => {
    if (!mapRef.current || fitPoints.length === 0) return;
    if (fitPoints.length === 1) {
      const region = regionForPoints(fitPoints);
      if (region) mapRef.current.animateToRegion(region, animated ? 400 : 0);
      return;
    }
    mapRef.current.fitToCoordinates(fitPoints, { edgePadding: EDGE_PADDING, animated });
  };

  // Re-frame when the phase changes (pickup) or the rider first appears; not on every GPS tick,
  // so the customer can pan without the map snapping back.
  const phase = isAfterPickup(deliveryStatus);
  const hasRider = !!rider;
  useEffect(() => {
    if (isReady.current) fit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, hasRider]);

  if (!initialRegion) {
    return (
      <View style={[styles.wrap, styles.empty]}>
        <Ionicons name="map-outline" size={28} color={colors.textMuted} />
        <Text style={styles.emptyText}>Map will appear once the order has a location.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onMapReady={() => {
          isReady.current = true;
          fit(false);
        }}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        accessibilityLabel="Map showing the restaurant, your delivery location and the rider"
      >
        {restaurant && (
          <Marker
            identifier="restaurant"
            coordinate={restaurant}
            title={restaurantName}
            description="Pickup"
            pinColor="orange"
          />
        )}
        {dropoff && (
          <Marker identifier="dropoff" coordinate={dropoff} title="Your delivery location" pinColor="green" />
        )}
        {rider && (
          // Remount when the colour changes so Android redraws the marker snapshot.
          <RiderMarker key={isStaleLocation ? 'stale' : 'live'} coordinate={rider} isStale={isStaleLocation} />
        )}
      </MapView>

      <View style={styles.statusPill} pointerEvents="none">
        <View style={[styles.statusDot, { backgroundColor: !rider || isStaleLocation ? colors.accent : '#2ECC71' }]} />
        <Text style={styles.statusText}>{trackingStatusLabel(!!rider, isStaleLocation)}</Text>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Recenter map"
        style={styles.recenterBtn}
        onPress={() => fit(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="locate" size={18} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

/**
 * Android draws custom markers as a snapshot: track view changes briefly so the icon renders,
 * then stop so the map stays smooth.
 */
function RiderMarker({ coordinate, isStale }: { coordinate: MapPoint; isStale: boolean }) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setTracksViewChanges(false), 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Marker
      identifier="rider"
      coordinate={coordinate}
      title="Your rider"
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
    >
      <View style={[styles.riderDot, isStale && styles.riderDotStale]}>
        <Ionicons name="bicycle" size={16} color="#FFFFFF" />
      </View>
    </Marker>
  );
}

const styles = appStyles({
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
  riderDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderDotStale: {
    backgroundColor: colors.accent,
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
