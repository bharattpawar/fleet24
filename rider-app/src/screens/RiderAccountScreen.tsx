import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/tokens';
import { useRiderAuth } from '../context/RiderAuthContext';
import { riderApi } from '../api/riderApi';
import { appStyles } from '../theme/appStyles';

export const RiderAccountScreen: React.FC = () => {
  const { profile, isMockSession, refreshProfile, logout } = useRiderAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [vehicleNumber, setVehicleNumber] = useState(profile?.vehicleNumber || '');
  const [vehicleType, setVehicleType] = useState(profile?.vehicleType || 'motorcycle');
  const [licenseNumber, setLicenseNumber] = useState(profile?.licenseNumber || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      if (isMockSession) {
        await new Promise((r) => setTimeout(r, 300));
        if (profile) {
          profile.fullName = fullName;
          profile.vehicleNumber = vehicleNumber;
          profile.vehicleType = vehicleType;
          profile.licenseNumber = licenseNumber;
        }
        setIsEditing(false);
        Alert.alert('Success', 'Profile updated successfully.');
        return;
      }

      await riderApi.updateProfile({
        fullName,
        vehicleNumber,
        vehicleType,
        licenseNumber,
      });
      await refreshProfile();
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to log out of Fleet24 Rider?');
      if (confirmed) {
        logout();
      }
      return;
    }
    Alert.alert('Logout', 'Are you sure you want to log out of Fleet24 Rider?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  const verificationStatus = profile?.verificationStatus || 'pending';
  const isApproved = verificationStatus === 'approved';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rider Account</Text>
        <Text style={styles.headerSub}>Profile & Operational Status</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Verification Status Card */}
        <View
          style={[
            styles.statusBanner,
            isApproved ? styles.statusApproved : styles.statusPending,
          ]}
        >
          <Ionicons
            name={isApproved ? 'shield-checkmark' : 'time'}
            size={22}
            color={isApproved ? colors.online : colors.warning}
          />
          <View style={styles.statusBannerText}>
            <Text style={styles.statusBannerTitle}>
              {isApproved ? 'VERIFIED DELIVERY PARTNER' : 'VERIFICATION PENDING'}
            </Text>
            <Text style={styles.statusBannerDesc}>
              {isApproved
                ? 'Your documents & vehicle are verified for delivery operations in Greater Noida.'
                : 'Your profile documents are undergoing administrative review.'}
            </Text>
          </View>
        </View>

        {/* Profile Details Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Personal Information</Text>
            {!isEditing && (
              <TouchableOpacity onPress={() => setIsEditing(true)}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>FULL NAME</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter full name"
              />
            ) : (
              <Text style={styles.fieldValue}>{profile?.fullName || 'Delivery Partner'}</Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>PHONE NUMBER</Text>
            <Text style={styles.fieldValue}>{profile?.user?.phone || 'Not provided'}</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
            <Text style={styles.fieldValue}>{profile?.user?.email || 'rider@fleet24.app'}</Text>
          </View>
        </View>

        {/* Vehicle & Logistics Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vehicle & Logistics</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>VEHICLE TYPE</Text>
            {isEditing ? (
              <View style={styles.vehicleTypeRow}>
                {['motorcycle', 'scooter', 'ev_2w', 'bicycle'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.vehicleChip,
                      vehicleType === type ? styles.vehicleChipSelected : null,
                    ]}
                    onPress={() => setVehicleType(type)}
                  >
                    <Text
                      style={[
                        styles.vehicleChipText,
                        vehicleType === type ? styles.vehicleChipTextSelected : null,
                      ]}
                    >
                      {type.toUpperCase().replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.fieldValue}>
                {profile?.vehicleType ? profile.vehicleType.toUpperCase().replace('_', ' ') : 'MOTORCYCLE'}
              </Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>REGISTRATION NUMBER</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={vehicleNumber}
                onChangeText={setVehicleNumber}
                placeholder="UP16 XX 0000"
                autoCapitalize="characters"
              />
            ) : (
              <Text style={styles.fieldValue}>{profile?.vehicleNumber || 'UP16 GN 2026'}</Text>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>DRIVING LICENSE</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={licenseNumber}
                onChangeText={setLicenseNumber}
                placeholder="DL-XXXXXXXX"
                autoCapitalize="characters"
              />
            ) : (
              <Text style={styles.fieldValue}>{profile?.licenseNumber || 'DL14202600123'}</Text>
            )}
          </View>

          {isEditing && (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setIsEditing(false)}
                disabled={isSaving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveProfile}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color={colors.textWhite} size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Operating Hub Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Assigned Operational Zone</Text>
          <View style={styles.hubRow}>
            <Ionicons name="map" size={20} color={colors.primary} />
            <View>
              <Text style={styles.hubTitle}>Greater Noida Central</Text>
              <Text style={styles.hubSub}>Sectors Alpha 1 & 2, Beta 1, Delta 1</Text>
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutButtonText}>LOG OUT OF PARTNER APP</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = appStyles({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surfaceDark,
  },
  header: {
    backgroundColor: colors.surfaceDark,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textWhite,
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    marginTop: 2,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  statusApproved: {
    backgroundColor: colors.surfaceGreen,
    borderColor: 'rgba(40, 84, 63, 0.25)',
  },
  statusPending: {
    backgroundColor: colors.warningLight,
    borderColor: 'rgba(217, 144, 88, 0.3)',
  },
  statusBannerText: {
    flex: 1,
  },
  statusBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  statusBannerDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  editLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  fieldGroup: {
    marginVertical: spacing.xs,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 2,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    height: 42,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vehicleTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 6,
  },
  vehicleChip: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.xs,
  },
  vehicleChipSelected: {
    backgroundColor: colors.primary,
  },
  vehicleChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  vehicleChipTextSelected: {
    color: colors.textWhite,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  saveButton: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textWhite,
  },
  hubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  hubTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  hubSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  logoutButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.error,
    letterSpacing: 0.5,
  },
});

