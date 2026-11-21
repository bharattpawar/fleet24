import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/tokens';
import { appStyles } from '../../theme/appStyles';

export type StateTone = 'neutral' | 'error' | 'warning' | 'locked';

const TONES: Record<StateTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surfaceGreen, fg: colors.primary },
  error: { bg: '#FDECEC', fg: '#B42318' },
  warning: { bg: '#FFF4E5', fg: '#9A5B13' },
  locked: { bg: colors.surfaceMuted, fg: colors.textSecondary },
};

/**
 * Loading, empty, error and permission states in one shape (same card language as the customer app).
 * `compact` is for queues and lists; the default fills the screen.
 */
export function StateView({ title, message, icon = 'file-tray-outline', tone = 'neutral', loading, actionLabel, onAction, compact }: {
  title: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: StateTone;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  const t = TONES[tone];
  return (
    <View style={[styles.root, compact && styles.rootCompact]} accessibilityRole={tone === 'error' ? 'alert' : undefined}>
      <View style={[styles.card, compact && styles.cardCompact]}>
        <View style={[styles.icon, compact && styles.iconCompact, { backgroundColor: t.bg }]}>
          {loading ? <ActivityIndicator color={t.fg} /> : <Ionicons name={icon} size={compact ? 24 : 32} color={t.fg} />}
        </View>
        <Text accessibilityRole="header" style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {actionLabel && onAction ? (
          <TouchableOpacity accessibilityRole="button" onPress={onAction} style={styles.action} activeOpacity={0.85}>
            <Text style={styles.actionText}>{actionLabel}</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = appStyles({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  rootCompact: { flex: 0, paddingVertical: 12 },
  card: {
    width: '100%', maxWidth: 440, padding: 24, borderRadius: 24, alignItems: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, boxShadow: '0px 10px 32px rgba(25,59,44,0.06)',
  },
  cardCompact: { padding: 18, borderRadius: 20, boxShadow: 'none' },
  icon: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  iconCompact: { width: 52, height: 52, borderRadius: 18, marginBottom: 10 },
  title: { color: colors.textPrimary, fontSize: 20, lineHeight: 26, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  titleCompact: { fontSize: 16, lineHeight: 22 },
  message: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  action: {
    marginTop: 16, minHeight: 48, paddingHorizontal: 20, borderRadius: 14, backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch',
  },
  actionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
