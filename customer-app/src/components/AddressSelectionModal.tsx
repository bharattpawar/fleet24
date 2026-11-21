import { appStyles } from '../theme/appStyles';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { colors, spacing, borderRadius } from '../theme/tokens';
import { Ionicons } from '@expo/vector-icons';
import { LocationPicker, PickedAddress } from './location/LocationPicker';

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
  /** Set by the API for addresses saved before map pinning; they must be re-pinned before checkout. */
  needsLocationConfirmation?: boolean;
  /** False when the address is outside every active service area (orders are blocked there). */
  isServiceable?: boolean;
  serviceZoneName?: string | null;
}

interface AddressSelectionModalProps {
  visible: boolean;
  addresses: Address[];
  selectedAddressId: string | null;
  onSelectAddress: (address: Address) => void;
  onAddAddress: (newAddress: Omit<Address, 'id'>) => Promise<void>;
  /** Saves a re-pinned/edited address. Without it, unconfirmed addresses cannot be re-pinned here. */
  onUpdateAddress?: (addressId: string, changes: Partial<Omit<Address, 'id'>>) => Promise<Address>;
  /** Open straight into re-pinning this address (e.g. checkout found an unconfirmed location). */
  repinAddress?: Address | null;
  onClose: () => void;
}

export const AddressSelectionModal: React.FC<AddressSelectionModalProps> = ({
  visible,
  addresses,
  selectedAddressId,
  onSelectAddress,
  onAddAddress,
  onUpdateAddress,
  repinAddress,
  onClose,
}) => {
  const [picker, setPicker] = useState<null | { mode: 'create' } | { mode: 'repin'; address: Address }>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (visible && repinAddress && onUpdateAddress) setPicker({ mode: 'repin', address: repinAddress });
      if (!visible) setPicker(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [visible, repinAddress, onUpdateAddress]);

  const closeAll = () => {
    setPicker(null);
    onClose();
  };

  const handlePicked = async (picked: PickedAddress) => {
    if (picker?.mode === 'repin' && onUpdateAddress) {
      const updated = await onUpdateAddress(picker.address.id, picked);
      onSelectAddress(updated);
    } else {
      await onAddAddress({ ...picked, isDefault: addresses.length === 0 });
    }
    closeAll();
  };

  const handleTapAddress = (item: Address) => {
    if (item.needsLocationConfirmation && onUpdateAddress) {
      setPicker({ mode: 'repin', address: item });
      return;
    }
    onSelectAddress(item);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => (picker ? setPicker(null) : onClose())}
    >
      {picker ? (
        <LocationPicker
          initial={picker.mode === 'repin' ? picker.address : undefined}
          title={picker.mode === 'repin' ? 'Confirm delivery location' : undefined}
          onCancel={() => setPicker(null)}
          onSubmit={handlePicked}
        />
      ) : (
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle} accessibilityRole="header">Select delivery address</Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <TouchableOpacity
              style={styles.addNewBtn}
              activeOpacity={0.7}
              accessibilityRole="button"
              onPress={() => setPicker({ mode: 'create' })}
            >
              <Ionicons name="add-circle" size={20} color={colors.primary} />
              <Text style={styles.addNewText}>Add new address</Text>
            </TouchableOpacity>

            {addresses.map((item) => {
              const isSelected = item.id === selectedAddressId;
              const needsPin = !!item.needsLocationConfirmation;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.addressCard, isSelected && styles.addressCardSelected]}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityHint={needsPin ? 'Opens the map to confirm this address location' : undefined}
                  onPress={() => handleTapAddress(item)}
                >
                  <View style={styles.addressLeft}>
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.labelRow}>
                        <Text style={styles.cardLabel}>{item.label || 'Saved address'}</Text>
                        {item.isDefault && (
                          <View style={styles.defaultPill}>
                            <Text style={styles.defaultPillText}>Default</Text>
                          </View>
                        )}
                        {needsPin && (
                          <View style={styles.confirmPill}>
                            <Ionicons name="location" size={12} color="#8C3A1C" />
                            <Text style={styles.confirmPillText}>Confirm location</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.cardAddress1} numberOfLines={1}>
                        {item.addressLine1}
                      </Text>
                      <Text style={styles.cardAddress2} numberOfLines={2}>
                        {item.addressLine2 ? `${item.addressLine2}, ` : ''}
                        {item.landmark ? `Near ${item.landmark}, ` : ''}
                        {[item.city, item.postalCode].filter(Boolean).join(' ')}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </Modal>
  );
};

const styles = appStyles({
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FDF3EC',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  confirmPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8C3A1C',
  },
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

