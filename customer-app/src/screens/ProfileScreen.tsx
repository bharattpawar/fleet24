import { useDeliveryLocation } from '../context/DeliveryLocationContext';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { colors, spacing, typography, borderRadius } from '../theme/tokens';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { apiRequest } from '../api/client';
import { USE_MOCK_DATA, MOCK_USER_PROFILE, MOCK_ADDRESSES } from '../api/mockData';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ProfileScreenProps {
  onRequireAuth: () => void;
  onOpenRiderDashboard?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onRequireAuth,
  onOpenRiderDashboard,
}) => {
  const insets = useSafeAreaInsets();
  const { addresses } = useDeliveryLocation();
  const defaultCity = addresses.find((address) => address.isDefault)?.city;
  const { user, isAuthenticated, logout, refreshProfile } = useAuth();
  const activeUser = USE_MOCK_DATA ? MOCK_USER_PROFILE : user;
  const isUserAuthenticated = USE_MOCK_DATA ? true : isAuthenticated;

  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(activeUser?.fullName || '');
  const [isSaving, setIsSaving] = useState(false);

  if (!isUserAuthenticated || !activeUser) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top + 40 }]}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="person-circle-outline" size={48} color={colors.primary} />
        </View>
        <Text style={styles.title}>Fleet24 Account</Text>
        <Text style={styles.sub}>
          Log in with your mobile number to manage your profile, saved addresses, and active orders.
        </Text>
        <Button
          title="Sign In / Register"
          onPress={onRequireAuth}
          size="lg"
          style={{ marginTop: spacing.xl, paddingHorizontal: spacing.xxl }}
        />
      </View>
    );
  }

  const handleSaveProfile = async () => {
    if (fullName.trim().length < 2) {
      Alert.alert('Invalid Name', 'Name must be at least 2 characters long.');
      return;
    }

    if (USE_MOCK_DATA) {
      setIsSaving(true);
      setTimeout(() => {
        setIsSaving(false);
        setIsEditing(false);
        Alert.alert('Profile Updated', 'Your profile details have been saved.');
      }, 400);
      return;
    }

    try {
      setIsSaving(true);
      await apiRequest('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ fullName: fullName.trim() }),
      });
      await refreshProfile();
      setIsEditing(false);
      Alert.alert('Profile Updated', 'Your profile details have been saved.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      Alert.alert('Notice', msg);
    } finally {
      setIsSaving(false);
    }
  };

  const getAddressIcon = (label: string): keyof typeof Ionicons.glyphMap => {
    const l = label.toLowerCase();
    if (l.includes('hostel') || l.includes('campus')) return 'school-outline';
    if (l.includes('office') || l.includes('work')) return 'briefcase-outline';
    return 'home-outline';
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenHeading}>My Profile</Text>
        <Text style={styles.headerSub}>Personal info, delivery preferences & addresses</Text>
      </View>

      {/* User Hero Card */}
      <View style={styles.userCard}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarChar}>{activeUser.fullName.charAt(0).toUpperCase()}</Text>
            <View style={styles.verifiedDot}>
              <Ionicons name="checkmark" size={10} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.userInfoTextCol}>
            {isEditing ? (
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                style={styles.nameInput}
                autoFocus
              />
            ) : (
              <Text style={styles.userName}>{activeUser.fullName}</Text>
            )}
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.userPhone}>+91 {activeUser.phone}</Text>
            </View>
            <View style={styles.roleTag}>
              <Ionicons name="shield-checkmark" size={11} color={colors.primary} />
              <Text style={styles.roleTagText}>Fleet24 Member</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {defaultCity && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Primary Service Area</Text>
            <View style={styles.locationCapsule}>
              <Ionicons name="location-sharp" size={12} color={colors.primary} />
              <Text style={styles.infoValue}>{defaultCity}</Text>
            </View>
          </View>
        )}

        <View style={styles.btnRow}>
          {isEditing ? (
            <>
              <Button
                title="Cancel"
                variant="outline"
                size="sm"
                onPress={() => setIsEditing(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Save Changes"
                variant="primary"
                size="sm"
                loading={isSaving}
                onPress={handleSaveProfile}
                style={{ flex: 1 }}
              />
            </>
          ) : (
            <TouchableOpacity
              style={styles.editBtn}
              activeOpacity={0.8}
              onPress={() => {
                setFullName(activeUser.fullName);
                setIsEditing(true);
              }}
            >
              <Ionicons name="create-outline" size={15} color={colors.primary} />
              <Text style={styles.editBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Saved Addresses Section */}
      <View style={styles.card}>
        <View style={styles.addressSectionHeader}>
          <View style={styles.sectionHeaderIconCircle}>
            <Ionicons name="location" size={16} color={colors.primary} />
          </View>
          <Text style={styles.addressSectionTitle}>Saved Addresses</Text>
          <View style={styles.addressCountBadge}>
            <Text style={styles.addressCountBadgeText}>{MOCK_ADDRESSES.length}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {MOCK_ADDRESSES.map((addr, index) => (
          <View
            key={addr.id}
            style={[
              styles.addressItem,
              index < MOCK_ADDRESSES.length - 1 && styles.addressItemBorder,
            ]}
          >
            <View style={styles.addressIconCol}>
              <Ionicons name={getAddressIcon(addr.label)} size={20} color={colors.primary} />
            </View>

            <View style={styles.addressDetailCol}>
              <View style={styles.addressBadgeRow}>
                <View style={styles.addressLabelBadge}>
                  <Text style={styles.addressLabelText}>{addr.label}</Text>
                </View>
                {addr.isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                  </View>
                )}
              </View>

              <Text style={styles.addressLine1}>{addr.addressLine1}</Text>
              <Text style={styles.addressLine2}>
                {addr.addressLine2 ? `${addr.addressLine2}, ` : ''}
                {addr.city} ({addr.postalCode})
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Help & Settings Group */}
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.7}
          onPress={onOpenRiderDashboard}
        >
          <View style={[styles.menuIconCircle, { backgroundColor: colors.surfaceGreen }]}>
            <Ionicons name="bicycle" size={17} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuText}>Fleet24 Rider Operations</Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
              Delivery offers, active runs & live GPS status
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.dividerLight} />

        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <View style={styles.menuIconCircle}>
            <Ionicons name="help-buoy-outline" size={17} color={colors.primary} />
          </View>
          <Text style={styles.menuText}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.dividerLight} />

        <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
          <View style={styles.menuIconCircle}>
            <Ionicons name="document-text-outline" size={17} color={colors.primary} />
          </View>
          <Text style={styles.menuText}>Terms of Service & Privacy</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.logoutBtn}
          activeOpacity={0.7}
          onPress={() => {
            Alert.alert('Log Out', 'Are you sure you want to log out of Fleet24?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Log Out',
                style: 'destructive',
                onPress: () => {
                  if (USE_MOCK_DATA) {
                    Alert.alert('Mock Mode', 'Log out is disabled while previewing mock data.');
                  } else {
                    logout();
                  }
                },
              },
            ]);
          }}
        >
          <View style={styles.logoutIconCircle}>
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
          </View>
          <Text style={styles.logoutText}>Log Out from Fleet24</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },
  header: {
    marginBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
  screenHeading: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13.5,
    color: colors.textSecondary,
    marginTop: 4,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarChar: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfoTextCol: {
    flex: 1,
  },
  userName: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  nameInput: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.primary,
    paddingVertical: 2,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  userPhone: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  roleTagText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },
  dividerLight: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginHorizontal: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  locationCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F2EB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  infoValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  btnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    paddingVertical: 9,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FAF9F5',
  },
  editBtnText: {
    color: colors.primary,
    fontSize: 13.5,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md + 2,
    marginBottom: spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  addressSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeaderIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressSectionTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: colors.textPrimary,
    flex: 1,
  },
  addressCountBadge: {
    backgroundColor: '#F3F2EB',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  addressCountBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: spacing.sm + 2,
  },
  addressItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: spacing.md,
    marginBottom: spacing.sm,
  },
  addressIconCol: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  addressDetailCol: {
    flex: 1,
  },
  addressBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  addressLabelBadge: {
    backgroundColor: '#F3F2EB',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  addressLabelText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  defaultBadge: {
    backgroundColor: '#FAF3E8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  defaultBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.3,
  },
  addressLine1: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 18,
  },
  addressLine2: {
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    gap: spacing.sm + 2,
  },
  menuIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm + 2,
  },
  logoutIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FDF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.error,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  sub: {
    fontSize: 13.5,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
});
