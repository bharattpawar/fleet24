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

type MainTab = 'orders' | 'menu' | 'outlets' | 'profile';

const MainNavigator: React.FC = () => {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const { isAuthenticated, isLoading, activeOutlet } = useRestaurantAuth();
  const [currentTab, setCurrentTab] = useState<MainTab>('orders');

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

  if (!isAuthenticated) {
    return <RestaurantLoginScreen />;
  }

  const navItems: Array<{ key: MainTab; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }> = [
    { key: 'orders', label: 'Kitchen', icon: 'restaurant-outline', iconActive: 'restaurant' },
    { key: 'menu', label: 'Menu & Stock', icon: 'fast-food-outline', iconActive: 'fast-food' },
    { key: 'outlets', label: 'Outlets', icon: 'storefront-outline', iconActive: 'storefront' },
    { key: 'profile', label: 'Partner Profile', icon: 'person-outline', iconActive: 'person' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Desktop / Tablet Header Nav (Rendered on wide screens) */}
      {isWide && (
        <View style={styles.desktopNavBar}>
          <View style={styles.desktopNavInner}>
            <View style={styles.desktopBrandCol}>
              <View style={styles.desktopLogoBox}>
                <Ionicons name="restaurant" size={18} color={colors.limeAccent} />
              </View>
              <View>
                <Text style={styles.desktopBrandTitle}>FLEET24</Text>
                <Text style={styles.desktopBrandSub}>Kitchen Display & Terminal</Text>
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
                      color={isActive ? colors.surfaceDark : colors.textWhite}
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

            {/* Active Outlet Quick Tag */}
            <TouchableOpacity
              style={styles.desktopOutletPill}
              onPress={() => setCurrentTab('outlets')}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.desktopOutletDot,
                  activeOutlet?.isAcceptingOrders ? styles.dotOpen : styles.dotPaused,
                ]}
              />
              <Text style={styles.desktopOutletName} numberOfLines={1}>
                {activeOutlet?.name || 'Select Outlet'}
              </Text>
            </TouchableOpacity>
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
                  {tab.label === 'Menu & Stock' ? 'Menu' : tab.label === 'Partner Profile' ? 'Profile' : tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
};

export default function App() {
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
  desktopNavBar: {
    backgroundColor: colors.surfaceDark,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  desktopNavInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  desktopBrandCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  desktopLogoBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.limeAccent,
  },
  desktopBrandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textWhite,
    letterSpacing: 1.5,
  },
  desktopBrandSub: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.limeAccent,
  },
  desktopTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  desktopTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.xs + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    minHeight: minTouchTarget,
  },
  desktopTabBtnActive: {
    backgroundColor: colors.limeAccent,
  },
  desktopTabLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textWhite,
  },
  desktopTabLabelActive: {
    color: colors.surfaceDark,
    fontWeight: '800',
  },
  desktopOutletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    maxWidth: 200,
  },
  desktopOutletDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotOpen: {
    backgroundColor: colors.online,
  },
  dotPaused: {
    backgroundColor: colors.pending,
  },
  desktopOutletName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.limeAccent,
  },
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
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: '800',
  },
});
