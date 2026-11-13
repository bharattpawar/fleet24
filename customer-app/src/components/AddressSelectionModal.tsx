import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius } from '../theme/tokens';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';

export interface Address {
  id: string;
  label?: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city?: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  isDefault?: boolean;
}

interface AddressSelectionModalProps {
  visible: boolean;
  addresses: Address[];
  selectedAddressId: string | null;
  onSelectAddress: (address: Address) => void;
  onAddAddress: (newAddress: Omit<Address, 'id'>) => Promise<void>;
  onClose: () => void;
}

export const AddressSelectionModal: React.FC<AddressSelectionModalProps> = ({
  visible,
  addresses,
  selectedAddressId,
  onSelectAddress,
  onAddAddress,
  onClose,
}) => {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [label, setLabel] = useState('Home');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('Greater Noida');
  const [postalCode, setPostalCode] = useState('201310');
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setLabel('Home');
    setAddressLine1('');
    setAddressLine2('');
    setLandmark('');
    setCity('Greater Noida');
    setPostalCode('201310');
    setIsAddingNew(false);
  };

  const handleSave = async () => {
    if (!addressLine1.trim()) {
      Alert.alert('Required Field', 'Please enter your house/flat or street address.');
      return;
    }
    if (!postalCode.trim() || postalCode.trim().length < 6) {
      Alert.alert('Invalid PIN Code', 'Please enter a valid 6-digit postal code.');
      return;
    }

    try {
      setIsSaving(true);
      await onAddAddress({
        label: label.trim() || 'Home',
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim() || undefined,
        landmark: landmark.trim() || undefined,
        city: city.trim() || 'Greater Noida',
        postalCode: postalCode.trim(),
        // Realistic Greater Noida residential coordinates (Sector Alpha 1, ~1.8km from KP III)
        latitude: '28.4855000',
        longitude: '77.5135000',
        isDefault: addresses.length === 0,
      });
      resetForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save address';
      Alert.alert('Error', msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {isAddingNew ? 'Add Delivery Address' : 'Select Delivery Address'}
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (isAddingNew) {
                setIsAddingNew(false);
              } else {
                onClose();
              }
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {isAddingNew ? (
            <View style={styles.form}>
              <Text style={styles.inputLabel}>ADDRESS LABEL</Text>
              <View style={styles.labelChips}>
                {['Home', 'Hostel', 'Campus', 'Work'].map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tagChip, label === tag && styles.tagChipActive]}
                    onPress={() => setLabel(tag)}
                  >
                    <Text
                      style={[styles.tagText, label === tag && styles.tagTextActive]}
                    >
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>HOUSE / FLAT / BLOCK NO. *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Flat 302, Tower B or Room 14, Boys Hostel"
                placeholderTextColor={colors.textMuted}
                value={addressLine1}
                onChangeText={setAddressLine1}
              />

              <Text style={styles.inputLabel}>STREET / SOCIETY / AREA</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Stellar Mi City Homes, Knowledge Park III"
                placeholderTextColor={colors.textMuted}
                value={addressLine2}
                onChangeText={setAddressLine2}
              />

              <Text style={styles.inputLabel}>LANDMARK</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Near Pari Chowk / Opposite Sharda Gate 2"
                placeholderTextColor={colors.textMuted}
                value={landmark}
                onChangeText={setLandmark}
              />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>CITY</Text>
                  <TextInput
                    style={[styles.input, styles.disabledInput]}
                    value={city}
                    editable={false}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>PIN CODE *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="201310"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={postalCode}
                    onChangeText={setPostalCode}
                  />
                </View>
              </View>

              <Button
                title="Save & Deliver Here"
                variant="primary"
                size="lg"
                loading={isSaving}
                onPress={handleSave}
                style={{ marginTop: spacing.lg }}
              />
            </View>
          ) : (
            <View>
              {addresses.map((item) => {
                const isSelected = item.id === selectedAddressId;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.addressCard, isSelected && styles.addressCardSelected]}
                    activeOpacity={0.8}
                    onPress={() => {
                      onSelectAddress(item);
                      onClose();
                    }}
                  >
                    <View style={styles.addressLeft}>
                      <View
                        style={[
                          styles.radioCircle,
                          isSelected && styles.radioCircleActive,
                        ]}
                      >
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.labelRow}>
                          <Text style={styles.cardLabel}>{item.label || 'Saved Address'}</Text>
                          {item.isDefault && (
                            <View style={styles.defaultPill}>
                              <Text style={styles.defaultPillText}>Default</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.cardAddress1} numberOfLines={1}>
                          {item.addressLine1}
                        </Text>
                        <Text style={styles.cardAddress2} numberOfLines={2}>
                          {item.addressLine2 ? `${item.addressLine2}, ` : ''}
                          {item.landmark ? `Near ${item.landmark}, ` : ''}
                          {item.city || 'Greater Noida'} ({item.postalCode})
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={styles.addNewBtn}
                activeOpacity={0.7}
                onPress={() => setIsAddingNew(true)}
              >
                <Ionicons name="add-circle" size={20} color={colors.primary} />
                <Text style={styles.addNewText}>Add New Delivery Address</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  content: {
    padding: spacing.lg,
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  addressCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceGreen,
  },
  addressLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioCircleActive: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  defaultPill: {
    backgroundColor: '#EAF3EE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  defaultPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  cardAddress1: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  cardAddress2: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  addNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  addNewText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  form: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  labelChips: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  tagChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  tagChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tagTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.textPrimary,
  },
  disabledInput: {
    backgroundColor: colors.borderLight,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});

