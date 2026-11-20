import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
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
        {avatarLetter ? <Text style={styles.avatarText}>{avatarLetter}</Text> : <Ionicons name="person" size={20} color={home.onCta} />}
      </TouchableOpacity>
    </View>
  );
}

/* ------------------------------------------------------------------ shortcuts */

export function ShortcutRow({ shortcuts, selected, onPress }: { shortcuts: FeedShortcut[]; selected: number; onPress: (shortcut: FeedShortcut, index: number) => void }) {
  const { width } = useWindowDimensions();
  const visible = Math.min(4, shortcuts.length);
  const gap = 8;
  // Four cards fill the row; a fifth/sixth scrolls.
  const cardWidth = Math.floor((Math.min(width, 520) - G * 2 - gap * (visible - 1)) / visible);
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
            style={[styles.shortcut, { width: cardWidth }, isSelected ? styles.shortcutSelected : styles.shortcutIdle]}
          >
            <View style={styles.shortcutArt}>
              <HomeImage source={item.image} fallback="shortcut-food" alt={item.alt} fit="contain" />
            </View>
            {item.badge ? <Text style={styles.shortcutBadge} numberOfLines={1}>{item.badge}</Text> : null}
            <Text style={[styles.shortcutLabel, isSelected && styles.shortcutLabelSelected]} numberOfLines={1}>{item.title}</Text>
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
  return (
    <View style={styles.searchRow}>
      <View style={[styles.searchBox, focused && styles.searchBoxFocused]}>
        <Ionicons name="search" size={20} color={home.muted} />
        <View style={styles.searchField}>
          {!query && <RotatingHint hints={hints} />}
          <TextInput
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
        ) : null}
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
  const slideWidth = Math.min(width, 520);
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
              style={[styles.banner, { width: slideWidth }]}
            >
              {banner.imageLeft ? (
                <View style={[styles.bannerArt, styles.bannerArtLeft]}>
                  <HomeImage source={banner.imageLeft} fallback="biryani" fit="contain" />
                </View>
              ) : null}
              {banner.image ? (
                <View style={[styles.bannerArt, styles.bannerArtRight]}>
                  <HomeImage source={banner.image} fallback={fallbackArt(banner.title)} alt={banner.imageAlt} fit="contain" />
                </View>
              ) : null}
              <View style={styles.bannerCopy}>
                {banner.eyebrow ? <Text style={styles.bannerEyebrow} numberOfLines={1}>{banner.eyebrow}</Text> : null}
                <Text style={styles.bannerTitle} numberOfLines={2}>{banner.title}</Text>
                {banner.subtitle ? <Text style={styles.bannerSubtitle} numberOfLines={2}>{banner.subtitle}</Text> : null}
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
  const tileWidth = Math.floor((Math.min(width, 520) - G * 2 - gap * 3) / 4.15);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tiles, { gap }]}>
      {section.targets.map((tile, i) => (
        <TouchableOpacity
          key={tile.type + tile.id + i}
          accessibilityRole="button"
          accessibilityLabel={[tile.title, tile.subtitle].filter(Boolean).join(', ')}
          activeOpacity={0.85}
          style={[styles.tile, { width: tileWidth, height: Math.round(tileWidth * 1.12) }]}
          onPress={() => onAction(targetAction(tile, tile.cards ?? [], tile.title ?? section.title))}
        >
          <Text style={styles.tileTitle} numberOfLines={2}>{tile.title}</Text>
          {tile.subtitle ? <Text style={styles.tileSubtitle} numberOfLines={1}>{tile.subtitle}</Text> : null}
          <View style={[styles.tileArt, { width: tileWidth * 0.5, height: tileWidth * 0.5 }]}>
            <HomeImage source={tile.image} fallback={i % 2 ? 'promo-bolt' : 'promo-percent'} alt={tile.alt} fit="contain" />
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  locationRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: G, paddingTop: 10, paddingBottom: 12, gap: 12 },
  locationButton: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center' },
  locationTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationTitle: { color: home.onHeader, fontSize: 18, fontWeight: '800', letterSpacing: -0.2, flexShrink: 1 },
  locationSubtitle: { color: home.onHeaderMuted, fontSize: 12, marginTop: 2, marginLeft: 23 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: home.onCta, fontSize: 16, fontWeight: '900' },

  shortcutRow: { paddingHorizontal: G },
  shortcut: { height: 80, borderRadius: 18, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 9, borderWidth: 1 },
  shortcutIdle: { backgroundColor: home.card, borderColor: home.cardBorder },
  shortcutSelected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  shortcutArt: { position: 'absolute', top: 6, width: 44, height: 44 },
  shortcutBadge: {
    position: 'absolute', top: 40, backgroundColor: home.badge, color: '#FFFFFF', fontSize: 9, fontWeight: '900',
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, overflow: 'hidden',
  },
  shortcutLabel: { color: home.onHeader, fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },
  shortcutLabelSelected: { color: home.ink },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: G, marginTop: 12 },
  searchBox: { flex: 1, minWidth: 0, height: 50, borderRadius: 14, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  searchField: { flex: 1, minWidth: 0, height: '100%', justifyContent: 'center' },
  searchBoxFocused: { borderWidth: 2, borderColor: home.accent, paddingHorizontal: 12 },
  // The whole box shows focus (orange border), so the browser's own outline is not needed.
  searchInput: { flex: 1, minWidth: 0, color: home.ink, fontSize: 15, paddingVertical: 0, outlineStyle: 'none' } as object,
  hintRow: { flexDirection: 'row', alignItems: 'center', height: 22, overflow: 'hidden' },
  hintText: { color: home.muted, fontSize: 15 },
  hintMoving: { flexShrink: 1 },
  vegCard: { width: 54, height: 50, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', gap: 4 },
  vegLabel: { color: home.ink, fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  vegTrack: { width: 32, height: 16, borderRadius: 8, backgroundColor: '#D7D9DE', justifyContent: 'center', paddingHorizontal: 1 },
  vegTrackOn: { backgroundColor: '#BFE8CC' },
  vegKnob: { width: 14, height: 14, borderRadius: 3, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  vegKnobOn: { transform: [{ translateX: 16 }] },
  vegMark: { width: 12, height: 12, borderWidth: 1.5, borderColor: home.veg, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  vegDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: home.veg },

  banner: { height: 140, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  bannerArt: { position: 'absolute', top: 14, width: 118, height: 118 },
  bannerArtLeft: { left: -30 },
  bannerArtRight: { right: -30 },
  bannerCopy: { alignItems: 'center', paddingHorizontal: 84, gap: 2 },
  bannerEyebrow: { color: home.cta, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  bannerTitle: { color: home.onHeader, fontSize: 21, lineHeight: 25, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center' },
  bannerSubtitle: { color: home.onHeader, fontSize: 13, lineHeight: 17, fontWeight: '600', textAlign: 'center' },
  bannerCta: { marginTop: 7, backgroundColor: home.cta, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5 },
  bannerCtaText: { color: home.onCta, fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: -2, marginBottom: 8 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { width: 14, backgroundColor: '#FFFFFF' },

  tiles: { paddingHorizontal: G, paddingBottom: 2 },
  tile: { borderRadius: 14, backgroundColor: home.card, borderWidth: 1, borderColor: home.cardBorder, padding: 8, overflow: 'hidden' },
  tileTitle: { color: home.onHeader, fontSize: 12, lineHeight: 14, fontWeight: '900' },
  tileSubtitle: { color: home.onHeaderMuted, fontSize: 10, lineHeight: 12, fontWeight: '700', marginTop: 1 },
  tileArt: { position: 'absolute', right: 2, bottom: 2 },
});
