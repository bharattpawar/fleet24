import { appStyles } from '../../theme/appStyles';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Platform,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HomeImage } from './HomeImage';
import { FeedAction, FeedSection, FeedShortcut, targetAction } from '../../utils/homeFeed';
import { fallbackArt } from '../../utils/imageRef';
import { home } from '../../theme/homeTheme';

const G = home.gutter;

/* ------------------------------------------------------------------ location */

export function LocationRow({ title, subtitle, onPickLocation, avatarLetter, onAvatar }: {
  title: string;
  subtitle: string;
  onPickLocation: () => void;
  /** First letter of the signed-in user's name; undefined when signed out. */
  avatarLetter?: string;
  onAvatar: () => void;
}) {
  return (
    <View style={styles.locationRow}>
      <TouchableOpacity style={styles.locationButton} onPress={onPickLocation} accessibilityRole="button" accessibilityLabel={`Delivering to ${title}. Change delivery location`}>
        <View style={styles.locationTitleRow}>
          <Ionicons name="navigate" size={17} color={home.onHeader} style={{ transform: [{ rotate: '0deg' }] }} />
          <Text style={styles.locationTitle} numberOfLines={1}>{title}</Text>
          <Ionicons name="chevron-down" size={16} color={home.onHeader} />
        </View>
        <Text style={styles.locationSubtitle} numberOfLines={1}>{subtitle}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.avatar} onPress={onAvatar} accessibilityRole="button" accessibilityLabel={avatarLetter ? 'Profile' : 'Sign in'}>
        {avatarLetter ? <Text style={styles.avatarText}>{avatarLetter}</Text> : <Ionicons name="person" size={20} color="#FFFFFF" />}
      </TouchableOpacity>
    </View>
  );
}

/* ------------------------------------------------------------------ shortcuts */

export function ShortcutRow({ shortcuts, selected, onPress }: { shortcuts: FeedShortcut[]; selected: number; onPress: (shortcut: FeedShortcut, index: number) => void }) {
  const { width } = useWindowDimensions();
  const visible = Math.min(4, shortcuts.length);
  const gap = 12;
  // Four cards fill the row; a fifth/sixth scrolls.
  const cardWidth = Math.floor((width - G * 2 - gap * (visible - 1)) / visible);
  const spacious = width >= 600;
  return (
    <ScrollView horizontal scrollEnabled={shortcuts.length > 4} showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.shortcutRow, { gap }]}>
      {shortcuts.map((item, i) => {
        const isSelected = i === selected;
        return (
          <TouchableOpacity
            key={item.title + i}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={item.title}
            activeOpacity={0.85}
            onPress={() => onPress(item, i)}
            style={[styles.shortcut, { width: cardWidth }, spacious && styles.shortcutSpacious, isSelected ? styles.shortcutSelected : styles.shortcutIdle]}
          >
            <View style={[styles.shortcutArt, spacious && styles.shortcutArtSpacious]}>
              <HomeImage source={item.image} fallback="shortcut-food" alt={item.alt} fit="contain" />
            </View>
            {item.badge ? <Text style={styles.shortcutBadge} numberOfLines={1}>{item.badge}</Text> : null}
            <Text style={[styles.shortcutLabel, spacious && styles.shortcutLabelSpacious, isSelected && styles.shortcutLabelSelected]} numberOfLines={1}>{item.title}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ search + veg */

function RotatingHint({ hints }: { hints: string[] }) {
  const [index, setIndex] = useState(0);
  const [slide] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (hints.length < 2) return;
    const timer = setInterval(() => {
      Animated.timing(slide, { toValue: -1, duration: 200, useNativeDriver: false }).start(() => {
        setIndex(i => (i + 1) % hints.length);
        slide.setValue(1);
        Animated.timing(slide, { toValue: 0, duration: 200, useNativeDriver: false }).start();
      });
    }, 2600);
    return () => clearInterval(timer);
  }, [hints.length, slide]);
  return (
    <View style={styles.hintRow} pointerEvents="none">
      <Text style={styles.hintText}>Search for </Text>
      <Animated.Text
        numberOfLines={1}
        style={[styles.hintText, styles.hintMoving, {
          opacity: slide.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
          transform: [{ translateY: slide.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] }) }],
        }]}
      >‘{hints[index % hints.length]}’</Animated.Text>
    </View>
  );
}

export function SearchRow({ query, onQuery, onSubmit, hints, vegMode, onToggleVeg }: {
  query: string;
  onQuery: (text: string) => void;
  onSubmit: () => void;
  hints: string[];
  vegMode: boolean;
  onToggleVeg: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const startVoiceSearch = () => {
    const browser = globalThis as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
    const Recognition = Platform.OS === 'web' && (browser.SpeechRecognition || browser.webkitSpeechRecognition);
    if (!Recognition) {
      input.current?.focus();
      Alert.alert('Voice search', 'Use the microphone on your keyboard to dictate a dish or restaurant.');
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'en-IN';
    recognition.onresult = (event: any) => onQuery(event.results[0][0].transcript);
    recognition.onerror = () => input.current?.focus();
    recognition.start();
  };
  return (
    <View style={styles.searchRow}>
      <View style={[styles.searchBox, focused && styles.searchBoxFocused]}>
        <Ionicons name="search" size={20} color={home.muted} />
        <View style={styles.searchField}>
          {!query && <RotatingHint hints={hints} />}
          <TextInput
            ref={input}
            accessibilityLabel="Search restaurants, dishes and cuisines"
            value={query}
            onChangeText={onQuery}
            onSubmitEditing={onSubmit}
            returnKeyType="search"
            autoCorrect={false}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[styles.searchInput, !query && StyleSheet.absoluteFill]}
          />
        </View>
        {query ? (
          <TouchableOpacity onPress={() => onQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={20} color={home.muted} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.voice} onPress={startVoiceSearch} accessibilityRole="button" accessibilityLabel="Search by voice">
            <Ionicons name="mic" size={20} color={home.accent} />
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity
        style={styles.vegCard}
        onPress={onToggleVeg}
        accessibilityRole="switch"
        accessibilityState={{ checked: vegMode }}
        accessibilityLabel="Veg only"
        activeOpacity={0.85}
      >
        <Text style={styles.vegLabel}>VEG</Text>
        <View style={[styles.vegTrack, vegMode && styles.vegTrackOn]}>
          <View style={[styles.vegKnob, vegMode && styles.vegKnobOn]}>
            <View style={styles.vegMark}><View style={styles.vegDot} /></View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

/* ------------------------------------------------------------------ banner carousel */

export function BannerCarousel({ banners, onAction }: { banners: FeedSection[]; onAction: (action: FeedAction) => void }) {
  const { width } = useWindowDimensions();
  const slideWidth = width;
  const spacious = width >= 600;
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [page, setPage] = useState(0);
  const touching = useRef(false);

  useEffect(() => {
    if (banners.length < 2) return;
    const timer = setInterval(() => {
      if (touching.current) return;
      setPage(current => {
        const next = (current + 1) % banners.length;
        scroller.current?.scrollTo({ x: next * slideWidth, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length, slideWidth]);

  if (!banners.length) return null;
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    touching.current = false;
    setPage(Math.round(e.nativeEvent.contentOffset.x / slideWidth));
  };

  return (
    <View>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => { touching.current = true; }}
        onMomentumScrollEnd={onScrollEnd}
        scrollEventThrottle={16}
      >
        {banners.map((banner, i) => {
          const action = targetAction(banner.targets[0], banner.cards, banner.title);
          return (
            <TouchableOpacity
              key={banner.title + i}
              activeOpacity={0.92}
              accessibilityRole="button"
              accessibilityLabel={[banner.title, banner.subtitle, banner.cta].filter(Boolean).join('. ')}
              onPress={() => onAction(action)}
              style={[styles.banner, { width: slideWidth }, spacious && styles.bannerSpacious]}
            >
              {banner.imageLeft ? (
                <View style={[styles.bannerArt, styles.bannerArtLeft, spacious && styles.bannerArtSpacious]}>
                  <HomeImage source={banner.imageLeft} fallback="biryani" fit="contain" />
                </View>
              ) : null}
              {banner.image ? (
                <View style={[styles.bannerArt, styles.bannerArtRight, spacious && styles.bannerArtSpacious]}>
                  <HomeImage source={banner.image} fallback={fallbackArt(banner.title)} alt={banner.imageAlt} fit="contain" />
                </View>
              ) : null}
              <View style={styles.bannerCopy}>
                {banner.eyebrow ? <Text style={styles.bannerEyebrow} numberOfLines={1}>{banner.eyebrow}</Text> : null}
                <Text style={[styles.bannerTitle, spacious && styles.bannerTitleSpacious]} numberOfLines={2}>{banner.title}</Text>
                {banner.subtitle ? <Text style={[styles.bannerSubtitle, spacious && styles.bannerSubtitleSpacious]} numberOfLines={2}>{banner.subtitle}</Text> : null}
                {banner.cta ? <View style={styles.bannerCta}><Text style={styles.bannerCtaText}>{banner.cta}</Text></View> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {banners.length > 1 && (
        <View style={styles.dots} accessibilityLabel={`Banner ${page + 1} of ${banners.length}`}>
          {banners.map((_, i) => <View key={i} style={[styles.dot, i === page && styles.dotActive]} />)}
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ promo tiles */

export function PromoTiles({ section, onAction }: { section: FeedSection; onAction: (action: FeedAction) => void }) {
  const { width } = useWindowDimensions();
  const gap = 8;
  const tileWidth = Math.floor((width - G * 2 - gap * 3) / 4);
  const spacious = width >= 600;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tiles, { gap }]}>
      {section.targets.map((tile, i) => (
        <TouchableOpacity
          key={tile.type + tile.id + i}
          accessibilityRole="button"
          accessibilityLabel={[tile.title, tile.subtitle].filter(Boolean).join(', ')}
          activeOpacity={0.85}
          style={[styles.tile, { width: tileWidth, height: spacious ? 132 : 108 }]}
          onPress={() => onAction(targetAction(tile, tile.cards ?? [], tile.title ?? section.title))}
        >
          <Text style={[styles.tileTitle, spacious && styles.tileTitleSpacious]} numberOfLines={1}>{tile.title}</Text>
          {tile.subtitle ? <Text style={styles.tileSubtitle} numberOfLines={1}>{tile.subtitle}</Text> : null}
          <View style={[styles.tileArt, { width: tileWidth - 6, height: spacious ? 90 : 66 }]}>
            <HomeImage source={tile.image} fallback={fallbackArt(tile.title)} alt={tile.alt} fit="contain" />
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = appStyles({
  locationRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: G, paddingTop: 14, paddingBottom: 14, gap: 12 },
  locationButton: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center' },
  locationTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationTitle: { color: home.onHeader, fontSize: 17, fontFamily: 'HomeBold', fontWeight: '800', letterSpacing: -0.2, flexShrink: 1 },
  locationSubtitle: { color: home.onHeaderMuted, fontSize: 12, marginTop: 2, marginLeft: 0 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: home.onCta, fontSize: 16, fontFamily: 'HomeBold', fontWeight: '900' },

  shortcutRow: { paddingHorizontal: G },
  shortcut: { height: 80, borderRadius: 18, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 9, borderWidth: 1 },
  shortcutIdle: { backgroundColor: home.card, borderColor: home.cardBorder },
  shortcutSelected: { backgroundColor: 'rgba(217,240,120,0.13)', borderColor: home.cta, borderWidth: 1.5 },
  shortcutSpacious: { height: 104, paddingBottom: 10 },
  shortcutArtSpacious: { width: 76, height: 68, top: 6 },
  shortcutLabelSpacious: { fontSize: 12 },
  shortcutArt: { position: 'absolute', top: 5, width: 54, height: 48 },
  shortcutBadge: {
    position: 'absolute', top: 40, backgroundColor: home.badge, color: '#FFFFFF', fontSize: 9, fontFamily: 'HomeBold', fontWeight: '900',
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, overflow: 'hidden',
  },
  shortcutLabel: { color: home.onHeader, fontSize: 10, fontFamily: 'HomeBold', fontWeight: '800', letterSpacing: 0.4 },
  shortcutLabelSelected: { color: home.onHeader },

  voice: { borderLeftWidth: 1, borderLeftColor: '#E6E6E6', paddingLeft: 8, minHeight: 28, justifyContent: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: G, marginTop: 12 },
  searchBox: { flex: 1, minWidth: 0, height: 56, borderRadius: 12, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  searchField: { flex: 1, minWidth: 0, height: '100%', justifyContent: 'center' },
  searchBoxFocused: { borderWidth: 2, borderColor: home.accent, paddingHorizontal: 12 },
  // The whole box shows focus (orange border), so the browser's own outline is not needed.
  searchInput: { flex: 1, minWidth: 0, color: home.ink, fontFamily: 'HomeRegular', fontSize: 15, paddingVertical: 0, outlineStyle: 'none' } as object,
  hintRow: { flexDirection: 'row', alignItems: 'center', height: 22, overflow: 'hidden' },
  hintText: { color: home.muted, fontFamily: 'HomeRegular', fontSize: 15 },
  hintMoving: { flexShrink: 1 },
  vegCard: { width: 50, height: 56, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', gap: 4 },
  vegLabel: { color: home.ink, fontSize: 10, fontFamily: 'HomeBold', fontWeight: '900', letterSpacing: 0.4 },
  vegTrack: { width: 32, height: 16, borderRadius: 8, backgroundColor: '#D7D9DE', justifyContent: 'center', paddingHorizontal: 1 },
  vegTrackOn: { backgroundColor: '#BFE8CC' },
  vegKnob: { width: 14, height: 14, borderRadius: 3, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  vegKnobOn: { transform: [{ translateX: 16 }] },
  vegMark: { width: 12, height: 12, borderWidth: 1.5, borderColor: home.veg, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  vegDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: home.veg },

  banner: { height: 112, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  bannerSpacious: { height: 158 },
  bannerArtSpacious: { width: 220, height: 150, top: 10 },
  bannerTitleSpacious: { fontSize: 30, lineHeight: 36 },
  bannerSubtitleSpacious: { fontSize: 15, lineHeight: 22 },
  bannerArt: { position: 'absolute', top: 22, width: 118, height: 92 },
  bannerArtLeft: { left: -25 },
  bannerArtRight: { right: -25 },
  bannerCopy: { alignItems: 'center', paddingHorizontal: 94, gap: 2 },
  bannerEyebrow: { color: home.cta, fontSize: 10, fontFamily: 'HomeBold', fontWeight: '900', letterSpacing: 1.2 },
  bannerTitle: { color: home.onHeader, fontSize: 19, lineHeight: 23, fontFamily: 'HomeBold', fontWeight: '900', letterSpacing: -0.5, textAlign: 'center' },
  bannerSubtitle: { color: home.onHeader, fontSize: 12, lineHeight: 17, fontFamily: 'HomeMedium', fontWeight: '600', textAlign: 'center' },
  bannerCta: { marginTop: 5, backgroundColor: home.cta, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 3 },
  bannerCtaText: { color: home.onCta, fontSize: 11, fontFamily: 'HomeBold', fontWeight: '900', letterSpacing: 0.4 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: -2, marginBottom: 8 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { width: 14, backgroundColor: '#FFFFFF' },

  tiles: { paddingHorizontal: G, paddingBottom: 2 },
  tile: { borderRadius: 12, backgroundColor: 'transparent', padding: 8, overflow: 'hidden' },
  tileTitle: { color: home.onHeader, fontSize: 10, lineHeight: 14, fontFamily: 'HomeBold', fontWeight: '800', textAlign: 'center' },
  tileTitleSpacious: { fontSize: 13, lineHeight: 18 },
  tileSubtitle: { color: home.onHeaderMuted, fontSize: 8, lineHeight: 12, fontFamily: 'HomeMedium', fontWeight: '600', textAlign: 'center', letterSpacing: 0.2 },
  tileArt: { position: 'absolute', left: 2, bottom: 0 },
});
