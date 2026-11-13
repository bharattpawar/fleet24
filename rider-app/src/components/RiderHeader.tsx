import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../theme/tokens';

interface RiderHeaderProps {
  riderName?: string | null;
  profileImageUrl?: string | null;
  isOnline: boolean;
  isSocketConnected: boolean;
  isMockMode?: boolean;
  onProfilePress?: () => void;
}

export const RiderHeader: React.FC<RiderHeaderProps> = ({
  riderName,
  profileImageUrl,
  isOnline,
  isSocketConnected,
  isMockMode = false,
  onProfilePress,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <View>
          <View style={styles.titleRow}>
            <Text style={styles.brandTitle}>FLEET24</Text>
            <View
              style={[
                styles.partnerBadge,
                isMockMode ? { backgroundColor: 'rgba(230, 81, 0, 0.35)' } : null,
              ]}
            >
              <Text
                style={[
                  styles.partnerText,
                  isMockMode ? { color: '#FFA726', fontWeight: '900' } : null,
                ]}
              >
                {isMockMode ? 'DEMO MODE' : 'RIDER PARTNER'}
              </Text>
            </View>
          </View>
          <Text style={styles.subtitle}>
            {isMockMode ? '⚠️ Simulated Mode (No Live Dispatch)' : 'Greater Noida Central'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.profileButton}
          onPress={onProfilePress}
          activeOpacity={0.8}
        >
          {profileImageUrl ? (
            <Image source={{ uri: profileImageUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={18} color={colors.textWhite} />
            </View>
          )}

          {/* Socket & Network Live Status Dot */}
          <View
            style={[
              styles.statusIndicator,
              {
                backgroundColor: isOnline
                  ? isSocketConnected
                    ? colors.online
                    : colors.warning
                  : colors.offline,
              },
            ]}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceDark,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textWhite,
    letterSpacing: 0.5,
  },
  partnerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  partnerText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.surfaceGreen,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    marginTop: 2,
  },
  profileButton: {
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.surfaceDark,
  },
});

