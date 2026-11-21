import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/tokens';
import { appStyles } from '../theme/appStyles';

interface RiderHeaderProps {
  serviceArea: string;
  profileImageUrl?: string | null;
  onProfilePress?: () => void;
}

export function RiderHeader({ serviceArea, profileImageUrl, onProfilePress }: RiderHeaderProps) {
  return (
    <View style={styles.header}>
      <View>
        <Text accessibilityRole="header" style={styles.title}>Fleet24 <Text style={styles.rider}>Rider</Text></Text>
        <Text style={styles.area}>{serviceArea}</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open account" onPress={onProfilePress} style={styles.profile}>
        {profileImageUrl ? <Image source={{ uri: profileImageUrl }} style={styles.avatar} /> :
          <Ionicons name="person-outline" size={21} color={colors.primary} />}
      </TouchableOpacity>
    </View>
  );
}

const styles = appStyles({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  title: { fontSize: 24, fontWeight: '900', color: colors.primary, letterSpacing: -0.7 },
  rider: { fontSize: 17, fontWeight: '700' },
  area: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  profile: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  avatar: { width: '100%', height: '100%' },
});
