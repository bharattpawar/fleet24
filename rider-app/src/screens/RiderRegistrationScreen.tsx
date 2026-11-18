import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../theme/tokens';
import { useRiderAuth } from '../context/RiderAuthContext';
import {
  VEHICLE_OPTIONS,
  needsVehicleDocuments,
  toRiderProfilePayload,
  validateRiderForm,
  type RiderFormErrors,
  type RiderRegistrationForm,
} from '../utils/riderOnboarding';

interface Props {
  /** Pre-filled details when re-applying after a rejection. */
  initial?: Partial<RiderRegistrationForm>;
  /** Shown when re-applying: go back to the status screen without submitting. */
  onCancel?: () => void;
  onSubmitted?: () => void;
}

/** New rider sign-up: name, vehicle and licence. The phone number comes from the OTP login. */
export const RiderRegistrationScreen: React.FC<Props> = ({ initial, onCancel, onSubmitted }) => {
  const { registerRider, logout } = useRiderAuth();
  const [form, setForm] = useState<RiderRegistrationForm>({
    fullName: initial?.fullName ?? '',
    vehicleType: initial?.vehicleType ?? 'motorcycle',
    vehicleNumber: initial?.vehicleNumber ?? '',
    licenseNumber: initial?.licenseNumber ?? '',
  });
  const [errors, setErrors] = useState<RiderFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const docsNeeded = needsVehicleDocuments(form.vehicleType);

  const update = (patch: Partial<RiderRegistrationForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      (Object.keys(patch) as Array<keyof RiderRegistrationForm>).forEach((k) => delete next[k]);
      return next;
    });
  };

  const submit = async () => {
    if (isSubmitting) return;
    const found = validateRiderForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setIsSubmitting(true);
    setServerError(null);
    try {
      await registerRider(toRiderProfilePayload(form));
      onSubmitted?.();
    } catch (err: unknown) {
      setServerError(err instanceof Error && err.message ? err.message : 'Could not submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="bicycle" size={26} color={colors.primary} />
            </View>
            <Text style={styles.title}>{onCancel ? 'Update your details' : 'Become a Fleet24 rider'}</Text>
            <Text style={styles.subtitle}>
              Fill in your details. Our team will check them and approve your account, usually within a day.
            </Text>
          </View>

          <Text style={styles.label}>Full name</Text>
          <TextInput
            accessibilityLabel="Full name"
            style={[styles.input, errors.fullName && styles.inputError]}
            value={form.fullName}
            onChangeText={(fullName) => update({ fullName })}
            placeholder="As on your driving licence"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            maxLength={100}
          />
          {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}

          <Text style={styles.label}>Vehicle</Text>
          <View style={styles.chips}>
            {VEHICLE_OPTIONS.map((option) => {
              const selected = form.vehicleType === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityLabel={`Vehicle ${option.label}`}
                  accessibilityState={{ selected }}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => update({ vehicleType: option.value })}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Vehicle number{docsNeeded ? '' : ' (optional)'}</Text>
          <TextInput
            accessibilityLabel="Vehicle number"
            style={[styles.input, errors.vehicleNumber && styles.inputError]}
            value={form.vehicleNumber}
            onChangeText={(vehicleNumber) => update({ vehicleNumber })}
            placeholder="UP16AB1234"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
          />
          {errors.vehicleNumber && <Text style={styles.errorText}>{errors.vehicleNumber}</Text>}

          <Text style={styles.label}>Driving licence number{docsNeeded ? '' : ' (optional)'}</Text>
          <TextInput
            accessibilityLabel="Driving licence number"
            style={[styles.input, errors.licenseNumber && styles.inputError]}
            value={form.licenseNumber}
            onChangeText={(licenseNumber) => update({ licenseNumber })}
            placeholder="UP16 20230001234"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={25}
          />
          {errors.licenseNumber && <Text style={styles.errorText}>{errors.licenseNumber}</Text>}

          {serverError && (
            <View style={styles.serverError}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.serverErrorText}>{serverError}</Text>
            </View>
          )}

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Submit application"
            style={[styles.primaryBtn, isSubmitting && styles.btnDisabled]}
            onPress={submit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.textWhite} />
            ) : (
              <Text style={styles.primaryBtnText}>Submit application</Text>
            )}
          </TouchableOpacity>

          {onCancel ? (
            <TouchableOpacity accessibilityRole="button" style={styles.linkBtn} onPress={onCancel} disabled={isSubmitting}>
              <Text style={styles.linkText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity accessibilityRole="button" style={styles.linkBtn} onPress={logout} disabled={isSubmitting}>
              <Text style={styles.linkText}>Log out</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
  },
  inputError: { borderColor: colors.error },
  errorText: { fontSize: 12, color: colors.error, marginTop: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  chipTextSelected: { color: colors.textWhite },
  serverError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  serverErrorText: { flex: 1, fontSize: 13, color: colors.error },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  btnDisabled: { opacity: 0.7 },
  primaryBtnText: { fontSize: 16, fontWeight: '800', color: colors.textWhite },
  linkBtn: { alignItems: 'center', paddingVertical: spacing.lg },
  linkText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
});
