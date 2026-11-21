import { useFonts } from 'expo-font';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from './src/theme/tokens';
import { RiderAuthProvider, useRiderAuth } from './src/context/RiderAuthContext';
import { RiderHomeScreen } from './src/screens/RiderHomeScreen';
import { RiderEarningsScreen } from './src/screens/RiderEarningsScreen';
import { RiderAccountScreen } from './src/screens/RiderAccountScreen';
import { RiderLoginScreen } from './src/screens/RiderLoginScreen';
import { RiderRegistrationScreen } from './src/screens/RiderRegistrationScreen';
import { RiderApplicationStatusScreen } from './src/screens/RiderApplicationStatusScreen';
import { riderGate, type RiderVehicleType } from './src/utils/riderOnboarding';
import { StartupSplash } from './src/components/motion/StartupSplash';

type Tab = 'home' | 'earnings' | 'account';

const MainNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, isMockSession, needsRegistration, profile } = useRiderAuth();
  const [currentTab, setCurrentTab] = useState<Tab>('home');
  const [isEditingApplication, setIsEditingApplication] = useState(false);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Initializing Fleet24 Rider...</Text>
      </View>
    );
  }

  // New riders register, then wait for admin approval before reaching the rider app.
  const gate = riderGate({
    isAuthenticated,
    isMockSession,
    needsRegistration,
    isEditingApplication,
    verificationStatus: profile?.verificationStatus ?? null,
  });

  if (gate === 'login') {
    return <RiderLoginScreen />;
  }

  if (gate === 'register') {
    return (
      <RiderRegistrationScreen
        initial={
          isEditingApplication && profile
            ? {
                fullName: profile.fullName ?? '',
                vehicleType: profile.vehicleType as RiderVehicleType,
                vehicleNumber: profile.vehicleNumber ?? '',
                licenseNumber: profile.licenseNumber ?? '',
              }
            : undefined
        }
        onCancel={isEditingApplication ? () => setIsEditingApplication(false) : undefined}
        onSubmitted={() => setIsEditingApplication(false)}
      />
    );
  }

  if (gate === 'pending' || gate === 'rejected') {
    return <RiderApplicationStatusScreen onEditApplication={() => setIsEditingApplication(true)} />;
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
      <SafeAreaView edges={['bottom']} style={styles.bottomNav}>
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
          {currentTab === 'home' && <View style={styles.navIndicator} />}
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
          {currentTab === 'earnings' && <View style={styles.navIndicator} />}
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
          {currentTab === 'account' && <View style={styles.navIndicator} />}
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
};

function AppExperience({ fontsReady }: { fontsReady: boolean }) {
  const { isLoading } = useRiderAuth();
  return <View style={styles.container}><MainNavigator /><StartupSplash ready={fontsReady && !isLoading} /></View>;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSerifItalic: require('./assets/fonts/InstrumentSerif-Italic.ttf'),
    StartupRegular: require('./assets/fonts/DMSans-400.ttf'),
    StartupBold: require('./assets/fonts/DMSans-800.ttf'),
  });

  return (
    <SafeAreaProvider>
      <RiderAuthProvider>
        <AppExperience fontsReady={fontsLoaded || Boolean(fontError)} />
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
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
    paddingBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 8,
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
    minHeight: 44,
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

