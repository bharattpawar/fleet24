import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/tokens';
import { riderApi } from '../api/riderApi';
import { useRiderAuth } from '../context/RiderAuthContext';
import { IS_MOCK_LOGIN_ENABLED } from '../api/mockData';
import { appStyles } from '../theme/appStyles';

export const RiderLoginScreen: React.FC = () => {
  const { loginWithMock, loginWithOtp } = useRiderAuth();

  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    if (isLoading) return;
    setError(null);
    const cleanDigits = phone.replace(/[^0-9]/g, '');

    // 1. Validate that the number contains exactly 10 digits
    if (cleanDigits.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsLoading(true);

    try {
      const formattedPhone = `+91${cleanDigits}`;
      await riderApi.requestOtp(formattedPhone);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Could not authenticate. Please check connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickMock = async () => {
    if (isLoading) return;
    setError(null);
    const cleanDigits = phone.replace(/[^0-9]/g, '') || '9888847327';
    setIsLoading(true);
    try {
      await loginWithMock(cleanDigits);
    } catch {
      setError('Could not open offline preview.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (isLoading) return;
    setError(null);
    if (!otp || otp.length < 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      const cleanDigits = phone.replace(/[^0-9]/g, '');
      const formattedPhone = `+91${cleanDigits}`;
      await loginWithOtp(formattedPhone, otp);
    } catch (err: any) {
      setError(err.message || 'Incorrect verification code. Please check.');
    } finally {
      setIsLoading(false);
    }
  };

  const isOtp = step === 'otp';
  const { width } = useWindowDimensions();
  const wide = width >= 800;

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.layout, wide && styles.layoutWide]}>
            <View style={[styles.hero, wide && styles.heroWide]}>
              <Text style={styles.wordmark}>Fleet24<Text style={styles.dot}> •</Text></Text>
              <Text style={styles.partner}>Delivery partner</Text>
              <Text accessibilityRole="header" style={[styles.heading, wide && styles.headingWide]}>
                Sign in as a rider
              </Text>
            </View>
            <View style={[styles.form, wide && styles.formWide]}>
              {isOtp && (
                <TouchableOpacity accessibilityRole="button" style={styles.link} disabled={isLoading} onPress={() => {
                  setOtp('');
                  setError(null);
                  setStep('phone');
                }}>
                  <Text style={styles.linkText}>Change number</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.intro}>{isOtp ? `Enter the verification code sent to +91 ${phone}.` : 'Enter your registered mobile number.'}</Text>
              <Text style={styles.label}>{isOtp ? 'Verification code' : 'Mobile number'}</Text>
              <View style={styles.field}>
                {!isOtp && <Text style={styles.prefix}>+91</Text>}
                <TextInput
                  accessibilityLabel={isOtp ? 'Verification code' : 'Mobile number'}
                  style={styles.input}
                  value={isOtp ? otp : phone}
                  onChangeText={value => {
                    setError(null);
                    if (isOtp) setOtp(value.replace(/\D/g, ''));
                    else setPhone(value.replace(/\D/g, ''));
                  }}
                  placeholder={isOtp ? 'Enter 6-digit code' : 'Enter mobile number'}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType={isOtp ? 'number-pad' : 'phone-pad'}
                  autoComplete={isOtp ? 'one-time-code' : 'tel-national'}
                  editable={!isLoading}
                  maxLength={isOtp ? 6 : 10}
                  onSubmitEditing={isOtp ? handleVerifyOtp : handleContinue}
                />
              </View>
              {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ disabled: isLoading, busy: isLoading }}
                style={[styles.button, isLoading && styles.busy]}
                disabled={isLoading}
                onPress={isOtp ? handleVerifyOtp : handleContinue}
              >
                {isLoading ? <ActivityIndicator color={colors.textWhite} /> : (
                  <>
                    <Text style={styles.buttonText}>{isOtp ? 'Verify and sign in' : 'Continue'}</Text>
                    <Ionicons name="arrow-forward" size={21} color={colors.textWhite} />
                  </>
                )}
              </TouchableOpacity>
              {!isOtp && IS_MOCK_LOGIN_ENABLED && (
                <TouchableOpacity accessibilityRole="button" style={styles.link} disabled={isLoading} onPress={handleQuickMock}>
                  <Text style={styles.linkText}>Open offline preview</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = appStyles({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 36 },
  layout: { width: '100%', maxWidth: 460, alignSelf: 'center' },
  layoutWide: { maxWidth: 1120, flexDirection: 'row', alignItems: 'center' },
  hero: { padding: 24, paddingBottom: 28, borderRadius: 28, backgroundColor: colors.surfaceDark, overflow: 'hidden' },
  heroWide: { flex: 1, marginRight: 32, padding: 40, minHeight: 440, justifyContent: 'center' },
  wordmark: { color: '#FFFFFF', fontSize: 30, fontWeight: '900', letterSpacing: -1.2, marginBottom: 28 },
  dot: { color: colors.limeAccent, fontSize: 22 },
  partner: { alignSelf: 'flex-start', color: colors.surfaceDark, backgroundColor: colors.limeAccent, overflow: 'hidden', fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginBottom: 14 },
  heading: { color: '#FFFFFF', fontFamily: 'InstrumentSerifItalic', fontSize: 50, lineHeight: 52 },
  headingWide: { fontFamily: 'InstrumentSerifItalic', fontSize: 72, lineHeight: 72 },
  form: { marginTop: 16, padding: 20, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, boxShadow: '0px 10px 32px rgba(25,59,44,0.06)' },
  formWide: { flex: 1, marginTop: 0, padding: 32 },
  intro: { color: colors.textPrimary, fontSize: 17, lineHeight: 24, fontWeight: '600', marginBottom: 18 },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 2 },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.background },
  prefix: { color: colors.primary, fontSize: 17, fontWeight: '800', paddingHorizontal: 14, borderRightWidth: 1, borderColor: colors.border },
  input: { flex: 1, minWidth: 0, minHeight: 54, paddingHorizontal: 14, fontSize: 16, color: colors.textPrimary, borderRadius: 12 },
  button: { minHeight: 54, marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  busy: { opacity: 0.7 },
  buttonText: { color: colors.textWhite, fontSize: 17, fontWeight: '800' },
  error: { color: colors.error, marginTop: 8, fontSize: 14 },
  link: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  linkText: { color: colors.primary, textDecorationLine: 'underline', fontWeight: '600' },
});
