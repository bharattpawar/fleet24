import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/tokens';

interface AvailabilityControlProps {
  isOnline: boolean;
  isLoading?: boolean;
  isMockMode?: boolean;
  onToggle: () => void;
}

export const AvailabilityControl: React.FC<AvailabilityControlProps> = ({
  isOnline,
  isLoading = false,
  isMockMode = false,
  onToggle,
}) => {
  const switchAnim = useRef(new Animated.Value(isOnline ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(switchAnim, {
      toValue: isOnline ? 1 : 0,
      useNativeDriver: false,
      friction: 8,
      tension: 60,
    }).start();
  }, [isOnline]);

  const thumbTranslate = switchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 48],
  });

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[
          styles.container,
          isOnline ? styles.containerOnline : styles.containerOffline,
        ]}
        activeOpacity={0.85}
        onPress={onToggle}
        disabled={isLoading}
      >
        <View style={styles.textContainer}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isOnline ? colors.online : colors.offline },
              ]}
            />
            <Text
              style={[
                styles.statusLabel,
                { color: isOnline ? colors.textWhite : colors.textPrimary },
              ]}
            >
              {isMockMode
                ? isOnline
                  ? 'DEMO PREVIEW: SIMULATING ONLINE'
                  : 'DEMO PREVIEW: OFFLINE'
                : isOnline
                ? 'LIVE DISPATCH: ONLINE'
                : 'LIVE DISPATCH: OFFLINE'}
            </Text>

            {/* Clear DEMO MODE badge if in mock mode */}
            {isMockMode ? (
              <View style={styles.demoBadge}>
                <Text style={styles.demoBadgeText}>DEMO ONLY</Text>
              </View>
            ) : (
              <View style={[styles.demoBadge, { backgroundColor: isOnline ? 'rgba(46, 125, 50, 0.25)' : 'rgba(100, 100, 100, 0.15)' }]}>
                <Text style={[styles.demoBadgeText, { color: isOnline ? '#2E7D32' : colors.textSecondary }]}>
                  {isOnline ? 'LIVE NETWORK' : 'STANDBY'}
                </Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.statusDescription,
              {
                color: isOnline
                  ? 'rgba(255, 255, 255, 0.85)'
                  : colors.textSecondary,
              },
            ]}
          >
            {isMockMode
              ? isOnline
                ? 'Simulated rider partner in local preview. Real backend dispatch is NOT active.'
                : 'Demo preview is offline. Connect to Live Backend for real orders.'
              : isOnline
              ? 'Connected to Fleet24 live dispatch • Ready for orders in Greater Noida'
              : 'Go online to start receiving real delivery orders'}
          </Text>
        </View>

        {/* Toggle Switch */}
        <View style={styles.switchTrack} pointerEvents="none">
          <Animated.View
            style={[
              styles.switchThumb,
              {
                transform: [{ translateX: thumbTranslate }],
                backgroundColor: isOnline ? colors.online : colors.surface,
              },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator
                size="small"
                color={isOnline ? colors.textWhite : colors.primary}
              />
            ) : (
              <Ionicons
                name={isOnline ? 'checkmark' : 'power'}
                size={16}
                color={isOnline ? colors.textWhite : colors.offline}
              />
            )}
          </Animated.View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
    shadowRadius: 6,
    elevation: 3,
  },
  containerOnline: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  containerOffline: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  textContainer: {
    flex: 1,
    paddingRight: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  demoBadge: {
    backgroundColor: 'rgba(217, 144, 88, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.xs,
    marginLeft: 4,
  },
  demoBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  statusDescription: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  switchTrack: {
    width: 86,
    height: 42,
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderRadius: borderRadius.full,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
});
