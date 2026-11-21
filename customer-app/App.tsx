import { useFonts } from 'expo-font';
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
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { EatListProvider } from './src/context/EatListContext';
import { EatListScreen } from './src/screens/EatListScreen';
import { StartupSplash } from './src/components/motion/StartupSplash';
import { CartProvider, useCart } from './src/context/CartContext';
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

type Tab = 'home' | 'eatlist' | 'orders' | 'profile';

const tabs: {
  id: 'home' | 'eatlist' | 'orders' | 'cart';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'home', label: 'Food', icon: 'fast-food-outline', activeIcon: 'fast-food' },
  { id: 'eatlist', label: 'Eat List', icon: 'bookmark-outline', activeIcon: 'bookmark' },
  { id: 'orders', label: 'Reorder', icon: 'receipt-outline', activeIcon: 'receipt' },
  { id: 'cart', label: 'Cart', icon: 'cart-outline', activeIcon: 'cart' },
];

function MainApp({ fontsReady }: { fontsReady: boolean }) {
  const { isLoading: isAuthLoading, user } = useAuth();
  const { cart } = useCart();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [navigationRequest, setNavigationRequest] = useState<{action: 'favourites' | 'food'; sequence: number}>();
  const [selectedNav, setSelectedNav] = useState('home');
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
    setSelectedNav(tab);
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
            setSelectedNav('orders');
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
            setSelectedNav('orders');
          }}
          onTrackOrder={(orderId) => {
            setIsCartVisible(false);
            setSelectedOutlet(null);
            setActiveTab('orders');
            setSelectedNav('orders');
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
            navigationRequest={navigationRequest}
            onSelectOutlet={(outlet, dishId) => { setFeaturedDishId(dishId); setSelectedOutlet(outlet); }}
            onViewCart={() => setIsCartVisible(true)}
            onRequireAuth={() => setIsAuthModalVisible(true)}
            onOpenProfile={() => handleTabChange('profile')}
            onOpenOrders={() => handleTabChange('orders')}
            onOpenFood={() => setSelectedNav('home')}
            vegMode={vegMode}
            onToggleVeg={() => setVegMode(v => !v)}
          />
        );
      }
      case 'eatlist':
        return <EatListScreen key={user?.id || 'guest'} onRequireAuth={() => setIsAuthModalVisible(true)} onExploreFood={() => handleTabChange('home')}
          onSelectOutlet={(outlet, dishId) => { setFeaturedDishId(dishId); setSelectedOutlet(outlet); }} />;
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
  const showNav = !selectedOutlet || isCartVisible;

  return (
    <EatListProvider authVisible={isAuthModalVisible} onRequireAuth={() => setIsAuthModalVisible(true)} onOpenList={() => handleTabChange('eatlist')}>
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, onHome && styles.homeTop]}>
      <StatusBar style={onHome ? 'light' : 'dark'} />

      {/* Screen Body */}
      <View style={[styles.body, !showNav && { paddingBottom: insets.bottom }]}>{renderContent()}</View>

      {/* The four customer destinations; checkout stays above the navigation. */}
      {showNav && (
        <View style={[styles.bottomNavBar, { paddingBottom: Math.max(insets.bottom, 6) }]} accessibilityRole="tablist" accessibilityLabel="Main navigation">
          {tabs.map(({ id, label, icon, activeIcon }) => {
            const selected = isCartVisible ? id === 'cart' : selectedNav === id;
            return (
              <TouchableOpacity
                key={id}
                style={styles.navTab}
                onPress={() => {
                  if (id === 'cart') {
                    if (isCartVisible) return;
                    setIsRiderMode(false); setTrackingOrderId(null); setSelectedOutlet(null); setIsCartVisible(true);
                    return;
                  }
                  if (id === 'home') {
                    handleTabChange('home');
                    setNavigationRequest({ action: 'food', sequence: Date.now() });
                    setSelectedNav(id);
                  } else handleTabChange(id);
                }}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected }}
                aria-selected={selected}
                activeOpacity={0.7}
              >
                <View style={[styles.navIcon, selected && styles.navIconActive]}>
                  <Ionicons name={selected ? activeIcon : icon} size={23} color={selected ? home.accent : colors.textSecondary} />
                  {id === 'cart' && Boolean(cart?.itemCount) && <View style={styles.cartCount}><Text style={styles.cartCountText}>{Math.min(cart!.itemCount, 99)}</Text></View>}
                </View>
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
      <StartupSplash ready={fontsReady && !isAuthLoading} />
    </SafeAreaView>
    </EatListProvider>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    HomeRegular: require('./assets/fonts/DMSans-400.ttf'),
    HomeMedium: require('./assets/fonts/DMSans-600.ttf'),
    HomeBold: require('./assets/fonts/DMSans-800.ttf'),
  });
  return (
    <SafeAreaProvider style={{ backgroundColor: '#FFFFFF' }}>
      <AuthProvider>
        <CartProvider>
          <DeliveryLocationProvider>
            <MainApp fontsReady={fontsLoaded || Boolean(fontError)} />
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
    width: '100%',
  },
  body: {
    flex: 1,
  },
  homeTop: { backgroundColor: home.headerTop, paddingTop: Platform.OS === 'web' ? 8 : 0 },
  bottomNavBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    boxShadow: '0px -2px 10px rgba(25, 59, 44, 0.06)',
  },
  navTab: {
    flex: 1,
    minHeight: 64,
    paddingTop: 7,
    paddingBottom: 5,
    gap: 3,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  navIcon: { minWidth: 52, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  navIconActive: { backgroundColor: colors.surfaceGreen },
  cartCount: { position: 'absolute', right: 1, top: -2, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: colors.primary, borderWidth: 1, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  cartCountText: { color: '#FFFFFF', fontSize: 9, lineHeight: 12, fontFamily: 'HomeBold' },
  navLabel: { fontSize: 11, fontFamily: 'HomeMedium', fontWeight: '600', color: colors.textSecondary },
  navLabelActive: { color: home.accent, fontFamily: 'HomeBold', fontWeight: '800' },
  navIndicator: { width: 34, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, marginBottom: 6 },
  navIndicatorActive: { backgroundColor: home.accent },
});
