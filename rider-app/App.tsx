import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from './src/theme/tokens';
import { RiderAuthProvider, useRiderAuth } from './src/context/RiderAuthContext';
import { RiderHomeScreen } from './src/screens/RiderHomeScreen';
import { RiderEarningsScreen } from './src/screens/RiderEarningsScreen';
import { RiderAccountScreen } from './src/screens/RiderAccountScreen';
import { RiderLoginScreen } from './src/screens/RiderLoginScreen';

type Tab = 'home' | 'earnings' | 'account';

const MainNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useRiderAuth();
  const [currentTab, setCurrentTab] = useState<Tab>('home');

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Initializing Fleet24 Rider...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <RiderLoginScreen />;
  }

  return (
    <View style={styles.container}>
      {/* Tab Screen Content */}
      <View style={styles.content}>
        {currentTab === 'home' && (
          <RiderHomeScreen onNavigateToTab={(tab) => setCurrentTab(tab)} />
        )}
        {currentTab === 'earnings' && <RiderEarningsScreen />}
        {currentTab === 'account' && <RiderAccountScreen />}
      </View>

      {/* 3-Tab Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        {/* Tab 1: Home */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('home')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={currentTab === 'home' ? 'map' : 'map-outline'}
            size={22}
            color={currentTab === 'home' ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.navLabel,
              currentTab === 'home' ? styles.navLabelActive : null,
            ]}
          >
            Home
          </Text>
        </TouchableOpacity>

        {/* Tab 2: Earnings */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('earnings')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={currentTab === 'earnings' ? 'wallet' : 'wallet-outline'}
            size={22}
            color={currentTab === 'earnings' ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.navLabel,
              currentTab === 'earnings' ? styles.navLabelActive : null,
            ]}
          >
            Earnings
          </Text>
        </TouchableOpacity>

        {/* Tab 3: Account */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('account')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={currentTab === 'account' ? 'person' : 'person-outline'}
            size={22}
            color={currentTab === 'account' ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.navLabel,
              currentTab === 'account' ? styles.navLabelActive : null,
            ]}
          >
            Account
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <RiderAuthProvider>
        <MainNavigator />
      </RiderAuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 10,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  navLabelActive: {
    color: colors.primary,
    fontWeight: '800',
  },
});

