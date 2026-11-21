import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useRestaurantAuth } from '../context/RestaurantAuthContext';
import { onboardingApi, PlaceSuggestion } from '../api/onboardingApi';
import {
  CUISINE_OPTIONS,
  MAX_CUISINES,
  emptyRestaurantForm,
  toApplicationPayload,
  toggleCuisine,
  validateRestaurantForm,
  type RestaurantFormErrors,
  type RestaurantRegistrationForm,
} from '../utils/restaurantOnboarding';
import { appStyles } from '../theme/appStyles';

interface Props {
  /** Re-applying after a rejection: go back to the status screen without submitting. */
  onCancel?: () => void;
  onSubmitted?: () => void;
}

const newSessionToken = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** "Register your restaurant": the details Swiggy/Zomato ask for, as numbers. Admin verifies before approving. */
export const RestaurantRegistrationScreen: React.FC<Props> = ({ onCancel, onSubmitted }) => {
  const { submitApplication, myApplication, logout } = useRestaurantAuth();
  const previous = myApplication?.application ?? null;

  const [form, setForm] = useState<RestaurantRegistrationForm>(() =>
    previous
      ? {
          ...emptyRestaurantForm(),
          restaurantName: previous.restaurantName,
          cuisines: previous.cuisines,
          ownerName: previous.ownerName,
          ownerEmail: previous.ownerEmail ?? '',
          contactPhone: previous.contactPhone.replace(/^\+91/, ''),
          outletAddress: previous.outletAddress,
          latitude: previous.latitude,
          longitude: previous.longitude,
          fssaiNumber: previous.fssaiNumber,
          fssaiExpiry: previous.fssaiExpiry ?? '',
          panNumber: previous.panNumber,
          gstin: previous.gstin ?? '',
          bankAccountHolder: previous.bankAccountHolder,
          bankIfsc: previous.bankIfsc,
          // The full account number is never sent back: it has to be typed again.
        }
      : emptyRestaurantForm(),
  );
  const [errors, setErrors] = useState<RestaurantFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const update = (patch: Partial<RestaurantRegistrationForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      (Object.keys(patch) as Array<keyof RestaurantRegistrationForm>).forEach((k) => delete next[k]);
      if ('latitude' in patch) delete next.outletAddress;
      return next;
    });
  };

  const submit = async () => {
    if (isSubmitting) return;
    const found = validateRestaurantForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setServerError('Please fix the highlighted fields.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setIsSubmitting(true);
    setServerError(null);
    try {
      await submitApplication(toApplicationPayload(form));
      onSubmitted?.();
    } catch (err: unknown) {
      setServerError(err instanceof Error && err.message ? err.message : 'Could not submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const field = (
    key: keyof RestaurantRegistrationForm,
    label: string,
    props: React.ComponentProps<typeof TextInput> = {},
  ) => (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={[styles.input, errors[key] && styles.inputError]}
        value={String(form[key] ?? '')}
        onChangeText={(text) => update({ [key]: text } as Partial<RestaurantRegistrationForm>)}
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        {...props}
      />
      {errors[key] ? <Text style={styles.errorText}>{errors[key]}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="storefront" size={26} color={colors.primary} />
            </View>
            <Text style={styles.title}>{onCancel ? 'Update your application' : 'Register your restaurant'}</Text>
            <Text style={styles.subtitle}>
              Fleet24 checks these details before your restaurant goes live, usually within 2–3 working days. Keep your FSSAI licence, PAN and a cancelled cheque handy: our team may ask to see them.
            </Text>
          </View>

          {serverError ? (
            <View style={styles.serverError}>
              <Ionicons name="alert-circle" size={16} color={colors.rejected} />
              <Text style={styles.serverErrorText}>{serverError}</Text>
            </View>
          ) : null}

          <Section title="Restaurant">
            {field('restaurantName', 'Restaurant name', { placeholder: 'As customers will see it', autoCapitalize: 'words', maxLength: 100 })}
            <Text style={styles.label}>Cuisines (up to {MAX_CUISINES})</Text>
            <View style={styles.chips}>
              {CUISINE_OPTIONS.map((cuisine) => {
                const selected = form.cuisines.includes(cuisine);
                return (
                  <TouchableOpacity
                    key={cuisine}
                    accessibilityRole="button"
                    accessibilityLabel={`Cuisine ${cuisine}`}
                    accessibilityState={{ selected }}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => update({ cuisines: toggleCuisine(form.cuisines, cuisine) })}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{cuisine}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {errors.cuisines ? <Text style={styles.errorText}>{errors.cuisines}</Text> : null}
            {field('contactPhone', 'Outlet phone number', { placeholder: '10-digit mobile', keyboardType: 'phone-pad', maxLength: 13 })}
          </Section>

          <Section title="Outlet address">
            <OutletAddressSearch
              address={form.outletAddress}
              hasPin={form.latitude !== null && form.longitude !== null}
              error={errors.outletAddress}
              onPick={(place) => update({ outletAddress: place.formattedAddress, latitude: place.latitude, longitude: place.longitude })}
              onEditAddress={(outletAddress) => update({ outletAddress })}
            />
          </Section>

          <Section title="Owner">
            {field('ownerName', 'Owner full name', { autoCapitalize: 'words', maxLength: 100 })}
            {field('ownerEmail', 'Email (optional)', { keyboardType: 'email-address', autoCapitalize: 'none', maxLength: 255 })}
          </Section>

          <Section title="Licences">
            {field('fssaiNumber', 'FSSAI licence number', { placeholder: '14 digits', keyboardType: 'number-pad', maxLength: 17 })}
            {field('fssaiExpiry', 'FSSAI valid until (optional)', { placeholder: 'YYYY-MM-DD', maxLength: 10 })}
            {field('panNumber', 'PAN (business or owner)', { placeholder: 'ABCDE1234F', autoCapitalize: 'characters', maxLength: 10 })}
            {field('gstin', 'GSTIN (if registered)', { placeholder: '15 characters', autoCapitalize: 'characters', maxLength: 15 })}
          </Section>

          <Section title="Bank account for payouts">
            {field('bankAccountHolder', 'Account holder name', { autoCapitalize: 'words', maxLength: 100 })}
            {field('bankAccountNumber', 'Account number', {
              placeholder: previous ? `Re-enter (was ${previous.bankAccountNumberMasked})` : '9 to 18 digits',
              keyboardType: 'number-pad',
              maxLength: 22,
            })}
            {field('bankAccountNumberConfirm', 'Confirm account number', { keyboardType: 'number-pad', maxLength: 22 })}
            {field('bankIfsc', 'IFSC', { placeholder: 'HDFC0001234', autoCapitalize: 'characters', maxLength: 11 })}
          </Section>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Submit for review"
            style={[styles.primaryBtn, isSubmitting && styles.btnDisabled]}
            onPress={submit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? <ActivityIndicator color={colors.textWhite} /> : <Text style={styles.primaryBtnText}>Submit for review</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            style={styles.linkBtn}
            onPress={onCancel ?? logout}
            disabled={isSubmitting}
          >
            <Text style={styles.linkText}>{onCancel ? 'Back' : 'Log out'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

interface AddressSearchProps {
  address: string;
  hasPin: boolean;
  error?: string;
  onPick: (place: { latitude: number; longitude: number; formattedAddress: string }) => void;
  onEditAddress: (address: string) => void;
}

/** Search the outlet on Google (through the backend) so it gets an exact map pin; the text stays editable. */
const OutletAddressSearch: React.FC<AddressSearchProps> = ({ address, hasPin, error, onPick, onEditAddress }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const sessionToken = useMemo(() => ({ current: newSessionToken() }), []);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 3) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const results = await onboardingApi.searchPlaces(text, sessionToken.current);
        if (!cancelled) setSuggestions(results);
      } catch {
        if (!cancelled) setSearchError('Could not search right now. Check your connection and try again.');
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, sessionToken]);

  const pick = async (s: PlaceSuggestion) => {
    setIsSearching(true);
    setSearchError(null);
    try {
      const place = await onboardingApi.placeDetails(s.placeId, sessionToken.current);
      onPick(place);
      setQuery('');
      setSuggestions([]);
      sessionToken.current = newSessionToken(); // a pick ends Google's billing session
    } catch {
      setSearchError('Could not load that place. Try another result.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <View>
      <Text style={styles.label}>Search your outlet</Text>
      <View style={[styles.searchRow, error && !hasPin && styles.inputError]}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          accessibilityLabel="Search outlet address"
          style={styles.searchInput}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            if (text.trim().length < 3) setSuggestions([]);
          }}
          placeholder="Shop name, street or area"
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
        />
        {isSearching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>
      {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}
      {suggestions.map((s) => (
        <TouchableOpacity
          key={s.placeId}
          accessibilityRole="button"
          accessibilityLabel={`Use ${s.primaryText}`}
          style={styles.suggestion}
          onPress={() => pick(s)}
        >
          <Ionicons name="location-outline" size={16} color={colors.primary} />
          <View style={styles.flex}>
            <Text style={styles.suggestionTitle}>{s.primaryText}</Text>
            {s.secondaryText ? <Text style={styles.suggestionSub}>{s.secondaryText}</Text> : null}
          </View>
        </TouchableOpacity>
      ))}

      {hasPin ? (
        <View>
          <View style={styles.pinRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.ready} />
            <Text style={styles.pinText}>Location pinned. Add shop number or floor below if needed.</Text>
          </View>
          <TextInput
            accessibilityLabel="Outlet address"
            style={[styles.input, styles.multiline]}
            value={address}
            onChangeText={onEditAddress}
            multiline
            maxLength={500}
          />
        </View>
      ) : null}
      {error && !hasPin ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = appStyles({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.huge, maxWidth: 640, width: '100%', alignSelf: 'center' },
  header: { alignItems: 'center', marginBottom: spacing.lg },
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
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  label: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top', marginTop: spacing.sm },
  inputError: { borderColor: colors.rejected },
  errorText: { fontSize: 12, color: colors.rejected, marginTop: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  chipTextSelected: { color: colors.textWhite },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: spacing.md, fontSize: 16, color: colors.textPrimary },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  suggestionTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  suggestionSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  pinText: { fontSize: 12, color: colors.textGreen, flex: 1 },
  serverError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.rejectedLight,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
  },
  serverErrorText: { flex: 1, fontSize: 13, color: colors.rejectedDark },
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
