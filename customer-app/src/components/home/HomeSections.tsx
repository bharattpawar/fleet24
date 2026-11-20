import React, { useEffect, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExplorePhoto } from '../ExplorePhoto';
import type { OutletSummary } from '../RestaurantCard';
import { formatEta } from '../../utils/deliveryEta';
import { FeedAction, FeedSection, RailFilter, outletPhoto, railOutlets, targetAction } from '../../utils/homeFeed';
import { home, photoShade } from '../../theme/homeTheme';

/** "Search for 'biryani'" — cycles through admin-set hints with a short slide. */
export function RotatingHint({ hints }: { hints: string[] }) {
  const [index, setIndex] = useState(0);
  const [slide] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (hints.length < 2) return;
    const timer = setInterval(() => {
      Animated.timing(slide, { toValue: -1, duration: 220, useNativeDriver: true }).start(() => {
        setIndex(i => (i + 1) % hints.length);
        slide.setValue(1);
        Animated.timing(slide, { toValue: 0, duration: 220, useNativeDriver: true }).start();
      });
    }, 2800);
    return () => clearInterval(timer);
  }, [hints.length, slide]);
  const hint = hints[index % hints.length];
  return (
    <View style={styles.hintRow} pointerEvents="none">
      <Text style={styles.hintStatic}>Search for </Text>
      <Animated.Text
        numberOfLines={1}
        style={[styles.hintMoving, { opacity: slide.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }), transform: [{ translateY: slide.interpolate({ inputRange: [-1, 1], outputRange: [-12, 12] }) }] }]}
      >
        ‘{hint}’
      </Animated.Text>
    </View>
  );
}

/** Big campaign card: eyebrow, headline, offer line, lime button, photo on the right. */
export function HeroBanner({ section, onAction, onSheet }: { section: FeedSection; onAction: (action: FeedAction) => void; onSheet?: boolean }) {
  const action = targetAction(section.targets[0], section.cards, section.title);
  return (
    <TouchableOpacity activeOpacity={0.9} accessibilityRole="button" accessibilityLabel={`${section.title}. ${section.cta ?? ''}`} onPress={() => onAction(action)} style={[styles.hero, onSheet && styles.heroOnSheet]}>
      <View style={styles.heroCopy}>
        {section.eyebrow ? <Text style={styles.heroEyebrow} numberOfLines={1}>{section.eyebrow}</Text> : null}
        <Text style={styles.heroTitle} numberOfLines={2}>{section.title}</Text>
        {section.subtitle ? <Text style={styles.heroSubtitle} numberOfLines={2}>{section.subtitle}</Text> : null}
        {section.cta ? (
          <View style={styles.heroCta}>
            <Text style={styles.heroCtaText}>{section.cta}</Text>
            <Ionicons name="arrow-forward" size={14} color={home.onCta} />
          </View>
        ) : null}
      </View>
      <View style={styles.heroPhoto}>
        <ExplorePhoto key={section.image} uri={section.image ?? null} />
      </View>
    </TouchableOpacity>
  );
}

/** Row of small offer cards, each with its own photo, title and sub-line. */
export function OfferTiles({ section, onAction }: { section: FeedSection; onAction: (action: FeedAction) => void }) {
  return (
    <View style={styles.block}>
      {section.title ? <Text style={styles.blockTitle}>{section.title}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {section.targets.map((tile, i) => (
          <TouchableOpacity
            key={tile.type + tile.id + i}
            accessibilityRole="button"
            accessibilityLabel={[tile.title, tile.subtitle].filter(Boolean).join(', ')}
            activeOpacity={0.88}
            style={styles.tile}
            onPress={() => onAction(targetAction(tile, tile.cards ?? [], tile.title ?? section.title))}
          >
            <Text style={styles.tileTitle} numberOfLines={2}>{tile.title}</Text>
            {tile.subtitle ? <Text style={styles.tileSubtitle} numberOfLines={1}>{tile.subtitle}</Text> : null}
            <View style={styles.tilePhoto}><ExplorePhoto key={tile.image} uri={tile.image ?? null} /></View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

/** Segmented toggle over a restaurant rail. The last card is cut off on purpose to show it scrolls. */
export function RestaurantRail({ section, outlets, onSelectOutlet }: { section: FeedSection; outlets: OutletSummary[]; onSelectOutlet: (outlet: OutletSummary) => void }) {
  const tabs = section.tabs?.length ? section.tabs : [{ label: 'All', filter: 'all' as RailFilter }];
  const [active, setActive] = useState(0);
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(168, Math.round((width - home.gutter * 2) / 2.35));
  const list = railOutlets(outlets, tabs[Math.min(active, tabs.length - 1)].filter);
  return (
    <View style={styles.block}>
      {section.title ? <Text style={styles.blockTitle}>{section.title}</Text> : null}
      {tabs.length > 1 && (
        <View style={styles.toggle} accessibilityRole="tablist">
          {tabs.map((tab, i) => (
            <TouchableOpacity
              key={tab.label + i}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === active }}
              onPress={() => setActive(i)}
              style={[styles.toggleItem, i === active && styles.toggleItemActive]}
            >
              <Text style={[styles.toggleText, i === active && styles.toggleTextActive]} numberOfLines={1}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {list.length === 0 ? (
        <Text style={styles.railEmpty}>Nothing here right now — check the other tab.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {list.map(outlet => (
            <TouchableOpacity key={outlet.id} accessibilityRole="button" accessibilityLabel={outlet.restaurantName} activeOpacity={0.88} style={{ width: cardWidth }} onPress={() => onSelectOutlet(outlet)}>
              <View style={[styles.railPhoto, { height: Math.round(cardWidth * 1.08) }]}>
                <ExplorePhoto key={outletPhoto(outlet)} uri={outletPhoto(outlet)} />
                {outlet.offerTitle ? (
                  <View style={styles.railShade}>
                    <Text style={styles.railOffer} numberOfLines={1}>{outlet.offerTitle}</Text>
                    {outlet.offerSubtitle ? <Text style={styles.railOfferSub} numberOfLines={1}>{outlet.offerSubtitle}</Text> : null}
                  </View>
                ) : null}
                {!outlet.isAcceptingOrders && <Text style={styles.closedBadge}>Closed</Text>}
              </View>
              <Text style={styles.railName} numberOfLines={1}>{outlet.restaurantName}</Text>
              <Text style={styles.railMeta} numberOfLines={1}>
                {[formatEta(outlet.deliveryEta), typeof outlet.distanceKm === 'number' ? `${outlet.distanceKm.toFixed(1)} km` : null].filter(Boolean).join(' · ') || outlet.outletName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/** "What's on your mind?" round cuisine photos. */
export function CuisineCircles({ sections, onAction }: { sections: FeedSection[]; onAction: (action: FeedAction) => void }) {
  if (!sections.length) return null;
  // Two rows that scroll together, as in the reference.
  const columns: FeedSection[][] = [];
  sections.forEach((section, i) => {
    if (i % 2 === 0) columns.push([section]);
    else columns[columns.length - 1].push(section);
  });
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>What’s on your mind?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {columns.map((column, c) => (
          <View key={c} style={styles.circleColumn}>
            {column.map((section, i) => (
              <TouchableOpacity key={i} accessibilityRole="button" accessibilityLabel={section.title} style={styles.circleItem}
                onPress={() => onAction(targetAction(section.targets[0] && { ...section.targets[0], name: section.categoryName ?? section.title }, section.cards, section.title))}>
                <View style={styles.circlePhoto}><ExplorePhoto key={section.image} uri={section.image ?? null} /></View>
                <Text style={styles.circleLabel} numberOfLines={1}>{section.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hintRow: { flexDirection: 'row', alignItems: 'center', flex: 1, overflow: 'hidden', height: 22 },
  hintStatic: { color: home.muted, fontSize: 15 },
  hintMoving: { color: home.muted, fontSize: 15, flexShrink: 1 },

  hero: {
    marginHorizontal: home.gutter, marginTop: 14, borderRadius: 22, minHeight: 168, overflow: 'hidden',
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  heroOnSheet: { backgroundColor: home.headerTop, borderWidth: 0, marginTop: 22 },
  heroCopy: { flex: 1, padding: 16, justifyContent: 'center', gap: 4 },
  heroEyebrow: { color: home.cta, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { color: home.onHeader, fontSize: 24, lineHeight: 28, fontWeight: '900', letterSpacing: -0.6 },
  heroSubtitle: { color: home.onHeaderMuted, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  heroCta: {
    alignSelf: 'flex-start', marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: home.cta, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9,
  },
  heroCtaText: { color: home.onCta, fontSize: 13, fontWeight: '800' },
  heroPhoto: { width: '42%', overflow: 'hidden', borderTopLeftRadius: 80, borderBottomLeftRadius: 80 },

  block: { marginTop: 22 },
  blockTitle: { color: home.ink, fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginHorizontal: home.gutter, marginBottom: 12 },
  strip: { paddingHorizontal: home.gutter, gap: 12 },

  tile: { width: 112, height: 132, borderRadius: 16, backgroundColor: home.tileBg, padding: 10, overflow: 'hidden' },
  tileTitle: { color: home.ink, fontSize: 14, lineHeight: 17, fontWeight: '900', letterSpacing: -0.3 },
  tileSubtitle: { color: home.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  tilePhoto: { position: 'absolute', right: -8, bottom: -8, width: 72, height: 72, borderRadius: 36, overflow: 'hidden' },

  toggle: { flexDirection: 'row', marginHorizontal: home.gutter, marginBottom: 14, padding: 4, borderRadius: 999, backgroundColor: home.chip, alignSelf: 'flex-start' },
  toggleItem: { paddingHorizontal: 16, minHeight: 36, borderRadius: 999, justifyContent: 'center' },
  toggleItemActive: { backgroundColor: home.sheet, boxShadow: '0px 1px 4px rgba(0,0,0,0.12)' },
  toggleText: { color: home.muted, fontSize: 13, fontWeight: '700' },
  toggleTextActive: { color: home.accent },
  railEmpty: { color: home.muted, fontSize: 13, marginHorizontal: home.gutter },
  railPhoto: { borderRadius: home.radius, overflow: 'hidden', backgroundColor: home.chip },
  railShade: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 10, paddingTop: 36, paddingBottom: 8, backgroundImage: photoShade },
  railOffer: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  railOfferSub: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  closedBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: home.sheet, color: home.ink, fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  railName: { color: home.ink, fontSize: 15, fontWeight: '800', marginTop: 8, letterSpacing: -0.3 },
  railMeta: { color: home.muted, fontSize: 12, marginTop: 2 },

  circleColumn: { gap: 14 },
  circleItem: { width: 80, alignItems: 'center', gap: 6 },
  circlePhoto: { width: 76, height: 76, borderRadius: 38, overflow: 'hidden' },
  circleLabel: { color: '#3D4152', fontSize: 13, fontWeight: '600' },
});
