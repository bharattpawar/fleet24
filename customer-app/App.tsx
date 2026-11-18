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
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { DeliveryLocationProvider } from './src/context/DeliveryLocationContext';
import { colors, exploreColors } from './src/theme/tokens';
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
  { id: 'home', label: 'Explore', icon: 'home-outline', activeIcon: 'home' },
  { id: 'orders', label: 'Orders', icon: 'clipboard-outline', activeIcon: 'clipboard' },
  { id: 'profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
];

function MainApp() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [featuredDishId, setFeaturedDishId] = useState<string>();
  const [selectedOutlet, setSelectedOutlet] = useState<OutletSummary | null>(null);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [isRiderMode, setIsRiderMode] = useState(false);
  const [isCartVisible, setIsCartVisible] = useState(false);
  const [isAuthModalVisible, setIsAuthModalVisible] = useState(false);

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

  return (
    <SafeAreaView style={[styles.container, activeTab === 'home' && !selectedOutlet && !isCartVisible && styles.exploreBackground]}>
      <StatusBar style="dark" />
      
      {/* Screen Body */}
      <View style={styles.body}>{renderContent()}</View>

      {/* Integrated Bottom Navigation Bar */}
      {!isCartVisible && !selectedOutlet && (
        <View style={styles.bottomNavBar} accessibilityRole="tablist">
          {tabs.map(({ id, label, icon, activeIcon }) => {
            const selected = activeTab === id;
            return (
              <TouchableOpacity
                key={id}
                style={styles.navTab}
                onPress={() => handleTabChange(id)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={selected ? activeIcon : icon}
                  size={22}
                  color={selected ? exploreColors.green : exploreColors.secondary}
                />
                <Text style={[styles.navLabel, selected && styles.navLabelActive]}>{label}</Text>
                <View style={[styles.navIndicator, selected && styles.navIndicatorActive]} />
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
  exploreBackground: { backgroundColor: exploreColors.background },
  bottomNavBar: {
    flexDirection: 'row',
    backgroundColor: exploreColors.background,
    borderTopWidth: 1,
    borderTopColor: exploreColors.border,
  },
  navTab: {
    flex: 1,
    minHeight: 56,
    paddingTop: 6,
    paddingBottom: 4,
    gap: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: { fontSize: 12, fontWeight: '500', color: exploreColors.secondary },
  navLabelActive: { color: exploreColors.green, fontWeight: '700' },
  navIndicator: { width: '54%', maxWidth: 72, height: 4, borderRadius: 2, marginTop: 2 },
  navIndicatorActive: { backgroundColor: exploreColors.green },
});
