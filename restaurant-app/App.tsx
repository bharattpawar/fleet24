import { useFonts } from 'expo-font';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, minTouchTarget, shadows } from './src/theme/tokens';
import { RestaurantAuthProvider, useRestaurantAuth } from './src/context/RestaurantAuthContext';
import { RestaurantLoginScreen } from './src/screens/RestaurantLoginScreen';
import { RestaurantOrdersScreen } from './src/screens/RestaurantOrdersScreen';
import { RestaurantMenuScreen } from './src/screens/RestaurantMenuScreen';
import { RestaurantOutletsScreen } from './src/screens/RestaurantOutletsScreen';
import { RestaurantProfileScreen } from './src/screens/RestaurantProfileScreen';
import { RestaurantRegistrationScreen } from './src/screens/RestaurantRegistrationScreen';
import { RestaurantApplicationStatusScreen } from './src/screens/RestaurantApplicationStatusScreen';
import { restaurantGate } from './src/utils/restaurantOnboarding';

type MainTab = 'orders' | 'menu' | 'outlets' | 'profile';

const MainNavigator: React.FC = () => {
  const { width } = useWindowDimensions();
  const isWide = width >= 1000;

  const { isAuthenticated, isLoading, applicationStatus } = useRestaurantAuth();
  const [currentTab, setCurrentTab] = useState<MainTab>('orders');
  const [isEditingApplication, setIsEditingApplication] = useState(false);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIconCircle}>
          <Ionicons name="restaurant" size={32} color={colors.limeAccent} />
        </View>
        <ActivityIndicator size="large" color={colors.limeAccent} />
        <Text style={styles.loadingText}>Connecting to Fleet24 Kitchen...</Text>
      </View>
    );
  }

  // New restaurants register, then wait for admin approval before the kitchen opens.
  const gate = restaurantGate({ isAuthenticated, applicationStatus, isEditingApplication });

  if (gate === 'login') {
    return <RestaurantLoginScreen />;
  }

  if (gate === 'register') {
    return (
      <RestaurantRegistrationScreen
        onCancel={isEditingApplication ? () => setIsEditingApplication(false) : undefined}
        onSubmitted={() => setIsEditingApplication(false)}
      />
    );
  }

  if (gate !== 'app') {
    return <RestaurantApplicationStatusScreen onEditApplication={() => setIsEditingApplication(true)} />;
  }

  const navItems: Array<{ key: MainTab; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }> = [
    { key: 'orders', label: 'Kitchen', icon: 'restaurant-outline', iconActive: 'restaurant' },
    { key: 'menu', label: 'Menu & Stock', icon: 'fast-food-outline', iconActive: 'fast-food' },
    { key: 'outlets', label: 'Outlets', icon: 'storefront-outline', iconActive: 'storefront' },
    { key: 'profile', label: 'Profile', icon: 'person-outline', iconActive: 'person' },
  ];

  return (
    <SafeAreaView style={[styles.container, isWide && styles.railLayout]} edges={['top', 'left', 'right', 'bottom']}>
      {/* Desktop / Tablet Header Nav (Rendered on wide screens) */}
      {isWide && (
        <View style={styles.desktopNavBar}>
          <View style={styles.desktopNavInner}>
            <View style={styles.desktopBrandCol}>
              <View style={styles.desktopLogoBox}>
                <Ionicons name="restaurant" size={18} color={colors.limeAccent} />
              </View>
              <View>
                <Text style={styles.desktopBrandTitle}>Fleet24</Text>
                <Text style={styles.desktopBrandSub}>Restaurant Operations</Text>
              </View>
            </View>

            {/* Desktop Tabs */}
            <View style={styles.desktopTabsRow}>
              {navItems.map((tab) => {
                const isActive = currentTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.desktopTabBtn, isActive && styles.desktopTabBtnActive]}
                    onPress={() => setCurrentTab(tab.key)}
                    activeOpacity={0.8}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Ionicons
                      name={isActive ? tab.iconActive : tab.icon}
                      size={18}
                      color={isActive ? colors.primary : colors.textPrimary}
                    />
                    <Text
                      style={[
                        styles.desktopTabLabel,
                        isActive && styles.desktopTabLabelActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

          </View>
        </View>
      )}

      {/* Screen Body */}
      <View style={styles.content}>
        {currentTab === 'orders' && (
          <RestaurantOrdersScreen onNavigateToOutlets={() => setCurrentTab('outlets')} />
        )}
        {currentTab === 'menu' && (
          <RestaurantMenuScreen onNavigateToOutlets={() => setCurrentTab('outlets')} />
        )}
        {currentTab === 'outlets' && (
          <RestaurantOutletsScreen
            onOutletSelected={() => setCurrentTab('orders')}
            onNavigateToKitchen={() => setCurrentTab('orders')}
            onNavigateToMenu={() => setCurrentTab('menu')}
          />
        )}
        {currentTab === 'profile' && (
          <RestaurantProfileScreen onNavigateToOutlets={() => setCurrentTab('outlets')} />
        )}
      </View>

      {/* Mobile Bottom Navigation Bar (Rendered on screens < 768px) */}
      {!isWide && (
        <View style={styles.bottomNav}>
          {navItems.map((tab) => {
            const isActive = currentTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.navItem}
                onPress={() => setCurrentTab(tab.key)}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <View style={[styles.navIconContainer, isActive && styles.navIconActive]}>
                  <Ionicons
                    name={isActive ? tab.iconActive : tab.icon}
                    size={20}
                    color={isActive ? colors.primary : colors.textSecondary}
                  />
                </View>
                <Text
                  style={[
                    styles.navLabel,
                    isActive ? styles.navLabelActive : null,
                  ]}
                >
                  {tab.label === 'Menu & Stock' ? 'Menu' : tab.label}
                </Text>
                {isActive && <View style={styles.navIndicator} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
};

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSerifItalic: require('./assets/fonts/InstrumentSerif-Italic.ttf'),
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <RestaurantAuthProvider>
        <MainNavigator />
      </RestaurantAuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceDark,
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.surfaceDark,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.limeAccent,
  },
  loadingText: {
    color: colors.limeAccent,
    marginTop: spacing.md,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  railLayout: { flexDirection: 'row', backgroundColor: '#FFFFFF' },
  desktopNavBar: { width: 190, padding: 12, borderRightWidth: 1, borderColor: '#E2E5E3', backgroundColor: '#FFFFFF' },
  desktopNavInner: { gap: 36, paddingTop: 18 },
  desktopBrandCol: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  desktopLogoBox: { backgroundColor: colors.primary, width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  desktopBrandTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '900' },
  desktopBrandSub: { color: colors.textSecondary, fontSize: 10 },
  desktopTabsRow: { gap: 6 },
  desktopTabBtn: { flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 46, borderRadius: 8, paddingHorizontal: 10 },
  desktopTabBtnActive: { backgroundColor: colors.surfaceGreen },
  desktopTabLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  desktopTabLabelActive: { color: colors.primary, fontWeight: '800' },
  bottomNav: {
    flexDirection: 'row',
    minHeight: 62,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: Platform.OS === 'web' ? 10 : 6,
    paddingTop: 6,
    ...shadows.card,
  },
  navIndicator: {
    width: 40,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
    position: 'absolute',
    bottom: -4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: minTouchTarget,
  },
  navIconContainer: {
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  navIconActive: {
    backgroundColor: colors.surfaceGreen,
  },
  navLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: '800',
  },
});
