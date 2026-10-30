import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, typography, borderRadius } from '../theme/tokens';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { QuantityStepper } from '../components/QuantityStepper';
import { apiRequest } from '../api/client';
import { USE_MOCK_DATA, MOCK_ADDRESSES, MOCK_ORDERS } from '../api/mockData';
import { Address, AddressSelectionModal } from '../components/AddressSelectionModal';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { API_BASE_URL } from '../api/client';
import {
  ConfirmedOrderDetails,
  OrderConfirmationModal,
} from '../components/OrderConfirmationModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Ensures in-app browser handles complete auth/checkout sessions properly
WebBrowser.maybeCompleteAuthSession();

interface CartScreenProps {
  onBack: () => void;
  onOrderSuccess: (orderId: string) => void;
  onRequireAuth?: () => void;
}

export const CartScreen: React.FC<CartScreenProps> = ({
  onBack,
  onOrderSuccess,
  onRequireAuth,
}) => {
  const insets = useSafeAreaInsets();
  const { cart, updateQuantity, removeItem, clearCart, fetchCart } = useCart();
  const { isAuthenticated } = useAuth();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [customerInstructions, setCustomerInstructions] = useState('');
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);

  // Confirmed order modal state
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrderDetails | null>(null);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  // Fetch addresses
  const loadAddresses = async () => {
    if (USE_MOCK_DATA) {
      setAddresses(MOCK_ADDRESSES);
      const defaultAddr = MOCK_ADDRESSES.find((a) => a.isDefault) || MOCK_ADDRESSES[0];
      setSelectedAddress(defaultAddr || null);
      return;
    }

    if (!isAuthenticated) return;

    try {
      setIsLoadingAddresses(true);
      const data = await apiRequest<Address[]>('/users/addresses');
      setAddresses(data || []);
      if (data && data.length > 0) {
        const defaultAddr = data.find((a) => a.isDefault) || data[0];
        setSelectedAddress(defaultAddr);
      } else {
        setSelectedAddress(null);
      }
    } catch {
      setAddresses([]);
    } finally {
      setIsLoadingAddresses(false);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, [isAuthenticated]);

  const handleAddNewAddress = async (newAddressDto: Omit<Address, 'id'>) => {
    if (USE_MOCK_DATA) {
      const mockCreated: Address = {
        id: `addr-mock-${Date.now()}`,
        ...newAddressDto,
      };
      const updated = [mockCreated, ...addresses];
      setAddresses(updated);
      setSelectedAddress(mockCreated);
      return;
    }

    const created = await apiRequest<Address>('/users/addresses', {
      method: 'POST',
      body: JSON.stringify(newAddressDto),
    });
    const updated = [created, ...addresses];
    setAddresses(updated);
    setSelectedAddress(created);
  };

  if (!cart || cart.items.length === 0) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: Math.max(insets.top, 14) }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onBack} style={styles.navIconButton}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Your Cart</Text>
          <View style={{ width: 38 }} />
        </View>

        <View style={styles.emptyContent}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="cart-outline" size={44} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>
            Browse our favourite neighbourhood kitchens in Greater Noida and add delicious artisanal food!
          </Text>
          <TouchableOpacity style={styles.exploreBtn} activeOpacity={0.85} onPress={onBack}>
            <Text style={styles.exploreBtnText}>Browse Restaurants</Text>
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleCheckout = async () => {
    if (!isAuthenticated && !USE_MOCK_DATA) {
      if (onRequireAuth) {
        onRequireAuth();
      } else {
        Alert.alert('Sign In Required', 'Please sign in to place your order.');
      }
      return;
    }

    if (!selectedAddress) {
      setIsAddressModalOpen(true);
      return;
    }

    try {
      setIsPlacingOrder(true);

      if (USE_MOCK_DATA) {
        setTimeout(async () => {
          setIsPlacingOrder(false);
          const mockOrderNum = `FLT-${new Date().getFullYear()}-${Math.floor(
            1000 + Math.random() * 9000,
          )}`;
          const mockId = `ord-mock-${Date.now()}`;

          const createdSummary: ConfirmedOrderDetails = {
            id: mockId,
            orderNumber: mockOrderNum,
            status: 'pending_payment',
            totalPayable: cart.totalPayable.toFixed(2),
            itemTotal: cart.itemTotal.toFixed(2),
            deliveryFee: cart.deliveryFee.toFixed(2),
            taxAmount: cart.taxAmount.toFixed(2),
            restaurantName: cart.restaurantName,
            outletName: cart.outletName,
            deliveryAddress: {
              label: selectedAddress.label,
              addressLine1: selectedAddress.addressLine1,
              addressLine2: selectedAddress.addressLine2,
              city: selectedAddress.city,
              postalCode: selectedAddress.postalCode,
            },
            itemCount: cart.itemCount,
            placedAt: new Date().toISOString(),
            paymentStatus: 'pending',
            customerInstructions: customerInstructions.trim() || undefined,
          };

          // Append to mock orders list so it immediately appears in the Orders tab
          MOCK_ORDERS.unshift({
            id: mockId,
            orderNumber: mockOrderNum,
            restaurantName: cart.restaurantName,
            outletName: cart.outletName,
            status: 'pending_payment',
            totalPayable: cart.totalPayable.toFixed(2),
            itemCount: cart.itemCount,
            createdAt: new Date().toISOString(),
          });

          await clearCart();
          setConfirmedOrder(createdSummary);
          setIsConfirmationOpen(true);
        }, 600);
        return;
      }

      // 1. Live Backend Order Creation (pending_payment)
      const order = await apiRequest<{
        id: string;
        orderNumber: string;
        status: string;
        itemTotal: string;
        deliveryFee: string;
        taxAmount: string;
        discountAmount: string;
        totalPayable: string;
        deliveryAddressSnapshot: Address;
        placedAt: string;
        paymentStatus: string;
      }>('/orders', {
        method: 'POST',
        body: JSON.stringify({
          deliveryAddressId: selectedAddress.id,
          customerInstructions: customerInstructions.trim() || undefined,
          idempotencyKey: `ord_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        }),
      });

      // Clear local/backend cart state now that order is safely created
      await fetchCart();

      // 2. Request Payment Session for Razorpay
      let paymentSession: {
        orderId: string;
        orderNumber: string;
        razorpayOrderId: string;
        keyId: string;
        amount: number;
        currency: string;
        status: string;
        checkoutUrl?: string;
      };

      try {
        paymentSession = await apiRequest(`/orders/${order.id}/payment-session`, {
          method: 'POST',
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to initialize payment session';
        Alert.alert(
          'Payment Notice',
          `${msg}. Your order #${order.orderNumber} is saved under Orders. You can pay from there.`,
          [{ text: 'View Orders', onPress: () => onOrderSuccess(order.id) }],
        );
        return;
      }

      // 3. Launch Razorpay Checkout in WebBrowser
      const returnUrl = Linking.createURL('payment-callback');
      const checkoutEndpoint = `${API_BASE_URL}/payments/checkout/${order.id}?returnUrl=${encodeURIComponent(returnUrl)}`;

      let browserResult: WebBrowser.WebBrowserAuthSessionResult;
      try {
        browserResult = await WebBrowser.openAuthSessionAsync(checkoutEndpoint, returnUrl);
      } catch (launchErr: unknown) {
        const msg = launchErr instanceof Error ? launchErr.message : 'Browser launch failed';
        Alert.alert('Checkout Notice', `${msg}. You can complete payment later from Orders.`);
        onOrderSuccess(order.id);
        return;
      }

      // 4. Verify Gateway Callback Result
      if (browserResult.type === 'success' && browserResult.url) {
        const parsed = Linking.parse(browserResult.url);
        const params = parsed.queryParams || {};

        if (params.status === 'cancelled') {
          Alert.alert(
            'Payment Incomplete',
            `Order #${order.orderNumber} is saved in your orders. You can complete payment whenever you are ready.`,
            [{ text: 'View Orders', onPress: () => onOrderSuccess(order.id) }],
          );
          return;
        }

        const rzpPaymentId = params.razorpay_payment_id as string;
        const rzpOrderId = (params.razorpay_order_id as string) || paymentSession.razorpayOrderId;
        const rzpSignature = params.razorpay_signature as string;

        if (!rzpPaymentId || !rzpSignature) {
          Alert.alert(
            'Verifying Payment',
            'We did not receive a direct callback signature. Checking order status with the server...',
          );
          onOrderSuccess(order.id);
          return;
        }

        // 5. Submit to Backend for Authoritative HMAC Verification
        try {
          const verifyResult = await apiRequest<{
            verified: boolean;
            orderId: string;
            orderNumber: string;
            orderStatus: string;
            paymentId: string;
            paymentStatus: string;
            amount: string;
          }>('/payments/verify', {
            method: 'POST',
            body: JSON.stringify({
              razorpayOrderId: rzpOrderId,
              razorpayPaymentId: rzpPaymentId,
              razorpaySignature: rzpSignature,
            }),
          });

          if (verifyResult.verified && verifyResult.orderStatus === 'placed') {
            const confirmedSummary: ConfirmedOrderDetails = {
              id: order.id,
              orderNumber: order.orderNumber,
              status: 'placed',
              totalPayable: order.totalPayable,
              itemTotal: order.itemTotal,
              deliveryFee: order.deliveryFee,
              taxAmount: order.taxAmount,
              restaurantName: cart.restaurantName,
              outletName: cart.outletName,
              deliveryAddress: {
                label: order.deliveryAddressSnapshot.label,
                addressLine1: order.deliveryAddressSnapshot.addressLine1,
                addressLine2: order.deliveryAddressSnapshot.addressLine2,
                city: order.deliveryAddressSnapshot.city,
                postalCode: order.deliveryAddressSnapshot.postalCode,
              },
              itemCount: cart.itemCount,
              placedAt: order.placedAt,
              paymentStatus: 'captured',
              customerInstructions: customerInstructions.trim() || undefined,
            };

            setConfirmedOrder(confirmedSummary);
            setIsConfirmationOpen(true);
            return;
          }
        } catch (verifyErr: unknown) {
          const msg = verifyErr instanceof Error ? verifyErr.message : 'Verification failed';
          Alert.alert(
            'Payment Verification Notice',
            `${msg}. If money was debited, your order will update automatically via webhook.`,
            [{ text: 'View Orders', onPress: () => onOrderSuccess(order.id) }],
          );
          return;
        }
      } else {
        // User closed the browser session manually
        Alert.alert(
          'Checkout Dismissed',
          `Order #${order.orderNumber} is pending payment. You can pay from the Orders tab whenever you're ready.`,
          [{ text: 'View Orders', onPress: () => onOrderSuccess(order.id) }],
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Checkout failed';
      Alert.alert('Checkout Notice', msg);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 14) }]}>
        <TouchableOpacity onPress={onBack} style={styles.navIconButton}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Cart ({cart.itemCount})</Text>
        <TouchableOpacity onPress={clearCart} style={styles.clearBtn} activeOpacity={0.7}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Restaurant Header */}
        <View style={styles.outletBox}>
          <View style={styles.outletIconCircle}>
            <Ionicons name="restaurant" size={17} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.outletName}>{cart.restaurantName}</Text>
            <Text style={styles.outletAddress}>{cart.outletName}</Text>
          </View>
          <View style={styles.etaPill}>
            <Ionicons name="time-outline" size={12} color={colors.primary} />
            <Text style={styles.etaPillText}>30 min</Text>
          </View>
        </View>

        {/* Delivery Address Selector Card */}
        <View style={styles.sectionCard}>
          <View style={styles.addressHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="location" size={15} color={colors.primary} />
              <Text style={styles.sectionHeader}>DELIVER TO</Text>
            </View>
            <TouchableOpacity onPress={() => setIsAddressModalOpen(true)} activeOpacity={0.7}>
              <Text style={styles.changeActionText}>
                {selectedAddress ? 'Change' : 'Select'}
              </Text>
            </TouchableOpacity>
          </View>

          {isLoadingAddresses ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 8 }} />
          ) : selectedAddress ? (
            <TouchableOpacity
              style={styles.selectedAddressPreview}
              activeOpacity={0.7}
              onPress={() => setIsAddressModalOpen(true)}
            >
              <View style={styles.selectedAddressBadge}>
                <Text style={styles.selectedAddressBadgeText}>
                  {selectedAddress.label || 'Home'}
                </Text>
              </View>
              <Text style={styles.selectedAddress1} numberOfLines={1}>
                {selectedAddress.addressLine1}
              </Text>
              <Text style={styles.selectedAddress2} numberOfLines={1}>
                {selectedAddress.addressLine2 ? `${selectedAddress.addressLine2}, ` : ''}
                {selectedAddress.city || 'Greater Noida'} ({selectedAddress.postalCode})
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.noAddressBox}
              activeOpacity={0.8}
              onPress={() => setIsAddressModalOpen(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.noAddressText}>Add or select a delivery address</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Item Rows */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>ORDER ITEMS</Text>
          {cart.items.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.itemRow,
                index === cart.items.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.itemPrice}>₹{item.unitPrice.toFixed(0)} each</Text>
              </View>

              <View style={styles.itemActions}>
                <QuantityStepper
                  quantity={item.quantity}
                  onIncrement={() => updateQuantity(item.id, item.quantity + 1)}
                  onDecrement={() => {
                    if (item.quantity <= 1) {
                      removeItem(item.id);
                    } else {
                      updateQuantity(item.id, item.quantity - 1);
                    }
                  }}
                />
                <Text style={styles.itemTotalText}>₹{item.totalPrice.toFixed(0)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Delivery / Kitchen Instructions */}
        <View style={styles.sectionCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Ionicons name="create-outline" size={15} color={colors.primary} />
            <Text style={styles.sectionHeader}>COOKING / DELIVERY NOTES</Text>
          </View>
          <TextInput
            style={styles.instructionsInput}
            placeholder="e.g. Call upon arrival, leave at hostel reception, less spicy"
            placeholderTextColor={colors.textMuted}
            value={customerInstructions}
            onChangeText={setCustomerInstructions}
            maxLength={120}
          />
        </View>

        {/* Bill Summary */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>BILL BREAKDOWN</Text>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item Total</Text>
            <Text style={styles.billValue}>₹{cart.itemTotal.toFixed(0)}</Text>
          </View>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery Partner Fee</Text>
            <Text style={styles.billValue}>₹{cart.deliveryFee.toFixed(0)}</Text>
          </View>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Govt Taxes (GST 5%)</Text>
            <Text style={styles.billValue}>₹{cart.taxAmount.toFixed(0)}</Text>
          </View>

          <View style={[styles.billRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>To Pay</Text>
            <Text style={styles.totalValue}>₹{cart.totalPayable.toFixed(0)}</Text>
          </View>
        </View>

        {/* Payment Policy Notice */}
        <View style={styles.noticeBox}>
          <Ionicons name="shield-checkmark" size={16} color={colors.accent} />
          <Text style={styles.noticeText}>
            Fleet24 orders are 100% secure. You can pay seamlessly via UPI, Cards or NetBanking.
          </Text>
        </View>
      </ScrollView>

      {/* Sticky Bottom Checkout Action */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <View style={styles.bottomTotalCol}>
          <Text style={styles.bottomLabel}>TOTAL PAYABLE</Text>
          <Text style={styles.bottomTotal}>₹{cart.totalPayable.toFixed(0)}</Text>
        </View>

        <TouchableOpacity
          style={styles.checkoutBtn}
          activeOpacity={0.88}
          disabled={isPlacingOrder}
          onPress={handleCheckout}
        >
          {isPlacingOrder ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.checkoutBtnText}>
                {selectedAddress ? 'Proceed to Pay' : 'Select Address'}
              </Text>
              <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Address Selection Modal */}
      <AddressSelectionModal
        visible={isAddressModalOpen}
        addresses={addresses}
        selectedAddressId={selectedAddress?.id || null}
        onSelectAddress={(addr) => setSelectedAddress(addr)}
        onAddAddress={handleAddNewAddress}
        onClose={() => setIsAddressModalOpen(false)}
      />

      {/* Order Confirmation Modal */}
      <OrderConfirmationModal
        visible={isConfirmationOpen}
        order={confirmedOrder}
        onViewOrders={() => {
          setIsConfirmationOpen(false);
          if (confirmedOrder) {
            onOrderSuccess(confirmedOrder.id);
          }
        }}
        onClose={() => {
          setIsConfirmationOpen(false);
          onBack();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm + 4,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    zIndex: 10,
  },
  navIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  topTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  clearBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  clearText: {
    fontSize: 13,
    color: colors.error,
    fontWeight: '700',
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  outletBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  outletIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outletName: {
    fontSize: 15.5,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  outletAddress: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  etaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  etaPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.md + 2,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  addressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  changeActionText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.primary,
  },
  selectedAddressPreview: {
    marginTop: spacing.xs,
    paddingTop: 4,
  },
  selectedAddressBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginBottom: 4,
  },
  selectedAddressBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  selectedAddress1: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  selectedAddress2: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  noAddressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.sm,
    marginTop: 4,
  },
  noAddressText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  instructionsInput: {
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 9,
    fontSize: 13,
    color: colors.textPrimary,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  itemInfo: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  itemPrice: {
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  itemTotalText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.textPrimary,
    minWidth: 45,
    textAlign: 'right',
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  billLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  billValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.sm + 2,
    marginTop: spacing.xs,
  },
  totalLabel: {
    fontSize: 15.5,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.primary,
  },
  noticeBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: '#FAF3E8',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#EBD7BE',
    alignItems: 'center',
  },
  noticeText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 16.5,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 8,
  },
  bottomTotalCol: {
    flexDirection: 'column',
  },
  bottomLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  bottomTotal: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: borderRadius.full,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  checkoutBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
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
  emptyTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 13.5,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 19,
    maxWidth: 280,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: borderRadius.full,
    marginTop: spacing.lg,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 3,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
