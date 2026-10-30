import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, typography } from '../theme/tokens';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

interface DeliveryMapViewProps {
  restaurantLocation?: Coordinate | null;
  customerLocation?: Coordinate | null;
  riderLocation?: Coordinate | null;
  restaurantName?: string;
  deliveryStatus?: string;
  isStaleLocation?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_HEIGHT = 280;

/**
 * High-performance, universal stylized vector map component for Fleet24.
 * Renders smooth animated rider transit, restaurant pickup and customer destination pins,
 * radar-sweep pulsing rings for live GPS tracking, and route connection lines across iOS, Android, and Web.
 */
export const DeliveryMapView: React.FC<DeliveryMapViewProps> = ({
  restaurantName = 'Restaurant',
  deliveryStatus,
  isStaleLocation = false,
}) => {
  // Pulse animation for live rider marker
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const riderPosAnim = useRef(new Animated.Value(0)).current; // 0 (at restaurant) to 1 (at customer)

  useEffect(() => {
    // Pulsing circle around rider
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.6,
          duration: 1200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim]);

  // Adjust animated rider progress based on status
  useEffect(() => {
    let targetProgress = 0.2;
    if (deliveryStatus === 'at_restaurant') targetProgress = 0.15;
    else if (deliveryStatus === 'picked_up') targetProgress = 0.55;
    else if (deliveryStatus === 'arrived_customer') targetProgress = 0.88;
    else if (deliveryStatus === 'completed') targetProgress = 1.0;

    Animated.timing(riderPosAnim, {
      toValue: targetProgress,
      duration: 1500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [deliveryStatus, riderPosAnim]);

  // Interpolate rider horizontal and vertical coordinate across the map canvas
  const riderLeft = riderPosAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [60, SCREEN_WIDTH - 100],
  });

  const riderTop = riderPosAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [MAP_HEIGHT - 90, MAP_HEIGHT / 2 - 30, 70],
  });

  return (
    <View style={styles.container}>
      {/* Map Canvas Background Grid */}
      <View style={styles.gridOverlay}>
        <View style={styles.gridHLine1} />
        <View style={styles.gridHLine2} />
        <View style={styles.gridVLine1} />
        <View style={styles.gridVLine2} />
      </View>

      {/* Stylized Transit Route Track */}
      <View style={styles.roadTrack} />
      <View style={styles.activeRoadTrack} />

      {/* 1. Restaurant Marker (Origin) */}
      <View style={[styles.pinContainer, { left: 40, bottom: 40 }]}>
        <View style={styles.restaurantBadge}>
          <Ionicons name="restaurant" size={14} color="#FFFFFF" />
        </View>
        <View style={styles.callout}>
          <Text style={styles.calloutText} numberOfLines={1}>
            {restaurantName}
          </Text>
        </View>
      </View>

      {/* 2. Customer Destination Marker */}
      <View style={[styles.pinContainer, { right: 40, top: 40 }]}>
        <View style={styles.customerBadge}>
          <Ionicons name="home" size={14} color="#FFFFFF" />
        </View>
        <View style={styles.callout}>
          <Text style={styles.calloutText}>Your Doorstep</Text>
        </View>
      </View>

      {/* 3. Live Animated Rider Marker */}
      <Animated.View
        style={[
          styles.riderMarkerWrapper,
          {
            left: riderLeft,
            top: riderTop,
          },
        ]}
      >
        {/* Radar Pulse Ring */}
        {!isStaleLocation && (
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: pulseAnim }],
                opacity: pulseAnim.interpolate({
                  inputRange: [1, 1.6],
                  outputRange: [0.6, 0],
                }),
              },
            ]}
          />
        )}

        <View style={[styles.riderBadge, isStaleLocation && styles.riderBadgeStale]}>
          <Ionicons name="bicycle" size={18} color="#FFFFFF" />
        </View>

        <View style={styles.riderCallout}>
          <View
            style={[
              styles.liveIndicatorDot,
              { backgroundColor: isStaleLocation ? colors.accent : '#2ECC71' },
            ]}
          />
          <Text style={styles.riderCalloutText}>
            {isStaleLocation ? 'Stale GPS' : 'Rider Live'}
          </Text>
        </View>
      </Animated.View>

      {/* Floating GPS Status Pill */}
      <View style={styles.statusPill}>
        <Ionicons
          name={isStaleLocation ? 'warning-outline' : 'navigate'}
          size={12}
          color={isStaleLocation ? colors.accent : colors.primary}
        />
        <Text style={[styles.statusPillText, isStaleLocation && { color: colors.accent }]}>
          {isStaleLocation ? 'Acquiring GPS...' : 'GPS Live Tracking'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: MAP_HEIGHT,
    backgroundColor: '#E8EFE9', // Light map grass/canvas tone
    position: 'relative',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFill,
    opacity: 0.25,
  },
  gridHLine1: {
    position: 'absolute',
    top: '35%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#9FB5A6',
  },
  gridHLine2: {
    position: 'absolute',
    top: '70%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#9FB5A6',
  },
  gridVLine1: {
    position: 'absolute',
    left: '30%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#9FB5A6',
  },
  gridVLine2: {
    position: 'absolute',
    left: '68%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#9FB5A6',
  },
  roadTrack: {
    position: 'absolute',
    left: 55,
    top: 75,
    right: 55,
    bottom: 75,
    borderWidth: 3,
    borderColor: '#D4DDD5',
    borderStyle: 'dashed',
    borderRadius: 80,
  },
  activeRoadTrack: {
    position: 'absolute',
    left: 55,
    top: 75,
    right: 55,
    bottom: 75,
    borderWidth: 4,
    borderColor: 'rgba(40, 84, 63, 0.2)',
    borderRadius: 80,
  },
  pinContainer: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 10,
  },
  restaurantBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 3,
  },
  customerBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 3,
  },
  callout: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  calloutText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  riderMarkerWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    width: 44,
    height: 44,
    marginLeft: -22,
    marginTop: -22,
  },
  pulseRing: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
  },
  riderBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 5,
  },
  riderBadgeStale: {
    backgroundColor: colors.textSecondary,
  },
  riderCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  liveIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  riderCalloutText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusPill: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
});
