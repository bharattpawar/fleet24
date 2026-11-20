import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
} from 'react-native';

// Polyfill Alert.alert on Web for cross-platform prompt/confirm consistency
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = ((
    title?: string | null,
    message?: string | null,
    buttons?: Array<{ text?: string; onPress?: () => void; style?: string }>,
  ) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    if (buttons && buttons.length > 1) {
      const confirmBtn = buttons.find((b) => b.style !== 'cancel') || buttons[1];
      const cancelBtn = buttons.find((b) => b.style === 'cancel') || buttons[0];
      const confirmed = window.confirm(text);
      if (confirmed) {
        confirmBtn?.onPress?.();
      } else {
        cancelBtn?.onPress?.();
      }
    } else {
      window.alert(text);
      buttons?.[0]?.onPress?.();
    }
  }) as any;
}
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { DeliveryLocationProvider } from './src/context/DeliveryLocationContext';
import { colors } from './src/theme/tokens';
import { home } from './src/theme/homeTheme';
import { OutletSummary } from './src/components/RestaurantCard';

// Screens
import { HomeScreen } from './src/screens/HomeScreen';
import { RestaurantDetailScreen } from './src/screens/RestaurantDetailScreen';
import { CartScreen } from './src/screens/CartScreen';
import { OrdersScreen } from './src/screens/OrdersScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { AuthModalScreen } from './src/screens/AuthModalScreen';
import { DeliveryTrackingScreen } from './src/screens/DeliveryTrackingScreen';
import { RiderDashboardScreen } from './src/screens/RiderDashboardScreen';

type Tab = 'home' | 'orders' | 'profile';

const tabs: {
  id: Tab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'home', label: 'Food', icon: 'fast-food-outline', activeIcon: 'fast-food' },
  { id: 'orders', label: 'Reorder', icon: 'receipt-outline', activeIcon: 'receipt' },
  { id: 'profile', label: 'Account', icon: 'person-circle-outline', activeIcon: 'person-circle' },
];

function MainApp() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [featuredDishId, setFeaturedDishId] = useState<string>();
  const [selectedOutlet, setSelectedOutlet] = useState<OutletSummary | null>(null);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [isRiderMode, setIsRiderMode] = useState(false);
  const [isCartVisible, setIsCartVisible] = useState(false);
  const [isAuthModalVisible, setIsAuthModalVisible] = useState(false);
  // Veg mode is shared by Home and restaurant menus for the whole session.
  const [vegMode, setVegMode] = useState(false);
  const insets = useSafeAreaInsets();

  // Handle Tab Switch
  const handleTabChange = (tab: Tab) => {
    // If we're deep in an outlet screen or cart, reset to standard tab screen
    setSelectedOutlet(null);
    setTrackingOrderId(null);
    setIsRiderMode(false);
    setIsCartVisible(false);
    setActiveTab(tab);
  };

  // Render current primary view
  const renderContent = () => {
    if (isRiderMode) {
      return (
        <RiderDashboardScreen
          onBackToCustomerMode={() => setIsRiderMode(false)}
        />
      );
    }

    if (trackingOrderId) {
      return (
        <DeliveryTrackingScreen
          onViewOrders={() => {
            setTrackingOrderId(null);
            setActiveTab('orders');
          }}
          orderId={trackingOrderId}
          onBack={() => setTrackingOrderId(null)}
        />
      );
    }

    if (isCartVisible) {
      return (
        <CartScreen
          onBack={() => setIsCartVisible(false)}
          onRequireAuth={() => setIsAuthModalVisible(true)}
          onViewOrders={() => {
            setIsCartVisible(false);
            setSelectedOutlet(null);
            setActiveTab('orders');
          }}
          onTrackOrder={(orderId) => {
            setIsCartVisible(false);
            setSelectedOutlet(null);
            setActiveTab('orders');
            setTrackingOrderId(orderId);
          }}
        />
      );
    }

    if (selectedOutlet) {
      return (
        <RestaurantDetailScreen
          key={selectedOutlet.id}
          featuredDishId={featuredDishId}
          outlet={selectedOutlet}
          onBack={() => setSelectedOutlet(null)}
          onViewCart={() => setIsCartVisible(true)}
          onRequireAuth={() => setIsAuthModalVisible(true)}
          vegOnly={vegMode}
          onToggleVegOnly={() => setVegMode(v => !v)}
        />
      );
    }

    switch (activeTab) {
      case 'home': {
        return (
          <HomeScreen
            onSelectOutlet={(outlet, dishId) => { setFeaturedDishId(dishId); setSelectedOutlet(outlet); }}
            onViewCart={() => setIsCartVisible(true)}
            onRequireAuth={() => setIsAuthModalVisible(true)}
            onOpenProfile={() => handleTabChange('profile')}
            onOpenOrders={() => handleTabChange('orders')}
            vegMode={vegMode}
            onToggleVeg={() => setVegMode(v => !v)}
          />
        );
      }
      case 'orders':
        return (
          <OrdersScreen
            onRequireAuth={() => setIsAuthModalVisible(true)}
            onExploreFood={() => handleTabChange('home')}
            onTrackOrder={(orderId) => setTrackingOrderId(orderId)}
          />
        );
      case 'profile':
        return (
          <ProfileScreen
            onRequireAuth={() => setIsAuthModalVisible(true)}
            onOpenRiderDashboard={() => setIsRiderMode(true)}
          />
        );
    }
  };

  const onHome = activeTab === 'home' && !selectedOutlet && !isCartVisible && !trackingOrderId && !isRiderMode;
  const showNav = !isCartVisible && !selectedOutlet;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, onHome && styles.homeTop]}>
      <StatusBar style={onHome ? 'light' : 'dark'} />

      {/* Screen Body */}
      <View style={[styles.body, !showNav && { paddingBottom: insets.bottom }]}>{renderContent()}</View>

      {/* Bottom navigation: fixed, white, orange for the current tab */}
      {showNav && (
        <View style={[styles.bottomNavBar, { paddingBottom: Math.max(insets.bottom, 6) }]} accessibilityRole="tablist">
          {tabs.map(({ id, label, icon, activeIcon }) => {
            const selected = activeTab === id;
            return (
              <TouchableOpacity
                key={id}
                style={styles.navTab}
                onPress={() => handleTabChange(id)}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected }}
                activeOpacity={0.7}
              >
                <View style={[styles.navIndicator, selected && styles.navIndicatorActive]} />
                <Ionicons name={selected ? activeIcon : icon} size={24} color={selected ? home.accent : '#6B6E78'} />
                <Text style={[styles.navLabel, selected && styles.navLabelActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Auth Modal Overlay */}
      <Modal
        visible={isAuthModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsAuthModalVisible(false)}
      >
        <AuthModalScreen
          onClose={() => setIsAuthModalVisible(false)}
          onSuccess={() => setIsAuthModalVisible(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <DeliveryLocationProvider>
            <MainApp />
          </DeliveryLocationProvider>
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
  },
  homeTop: { backgroundColor: home.headerTop },
  bottomNavBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D9DAE0',
    boxShadow: '0px -2px 10px rgba(16, 25, 79, 0.06)',
  },
  navTab: {
    flex: 1,
    minHeight: 58,
    paddingTop: 0,
    paddingBottom: 4,
    gap: 2,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  navLabel: { fontSize: 11, fontWeight: '600', color: '#6B6E78' },
  navLabelActive: { color: home.accent, fontWeight: '800' },
  navIndicator: { width: 34, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, marginBottom: 6 },
  navIndicatorActive: { backgroundColor: home.accent },
});
