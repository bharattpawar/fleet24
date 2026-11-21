import { canVerifyOtp, otpDeadlines, secondsRemaining } from '../utils/otp';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/tokens';
import { useRestaurantAuth } from '../context/RestaurantAuthContext';
import { appStyles } from '../theme/appStyles';

export const RestaurantLoginScreen: React.FC = () => {
  const { requestOtp, verifyOtp } = useRestaurantAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [challenge, setChallenge] = useState<({ phone: string } & ReturnType<typeof otpDeadlines>) | null>(null);
  const [now, setNow] = useState(Date.now);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const devAuth = __DEV__ && process.env.EXPO_PUBLIC_DEV_AUTH_BYPASS === 'true';

  useEffect(() => {
    if (!challenge) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [challenge]);

  const sendCode = async () => {
    if (isLoading || (challenge && secondsRemaining(challenge.resendAt, Date.now()) > 0)) return;
    setError(null);
    if (!challenge && !(/^[6-9]\d{9}$/.test(phone) || (devAuth && /^\d{10}$/.test(phone)))) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }

    const targetPhone = challenge?.phone ?? `+91${phone}`;
    setIsLoading(true);
    try {
      const response = await requestOtp(targetPhone);
      const issuedAt = Date.now();
      setNow(issuedAt);
      setChallenge({ phone: targetPhone, ...otpDeadlines(response, issuedAt) });
      setOtp('');
      if (devAuth && !challenge) await verifyOtp(targetPhone, '123456');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send the verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async () => {
    if (isLoading || !challenge || !canVerifyOtp(otp, challenge.expiresAt, Date.now())) return;
    setIsLoading(true);
    setError(null);
    try {
      await verifyOtp(challenge.phone, otp);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not verify the code.');
    } finally {
      setIsLoading(false);
    }
  };

  const resendIn = challenge ? secondsRemaining(challenge.resendAt, now) : 0;
  const expiresIn = challenge ? secondsRemaining(challenge.expiresAt, now) : 0;
  const submitDisabled = isLoading || (challenge !== null && !canVerifyOtp(otp, challenge.expiresAt, now));
  const submit = challenge ? verifyCode : sendCode;
  const { width } = useWindowDimensions();
  const wide = width >= 800;

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.layout, wide && styles.layoutWide]}>
            <View style={[styles.hero, wide && styles.heroWide]}>
              <Text style={styles.wordmark}>Fleet24<Text style={styles.dot}> •</Text></Text>
              <Text style={styles.partner}>Restaurant partner</Text>
              <Text accessibilityRole="header" style={[styles.heading, wide && styles.headingWide]}>
                Sign in to your kitchen
              </Text>
            </View>
            <View style={[styles.form, wide && styles.formWide]}>

              {challenge ? (
                <>
                  <Text style={styles.intro}>Enter the verification code sent to {challenge.phone}.</Text>
                  <Text style={styles.label}>Verification code</Text>
                  <View style={styles.field}>
                    <TextInput
                      accessibilityLabel="Verification code"
                      style={styles.input}
                      value={otp}
                      onChangeText={(value) => { setOtp(value.replace(/\D/g, '').slice(0, 6)); setError(null); }}
                      keyboardType="number-pad"
                      autoComplete="one-time-code"
                      editable={!isLoading && expiresIn > 0}
                      maxLength={6}
                      onSubmitEditing={verifyCode}
                    />
                  </View>
                  <Text style={styles.label}>{expiresIn > 0 ? `Code expires in ${expiresIn}s` : 'Code expired'}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.intro}>Enter your registered mobile number.</Text>
                  <Text style={styles.label}>Mobile number</Text>
                  <View style={styles.field}>
                    <Text style={styles.prefix}>+91</Text>
                    <TextInput
                      accessibilityLabel="Mobile number"
                      style={styles.input}
                      value={phone}
                      onChangeText={value => {
                        setError(null);
                        setPhone(value.replace(/\D/g, ''));
                      }}
                      placeholder="Enter mobile number"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType={"phone-pad"}
                      autoComplete={"tel-national"}
                      editable={!isLoading}
                      maxLength={10}
                      onSubmitEditing={sendCode}
                    />
                  </View>
                </>
              )}
              {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ disabled: submitDisabled, busy: isLoading }}
                style={[styles.button, submitDisabled && styles.busy]}
                disabled={submitDisabled}
                onPress={submit}
              >
                {isLoading ? <ActivityIndicator color={colors.textWhite} /> : (
                  <>
                    <Text style={styles.buttonText}>{challenge ? 'Verify code' : 'Send code'}</Text>
                    <Ionicons name="arrow-forward" size={21} color={colors.textWhite} />
                  </>
                )}
              </TouchableOpacity>
              {challenge && (
                <>
                  <TouchableOpacity accessibilityRole="button" style={styles.link} disabled={isLoading || resendIn > 0} onPress={sendCode}>
                    <Text style={styles.linkText}>{resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" style={styles.link} disabled={isLoading} onPress={() => {
                    setChallenge(null);
                    setOtp('');
                    setError(null);
                  }}>
                    <Text style={styles.linkText}>Change mobile number</Text>
                  </TouchableOpacity>
                </>
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
  error: { color: colors.rejectedDark, marginTop: 8, fontSize: 14 },
  link: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  linkText: { color: colors.primary, textDecorationLine: 'underline', fontWeight: '600' },
});
