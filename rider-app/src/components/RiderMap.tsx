import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/tokens';
import { RiderLocationUpdate } from '../api/riderApi';
import { GpsStatus } from '../services/locationService';
import { appStyles } from '../theme/appStyles';

interface RiderMapProps {
  riderLocation?: RiderLocationUpdate | null;
  outletLocation?: { latitude: number; longitude: number; name?: string } | null;
  customerLocation?: { latitude?: number; longitude?: number; address?: string; addressLine1?: string; street?: string } | null;
  deliveryStatus?: string;
  isOnline: boolean;
  isMockMode?: boolean;
  gpsStatus?: GpsStatus;
  onRequestPermission?: () => void;
  onRecenter?: () => void;
  onExpand?: () => void;
  isExpanded?: boolean;
  onCloseExpanded?: () => void;
  height?: number;
}

export const RiderMap: React.FC<RiderMapProps> = ({
  riderLocation,
  outletLocation,
  customerLocation,
  deliveryStatus,
  isOnline,
  isMockMode = false,
  gpsStatus = 'initializing',
  onRequestPermission,
  onRecenter,
  onExpand,
  isExpanded = false,
  onCloseExpanded,
  height = 300,
}) => {
  // Pulse animation for live rider marker
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const radarAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.5,
          duration: 1500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    const radarLoop = Animated.loop(
      Animated.timing(radarAnim, {
        toValue: 1,
        duration: 3500,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    pulseLoop.start();
    if (isOnline) {
      radarLoop.start();
    }

    return () => {
      pulseLoop.stop();
      radarLoop.stop();
    };
  }, [isOnline]);

  const radarRotate = radarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const hasCoordinates = Number.isFinite(riderLocation?.latitude) && Number.isFinite(riderLocation?.longitude);
  const gpsActive = !isMockMode && hasCoordinates && gpsStatus === 'active';
  const permissionRequired = gpsStatus === 'permission_denied' || gpsStatus === 'services_disabled';
  const gpsLabels: Record<GpsStatus, string> = {
    initializing: 'Finding location',
    requesting_permission: 'Checking permission',
    permission_denied: 'Location permission required',
    services_disabled: 'Location services off',
    acquiring: 'Finding location',
    active: hasCoordinates ? 'GPS active' : 'Finding location',
    stale: 'GPS signal stale',
    error: 'GPS unavailable',
  };
  const gpsBadgeLabel = isMockMode ? 'Simulated location' : gpsLabels[gpsStatus];
  const gpsDotColor = gpsActive ? colors.online : permissionRequired || gpsStatus === 'error' ? colors.error : colors.warning;

  return (
    <View style={[styles.container, isExpanded ? styles.containerExpanded : { height }]}>
      {/* Stylized Canvas Grid & Road Layout */}
      <View style={styles.gridOverlay}>
        <View style={styles.horizontalRoad1} />
        <View style={styles.horizontalRoad2} />
        <View style={styles.verticalRoad1} />
        <View style={styles.verticalRoad2} />
        <View style={styles.diagonalAvenue} />
        <View style={styles.waterFeature} />
        <View style={styles.parkFeature} />
      </View>

      {/* Radar scanning circle when online and coordinates active */}
      {isOnline && gpsActive && (
        <Animated.View
          style={[
            styles.radarBeam,
            {
              transform: [{ rotate: radarRotate }],
            },
          ]}
        />
      )}

      {/* Center GPS Marker (Rider's Real Position Pin) */}
      <View style={styles.centerMarkerWrapper}>
        <Animated.View
          style={[
            styles.pulsingRing,
            {
              transform: [{ scale: pulseAnim }],
              backgroundColor:
                isOnline && gpsActive ? colors.onlineGlow : 'rgba(138, 146, 140, 0.25)',
            },
          ]}
        />
        <View
          style={[
            styles.riderPin,
            {
              backgroundColor: !hasCoordinates
                ? colors.offline
                : isOnline
                ? colors.primaryDark
                : colors.offline,
            },
          ]}
        >
          <Ionicons
            name={hasCoordinates ? 'bicycle' : 'location-outline'}
            size={isExpanded ? 24 : 20}
            color={colors.textWhite}
          />
        </View>
      </View>

      {/* Outlet Marker (if delivery in progress) */}
      {outletLocation && (
        <View style={styles.outletPinWrapper}>
          <View style={styles.outletPin}>
            <Ionicons name="restaurant" size={16} color={colors.textWhite} />
          </View>
          <View style={styles.pinLabel}>
            <Text style={styles.pinLabelText} numberOfLines={1}>
              {outletLocation.name || 'Pickup'}
            </Text>
          </View>
        </View>
      )}

      {/* Customer Marker (if delivery in progress) */}
      {customerLocation && (
        <View style={styles.customerPinWrapper}>
          <View style={styles.customerPin}>
            <Ionicons name="location" size={16} color={colors.textWhite} />
          </View>
          <View style={styles.pinLabel}>
            <Text style={styles.pinLabelText} numberOfLines={1}>
              Dropoff
            </Text>
          </View>
        </View>
      )}

      {/* Route Line Simulator when Active Delivery */}
      {outletLocation && customerLocation && (
        <View style={styles.routePathContainer}>
          <View style={styles.routeSegment} />
        </View>
      )}

      {/* Top Map Control: Live GPS Status Badge */}
      <View style={[styles.gpsBadge, isExpanded ? styles.gpsBadgeExpanded : null]}>
        <View style={[styles.gpsDot, { backgroundColor: gpsDotColor }]} />
        <Text style={styles.gpsText} numberOfLines={1}>
          {gpsBadgeLabel}
        </Text>
      </View>

      {/* Top Right: Expand / Close Map Button */}
      {isExpanded ? (
        <TouchableOpacity
          accessibilityLabel="Close map"
          style={styles.closeExpandedButton}
          activeOpacity={0.8}
          onPress={onCloseExpanded}
        >
          <Ionicons name="close" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      ) : onExpand ? (
        <TouchableOpacity
          accessibilityLabel="Expand map"
          style={styles.expandButton}
          activeOpacity={0.8}
          onPress={onExpand}
        >
          <Ionicons name="expand-outline" size={18} color={colors.primaryDark} />
        </TouchableOpacity>
      ) : null}

      {/* Bottom Sector / Region Badge */}
      <View style={[styles.sectorBadge, isExpanded ? styles.sectorBadgeExpanded : null]}>
        <Ionicons name="navigate-circle" size={14} color={isMockMode ? colors.warning : colors.primary} />
        <Text style={styles.sectorText}>
          Schematic map preview
        </Text>
      </View>

      {/* Bottom Right: Recenter Button */}
      {onRecenter && (
        <TouchableOpacity
          accessibilityLabel="Refresh rider location"
          style={[styles.recenterButton, isExpanded ? styles.recenterButtonExpanded : null]}
          activeOpacity={0.8}
          onPress={onRecenter}
        >
          <Ionicons
            name={hasCoordinates ? 'locate' : 'refresh'}
            size={22}
            color={colors.primaryDark}
          />
        </TouchableOpacity>
      )}

      {/* Permission Denied / Service Disabled Overlay Warning */}
      {permissionRequired && onRequestPermission && (
        <View style={styles.permissionWarningOverlay}>
          <TouchableOpacity style={styles.enableButton} onPress={onRequestPermission}>
            <Text style={styles.enableButtonText}>Location settings</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = appStyles({
  container: {
    width: '100%',
    backgroundColor: '#EBE9DF',
    position: 'relative',
    overflow: 'hidden',
  },
  containerExpanded: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFill,
  },
  horizontalRoad1: {
    position: 'absolute',
    top: '32%',
    left: 0,
    right: 0,
    height: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#DFDCD1',
  },
  horizontalRoad2: {
    position: 'absolute',
    top: '68%',
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#DFDCD1',
  },
  verticalRoad1: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '28%',
    width: 14,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#DFDCD1',
  },
  verticalRoad2: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: '25%',
    width: 12,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#DFDCD1',
  },
  diagonalAvenue: {
    position: 'absolute',
    top: -40,
    left: '10%',
    width: 18,
    height: '160%',
    backgroundColor: '#FAF8F2',
    transform: [{ rotate: '42deg' }],
  },
  waterFeature: {
    position: 'absolute',
    bottom: -10,
    right: -20,
    width: 130,
    height: 90,
    borderRadius: 60,
    backgroundColor: '#D7E4ED',
  },
  parkFeature: {
    position: 'absolute',
    top: 15,
    left: 15,
    width: 70,
    height: 55,
    borderRadius: 12,
    backgroundColor: '#DDE8DE',
  },
  radarBeam: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 260,
    height: 260,
    marginLeft: -130,
    marginTop: -130,
    borderRadius: 130,
    borderWidth: 1,
    borderColor: 'rgba(46, 133, 64, 0.35)',
    borderTopColor: colors.online,
  },
  centerMarkerWrapper: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -24,
    marginTop: -24,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  pulsingRing: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  riderPin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  outletPinWrapper: {
    position: 'absolute',
    top: '22%',
    left: '20%',
    alignItems: 'center',
    zIndex: 9,
  },
  outletPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  customerPinWrapper: {
    position: 'absolute',
    top: '72%',
    right: '18%',
    alignItems: 'center',
    zIndex: 9,
  },
  customerPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  pinLabel: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    marginTop: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pinLabelText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  routePathContainer: {
    position: 'absolute',
    top: '32%',
    left: '28%',
    width: 140,
    height: 120,
    zIndex: 5,
  },
  routeSegment: {
    width: '100%',
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
    opacity: 0.6,
    borderStyle: 'dashed',
  },
  gpsBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    maxWidth: '75%',
  },
  gpsBadgeExpanded: {
    top: 54, // Avoid iPhone notch / Dynamic Island
    left: spacing.lg,
  },
  gpsDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  gpsText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  expandButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeExpandedButton: {
    position: 'absolute',
    top: 48,
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 20,
  },
  sectorBadge: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectorBadgeExpanded: {
    bottom: 34,
    left: spacing.lg,
  },
  sectorText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  recenterButton: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recenterButtonExpanded: {
    bottom: 34,
    right: spacing.lg,
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  permissionWarningOverlay: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 52,
    zIndex: 11,
  },
  enableButton: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  enableButtonText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
});
