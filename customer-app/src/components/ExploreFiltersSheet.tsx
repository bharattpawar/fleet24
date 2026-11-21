import { appStyles } from '../theme/appStyles';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { exploreColors as c } from '../theme/tokens';

interface ExploreFiltersSheetProps {
  openOnly: boolean;
  onClose: () => void;
  onApply: (openOnly: boolean) => void;
}

export function ExploreFiltersSheet({ openOnly, onClose, onApply }: ExploreFiltersSheetProps) {
  const [draftOpenOnly, setDraftOpenOnly] = useState(openOnly);
  const { bottom } = useSafeAreaInsets();

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
        <View style={[styles.sheet, { paddingBottom: Math.max(bottom, 16) }]} accessibilityViewIsModal>
          <View style={styles.row}>
            <Text style={styles.title} accessibilityRole="header">Filters</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close filters" onPress={onClose} style={styles.close}>
              <Ionicons name="close" size={24} color={c.green} />
            </Pressable>
          </View>

          <View style={[styles.row, styles.option]}>
            <View style={styles.description}>
              <Text style={styles.label}>Open now</Text>
              <Text style={styles.caption}>Show kitchens currently accepting orders.</Text>
            </View>
            <Switch
              accessibilityLabel="Open now"
              value={draftOpenOnly}
              onValueChange={setDraftOpenOnly}
              trackColor={{ false: c.border, true: c.green }}
            />
          </View>

          <View style={[styles.row, styles.actions]}>
            <Pressable accessibilityRole="button" onPress={() => setDraftOpenOnly(false)} style={styles.clear}>
              <Text style={styles.clearText}>Clear all</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => onApply(draftOpenOnly)} style={styles.apply}>
              <Text style={styles.applyText}>Apply filters</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = appStyles({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16, 32, 25, 0.42)' },
  sheet: {
    alignSelf: 'center', width: '100%', maxWidth: 560, backgroundColor: c.background,
    paddingHorizontal: 20, paddingTop: 12, borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { color: c.ink, fontSize: 22, fontWeight: '800' },
  close: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  option: { paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border },
  description: { flex: 1, gap: 4 },
  label: { fontSize: 16, color: c.ink, fontWeight: '700' },
  caption: { fontSize: 13, color: c.secondary },
  actions: { marginTop: 16 },
  clear: { paddingHorizontal: 14, minHeight: 46, justifyContent: 'center' },
  clearText: { color: c.green, fontWeight: '700' },
  apply: { flex: 1, minHeight: 46, borderRadius: 14, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  applyText: { color: '#FFFFFF', fontWeight: '700' },
});
