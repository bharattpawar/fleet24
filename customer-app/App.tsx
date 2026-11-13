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
import { colors, spacing, typography, borderRadius } from './src/theme/tokens';
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

function MainApp() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('home');
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
          onOrderSuccess={(orderId) => {
            setIsCartVisible(false);
            setSelectedOutlet(null);
            if (orderId) {
              setTrackingOrderId(orderId);
            } else {
              setActiveTab('orders');
            }
          }}
        />
      );
    }

    if (selectedOutlet) {
      return (
        <RestaurantDetailScreen
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
            onSelectOutlet={(outlet) => setSelectedOutlet(outlet)}
            onViewCart={() => setIsCartVisible(true)}
            onRequireAuth={() => setIsAuthModalVisible(true)}
            onOpenProfile={() => handleTabChange('profile')}
            bottomOffset={62 + Math.max(insets.bottom, 6)}
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
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Screen Body */}
      <View style={styles.body}>{renderContent()}</View>

      {/* Integrated Bottom Navigation Bar */}
      {!isCartVisible && !selectedOutlet && (
        <View
          style={[
            styles.bottomNavBar,
            {
              paddingBottom: Math.max(insets.bottom, 6),
              height: 54 + Math.max(insets.bottom, 6),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.navTab}
            onPress={() => handleTabChange('home')}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.navIconContainer,
                activeTab === 'home' && styles.navIconContainerActive,
              ]}
            >
              <Ionicons
                name={activeTab === 'home' ? 'compass' : 'compass-outline'}
                size={21}
                color={activeTab === 'home' ? colors.primary : colors.textSecondary}
              />
            </View>
            <Text
              style={[
                styles.navLabel,
                activeTab === 'home' && styles.navLabelActive,
              ]}
            >
              Explore
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navTab}
            onPress={() => handleTabChange('orders')}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.navIconContainer,
                activeTab === 'orders' && styles.navIconContainerActive,
              ]}
            >
              <Ionicons
                name={activeTab === 'orders' ? 'receipt' : 'receipt-outline'}
                size={20}
                color={activeTab === 'orders' ? colors.primary : colors.textSecondary}
              />
            </View>
            <Text
              style={[
                styles.navLabel,
                activeTab === 'orders' && styles.navLabelActive,
              ]}
            >
              Orders
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navTab}
            onPress={() => handleTabChange('profile')}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.navIconContainer,
                activeTab === 'profile' && styles.navIconContainerActive,
              ]}
            >
              <Ionicons
                name={activeTab === 'profile' ? 'person' : 'person-outline'}
                size={20}
                color={activeTab === 'profile' ? colors.primary : colors.textSecondary}
              />
            </View>
            <Text
              style={[
                styles.navLabel,
                activeTab === 'profile' && styles.navLabelActive,
              ]}
            >
              Profile
            </Text>
          </TouchableOpacity>
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
          <MainApp />
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
  bottomNavBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 6,
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: colors.charcoal,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 8,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconContainer: {
    paddingVertical: 4,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconContainerActive: {
    backgroundColor: colors.surfaceGreen,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 2,
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
