import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/tokens';
import { riderApi } from '../api/riderApi';
import { useRiderAuth } from '../context/RiderAuthContext';
import { IS_MOCK_LOGIN_ENABLED } from '../api/mockData';

export const RiderLoginScreen: React.FC = () => {
  const { loginWithMock, loginWithOtp } = useRiderAuth();

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Action Handler for Continue / Submit
   * In Development (Mock Enabled): Validates 10 digits and immediately starts mock session without OTP.
   * In Production (Real Auth): Requests real SMS OTP from backend.
   */
  const handleContinue = async () => {
    const cleanDigits = phone.replace(/[^0-9]/g, '');

    // 1. Validate that the number contains exactly 10 digits
    if (cleanDigits.length !== 10) {
      Alert.alert('Invalid Mobile Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsLoading(true);

    try {
      const formattedPhone = `+91${cleanDigits}`;
      await riderApi.requestOtp(formattedPhone);
      setStep('otp');
    } catch (err: any) {
      Alert.alert('Sign In Failed', err.message || 'Could not authenticate. Please check connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickMock = async () => {
    const cleanDigits = phone.replace(/[^0-9]/g, '') || '9888847327';
    setIsLoading(true);
    try {
      await loginWithMock(cleanDigits);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Real OTP Verification Handler (preserved intact for future integration)
   */
  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      const cleanDigits = phone.replace(/[^0-9]/g, '');
      const formattedPhone = `+91${cleanDigits}`;
      await loginWithOtp(formattedPhone, otp);
    } catch (err: any) {
      Alert.alert('Verification Failed', err.message || 'Incorrect verification code. Please check.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          {/* Logo & Brand Header */}
          <View style={styles.brandContainer}>
            <View style={styles.logoBadge}>
              <Ionicons name="bicycle" size={32} color={colors.textWhite} />
            </View>
            <Text style={styles.brandTitle}>FLEET24</Text>
            <View style={styles.riderTag}>
              <Text style={styles.riderTagText}>RIDER PARTNER PORTAL</Text>
            </View>
            <Text style={styles.brandDesc}>
              Logistics & Delivery Operations • Greater Noida
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {step === 'phone' ? (
              <>
                <Text style={styles.formTitle}>Rider Sign In</Text>
                <Text style={styles.formSub}>
                  Enter your registered mobile number to continue.
                </Text>

                <View style={styles.inputContainer}>
                  <Text style={styles.prefixText}>+91</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter 10-digit mobile number"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={phone}
                    onChangeText={setPhone}
                    autoFocus
                  />
                </View>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleContinue}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color={colors.textWhite} />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>CONTINUE</Text>
                      <Ionicons name="arrow-forward" size={18} color={colors.textWhite} />
                    </>
                  )}
                </TouchableOpacity>

                {IS_MOCK_LOGIN_ENABLED && (
                  <TouchableOpacity
                    style={{ marginTop: 12, alignItems: 'center', padding: 8 }}
                    onPress={handleQuickMock}
                  >
                    <Text style={{ fontSize: 12, color: colors.textSecondary, textDecorationLine: 'underline' }}>
                      Offline Preview Mode (Simulated Data)
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.backButton} onPress={() => setStep('phone')}>
                  <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
                  <Text style={styles.backButtonText}>Change number</Text>
                </TouchableOpacity>

                <Text style={styles.formTitle}>Verify Mobile OTP</Text>
                <Text style={styles.formSub}>
                  Enter the 6-digit verification code sent to +91 {phone}
                </Text>

                <View style={styles.inputContainer}>
                  <Ionicons name="key-outline" size={20} color={colors.textSecondary} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter 6-digit OTP (123456 in dev)"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otp}
                    onChangeText={setOtp}
                    autoFocus
                  />
                </View>

                <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 12, textAlign: 'center' }}>
                  Dev master bypass code: <Text style={{ fontWeight: '700', color: colors.primary }}>123456</Text>
                </Text>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleVerifyOtp}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color={colors.textWhite} />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>VERIFY & SIGN IN</Text>
                      <Ionicons name="checkmark-circle" size={18} color={colors.textWhite} />
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Footer Notice */}
          <Text style={styles.footerText}>
            Greater Noida Pilot Program • Fleet24 Partner Network
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surfaceDark,
  },
  keyboardContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textWhite,
    letterSpacing: 1,
  },
  riderTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.xs,
    marginTop: 6,
  },
  riderTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.surfaceGreen,
    letterSpacing: 0.8,
  },
  brandDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: spacing.sm,
    fontWeight: '500',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.md,
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  formSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: borderRadius.md,
    height: 54,
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  prefixText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textWhite,
    letterSpacing: 0.5,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: spacing.xxl,
  },
});
