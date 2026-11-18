import { useServiceAreas } from '../context/DeliveryLocationContext';
import React, { useState, useEffect, useEffectEvent } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { colors, spacing, typography, borderRadius } from '../theme/tokens';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { USE_MOCK_DATA } from '../api/mockData';

// Ensure WebBrowser finishes auth redirects if invoked via web modal
WebBrowser.maybeCompleteAuthSession();

// Google Web / Expo OAuth Client ID
const GOOGLE_CLIENT_ID = '840348382677-6loj3nm3cmkhafhdfs2ejlho1ibbquph.apps.googleusercontent.com';

const GOOGLE_DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

const DEFAULT_REDIRECT_URI =
  Platform.OS === 'web'
    ? (typeof globalThis !== 'undefined' && 'location' in globalThis && (globalThis as any).location?.origin) ||
      'http://localhost:8081'
    : 'https://auth.expo.io/@bharattpawar/fleet24';

interface AuthModalScreenProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AuthModalScreen: React.FC<AuthModalScreenProps> = ({ onClose, onSuccess }) => {
  const serviceAreas = useServiceAreas();
  const { requestOtp, verifyOtp, loginWithGoogle } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'main' | 'otp' | 'linkPhone'>('main');
  const [cooldown, setCooldown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stable auth config with required OpenID Connect nonce to prevent render loops on web and native
  const [authConfig] = useState(
    () => ({
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.IdToken,
      usePKCE: false,
      redirectUri: DEFAULT_REDIRECT_URI,
      extraParams: {
        nonce: Math.random().toString(36).substring(2, 15),
      },
    }),
  );

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    authConfig,
    GOOGLE_DISCOVERY,
  );

  const handleGoogleToken = useEffectEvent(async (idToken: string) => {
    try {
      setIsGoogleLoading(true);
      setErrorMessage(null);
      const result = await loginWithGoogle(idToken);
      if (result.needsPhoneVerification) {
        setStep('linkPhone');
      } else {
        onSuccess();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google authentication failed';
      setErrorMessage(msg);
      if (Platform.OS === 'web') window.alert(`Sign-In Failed: ${msg}`);
      else Alert.alert('Sign-In Failed', msg);
    } finally {
      setIsGoogleLoading(false);
    }
  });

  // Handle incoming OAuth response
  useEffect(() => {
    void Promise.resolve().then(() => {
      if (response?.type === 'success' && response.params?.id_token) {
        handleGoogleToken(response.params.id_token);
      } else if (response?.type === 'error') {
        setIsGoogleLoading(false);
        const msg = response.error?.message || 'Failed to authenticate with Google';
        setErrorMessage(msg);
        if (Platform.OS === 'web') window.alert(`Google Sign-In Error: ${msg}`);
        else Alert.alert('Google Sign-In Error', msg);
      } else if (response?.type === 'dismiss' || response?.type === 'cancel') {
        setIsGoogleLoading(false);
      }
    });
  }, [response]);

  const handleTriggerGoogleAuth = async () => {
    if (USE_MOCK_DATA) {
      // In mock mode, emulate instantaneous smooth Google login
      setIsGoogleLoading(true);
      setTimeout(async () => {
        try {
          await loginWithGoogle('mock-google-id-token');
          setIsGoogleLoading(false);
          onSuccess();
        } catch {
          setIsGoogleLoading(false);
        }
      }, 500);
      return;
    }

    try {
      setIsGoogleLoading(true);
      setErrorMessage(null);

      // On native Expo Go, route through the AuthSession proxy start endpoint
      // so auth.expo.io sets the `ru` session cookie needed to route back to Expo Go.
      if (Platform.OS !== 'web' && request) {
        const rawAuthUrl = await request.makeAuthUrlAsync(GOOGLE_DISCOVERY);
        const returnUrl = AuthSession.getDefaultReturnUrl();
        const startUrl = `https://auth.expo.io/@bharattpawar/fleet24/start?${new URLSearchParams({
          authUrl: rawAuthUrl,
          returnUrl,
        }).toString()}`;

        const res = await promptAsync({ url: startUrl });
        if (res.type !== 'success') {
          setIsGoogleLoading(false);
        }
      } else {
        const res = await promptAsync();
        if (res.type !== 'success') {
          setIsGoogleLoading(false);
        }
      }
    } catch (err: unknown) {
      setIsGoogleLoading(false);
      const msg = err instanceof Error ? err.message : 'Could not launch Google Sign-In';
      setErrorMessage(msg);
      if (Platform.OS === 'web') window.alert(`Sign-In Error: ${msg}`);
      else Alert.alert('Sign-In Error', msg);
    }
  };

  /**
   * One-Tap Quick Demo Customer Login
   * Instantly authenticates as verified Demo Customer with bypass 123456
   */
  const handleQuickDemoLogin = async () => {
    if (!__DEV__) return;
    const targetPhone = '+919876543210';
    setIsLoading(true);
    setErrorMessage(null);
    try {
      try {
        await requestOtp(targetPhone);
      } catch {
        // Cooldown or existing challenge is acceptable
      }
      await verifyOtp(targetPhone, '123456');
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Demo customer login failed';
      setErrorMessage(msg);
      if (Platform.OS === 'web') window.alert(`Sign-In Failed: ${msg}`);
      else Alert.alert('Sign-In Failed', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (isLinkStep = false) => {
    const digits = phone.replace(/[^0-9]/g, '');
    const cleaned = digits.length >= 10 ? digits.slice(-10) : digits;

    if (cleaned.length !== 10) {
      const msg = 'Please enter a valid 10-digit mobile number.';
      setErrorMessage(msg);
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Invalid Phone', msg);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await requestOtp(cleaned);
      setCooldown(res.cooldownSeconds || 60);
      setStep('otp');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send OTP';
      setErrorMessage(msg);
      if (Platform.OS === 'web') window.alert(`Error: ${msg}`);
      else Alert.alert('Error', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      const msg = 'Please enter the 6-digit verification code.';
      setErrorMessage(msg);
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Invalid OTP', msg);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      const digits = phone.replace(/[^0-9]/g, '');
      const cleaned = digits.length >= 10 ? digits.slice(-10) : digits;
      await verifyOtp(cleaned, cleanOtp);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid code';
      setErrorMessage(msg);
      if (Platform.OS === 'web') window.alert(`Verification Failed: ${msg}`);
      else Alert.alert('Verification Failed', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

      <View style={styles.content}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>FLEET24</Text>
          </View>
          <View style={styles.regionBadge}>
            <Ionicons name="location-sharp" size={11} color={colors.primary} />
            <Text style={styles.regionText}>{serviceAreas}</Text>
          </View>
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={colors.error} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {step === 'main' && (
          <>
            <Text style={styles.title}>Welcome to Fleet24</Text>
            <Text style={styles.subtitle}>
              Fast, hot meals from your favorite campus & neighborhood outlets.
            </Text>

            {/* Quick Demo Customer Sign-In (1-Tap Fast Testing) — development builds only */}
            {__DEV__ && (
            <TouchableOpacity
              style={styles.demoLoginButton}
              onPress={handleQuickDemoLogin}
              disabled={isLoading || isGoogleLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="flash" size={18} color="#FFFFFF" />
                  <Text style={styles.demoLoginButtonText}>
                    ⚡ Quick Demo Login (+91 9876543210)
                  </Text>
                </>
              )}
            </TouchableOpacity>
            )}

            {/* Google Sign-In Primary / One-Tap Button */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleTriggerGoogleAuth}
              disabled={isGoogleLoading || isLoading}
              activeOpacity={0.85}
            >
              {isGoogleLoading ? (
                <ActivityIndicator size="small" color={colors.textPrimary} />
              ) : (
                <>
                  <View style={styles.googleIconContainer}>
                    <Ionicons name="logo-google" size={18} color="#EA4335" />
                  </View>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with phone</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Phone Input */}
            <View style={styles.inputContainer}>
              <View style={styles.countryCode}>
                <Text style={styles.flagEmoji}>🇮🇳</Text>
                <Text style={styles.codeText}>+91</Text>
              </View>
              <TextInput
                placeholder="10-digit mobile number"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                maxLength={14}
                value={phone}
                onChangeText={(text) => {
                  const digits = text.replace(/[^0-9]/g, '');
                  const last10 = digits.length > 10 ? digits.slice(-10) : digits;
                  setPhone(last10);
                }}
                style={styles.input}
              />
            </View>

            <Button
              title="Send Verification Code"
              onPress={() => handleSendOtp(false)}
              loading={isLoading}
              size="lg"
              style={styles.submitBtn}
            />

            <Text style={styles.termsText}>
              By continuing, you agree to Fleet24{' '}
              <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>.
            </Text>
          </>
        )}

        {step === 'linkPhone' && (
          <>
            <Text style={styles.title}>Link Phone Number</Text>
            <Text style={styles.subtitle}>
              Riders and restaurants need a mobile number to contact you regarding deliveries in {serviceAreas}.
            </Text>

            <View style={styles.inputContainer}>
              <View style={styles.countryCode}>
                <Text style={styles.flagEmoji}>🇮🇳</Text>
                <Text style={styles.codeText}>+91</Text>
              </View>
              <TextInput
                placeholder="10-digit mobile number"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                maxLength={14}
                value={phone}
                onChangeText={(text) => {
                  const digits = text.replace(/[^0-9]/g, '');
                  const last10 = digits.length > 10 ? digits.slice(-10) : digits;
                  setPhone(last10);
                }}
                style={styles.input}
                autoFocus
              />
            </View>

            <Button
              title="Send OTP to Link Phone"
              onPress={() => handleSendOtp(true)}
              loading={isLoading}
              size="lg"
              style={styles.submitBtn}
            />

            <TouchableOpacity
              onPress={() => onSuccess()}
              style={styles.skipBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'otp' && (
          <>
            <Text style={styles.title}>Enter 6-Digit Code</Text>
            <Text style={styles.subtitle}>
              Sent to +91 {phone}.{' '}
              <Text style={styles.editLink} onPress={() => setStep('main')}>
                Edit
              </Text>
            </Text>

            {/* Quick Autofill Dev Code Button — development builds only */}
            {__DEV__ && (
              <TouchableOpacity
                style={styles.autofillDevBtn}
                onPress={() => setOtp('123456')}
                activeOpacity={0.8}
              >
                <Ionicons name="key" size={14} color="#166534" />
                <Text style={styles.autofillDevText}>⚡ Tap to autofill test OTP: 123456</Text>
              </TouchableOpacity>
            )}

            <View style={styles.otpInputContainer}>
              <TextInput
                placeholder="000000"
                placeholderTextColor={colors.border}
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={setOtp}
                style={styles.otpInput}
                autoFocus
              />
            </View>

            <Button
              title="Verify & Continue"
              onPress={handleVerifyOtp}
              loading={isLoading}
              size="lg"
              style={styles.submitBtn}
            />

            <TouchableOpacity
              onPress={() => handleSendOtp(false)}
              disabled={isLoading}
              style={styles.resendBtn}
            >
              <Text style={styles.resendText}>Resend OTP</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    alignItems: 'flex-end',
  },
  closeBtn: {
    padding: spacing.xs,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  logoBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
  },
  logoText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.8,
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EBF4EF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  regionText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 19,
    marginBottom: spacing.xl,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    height: 52,
    paddingHorizontal: spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  googleIconContainer: {
    marginRight: 10,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  editLink: {
    color: colors.primary,
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    height: 52,
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    height: '100%',
    gap: 6,
    backgroundColor: '#FAF9F5',
  },
  flagEmoji: {
    fontSize: 16,
  },
  codeText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  otpInputContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  otpInput: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 10,
    textAlign: 'center',
    color: colors.primary,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    width: 220,
  },
  submitBtn: {
    marginTop: spacing.lg,
  },
  skipBtn: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  skipText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  termsText: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 16,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '700',
  },
  resendBtn: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  resendText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  demoLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15803D',
    borderRadius: borderRadius.lg,
    height: 50,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: 8,
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  demoLoginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  autofillDevBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: borderRadius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'center',
    marginBottom: spacing.md,
    gap: 6,
  },
  autofillDevText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: borderRadius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: spacing.md,
    gap: 8,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
});
