import React from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HomeImage } from './HomeImage';
import type { OutletSummary } from '../RestaurantCard';
import { formatEta } from '../../utils/deliveryEta';
import { fallbackArt } from '../../utils/imageRef';
import { FeedAction, FeedCard, FeedSection, RailFilter, outletPhoto, targetAction } from '../../utils/homeFeed';
import type { SearchState } from '../../hooks/useHomeSearch';
import { home, photoShade } from '../../theme/homeTheme';

const G = home.gutter;

/* ------------------------------------------------------------------ segmented filter pills */

export function OfferFilterPills({ tabs, active, onChange }: { tabs: { label: string; filter: RailFilter }[]; active: number; onChange: (index: number) => void }) {
  return (
    <View style={styles.pills} accessibilityRole="tablist">
      {tabs.map((tab, i) => {
        const selected = i === active;
        return (
          <TouchableOpacity
            key={tab.label + i}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(i)}
            style={[styles.pill, selected && styles.pillSelected]}
          >
            <Text style={[styles.pillText, selected && styles.pillTextSelected]} numberOfLines={1}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ deal card (compact, horizontal rail) */

export interface CardFacts {
  cuisine: (outletId: string) => string;
  isFavorite: (outletId: string) => boolean;
  onToggleFavorite: (outletId: string) => void;
}

function Heart({ outlet, facts, size = 22, style }: { outlet: OutletSummary; facts: CardFacts; size?: number; style?: object }) {
  const favorite = facts.isFavorite(outlet.id);
  return (
    <TouchableOpacity
      style={[styles.heart, style]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityState={{ selected: favorite }}
      accessibilityLabel={favorite ? `Remove ${outlet.restaurantName} from favourites` : `Add ${outlet.restaurantName} to favourites`}
      onPress={() => facts.onToggleFavorite(outlet.id)}
    >
      <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={size} color={favorite ? home.heart : '#FFFFFF'} />
    </TouchableOpacity>
  );
}

function MetaLine({ outlet }: { outlet: OutletSummary }) {
  const eta = formatEta(outlet.deliveryEta);
  const distance = typeof outlet.distanceKm === 'number' ? `${outlet.distanceKm.toFixed(1)} km` : null;
  return (
    <View style={styles.metaRow}>
      {outlet.isAcceptingOrders ? (
        <View style={styles.etaBadge}><Ionicons name="time" size={10} color="#FFFFFF" /></View>
      ) : (
        <View style={[styles.etaBadge, styles.closedBadgeDot]}><Ionicons name="moon" size={9} color="#FFFFFF" /></View>
      )}
      <Text style={styles.metaText} numberOfLines={1}>
        {outlet.isAcceptingOrders ? [eta, distance].filter(Boolean).join(' • ') || 'Open now' : 'Closed now'}
      </Text>
    </View>
  );
}

export function DealCard({ outlet, width, facts, onPress }: { outlet: OutletSummary; width: number; facts: CardFacts; onPress: () => void }) {
  const cuisine = facts.cuisine(outlet.id);
  const photoHeight = Math.round(width * 1.05);
  return (
    <View style={{ width }}>
      <TouchableOpacity activeOpacity={0.88} accessibilityRole="button" accessibilityLabel={[outlet.restaurantName, outlet.offerTitle, outlet.offerSubtitle].filter(Boolean).join(', ')} onPress={onPress}>
        <View style={[styles.dealPhoto, { height: photoHeight }, !outlet.isAcceptingOrders && styles.dimmed]}>
          <HomeImage source={outletPhoto(outlet)} fallback={fallbackArt(cuisine, outlet.restaurantName)} alt={`${outlet.restaurantName} food`} />
          {outlet.offerTitle ? (
            <View style={styles.dealShade}>
              <Text style={styles.dealOffer} numberOfLines={1}>{outlet.offerTitle}</Text>
              {outlet.offerSubtitle ? <Text style={styles.dealOfferSub} numberOfLines={1}>{outlet.offerSubtitle}</Text> : null}
            </View>
          ) : null}
        </View>
        <Text style={styles.dealName} numberOfLines={1}>{outlet.restaurantName}</Text>
        <MetaLine outlet={outlet} />
        {cuisine ? <Text style={styles.dealCuisine} numberOfLines={1}>{cuisine}</Text> : null}
      </TouchableOpacity>
      <Heart outlet={outlet} facts={facts} size={19} />
    </View>
  );
}

export function DealRail({ outlets, facts, onSelectOutlet, emptyText }: { outlets: OutletSummary[]; facts: CardFacts; onSelectOutlet: (outlet: OutletSummary) => void; emptyText: string }) {
  const { width } = useWindowDimensions();
  // ~2.85 cards per screen: the next card is cut off to show the row scrolls.
  const cardWidth = Math.round((Math.min(width, 520) - G) / 2.85) - 10;
  if (!outlets.length) return <Text style={styles.railEmpty}>{emptyText}</Text>;
  return (
    <FlatList
      horizontal
      data={outlets}
      keyExtractor={item => item.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.dealRail}
      ItemSeparatorComponent={RailGap}
      initialNumToRender={4}
      windowSize={3}
      renderItem={({ item }) => <DealCard outlet={item} width={cardWidth} facts={facts} onPress={() => onSelectOutlet(item)} />}
    />
  );
}

function RailGap() {
  return <View style={{ width: 10 }} />;
}

/* ------------------------------------------------------------------ restaurant list item (compact, vertical list) */

export function RestaurantListItem({ outlet, facts, onPress }: { outlet: OutletSummary; facts: CardFacts; onPress: () => void }) {
  const cuisine = facts.cuisine(outlet.id);
  return (
    <View>
      <TouchableOpacity style={styles.listItem} activeOpacity={0.88} accessibilityRole="button" accessibilityLabel={[outlet.restaurantName, outlet.offerTitle].filter(Boolean).join(', ')} onPress={onPress}>
        <View style={[styles.listPhoto, !outlet.isAcceptingOrders && styles.dimmed]}>
          <HomeImage source={outletPhoto(outlet)} fallback={fallbackArt(cuisine, outlet.restaurantName)} alt={`${outlet.restaurantName} food`} />
          {outlet.offerTitle ? (
            <View style={styles.dealShade}>
              <Text style={styles.listOffer} numberOfLines={1}>{outlet.offerTitle}</Text>
              {outlet.offerSubtitle ? <Text style={styles.dealOfferSub} numberOfLines={1}>{outlet.offerSubtitle}</Text> : null}
            </View>
          ) : null}
        </View>
        <View style={styles.listBody}>
          <Text style={styles.listName} numberOfLines={2}>{outlet.restaurantName}</Text>
          <MetaLine outlet={outlet} />
          {cuisine ? <Text style={styles.dealCuisine} numberOfLines={1}>{cuisine}</Text> : null}
          <Text style={styles.listOutlet} numberOfLines={1}>{outlet.outletName}</Text>
        </View>
      </TouchableOpacity>
      <Heart outlet={outlet} facts={facts} size={18} style={styles.listHeart} />
    </View>
  );
}

/* ------------------------------------------------------------------ cuisine circles */

export function CuisineCircles({ sections, onAction, onPressSection, title = 'What’s on your mind?' }: {
  sections: FeedSection[];
  onAction: (action: FeedAction) => void;
  /** Overrides the default tap (used for circles built from live menus rather than admin content). */
  onPressSection?: (section: FeedSection) => void;
  title?: string;
}) {
  if (!sections.length) return null;
  const columns: FeedSection[][] = [];
  sections.forEach((section, i) => (i % 2 === 0 ? columns.push([section]) : columns[columns.length - 1].push(section)));
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {columns.map((column, c) => (
          <View key={c} style={styles.circleColumn}>
            {column.map((section, i) => (
              <TouchableOpacity key={i} accessibilityRole="button" accessibilityLabel={section.title} style={styles.circleItem}
                onPress={() => onPressSection ? onPressSection(section) : onAction(targetAction(section.targets[0] && { ...section.targets[0], name: section.categoryName ?? section.title }, section.cards, section.title))}>
                <View style={styles.circlePhoto}>
                  <HomeImage source={section.image} fallback={fallbackArt(section.title)} alt={section.imageAlt} fit="contain" />
                </View>
                <Text style={styles.circleLabel} numberOfLines={1}>{section.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ curated row (admin-picked outlets/dishes) */

export function CuratedRow({ section, cards, facts, onSelectOutlet }: { section: FeedSection; cards: FeedCard[]; facts: CardFacts; onSelectOutlet: (outlet: OutletSummary, dishId?: string) => void }) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.round((Math.min(width, 520) - G) / 2.85) - 10;
  if (!cards.length) return null;
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{section.title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.strip, { gap: 10 }]}>
        {cards.map(({ outlet, dish }, i) => dish ? (
          <TouchableOpacity key={i} style={{ width: cardWidth }} accessibilityRole="button" accessibilityLabel={`${dish.name} from ${outlet.restaurantName}`} onPress={() => onSelectOutlet(outlet, dish.id)}>
            <View style={[styles.dealPhoto, { height: Math.round(cardWidth * 1.05) }]}>
              <HomeImage source={dish.imageUrl} fallback={fallbackArt(dish.name)} alt={dish.name} />
            </View>
            <Text style={styles.dealName} numberOfLines={1}>{dish.name}</Text>
            <Text style={styles.metaText} numberOfLines={1}>₹{dish.finalPrice ?? dish.effectivePrice} • {outlet.restaurantName}</Text>
          </TouchableOpacity>
        ) : (
          <DealCard key={i} outlet={outlet} width={cardWidth} facts={facts} onPress={() => onSelectOutlet(outlet)} />
        ))}
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ search results */

export function SearchResults({ search, vegMode, facts, onSelectOutlet, onRetry }: {
  search: SearchState;
  vegMode: boolean;
  facts: CardFacts;
  onSelectOutlet: (outlet: OutletSummary, dishId?: string) => void;
  onRetry: () => void;
}) {
  if (search.status === 'idle') return null;
  if (search.status === 'loading') {
    return <View style={styles.searchState}><ActivityIndicator color={home.accent} /><Text style={styles.metaText}>Searching for “{search.query}”…</Text></View>;
  }
  if (search.status === 'error') {
    return (
      <View style={styles.searchState}>
        <Text style={styles.searchEmptyTitle}>Search isn’t working right now</Text>
        <TouchableOpacity accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
      </View>
    );
  }
  const { result } = search;
  const outlets = vegMode ? result.outlets.filter(o => result.vegByOutlet[o.id]?.hasVeg) : result.outlets;
  const dishes = vegMode ? result.dishes.filter(d => d.dish.isVeg) : result.dishes;
  if (!outlets.length && !dishes.length) {
    return (
      <View style={styles.searchState}>
        <Ionicons name="search" size={28} color={home.muted} />
        <Text style={styles.searchEmptyTitle}>No results for “{result.query}”</Text>
        <Text style={styles.metaText}>{vegMode ? 'Veg mode is on. Try turning it off, or ' : 'Try '}a restaurant, dish or cuisine name.</Text>
      </View>
    );
  }
  return (
    <View>
      {dishes.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Dishes</Text>
          {dishes.slice(0, 12).map(({ outlet, dish }) => (
            <TouchableOpacity key={outlet.id + dish.id} style={styles.dishRow} accessibilityRole="button" accessibilityLabel={`${dish.name}, ₹${dish.finalPrice ?? dish.effectivePrice}, from ${outlet.restaurantName}`} onPress={() => onSelectOutlet(outlet, dish.id)}>
              <View style={styles.dishThumb}><HomeImage source={dish.imageUrl} fallback={fallbackArt(dish.name)} alt={dish.name} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.listName} numberOfLines={1}>{dish.name}</Text>
                <Text style={styles.metaText} numberOfLines={1}>₹{dish.finalPrice ?? dish.effectivePrice} • {outlet.restaurantName}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={home.muted} />
            </TouchableOpacity>
          ))}
        </View>
      )}
      {outlets.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Restaurants</Text>
          {outlets.map(outlet => <RestaurantListItem key={outlet.id} outlet={outlet} facts={facts} onPress={() => onSelectOutlet(outlet)} />)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', marginHorizontal: G, padding: 4, borderRadius: 999, backgroundColor: home.pill },
  pill: { flex: 1, minHeight: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  pillSelected: { backgroundColor: '#FFFFFF', boxShadow: '0px 1px 4px rgba(16, 25, 79, 0.16)' },
  pillText: { color: '#4A4D55', fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  pillTextSelected: { color: home.accent },

  dealRail: { paddingHorizontal: G, paddingTop: 14 },
  dealPhoto: { borderRadius: home.radius, overflow: 'hidden', backgroundColor: '#F6EFE6' },
  dimmed: { opacity: 0.55 },
  dealShade: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 9, paddingTop: 34, paddingBottom: 8, backgroundImage: photoShade },
  dealOffer: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', letterSpacing: -0.4 },
  dealOfferSub: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  heart: { position: 'absolute', top: 6, right: 6, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.22)' },
  listHeart: { top: 16, left: home.gutter + 116 - 36, right: undefined },
  dealName: { color: home.ink, fontSize: 14, fontWeight: '800', marginTop: 7, letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  etaBadge: { width: 15, height: 15, borderRadius: 8, backgroundColor: home.veg, alignItems: 'center', justifyContent: 'center' },
  closedBadgeDot: { backgroundColor: '#9A9CA3' },
  metaText: { color: '#3E4152', fontSize: 12, fontWeight: '600' },
  dealCuisine: { color: home.muted, fontSize: 12, marginTop: 1 },
  railEmpty: { color: home.muted, fontSize: 13, marginHorizontal: G, marginTop: 16 },

  listItem: { flexDirection: 'row', gap: 14, paddingHorizontal: G, paddingVertical: 10 },
  listPhoto: { width: 116, height: 132, borderRadius: home.radius, overflow: 'hidden', backgroundColor: '#F6EFE6' },
  listOffer: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  listBody: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 1 },
  listName: { color: home.ink, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  listOutlet: { color: home.muted, fontSize: 12, marginTop: 1 },

  block: { marginTop: 22 },
  blockTitle: { color: home.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.3, marginHorizontal: G, marginBottom: 12 },
  strip: { paddingHorizontal: G, gap: 12 },
  circleColumn: { gap: 12 },
  circleItem: { width: 78, alignItems: 'center', gap: 5 },
  circlePhoto: { width: 74, height: 74, borderRadius: 37, overflow: 'hidden' },
  circleLabel: { color: '#3E4152', fontSize: 12, fontWeight: '600' },

  searchState: { alignItems: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: G },
  searchEmptyTitle: { color: home.ink, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  retry: { backgroundColor: home.accent, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: '#FFFFFF', fontWeight: '800' },
  dishRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: G, paddingVertical: 8 },
  dishThumb: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden', backgroundColor: home.pill },
});
