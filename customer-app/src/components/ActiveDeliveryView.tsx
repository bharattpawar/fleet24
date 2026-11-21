import { appStyles } from '../theme/appStyles';
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/tokens';
import { riderApi } from '../api/riderApi';

export interface ActiveDeliveryData {
  orderId: string;
  deliveryId: string;
  orderNumber: string;
  status: string; // accepted, at_restaurant, picked_up, arrived_customer, completed
  restaurant: {
    name: string;
    address: string;
    phone: string;
    latitude?: number;
    longitude?: number;
  };
  customer: {
    name: string;
    address: string;
    phone?: string;
    latitude?: number;
    longitude?: number;
  };
  items: Array<{
    name: string;
    quantity: number;
  }>;
}

interface ActiveDeliveryViewProps {
  delivery: ActiveDeliveryData;
  onStatusChanged: (newStatus: string) => void;
}

export const ActiveDeliveryView: React.FC<ActiveDeliveryViewProps> = ({
  delivery,
  onStatusChanged,
}) => {
  const [currentStatus, setCurrentStatus] = useState(delivery.status);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Navigation Deep Link launcher (Google Maps / Apple Maps)
  const openMapsNavigation = (latitude?: number, longitude?: number, label?: string) => {
    if (latitude && longitude) {
      const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
      const latLng = `${latitude},${longitude}`;
      const url = Platform.select({
        ios: `${scheme}${label}@${latLng}`,
        android: `${scheme}${latLng}(${label})`,
      });

      if (url) {
        Linking.openURL(url).catch(() => {
          Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latLng}`);
        });
      }
    } else {
      Alert.alert('Directions', `Navigating to ${label}`);
    }
  };

  // State Transition Handlers
  const handleConfirmArrivalRestaurant = async () => {
    setIsSubmitting(true);
    try {
      await riderApi.confirmArrival(delivery.orderId);
      setCurrentStatus('at_restaurant');
      onStatusChanged('at_restaurant');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmPickup = async () => {
    setIsSubmitting(true);
    try {
      await riderApi.confirmPickup(delivery.orderId);
      setCurrentStatus('picked_up');
      onStatusChanged('picked_up');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not confirm pickup.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmArrivedCustomer = async () => {
    setIsSubmitting(true);
    try {
      await riderApi.confirmArrivedCustomer(delivery.orderId);
      setCurrentStatus('arrived_customer');
      onStatusChanged('arrived_customer');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not confirm arrival.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkDelivered = async () => {
    setIsSubmitting(true);
    try {
      await riderApi.completeDelivery(delivery.orderId);
      setCurrentStatus('completed');
      onStatusChanged('completed');
      Alert.alert('Delivery Complete!', 'Order marked as delivered.');
    } catch (err: any) {
      Alert.alert('Could not mark delivered', err.message || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Order Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerRow}>
          <Text style={styles.orderNumberText}>Order #{delivery.orderNumber}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{currentStatus.replace('_', ' ').toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {/* Target Destination Card: Restaurant vs Customer */}
      {currentStatus === 'accepted' || currentStatus === 'at_restaurant' ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="restaurant" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>Pickup: {delivery.restaurant.name}</Text>
          </View>
          <Text style={styles.cardAddress}>{delivery.restaurant.address}</Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() =>
                openMapsNavigation(
                  delivery.restaurant.latitude,
                  delivery.restaurant.longitude,
                  delivery.restaurant.name,
                )
              }
            >
              <Ionicons name="navigate" size={16} color="#FFFFFF" />
              <Text style={styles.navButtonText}>Open in Maps</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.phoneButton}
              onPress={() => Linking.openURL(`tel:${delivery.restaurant.phone}`)}
            >
              <Ionicons name="call" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="home" size={20} color={colors.accent} />
            <Text style={styles.cardTitle}>Dropoff: {delivery.customer.name}</Text>
          </View>
          <Text style={styles.cardAddress}>{delivery.customer.address}</Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() =>
                openMapsNavigation(
                  delivery.customer.latitude,
                  delivery.customer.longitude,
                  delivery.customer.name,
                )
              }
            >
              <Ionicons name="navigate" size={16} color="#FFFFFF" />
              <Text style={styles.navButtonText}>Navigate to Customer</Text>
            </TouchableOpacity>

            {delivery.customer.phone && (
              <TouchableOpacity
                style={styles.phoneButton}
                onPress={() => Linking.openURL(`tel:${delivery.customer.phone}`)}
              >
                <Ionicons name="call" size={16} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Hand-over (When Arrived at Customer): rider marks delivered, or the customer taps "I got my order" */}
      {currentStatus === 'arrived_customer' && (
        <View style={styles.handoverSection}>
          <View style={styles.handoverHeader}>
            <Ionicons name="bag-check" size={18} color={colors.primary} />
            <Text style={styles.handoverTitle}>Hand over the order</Text>
          </View>
          <Text style={styles.handoverSub}>
            Mark it delivered once the customer has it. They can also confirm from their app.
          </Text>

          <TouchableOpacity
            style={styles.completeBtn}
            onPress={handleMarkDelivered}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                <Text style={styles.completeBtnText}>Mark Delivered</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Action Progression Button (State transition steps) */}
      {currentStatus === 'accepted' && (
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleConfirmArrivalRestaurant}
          disabled={isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.actionBtnText}>Confirm Arrived at Restaurant</Text>
          )}
        </TouchableOpacity>
      )}

      {currentStatus === 'at_restaurant' && (
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleConfirmPickup}
          disabled={isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.actionBtnText}>Confirm Order Pickup</Text>
          )}
        </TouchableOpacity>
      )}

      {currentStatus === 'picked_up' && (
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleConfirmArrivedCustomer}
          disabled={isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.actionBtnText}>Confirm Arrived at Customer</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = appStyles({
  container: {
    padding: spacing.md,
  },
  banner: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusBadge: {
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardAddress: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
  },
  navButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  phoneButton: {
    width: 46,
    height: 46,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handoverSection: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  handoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  handoverTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  handoverSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
  },
  completeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  actionBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});

