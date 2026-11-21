import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/tokens';
import { appStyles } from '../theme/appStyles';

interface AvailabilityControlProps {
  isOnline: boolean;
  isLoading: boolean;
  error: string | null;
  onToggle: () => void;
}

/**
 * The rider's main control. Offline: dark card with a large "Go online" button.
 * Online: lime card that says the rider is receiving offers, with a clear way to stop.
 * One switch for assistive technology; the whole button is a 56px target.
 */
export function AvailabilityControl({ isOnline, isLoading, error, onToggle }: AvailabilityControlProps) {
  return (
    <View style={[styles.card, isOnline ? styles.cardOnline : styles.cardOffline]}>
      <View style={styles.row}>
        <View style={[styles.status, isOnline ? styles.statusOnline : styles.statusOffline]}>
          <View style={[styles.dot, isOnline ? styles.dotOnline : styles.dotOffline]} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, isOnline && styles.titleOnline]}>{isOnline ? 'You’re online' : 'You’re offline'}</Text>
          <Text style={[styles.subtitle, isOnline && styles.subtitleOnline]} accessibilityLiveRegion="polite">
            {isLoading ? 'Updating availability…' : isOnline ? 'Looking for orders near you' : 'Go online to receive delivery offers'}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        accessibilityRole="switch"
        accessibilityLabel="Rider availability"
        accessibilityHint={isOnline ? 'Stops new delivery offers' : 'Starts receiving delivery offers'}
        accessibilityState={{ checked: isOnline, busy: isLoading, disabled: isLoading }}
        disabled={isLoading}
        onPress={onToggle}
        activeOpacity={0.85}
        style={[styles.button, isOnline ? styles.buttonOnline : styles.buttonOffline, isLoading && styles.busy]}
      >
        {isLoading ? (
          <ActivityIndicator color={isOnline ? colors.surfaceDark : colors.surfaceDark} />
        ) : (
          <Ionicons name="power" size={20} color={isOnline ? '#FFFFFF' : colors.surfaceDark} />
        )}
        <Text style={[styles.buttonText, isOnline && styles.buttonTextOnline]}>{isOnline ? 'Go offline' : 'Go online'}</Text>
      </TouchableOpacity>
      {error && <Text accessibilityRole="alert" style={[styles.error, isOnline && styles.errorOnline]}>{error}</Text>}
    </View>
  );
}

const styles = appStyles({
  card: { padding: 16, borderRadius: 24, gap: 14 },
  cardOffline: { backgroundColor: colors.surfaceDark },
  cardOnline: { backgroundColor: colors.limeAccent },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  status: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  statusOffline: { backgroundColor: 'rgba(255,255,255,0.1)' },
  statusOnline: { backgroundColor: 'rgba(25,59,44,0.12)' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3 },
  dotOffline: { backgroundColor: '#8A928C', borderColor: 'rgba(255,255,255,0.25)' },
  dotOnline: { backgroundColor: '#1F8A44', borderColor: 'rgba(255,255,255,0.7)' },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '800', letterSpacing: -0.4, color: '#FFFFFF' },
  titleOnline: { color: colors.surfaceDark },
  subtitle: { fontSize: 14, lineHeight: 19, color: '#CFE0D6', marginTop: 1 },
  subtitleOnline: { color: '#3E5A2B' },
  button: { minHeight: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonOffline: { backgroundColor: colors.limeAccent },
  buttonOnline: { backgroundColor: colors.surfaceDark },
  busy: { opacity: 0.7 },
  buttonText: { fontSize: 17, fontWeight: '800', color: colors.surfaceDark },
  buttonTextOnline: { color: '#FFFFFF' },
  error: { fontSize: 14, color: '#FFD2CC', fontWeight: '600' },
  errorOnline: { color: '#8A1F17' },
});
