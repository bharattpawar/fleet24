import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, minTouchTarget, shadows } from '../theme/tokens';
import { useRestaurantAuth } from '../context/RestaurantAuthContext';
import { OperatingOutlet, OperatingHour } from '../types';
import { restaurantApi } from '../api/restaurantApi';
import { appStyles } from '../theme/appStyles';

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

interface RestaurantOutletsScreenProps {
  onOutletSelected?: () => void;
  onNavigateToKitchen?: () => void;
  onNavigateToMenu?: () => void;
}

export const RestaurantOutletsScreen: React.FC<RestaurantOutletsScreenProps> = ({
  onOutletSelected,
  onNavigateToKitchen,
  onNavigateToMenu,
}) => {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const {
    outlets,
    activeOutlet,
    setActiveOutlet,
    toggleOrderAcceptance,
    refreshProfile,
    permissions,
  } = useRestaurantAuth();

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'paused'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [togglingOutletId, setTogglingOutletId] = useState<string | null>(null);

  // Edit Outlet Modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<OperatingOutlet | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formRadius, setFormRadius] = useState('');
  const [savingOutlet, setSavingOutlet] = useState(false);
  const [outletFieldErrors, setOutletFieldErrors] = useState<{ [k: string]: string }>({});

  // Operating Hours Modal
  const [hoursModalVisible, setHoursModalVisible] = useState(false);
  const [hoursOutlet, setHoursOutlet] = useState<OperatingOutlet | null>(null);
  const [schedule, setSchedule] = useState<OperatingHour[]>([]);
  const [loadingHours, setLoadingHours] = useState(false);
  const [savingHours, setSavingHours] = useState(false);

  // Refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setRefreshing(false);
    }
  };

  // Filtered Outlets
  const filteredOutlets = useMemo(() => {
    return outlets.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        item.name.toLowerCase().includes(q) ||
        item.restaurantName.toLowerCase().includes(q) ||
        item.address.toLowerCase().includes(q) ||
        item.phone.includes(q);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'open' && item.isAcceptingOrders) ||
        (statusFilter === 'paused' && !item.isAcceptingOrders);

      return matchesSearch && matchesStatus;
    });
  }, [outlets, searchQuery, statusFilter]);

  // Switch Active Outlet
  const handleSelectOutlet = async (outlet: OperatingOutlet) => {
    if (activeOutlet?.id === outlet.id) return;
    try {
      await setActiveOutlet(outlet);
      if (onOutletSelected) {
        onOutletSelected();
      }
    } catch (err: any) {
      Alert.alert('Selection Error', err?.message || 'Could not switch active outlet.');
    }
  };

  // Toggle Order Acceptance
  const handleToggleAcceptance = async (outlet: OperatingOutlet, nextVal: boolean) => {
    if (!permissions.canToggleOrderAcceptance) {
      Alert.alert('Permission Denied', 'You do not have permission to toggle order acceptance.');
      return;
    }
    setTogglingOutletId(outlet.id);
    try {
      await toggleOrderAcceptance(nextVal, outlet.id);
    } catch (err: any) {
      Alert.alert('Status Update Failed', err?.message || 'Could not update order acceptance.');
    } finally {
      setTogglingOutletId(null);
    }
  };

  // Open Edit Outlet Modal
  const openEditModal = (outlet: OperatingOutlet) => {
    if (!permissions.canManageOutletInfo) {
      Alert.alert('Restricted Access', 'Only Restaurant Owners and authorized Managers can modify outlet details.');
      return;
    }
    setEditingOutlet(outlet);
    setFormName(outlet.name);
    setFormPhone(outlet.phone);
    setFormAddress(outlet.address);
    setFormRadius(outlet.deliveryRadiusKm.toString());
    setOutletFieldErrors({});
    setEditModalVisible(true);
  };

  // Save Outlet Details
  const handleSaveOutlet = async () => {
    if (!editingOutlet) return;

    const errors: { [k: string]: string } = {};
    if (!formName.trim()) errors.name = 'Outlet name is required.';
    if (!formAddress.trim()) errors.address = 'Full address is required.';

    const phoneClean = formPhone.trim().replace(/^(\+91)/, '');
    if (!/^[6-9]\d{9}$/.test(phoneClean)) {
      errors.phone = 'Valid 10-digit Indian mobile number required.';
    }

    const radiusVal = parseFloat(formRadius);
    if (isNaN(radiusVal) || radiusVal < 0.5 || radiusVal > 25) {
      errors.radius = 'Radius must be between 0.5 km and 25.0 km.';
    }

    if (Object.keys(errors).length > 0) {
      setOutletFieldErrors(errors);
      return;
    }

    setSavingOutlet(true);
    try {
      await restaurantApi.updateOutlet(editingOutlet.id, {
        name: formName.trim(),
        phone: formPhone.trim(),
        address: formAddress.trim(),
        deliveryRadiusKm: radiusVal,
      });

      await refreshProfile();
      setEditModalVisible(false);
      Alert.alert('Success', 'Outlet settings updated successfully.');
    } catch (err: any) {
      Alert.alert('Update Failed', err?.message || 'Could not save outlet settings.');
    } finally {
      setSavingOutlet(false);
    }
  };

  // Open Operating Hours Modal
  const openHoursModal = async (outlet: OperatingOutlet) => {
    setHoursOutlet(outlet);
    setHoursModalVisible(true);
    setLoadingHours(true);
    try {
      const data = await restaurantApi.getOperatingHours(outlet.id);
      if (Array.isArray(data) && data.length > 0) {
        setSchedule(data);
      } else {
        const defaultSchedule: OperatingHour[] = Array.from({ length: 7 }, (_, i) => ({
          dayOfWeek: i,
          openTime: '09:00',
          closeTime: '23:00',
          isClosed: false,
        }));
        setSchedule(defaultSchedule);
      }
    } catch (err: any) {
      Alert.alert('Fetch Error', err?.message || 'Could not load operating hours.');
    } finally {
      setLoadingHours(false);
    }
  };

  // Save Operating Hours
  const handleSaveHours = async () => {
    if (!hoursOutlet) return;
    if (!permissions.canUpdateOperatingHours) {
      Alert.alert('Permission Denied', 'Only Owners and Managers can modify operating hours.');
      return;
    }

    for (const day of schedule) {
      if (!day.isClosed && day.openTime >= day.closeTime) {
        Alert.alert(
          'Invalid Time Range',
          `${DAYS_OF_WEEK[day.dayOfWeek]}: Open time (${day.openTime}) must be earlier than close time (${day.closeTime}).`,
        );
        return;
      }
    }

    setSavingHours(true);
    try {
      await restaurantApi.saveOperatingHours(
        hoursOutlet.id,
        schedule.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          openTime: s.openTime,
          closeTime: s.closeTime,
          isClosed: s.isClosed || false,
        })),
      );
      Alert.alert('Success', 'Operating hours saved successfully.');
      setHoursModalVisible(false);
      await refreshProfile();
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message || 'Could not update operating hours.');
    } finally {
      setSavingHours(false);
    }
  };

  const updateScheduleDay = (dayIndex: number, updates: Partial<OperatingHour>) => {
    setSchedule((prev) =>
      prev.map((d) => (d.dayOfWeek === dayIndex ? { ...d, ...updates } : d)),
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Banner */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <View>
            <Text style={styles.headerTitle}>Outlet Management</Text>
            <Text style={styles.headerSubtitle}>
              {outlets.length} Authorized {outlets.length === 1 ? 'Terminal' : 'Terminals'} · Real-time Control
            </Text>
          </View>
        </View>

        {/* Search Row */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={17} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, address or phone..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={17} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter Chips */}
        <View style={styles.filterPillRow}>
          <TouchableOpacity
            style={[styles.filterPill, statusFilter === 'all' && styles.filterPillActive]}
            onPress={() => setStatusFilter('all')}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: statusFilter === 'all' }}
          >
            <Text style={[styles.filterPillText, statusFilter === 'all' && styles.filterPillTextActive]}>
              All Outlets ({outlets.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, statusFilter === 'open' && styles.filterPillActive]}
            onPress={() => setStatusFilter('open')}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: statusFilter === 'open' }}
          >
            <View style={[styles.dot, { backgroundColor: colors.online }]} />
            <Text style={[styles.filterPillText, statusFilter === 'open' && styles.filterPillTextActive]}>
              Accepting Orders ({outlets.filter((o) => o.isAcceptingOrders).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, statusFilter === 'paused' && styles.filterPillActive]}
            onPress={() => setStatusFilter('paused')}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: statusFilter === 'paused' }}
          >
            <View style={[styles.dot, { backgroundColor: colors.pending }]} />
            <Text style={[styles.filterPillText, statusFilter === 'paused' && styles.filterPillTextActive]}>
              Paused ({outlets.filter((o) => !o.isAcceptingOrders).length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Outlets List */}
      <FlatList
        key={isWide ? 'grid-2' : 'list-1'}
        data={filteredOutlets}
        keyExtractor={(item) => item.id}
        numColumns={isWide ? 2 : 1}
        columnWrapperStyle={isWide ? styles.gridRow : undefined}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="business-outline" size={38} color={colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>No Outlets Found</Text>
            <Text style={styles.emptyDesc}>
              {searchQuery
                ? 'No authorized outlets matched your search criteria.'
                : 'No outlets are currently assigned to your account.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isSelected = activeOutlet?.id === item.id;
          const isToggling = togglingOutletId === item.id;

          return (
            <View style={[isWide && styles.gridCol]}>
              <View
                style={[
                  styles.outletCard,
                  isSelected && styles.outletCardSelected,
                  !item.isActive && styles.outletCardInactive,
                ]}
              >
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.headerInfo}>
                    <View style={styles.badgeRow}>
                      <Text style={styles.brandName}>{item.restaurantName}</Text>
                      {isSelected && (
                        <View style={styles.activeTag}>
                          <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
                          <Text style={styles.activeTagText}>CURRENT KITCHEN</Text>
                        </View>
                      )}
                      {!item.isActive && (
                        <View style={styles.disabledTag}>
                          <Text style={styles.disabledTagText}>DEACTIVATED</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.outletTitle}>{item.name}</Text>
                  </View>

                  {/* Acceptance Switch */}
                  <View style={styles.switchCol}>
                    <Text
                      style={[
                        styles.switchStatus,
                        item.isAcceptingOrders ? styles.statusOpen : styles.statusPaused,
                      ]}
                    >
                      {item.isAcceptingOrders ? 'ONLINE' : 'PAUSED'}
                    </Text>
                    <Switch
                      value={item.isAcceptingOrders}
                      onValueChange={(val) => handleToggleAcceptance(item, val)}
                      disabled={isToggling || !item.isActive}
                      trackColor={{ false: '#6B7280', true: colors.online }}
                      thumbColor={colors.textWhite}
                      ios_backgroundColor="#6B7280"
                      style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                  </View>
                </View>

                {/* Address & Meta Pills */}
                <View style={styles.metaSection}>
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
                    <Text style={styles.addressText} numberOfLines={2}>
                      {item.address}
                    </Text>
                  </View>

                  <View style={styles.tagWrap}>
                    <View style={styles.metaPill}>
                      <Ionicons name="call-outline" size={13} color={colors.textSecondary} />
                      <Text style={styles.metaPillText}>{item.phone}</Text>
                    </View>

                    <View style={styles.metaPill}>
                      <Ionicons name="bicycle-outline" size={13} color={colors.primary} />
                      <Text style={styles.metaPillText}>
                        Radius: {item.deliveryRadiusKm.toFixed(1)} km
                      </Text>
                    </View>

                    <View style={styles.metaPill}>
                      <Ionicons name="shield-checkmark-outline" size={13} color={colors.primary} />
                      <Text style={styles.metaPillText}>
                        {(item.designation || item.role).toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Action Buttons Row */}
                <View style={styles.cardActionsRow}>
                  {isSelected ? (
                    <View style={styles.currentIndicator}>
                      <Ionicons name="radio-button-on" size={15} color={colors.primary} />
                      <Text style={styles.currentIndicatorText}>Terminal Active</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.switchBtn}
                      onPress={() => handleSelectOutlet(item)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`Select outlet ${item.name}`}
                    >
                      <Ionicons name="swap-horizontal" size={15} color={colors.textWhite} />
                      <Text style={styles.switchBtnText}>Select Outlet</Text>
                    </TouchableOpacity>
                  )}

                  <View style={styles.rightActions}>
                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() => openHoursModal(item)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="View operating hours"
                    >
                      <Ionicons name="time-outline" size={16} color={colors.primary} />
                      <Text style={styles.actionIconText}>Hours</Text>
                    </TouchableOpacity>

                    {permissions.canManageOutletInfo && (
                      <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => openEditModal(item)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Edit outlet details"
                      >
                        <Ionicons name="create-outline" size={16} color={colors.primary} />
                        <Text style={styles.actionIconText}>Edit</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Direct Shortcuts if currently selected */}
                {isSelected && (
                  <View style={styles.shortcutRow}>
                    {onNavigateToKitchen && (
                      <TouchableOpacity
                        style={styles.shortcutBtn}
                        onPress={onNavigateToKitchen}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="restaurant-outline" size={14} color={colors.primary} />
                        <Text style={styles.shortcutText}>Go to Kitchen Terminal</Text>
                      </TouchableOpacity>
                    )}

                    {onNavigateToMenu && (
                      <TouchableOpacity
                        style={styles.shortcutBtn}
                        onPress={onNavigateToMenu}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="fast-food-outline" size={14} color={colors.primary} />
                        <Text style={styles.shortcutText}>Manage Menu</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Edit Outlet Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Edit Outlet Details</Text>
                <Text style={styles.modalSubtitle}>Configure contact, address & delivery radius</Text>
              </View>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {/* Outlet Name */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Outlet Name <Text style={styles.req}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, outletFieldErrors.name && styles.inputError]}
                  value={formName}
                  onChangeText={setFormName}
                  placeholder="e.g. Knowledge Park Branch"
                  placeholderTextColor={colors.textMuted}
                />
                {outletFieldErrors.name && (
                  <Text style={styles.errorText}>{outletFieldErrors.name}</Text>
                )}
              </View>

              {/* Phone */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Contact Phone <Text style={styles.req}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, outletFieldErrors.phone && styles.inputError]}
                  value={formPhone}
                  onChangeText={setFormPhone}
                  placeholder="+919876543210"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                />
                {outletFieldErrors.phone && (
                  <Text style={styles.errorText}>{outletFieldErrors.phone}</Text>
                )}
              </View>

              {/* Address */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Full Address <Text style={styles.req}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.multilineInput,
                    outletFieldErrors.address && styles.inputError,
                  ]}
                  value={formAddress}
                  onChangeText={setFormAddress}
                  placeholder="Street, locality, landmark, city"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                />
                {outletFieldErrors.address && (
                  <Text style={styles.errorText}>{outletFieldErrors.address}</Text>
                )}
              </View>

              {/* Delivery Radius */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Delivery Radius (km) <Text style={styles.req}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, outletFieldErrors.radius && styles.inputError]}
                  value={formRadius}
                  onChangeText={setFormRadius}
                  placeholder="5.0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                />
                {outletFieldErrors.radius && (
                  <Text style={styles.errorText}>{outletFieldErrors.radius}</Text>
                )}
              </View>

              {/* CTA Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setEditModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSaveOutlet}
                  disabled={savingOutlet}
                  activeOpacity={0.8}
                >
                  {savingOutlet ? (
                    <ActivityIndicator size="small" color={colors.textWhite} />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Operating Hours Modal */}
      <Modal
        visible={hoursModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHoursModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Weekly Operating Hours</Text>
                <Text style={styles.modalSubtitle}>
                  {hoursOutlet ? `${hoursOutlet.name} · Kitchen Schedule` : 'Schedule'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setHoursModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {loadingHours ? (
              <View style={styles.loadingHoursBox}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingHoursText}>Loading operating schedule...</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.scheduleScroll}>
                {schedule.map((day) => (
                  <View key={day.dayOfWeek} style={styles.dayRow}>
                    <View style={styles.dayNameCol}>
                      <Text style={styles.dayNameText}>{DAYS_OF_WEEK[day.dayOfWeek]}</Text>
                      <TouchableOpacity
                        onPress={() =>
                          updateScheduleDay(day.dayOfWeek, { isClosed: !day.isClosed })
                        }
                        style={[
                          styles.closedChip,
                          day.isClosed && styles.closedChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.closedChipText,
                            day.isClosed && styles.closedChipTextActive,
                          ]}
                        >
                          {day.isClosed ? 'CLOSED' : 'OPEN'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {!day.isClosed ? (
                      <View style={styles.timeInputsRow}>
                        <View style={styles.timeInputBox}>
                          <Text style={styles.timeLabel}>OPEN</Text>
                          <TextInput
                            style={styles.timeInput}
                            value={day.openTime}
                            onChangeText={(t) => updateScheduleDay(day.dayOfWeek, { openTime: t })}
                            placeholder="09:00"
                            placeholderTextColor={colors.textMuted}
                            maxLength={5}
                          />
                        </View>

                        <Text style={styles.timeToText}>to</Text>

                        <View style={styles.timeInputBox}>
                          <Text style={styles.timeLabel}>CLOSE</Text>
                          <TextInput
                            style={styles.timeInput}
                            value={day.closeTime}
                            onChangeText={(t) => updateScheduleDay(day.dayOfWeek, { closeTime: t })}
                            placeholder="23:00"
                            placeholderTextColor={colors.textMuted}
                            maxLength={5}
                          />
                        </View>
                      </View>
                    ) : (
                      <View style={styles.closedDayBanner}>
                        <Text style={styles.closedDayText}>Kitchen Closed for Orders</Text>
                      </View>
                    )}
                  </View>
                ))}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setHoursModalVisible(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSaveHours}
                    disabled={savingHours}
                    activeOpacity={0.8}
                  >
                    {savingHours ? (
                      <ActivityIndicator size="small" color={colors.textWhite} />
                    ) : (
                      <Text style={styles.saveBtnText}>Save Schedule</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = appStyles({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.surfaceDark,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  headerInner: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textWhite,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.limeAccent,
    fontWeight: '600',
    marginTop: 2,
  },
  searchRow: {
    marginTop: spacing.md,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    minHeight: minTouchTarget,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textWhite,
    marginLeft: spacing.sm,
  },
  filterPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: 6,
    minHeight: 38,
  },
  filterPillActive: {
    backgroundColor: colors.limeAccent,
    borderColor: colors.limeAccent,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textWhite,
  },
  filterPillTextActive: {
    color: colors.surfaceDark,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 120,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  gridRow: {
    gap: spacing.md,
  },
  gridCol: {
    flex: 1,
  },
  outletCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  outletCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  outletCardInactive: {
    opacity: 0.65,
    backgroundColor: '#FAFAF8',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerInfo: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  brandName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  activeTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 0.3,
  },
  disabledTag: {
    backgroundColor: colors.rejectedLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  disabledTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.rejectedDark,
  },
  outletTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  switchCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  switchStatus: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusOpen: {
    color: colors.online,
  },
  statusPaused: {
    color: colors.pending,
  },
  metaSection: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  addressText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    flex: 1,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 4,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
  },
  metaPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: spacing.sm,
  },
  currentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    minHeight: minTouchTarget,
  },
  currentIndicatorText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    minHeight: minTouchTarget,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    ...shadows.kpi,
  },
  switchBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textWhite,
  },
  rightActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: spacing.md,
    minHeight: minTouchTarget,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(36, 83, 63, 0.15)',
  },
  actionIconText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  shortcutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    minHeight: 38,
  },
  shortcutText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(18, 25, 21, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.modal,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  modalBody: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  formGroup: {
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  req: {
    color: colors.rejected,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    minHeight: minTouchTarget,
    fontSize: 14,
    color: colors.textPrimary,
  },
  multilineInput: {
    minHeight: 70,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.rejected,
  },
  errorText: {
    fontSize: 11,
    color: colors.rejected,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  cancelBtn: {
    paddingHorizontal: spacing.lg,
    minHeight: minTouchTarget,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  saveBtn: {
    paddingHorizontal: spacing.xl,
    minHeight: minTouchTarget,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.kpi,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textWhite,
  },
  loadingHoursBox: {
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingHoursText: {
    marginTop: spacing.md,
    fontSize: 13,
    color: colors.textSecondary,
  },
  scheduleScroll: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  dayNameCol: {
    gap: 4,
  },
  dayNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closedChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    backgroundColor: colors.surfaceGreen,
  },
  closedChipActive: {
    backgroundColor: colors.rejectedLight,
  },
  closedChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  closedChipTextActive: {
    color: colors.rejectedDark,
  },
  timeInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  timeInputBox: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  timeInput: {
    width: 60,
    height: 34,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.sm,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  timeToText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginHorizontal: 2,
  },
  closedDayBanner: {
    backgroundColor: colors.rejectedLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  closedDayText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.rejectedDark,
  },
});
