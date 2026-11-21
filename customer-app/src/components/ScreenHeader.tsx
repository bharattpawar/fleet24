import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/tokens';
import { appStyles } from '../theme/appStyles';

export function ScreenHeader({ title, subtitle, icon, onBack, action, children }: {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onBack?: () => void;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.row}>
        {onBack ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={styles.icon}><Ionicons name="arrow-back" size={21} color="#FFFFFF" /></TouchableOpacity>
          : icon ? <View style={styles.icon}><Ionicons name={icon} size={23} color={colors.citrusLime} /></View> : null}
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

const styles = appStyles({
  header: { backgroundColor: colors.primary, borderRadius: 24, padding: 20, marginBottom: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  title: { color: '#FFFFFF', fontSize: 25, lineHeight: 32, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { color: '#D9E8DF', fontSize: 12, lineHeight: 18, marginTop: 4 },
});
