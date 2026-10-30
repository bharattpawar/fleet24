import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
} from 'react-native';
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
            bottomOffset={10}
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

      {/* Floating Bottom Navigation Tab Bar respecting iOS safe area */}
      {!isCartVisible && !selectedOutlet && (
        <View
          style={[
            styles.tabBar,
            {
              paddingBottom: Math.max(insets.bottom, 6),
              height: 52 + Math.max(insets.bottom, 6),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => handleTabChange('home')}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.tabIconWrapper,
                activeTab === 'home' && styles.tabIconWrapperActive,
              ]}
            >
              <Ionicons
                name={activeTab === 'home' ? 'compass' : 'compass-outline'}
                size={20}
                color={activeTab === 'home' ? colors.primary : colors.textMuted}
              />
            </View>
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'home' && styles.tabLabelActive,
              ]}
            >
              Explore
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => handleTabChange('orders')}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.tabIconWrapper,
                activeTab === 'orders' && styles.tabIconWrapperActive,
              ]}
            >
              <Ionicons
                name={activeTab === 'orders' ? 'receipt' : 'receipt-outline'}
                size={19}
                color={activeTab === 'orders' ? colors.primary : colors.textMuted}
              />
            </View>
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'orders' && styles.tabLabelActive,
              ]}
            >
              Orders
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => handleTabChange('profile')}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.tabIconWrapper,
                activeTab === 'profile' && styles.tabIconWrapperActive,
              ]}
            >
              <Ionicons
                name={activeTab === 'profile' ? 'person' : 'person-outline'}
                size={19}
                color={activeTab === 'profile' ? colors.primary : colors.textMuted}
              />
            </View>
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'profile' && styles.tabLabelActive,
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 8,
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#202923',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapper: {
    paddingVertical: 5,
    paddingHorizontal: 16,
    borderRadius: borderRadius.full,
  },
  tabIconWrapperActive: {
    backgroundColor: colors.surfaceGreen,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 3,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
