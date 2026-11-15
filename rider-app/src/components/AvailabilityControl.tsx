import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { colors } from '../theme/tokens';

interface AvailabilityControlProps {
  isOnline: boolean;
  isLoading: boolean;
  error: string | null;
  onToggle: () => void;
}

export function AvailabilityControl({ isOnline, isLoading, error, onToggle }: AvailabilityControlProps) {
  return (
    <View style={styles.card}>
      <View style={styles.copy}>
        <Text style={styles.title}>{isOnline ? 'You’re online' : 'You’re offline'}</Text>
        {isLoading && <Text accessibilityLiveRegion="polite" style={styles.meta}>Updating availability…</Text>}
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      </View>
      <Switch accessibilityLabel="Rider availability" value={isOnline} disabled={isLoading}
        onValueChange={onToggle} trackColor={{ false: colors.offline, true: colors.primary }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, padding: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 16 },
  copy: { flex: 1 },
  title: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 3 },
  error: { fontSize: 13, color: colors.error, marginTop: 3 },
});
