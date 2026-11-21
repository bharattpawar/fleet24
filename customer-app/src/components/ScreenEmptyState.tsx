import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { colors } from '../theme/tokens';
import { appStyles } from '../theme/appStyles';

export function ScreenEmptyState({ title, subtitle, icon, action, onPress }: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <View style={styles.halo}><View style={styles.icon}><Ionicons name={icon} size={39} color={colors.primary} /></View></View>
        <Text style={styles.eyebrow}>FLEET24 · GOOD FOOD, CLOSE BY</Text>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {action && onPress ? <Button title={action} onPress={onPress} size="lg" style={styles.button} icon={<Ionicons name="arrow-forward" size={17} color="#FFFFFF" />} /> : null}
      </View>
    </View>
  );
}

const styles = appStyles({
  root: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 20 },
  card: { width: '100%', maxWidth: 460, padding: 26, borderRadius: 28, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, boxShadow: '0px 12px 40px rgba(25,59,44,0.06)' },
  halo: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#F4F8EF', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  icon: { width: 86, height: 86, borderRadius: 30, backgroundColor: colors.surfaceGreen, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] },
  eyebrow: { color: colors.primary, fontSize: 9, lineHeight: 15, fontWeight: '700', letterSpacing: 1.1, textAlign: 'center', marginBottom: 9 },
  title: { color: colors.textPrimary, fontSize: 25, lineHeight: 32, fontWeight: '800', letterSpacing: -0.6, textAlign: 'center' },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 12 },
  button: { marginTop: 26, width: '100%', borderRadius: 15 },
});
