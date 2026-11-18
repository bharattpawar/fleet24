import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/tokens';
import { MapPinView } from './MapPinView';
import {
  PlaceSuggestion,
  ResolvedLocation,
  getPlaceLocation,
  isServiceable,
  newPlacesSessionToken,
  reverseGeocode,
  searchPlaces,
} from '../../api/geo';

export interface PickedAddress {
  label: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  postalCode: string;
  latitude: string;
  longitude: string;
}

export interface LocationPickerProps {
  /** Existing address being re-pinned or edited; omit to add a new one. */
  initial?: Partial<PickedAddress> & { latitude?: string; longitude?: string; needsLocationConfirmation?: boolean };
  title?: string;
  onCancel: () => void;
  onSubmit: (address: PickedAddress) => Promise<void>;
}

type Step = 'search' | 'map' | 'details';
const LABELS = ['Home', 'Work', 'Hostel', 'Other'];

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

export function LocationPicker({ initial, title, onCancel, onSubmit }: LocationPickerProps) {
  const reduceMotion = useReduceMotion();
  const sessionToken = useMemo(() => newPlacesSessionToken(), []);
  const hasUsableInitial =
    !!initial?.latitude && !!initial?.longitude && !initial?.needsLocationConfirmation;

  const [step, setStep] = useState<Step>(hasUsableInitial ? 'map' : 'search');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const [center, setCenter] = useState<{ latitude: number; longitude: number } | null>(
    hasUsableInitial ? { latitude: Number(initial!.latitude), longitude: Number(initial!.longitude) } : null,
  );
  const [recenterKey, setRecenterKey] = useState(0);
  const [resolved, setResolved] = useState<ResolvedLocation | null>(null);
  const [resolving, setResolving] = useState(false);
  const [serviceable, setServiceable] = useState<boolean | null>(null);

  const [label, setLabel] = useState(initial?.label && LABELS.includes(initial.label) ? initial.label : 'Home');
  const [flat, setFlat] = useState(initial?.addressLine1 || '');
  const [landmark, setLandmark] = useState(initial?.landmark || '');
  const [postalCode, setPostalCode] = useState(initial?.postalCode || '');
  const [city, setCity] = useState(initial?.city || '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Step transition: fade + slide up.
  const enter = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion) return;
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [step, reduceMotion, enter]);
  const stepStyle = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };

  // ---- Search (debounced) ----
  useEffect(() => {
    if (step !== 'search') return;
    const text = query.trim();
    if (text.length < 2) {
      setSuggestions([]);
      setSearchError(null);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      searchPlaces(text, sessionToken, center || undefined)
        .then((results) => active && (setSuggestions(results), setSearchError(null)))
        .catch((e) => active && setSearchError(e instanceof Error ? e.message : 'Search failed'))
        .finally(() => active && setSearching(false));
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, step, sessionToken, center]);

  // ---- Resolve the pinned point (debounced; ignores stale replies) ----
  const resolveSeq = useRef(0);
  const resolvePoint = useCallback((latitude: number, longitude: number) => {
    const seq = ++resolveSeq.current;
    setResolving(true);
    setServiceable(null);
    Promise.allSettled([reverseGeocode(latitude, longitude), isServiceable(latitude, longitude)]).then(([geo, svc]) => {
      if (seq !== resolveSeq.current) return;
      setResolving(false);
      setResolved(
        geo.status === 'fulfilled'
          ? geo.value
          : { latitude, longitude, formattedAddress: '', area: null, city: null, state: null, postalCode: null },
      );
      setServiceable(svc.status === 'fulfilled' ? svc.value : null);
    });
  }, []);

  useEffect(() => {
    if (step === 'map' && center && !resolved) resolvePoint(center.latitude, center.longitude);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const moveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleMoveEnd = (latitude: number, longitude: number) => {
    if (center && Math.abs(center.latitude - latitude) < 1e-6 && Math.abs(center.longitude - longitude) < 1e-6 && resolved) {
      return;
    }
    setCenter({ latitude, longitude });
    if (moveTimer.current) clearTimeout(moveTimer.current);
    moveTimer.current = setTimeout(() => resolvePoint(latitude, longitude), 350);
  };

  const goToPoint = (latitude: number, longitude: number, known?: ResolvedLocation) => {
    setCenter({ latitude, longitude });
    setRecenterKey((k) => k + 1);
    if (known) {
      setResolved(known);
      setServiceable(null);
      isServiceable(latitude, longitude).then(setServiceable).catch(() => setServiceable(null));
    } else {
      setResolved(null);
      resolvePoint(latitude, longitude);
    }
    setStep('map');
  };

  const pickSuggestion = async (s: PlaceSuggestion) => {
    setSearching(true);
    try {
      const place = await getPlaceLocation(s.placeId, sessionToken);
      goToPoint(place.latitude, place.longitude, place);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Could not open that place');
    } finally {
      setSearching(false);
    }
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    setSearchError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setSearchError('Location permission is off. Search for your area instead.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      goToPoint(pos.coords.latitude, pos.coords.longitude);
    } catch {
      setSearchError('Could not get your location. Search for your area instead.');
    } finally {
      setLocating(false);
    }
  };

  const confirmPin = () => {
    if (!resolved) return;
    if (!postalCode && resolved.postalCode) setPostalCode(resolved.postalCode);
    if (!city && resolved.city) setCity(resolved.city);
    setStep('details');
  };

  const save = async () => {
    if (!center || !resolved) return;
    if (!flat.trim()) {
      setSaveError('Add your house / flat / floor so the rider can find you.');
      return;
    }
    if (!/^\d{6}$/.test(postalCode.trim())) {
      setSaveError('Enter a valid 6-digit PIN code.');
      return;
    }
    if (!city.trim()) {
      setSaveError('Enter your city.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onSubmit({
        label,
        addressLine1: flat.trim(),
        addressLine2: resolved.area || resolved.formattedAddress || undefined,
        landmark: landmark.trim() || undefined,
        city: city.trim(),
        postalCode: postalCode.trim(),
        latitude: center.latitude.toFixed(7),
        longitude: center.longitude.toFixed(7),
      });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save this address');
    } finally {
      setSaving(false);
    }
  };

  const headerTitle =
    title || (step === 'details' ? 'Add address details' : step === 'map' ? 'Confirm delivery location' : 'Set delivery location');
  const back = () => (step === 'details' ? setStep('map') : step === 'map' ? setStep('search') : onCancel());

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel={step === 'search' ? 'Close' : 'Back'} style={styles.iconBtn} hitSlop={6}>
          <Ionicons name={step === 'search' ? 'close' : 'arrow-back'} size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header">{headerTitle}</Text>
        <View style={styles.iconBtn} />
      </View>

      {step === 'search' && (
        <Animated.View style={[styles.flex, stepStyle]}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search area, street or building"
              placeholderTextColor={colors.textSecondary}
              style={styles.searchInput}
              autoFocus
              returnKeyType="search"
              accessibilityLabel="Search for your delivery area"
            />
            {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          </View>

          <Pressable onPress={useCurrentLocation} disabled={locating} accessibilityRole="button"
            style={({ pressed }) => [styles.currentRow, pressed && styles.pressed]}>
            <View style={styles.currentIcon}>
              {locating ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="locate" size={20} color={colors.primary} />}
            </View>
            <View style={styles.flex}>
              <Text style={styles.currentTitle}>Use my current location</Text>
              <Text style={styles.muted}>Most accurate — uses your phone’s GPS</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>

          {searchError ? <Text style={styles.error} accessibilityRole="alert">{searchError}</Text> : null}

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.results}>
            {suggestions.map((s, index) => (
              <SuggestionRow key={s.placeId} suggestion={s} index={index} reduceMotion={reduceMotion} onPress={() => pickSuggestion(s)} />
            ))}
            {!searching && query.trim().length >= 2 && suggestions.length === 0 && !searchError ? (
              <Text style={styles.emptyText}>No places found. Try a nearby landmark or sector.</Text>
            ) : null}
          </ScrollView>
        </Animated.View>
      )}

      {step === 'map' && center && (
        <Animated.View style={[styles.flex, stepStyle]}>
          <MapPinView
            style={styles.map}
            latitude={center.latitude}
            longitude={center.longitude}
            recenterKey={recenterKey}
            onMoveStart={() => setServiceable(null)}
            onMoveEnd={handleMoveEnd}
          />
          <View style={styles.sheet}>
            <Text style={styles.hint}>Move the map to place the pin on your exact building or gate</Text>
            <View style={styles.placeRow}>
              <Ionicons name="location" size={22} color={colors.primary} />
              <View style={styles.flex}>
                {resolving || !resolved ? (
                  <Text style={styles.placeTitle}>Finding this place…</Text>
                ) : (
                  <>
                    <Text style={styles.placeTitle} numberOfLines={1}>{resolved.area || resolved.city || 'Pinned location'}</Text>
                    <Text style={styles.muted} numberOfLines={2}>{resolved.formattedAddress || `${center.latitude.toFixed(5)}, ${center.longitude.toFixed(5)}`}</Text>
                  </>
                )}
              </View>
              <Pressable onPress={() => setStep('search')} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.link}>Change</Text>
              </Pressable>
            </View>
            {serviceable === false ? (
              <View style={styles.warn} accessibilityRole="alert">
                <Ionicons name="alert-circle" size={18} color="#8C3A1C" />
                <Text style={styles.warnText}>No kitchens deliver here yet. You can still save this address.</Text>
              </View>
            ) : null}
            <Pressable
              onPress={confirmPin}
              disabled={!resolved || resolving}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primaryBtn, (!resolved || resolving) && styles.btnDisabled, pressed && styles.pressed]}
            >
              <Text style={styles.primaryBtnText}>Confirm location</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {step === 'details' && resolved && (
        <Animated.View style={[styles.flex, stepStyle]}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <View style={styles.pinnedCard}>
              <Ionicons name="location" size={20} color={colors.primary} />
              <View style={styles.flex}>
                <Text style={styles.placeTitle} numberOfLines={1}>{resolved.area || resolved.city || 'Pinned location'}</Text>
                <Text style={styles.muted} numberOfLines={2}>{resolved.formattedAddress}</Text>
              </View>
              <Pressable onPress={() => setStep('map')} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.link}>Edit pin</Text>
              </Pressable>
            </View>

            <Field label="House / flat / floor *" value={flat} onChangeText={setFlat} placeholder="e.g. Flat 402, Tower B, 4th floor" />
            <Field label="Landmark (optional)" value={landmark} onChangeText={setLandmark} placeholder="e.g. Near Gate 2" />
            <View style={styles.twoCol}>
              <View style={styles.flex}>
                <Field label="City *" value={city} onChangeText={setCity} placeholder="City" />
              </View>
              <View style={styles.flex}>
                <Field label="PIN code *" value={postalCode} onChangeText={(t) => setPostalCode(t.replace(/\D/g, '').slice(0, 6))} placeholder="6 digits" keyboardType="number-pad" />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Save as</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {LABELS.map((l) => {
                const on = l === label;
                return (
                  <Pressable key={l} onPress={() => setLabel(l)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                    style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{l}</Text>
                  </Pressable>
                );
              })}
            </View>

            {saveError ? <Text style={styles.error} accessibilityRole="alert">{saveError}</Text> : null}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable onPress={save} disabled={saving} accessibilityRole="button"
              style={({ pressed }) => [styles.primaryBtn, saving && styles.btnDisabled, pressed && styles.pressed]}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Save address</Text>}
            </Pressable>
          </View>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

function SuggestionRow({ suggestion, index, reduceMotion, onPress }: { suggestion: PlaceSuggestion; index: number; reduceMotion: boolean; onPress: () => void }) {
  const appear = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(appear, { toValue: 1, duration: 220, delay: index * 50, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [appear, index, reduceMotion]);
  return (
    <Animated.View style={{ opacity: appear, transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${suggestion.primaryText}, ${suggestion.secondaryText}`}
        style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>
        <Ionicons name="location-outline" size={20} color={colors.textSecondary} />
        <View style={styles.flex}>
          <Text style={styles.resultTitle} numberOfLines={1}>{suggestion.primaryText}</Text>
          {suggestion.secondaryText ? <Text style={styles.muted} numberOfLines={1}>{suggestion.secondaryText}</Text> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function Field(props: { label: string; value: string; onChangeText: (t: string) => void; placeholder: string; keyboardType?: 'default' | 'number-pad' }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={props.keyboardType || 'default'}
        style={styles.input}
        accessibilityLabel={props.label.replace(' *', '')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, marginBottom: 8, height: 50, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF' },
  searchInput: { flex: 1, fontSize: 15, color: colors.textPrimary, paddingVertical: 0 },
  currentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, padding: 12, borderRadius: 14, backgroundColor: '#EAF2EC', minHeight: 56 },
  currentIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  currentTitle: { fontSize: 15, fontWeight: '800', color: colors.primary },
  results: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 56, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 24 },
  map: { flex: 1 },
  sheet: { padding: 16, gap: 12, backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, boxShadow: '0px -8px 24px rgba(23, 33, 27, 0.12)' },
  hint: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textAlign: 'center' },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  placeTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  muted: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  link: { fontSize: 14, fontWeight: '800', color: colors.primary },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, backgroundColor: '#FDF3EC' },
  warnText: { flex: 1, fontSize: 13, color: '#8C3A1C', fontWeight: '600' },
  primaryBtn: { height: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  btnDisabled: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.97 }] },
  form: { padding: 16, gap: 14, paddingBottom: 32 },
  pinnedCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: '#F7F6F0' },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  input: { height: 50, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, fontSize: 15, color: colors.textPrimary, backgroundColor: '#FFFFFF' },
  twoCol: { flexDirection: 'row', gap: 12 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { height: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  chipTextOn: { color: '#FFFFFF' },
  error: { marginHorizontal: 16, fontSize: 13, fontWeight: '600', color: colors.error },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
});
