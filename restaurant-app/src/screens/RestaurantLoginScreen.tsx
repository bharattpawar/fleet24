import React, { useState } from 'react';
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

export const RestaurantLoginScreen: React.FC = () => {
  const { loginWithPhoneOnly } = useRestaurantAuth();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    if (loading) return;
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    try {
      await loginWithPhoneOnly(`+91${cleaned}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to authenticate. Please check phone number.');
    } finally {
      setLoading(false);
    }
  };

  const isLoading = loading;
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
                  onSubmitEditing={handleLogin}
                />
              </View>
              {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ disabled: isLoading, busy: isLoading }}
                style={[styles.button, isLoading && styles.busy]}
                disabled={isLoading}
                onPress={handleLogin}
              >
                {isLoading ? <ActivityIndicator color={colors.textWhite} /> : (
                  <>
                    <Text style={styles.buttonText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={21} color={colors.textWhite} />
                  </>
                )}
              </TouchableOpacity>
              {__DEV__ && (
                <TouchableOpacity accessibilityRole="button" style={styles.link} disabled={isLoading} onPress={() => {
                  setPhone('9876543210');
                  setError(null);
                }}>
                  <Text style={styles.linkText}>Use test number</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 36 },
  layout: { width: '100%', maxWidth: 460, alignSelf: 'center' },
  layoutWide: { maxWidth: 1120, flexDirection: 'row', alignItems: 'center' },
  hero: { paddingBottom: 28, borderBottomWidth: 1, borderColor: colors.border },
  heroWide: { flex: 1, paddingRight: 40, paddingBottom: 12, borderBottomWidth: 0 },
  wordmark: { color: colors.primary, fontSize: 34, fontWeight: '900', letterSpacing: -1.4, marginBottom: 24 },
  dot: { color: colors.primary, fontSize: 22 },
  partner: { color: colors.primary, fontSize: 16, fontWeight: '600', marginBottom: 8 },
  heading: { color: colors.primary, fontFamily: 'InstrumentSerifItalic', fontSize: 56, lineHeight: 55 },
  headingWide: { fontSize: 78, lineHeight: 76 },
  form: { paddingTop: 26 },
  formWide: { flex: 1, borderLeftWidth: 1, borderColor: colors.border, paddingLeft: 40, paddingVertical: 20 },
  intro: { color: colors.primary, fontSize: 19, lineHeight: 27, marginBottom: 22 },
  label: { color: colors.primary, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.primary, borderRadius: 12, backgroundColor: colors.surface },
  prefix: { color: colors.primary, fontSize: 17, fontWeight: '800', paddingHorizontal: 14, borderRightWidth: 1, borderColor: colors.border },
  input: { flex: 1, minWidth: 0, minHeight: 54, paddingHorizontal: 14, fontSize: 16, color: colors.textPrimary, borderRadius: 12 },
  button: { minHeight: 54, marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  busy: { opacity: 0.7 },
  buttonText: { color: colors.textWhite, fontSize: 17, fontWeight: '800' },
  error: { color: colors.rejectedDark, marginTop: 8, fontSize: 14 },
  link: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  linkText: { color: colors.primary, textDecorationLine: 'underline', fontWeight: '600' },
});
