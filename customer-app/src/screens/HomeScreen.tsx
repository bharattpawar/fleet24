import { appStyles } from '../theme/appStyles';
import React, { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cuisineCategories, normalizeCategory } from '../utils/homeCategories';
import { useDeliveryLocation, useServiceAreas } from '../context/DeliveryLocationContext';
import { apiRequest } from '../api/client';
import type { OutletSummary } from '../components/RestaurantCard';
import { USE_MOCK_DATA, MOCK_OUTLETS, MOCK_MENUS, DEFAULT_MOCK_MENU } from '../api/mockData';
import { useAuth } from '../context/AuthContext';
import { ExploreFiltersSheet } from '../components/ExploreFiltersSheet';
import { CartSummaryBar } from '../components/CartSummaryBar';
import { AddressSelectionModal, Address } from '../components/AddressSelectionModal';
import { LaunchingSoonModal } from '../components/LaunchingSoonModal';
import { BannerCarousel, LocationRow, PromoTiles, SearchRow, ShortcutRow } from '../components/home/HomeHeader';
import {
  CardFacts, CuisineCircles, CuratedRow, DealRail, OfferFilterPills, RestaurantListItem, SearchResults,
} from '../components/home/HomeSections';
import {
  DEFAULT_RAIL_TABS, DEFAULT_SHORTCUTS, FeedAction, FeedSection, FeedShortcut, VegFacts,
  cuisineLine, railOutlets, searchHints, vegOutlets, comingSoonFeature, ComingSoonFeature,
} from '../utils/homeFeed';
import { useFavorites } from '../hooks/useFavorites';
import { useHomeSearch } from '../hooks/useHomeSearch';
import { fallbackArt } from '../utils/imageRef';
import { home, headerGradient } from '../theme/homeTheme';
import { restaurantColumns } from '../theme/homeLayout';

interface HomeScreenProps {
  onSelectOutlet: (outlet: OutletSummary, dishId?: string) => void;
  onViewCart?: () => void;
  onRequireAuth?: () => void;
  onOpenProfile?: () => void;
  onOpenOrders?: () => void;
  onOpenFood?: () => void;
  navigationRequest?: { action: FeedShortcut["action"]; sequence: number };
  /** Veg mode lives in the app so restaurant menus follow it too. */
  vegMode?: boolean;
  onToggleVeg?: () => void;
}

interface HomeFeed {
  outlets: OutletSummary[];
  sections: FeedSection[];
  categoriesByOutlet?: Record<string, string[]>;
  vegByOutlet?: Record<string, VegFacts>;
  cuisinesByOutlet?: Record<string, string[]>;
}

const RAIL_EMPTY: Record<string, string> = {
  offers100: 'No matching discounts right now.',
  fast10: 'Choose a delivery address to check 10-minute availability.',
  offers: 'No restaurant offers near you right now.',
  fast: 'No kitchens are open near you right now.',
  all: 'No kitchens near you yet.',
};

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectOutlet,
  onViewCart,
  onRequireAuth,
  onOpenProfile,
  onOpenOrders,
  onOpenFood,
  navigationRequest,
  vegMode = false,
  onToggleVeg,
}) => {
  const { width } = useWindowDimensions();
  const columns = restaurantColumns(width);
  const gridCardWidth = Math.floor((width - home.gutter * 2 - (columns - 1) * 16) / columns);
  const serviceAreas = useServiceAreas();
  const { user, isAuthenticated } = useAuth();
  const { addresses, location, selectedAddress, selectAddress, addAddress, updateAddress } = useDeliveryLocation();
  const { favoriteIds, toggleFavorite, favoritesError } = useFavorites(isAuthenticated);

  const [feed, setFeed] = useState<HomeFeed>({ outlets: [], sections: [] });
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openOnly, setOpenOnly] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categoryOutlets, setCategoryOutlets] = useState<string[] | null>(null);
  const [categoryLabel, setCategoryLabel] = useState('');
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [railTab, setRailTab] = useState(0);
  const [selectedShortcut, setSelectedShortcut] = useState(0);
  const [isAddressModalVisible, setIsAddressModalVisible] = useState(false);
  const [launchingFeature, setLaunchingFeature] = useState<ComingSoonFeature | null>(null);

  const list = useRef<FlatList<OutletSummary>>(null);
  const railY = useRef(0);
  const listY = useRef(0);

  const notServiceable = location?.kind === 'address' && location.address.isServiceable === false;
  const coordinates = location?.latitude && location?.longitude
    ? '?latitude=' + encodeURIComponent(location.latitude) + '&longitude=' + encodeURIComponent(location.longitude)
    : '';
  const { search, submitSearch } = useHomeSearch(searchQuery, coordinates);

  // Newest request wins: location changes can overlap.
  const requestVersion = useRef(0);
  const [loadedCoordinates, setLoadedCoordinates] = useState<string>();
  const fetchFeed = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const next: HomeFeed = USE_MOCK_DATA
        ? {
            outlets: MOCK_OUTLETS,
            sections: [],
            categoriesByOutlet: Object.fromEntries(MOCK_OUTLETS.map(o => [o.id, (MOCK_MENUS[o.id] ?? DEFAULT_MOCK_MENU).flatMap(item => item.categoryName ? [item.categoryName] : [])])),
          }
        : await apiRequest<HomeFeed>('/public/customer-home' + coordinates)
            .catch(async () => ({ outlets: await apiRequest<OutletSummary[]>('/public/outlets' + coordinates), sections: [] }));
      if (version !== requestVersion.current) return;
      setFeed(next);
      setHasError(false);
    } catch {
      if (version !== requestVersion.current) return;
      setHasError(true);
      setFeed({ outlets: [], sections: [] });
    } finally {
      if (version === requestVersion.current) {
        setLoadedCoordinates(coordinates);
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [coordinates]);

  useEffect(() => {
    void Promise.resolve().then(() => fetchFeed());
    const versions = requestVersion;
    return () => { versions.current++; };
  }, [fetchFeed]);

  const { outlets, sections } = feed;
  const categoriesByOutlet = feed.categoriesByOutlet ?? {};
  const vegByOutlet = feed.vegByOutlet ?? {};
  const cuisinesByOutlet = feed.cuisinesByOutlet ?? {};

  // ---- derived content
  const shortcuts = sections.find(s => s.kind === 'shortcuts')?.shortcuts ?? DEFAULT_SHORTCUTS;
  const hints = searchHints(sections);
  const banners = sections.filter(s => s.kind === 'banner');
  const tileSections = sections.filter(s => s.kind === 'tiles');
  const railSection = sections.find(s => s.kind === 'rail');
  const railTabs = railSection?.tabs?.length ? railSection.tabs : DEFAULT_RAIL_TABS;
  const activeRailTab = Math.min(railTab, railTabs.length - 1);
  const categorySections = sections.filter(s => s.kind === 'category');
  const categories = cuisineCategories(categoriesByOutlet);
  const searching = searchQuery.trim().length >= 2;

  const baseOutlets = vegMode && feed.vegByOutlet ? vegOutlets(outlets, vegByOutlet) : outlets;
  const activeCategory = categories.some(c => c.id === selectedCategory) ? selectedCategory : 'all';
  let listOutlets = categoryOutlets ? baseOutlets.filter(o => categoryOutlets.includes(o.id)) : baseOutlets;
  if (activeCategory !== 'all') {
    listOutlets = listOutlets.filter(o => categoriesByOutlet[o.id]?.some(name => `category:${normalizeCategory(name)}` === activeCategory));
  }
  if (favouritesOnly) listOutlets = listOutlets.filter(o => favoriteIds.has(o.id));
  if (openOnly) listOutlets = listOutlets.filter(o => o.isAcceptingOrders);
  listOutlets = [...listOutlets].sort((a, b) => Number(b.isAcceptingOrders) - Number(a.isAcceptingOrders));
  const openCount = listOutlets.filter(o => o.isAcceptingOrders).length;
  const favourites = baseOutlets.filter(o => favoriteIds.has(o.id));

  const curatedIds = new Set(sections.filter(section => section.kind === 'row').flatMap(section => section.cards.map(card => card.outlet.id)));
  const fallbackRail = [...baseOutlets].sort((a, b) => Number(curatedIds.has(b.id)) - Number(curatedIds.has(a.id)));
  const filteredRail = railOutlets(baseOutlets, railTabs[activeRailTab].filter);

  const facts: CardFacts = {
    cuisine: id => cuisineLine(id, cuisinesByOutlet, categoriesByOutlet),
    isFavorite: id => favoriteIds.has(id),
    onToggleFavorite: id => (isAuthenticated ? void toggleFavorite(id) : onRequireAuth?.()),
  };

  // ---- actions
  const clearFilters = () => {
    setCategoryOutlets(null);
    setSelectedCategory('all');
    setCategoryLabel('');
    setFavouritesOnly(false);
  };
  const scrollTo = (y: number) => list.current?.scrollToOffset({ offset: Math.max(0, y - 8), animated: true });

  const handleAction = (action: FeedAction) => {
    if (action.type === 'outlet') onSelectOutlet(action.outlet, action.dishId);
    else if (action.type === 'outlets') {
      setSelectedCategory('all');
      setFavouritesOnly(false);
      setCategoryOutlets(action.outletIds);
      setCategoryLabel(action.label);
      scrollTo(listY.current);
    }
  };

  const handleCategory = (id: string, label: string) => {
    setCategoryOutlets(null);
    setFavouritesOnly(false);
    setSelectedCategory(id);
    setCategoryLabel(label);
    scrollTo(listY.current);
  };

  const handleShortcut = (shortcut: FeedShortcut, index: number) => {
    const upcoming = comingSoonFeature(shortcut);
    if (upcoming) { setLaunchingFeature(upcoming); return; }
    switch (shortcut.action) {
      case 'food':
        onOpenFood?.();
        setSelectedShortcut(index);
        clearFilters();
        setSearchQuery('');
        scrollTo(0);
        break;
      case 'offers':
      case 'fast': {
        setSelectedShortcut(index);
        const tab = railTabs.findIndex(t => t.filter === shortcut.action || (shortcut.action === 'offers' && t.filter === 'offers100') || (shortcut.action === 'fast' && t.filter === 'fast10'));
        if (tab >= 0) setRailTab(tab);
        scrollTo(railY.current);
        break;
      }
      case 'veg':
        onToggleVeg?.();
        setSelectedShortcut(vegMode ? 0 : index);
        break;
      case 'favourites':
        if (!isAuthenticated) { onRequireAuth?.(); break; }
        setSelectedShortcut(index);
        setFavouritesOnly(true);
        scrollTo(listY.current);
        break;
      case 'orders':
        onOpenOrders?.();
        break;
      case 'profile':
        if (isAuthenticated) onOpenProfile?.(); else onRequireAuth?.();
        break;
    }
  };

  const navigateFromBar = useEffectEvent(() => {
    if (navigationRequest) handleShortcut({ title: '', image: '', action: navigationRequest.action }, 0);
  });
  useEffect(() => {
    if (navigationRequest) void Promise.resolve().then(() => navigateFromBar());
  }, [navigationRequest]);

  const openAddressPicker = () => {
    // Saved addresses need an account; signed-out users browse a service area.
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }
    setIsAddressModalVisible(true);
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    void fetchFeed();
  };

  const filterName = favouritesOnly ? 'Favourites' : categoryLabel || categories.find(c => c.id === activeCategory)?.name || '';
  const filterActive = favouritesOnly || Boolean(categoryOutlets) || activeCategory !== 'all';

  // ---- header (everything above the restaurant list)
  const renderHeader = () => (
    <View>
      <View style={styles.navy}>
        <LocationRow
          title={location ? location.title : 'Set location'}
          subtitle={location ? location.subtitle : 'Sign in to add your delivery address'}
          onPickLocation={openAddressPicker}
          avatarLetter={isAuthenticated ? (user?.fullName || 'U').charAt(0).toUpperCase() : undefined}
          onAvatar={() => (isAuthenticated ? onOpenProfile?.() : onRequireAuth?.())}
        />
        <ShortcutRow shortcuts={shortcuts} selected={Math.min(selectedShortcut, shortcuts.length - 1)} onPress={handleShortcut} />
        <SearchRow
          query={searchQuery}
          onQuery={setSearchQuery}
          onSubmit={submitSearch}
          hints={hints}
          vegMode={vegMode}
          onToggleVeg={() => onToggleVeg?.()}
        />
        {!searching && (
          <>
            {banners.length > 0 ? <View style={styles.bannerGap}><BannerCarousel banners={banners} onAction={handleAction} /></View> : <View style={{ height: 14 }} />}
            {tileSections.map((section, i) => <PromoTiles key={i} section={section} onAction={handleAction} />)}
          </>
        )}
      </View>

      {searching ? (
        <SearchResults search={search} vegMode={vegMode} facts={facts} onSelectOutlet={onSelectOutlet} onRetry={submitSearch} />
      ) : (
        <>
          {notServiceable && (
            <View style={styles.outOfArea} accessibilityRole="alert">
              <Ionicons name="location-outline" size={22} color="#8C3A1C" />
              <View style={{ flex: 1 }}>
                <Text style={styles.outOfAreaTitle}>We don’t deliver here yet</Text>
                <Text style={styles.outOfAreaText}>Fleet24 currently delivers in {serviceAreas}.</Text>
              </View>
              <TouchableOpacity onPress={openAddressPicker} accessibilityRole="button" style={styles.outOfAreaBtn}>
                <Text style={styles.outOfAreaBtnText}>Change</Text>
              </TouchableOpacity>
            </View>
          )}
          {vegMode && (
            <View style={styles.vegNote}>
              <View style={styles.vegMark}><View style={styles.vegDot} /></View>
              <Text style={styles.vegNoteText}>Veg mode: showing kitchens with veg dishes.</Text>
              <TouchableOpacity onPress={() => onToggleVeg?.()} accessibilityRole="button"><Text style={styles.link}>Turn off</Text></TouchableOpacity>
            </View>
          )}

          <View style={styles.railBlock} onLayout={e => { railY.current = e.nativeEvent.layout.y; }}>
            {railSection?.title ? <Text style={styles.blockTitle}>{railSection.title}</Text> : null}
            <OfferFilterPills tabs={railTabs} active={activeRailTab} onChange={setRailTab} />
            {!railOutlets(baseOutlets, railTabs[activeRailTab].filter).length && <Text style={styles.railNotice}>{RAIL_EMPTY[railTabs[activeRailTab].filter]} Explore kitchens near you.</Text>}
            <DealRail
              outlets={filteredRail.length ? filteredRail : fallbackRail.slice(0, 10)}
              facts={facts}
              onSelectOutlet={outlet => onSelectOutlet(outlet)}
              emptyText={RAIL_EMPTY[railTabs[activeRailTab].filter]}
            />
          </View>

          {isAuthenticated && favourites.length > 0 && (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Your favourites</Text>
              <DealRail outlets={favourites} facts={facts} onSelectOutlet={outlet => onSelectOutlet(outlet)} emptyText="" />
            </View>
          )}
          {favoritesError ? <Text style={styles.inlineError}>{favoritesError}</Text> : null}

          {categorySections.length > 0 ? (
            <CuisineCircles sections={categorySections} onAction={handleAction} />
          ) : categories.length > 0 && (
            <CuisineCircles
              sections={categories.slice(0, 12).map(category => ({
                kind: 'category' as const,
                title: category.name,
                image: `asset:${fallbackArt(category.name)}`,
                targets: [{ type: 'category' as const, id: category.id, name: category.name }],
                cards: [],
              }))}
              onAction={handleAction}
              onPressSection={section => {
                const target = section.targets[0];
                if (target) handleCategory(target.id, section.title);
              }}
            />
          )}

          {sections.filter(s => s.kind === 'row').map((section, i) => {
            const cards = vegMode
              ? section.cards.filter(card => (card.dish ? card.dish.isVeg !== false : vegByOutlet[card.outlet.id]?.hasVeg !== false))
              : section.cards;
            return <CuratedRow key={i} section={section} cards={cards} facts={facts} onSelectOutlet={onSelectOutlet} />;
          })}

          <View style={styles.listHeader} onLayout={e => { listY.current = e.nativeEvent.layout.y; }}>
            <Text style={styles.listTitle}>All restaurants</Text>
          </View>
          <View style={styles.chips}>
            <TouchableOpacity style={[styles.chip, openOnly && styles.chipOn]} onPress={() => setFiltersVisible(true)} accessibilityRole="button" accessibilityLabel={openOnly ? 'Filters, 1 active' : 'Filters'}>
              <Ionicons name="options-outline" size={14} color={openOnly ? home.accent : home.ink} />
              <Text style={[styles.chipText, openOnly && styles.chipTextOn]}>Filter{openOnly ? ' (1)' : ''}</Text>
            </TouchableOpacity>
            {isAuthenticated && (
              <TouchableOpacity style={[styles.chip, favouritesOnly && styles.chipOn]} onPress={() => setFavouritesOnly(v => !v)} accessibilityRole="button" accessibilityState={{ selected: favouritesOnly }}>
                <Ionicons name={favouritesOnly ? 'heart' : 'heart-outline'} size={14} color={favouritesOnly ? home.accent : home.ink} />
                <Text style={[styles.chipText, favouritesOnly && styles.chipTextOn]}>Favourites</Text>
              </TouchableOpacity>
            )}
            {filterActive && !favouritesOnly && (
              <TouchableOpacity style={[styles.chip, styles.chipOn]} onPress={clearFilters} accessibilityRole="button" accessibilityLabel={`Showing ${filterName}. Clear`}>
                <Text style={[styles.chipText, styles.chipTextOn]}>{filterName}</Text>
                <Ionicons name="close" size={14} color={home.accent} />
              </TouchableOpacity>
            )}
          </View>
          {!hasError && <Text style={styles.listCount}>{openCount} {openCount === 1 ? 'kitchen' : 'kitchens'} ready to deliver</Text>}
        </>
      )}
    </View>
  );

  const emptyList = hasError ? (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Couldn’t load kitchens</Text>
      <TouchableOpacity accessibilityRole="button" onPress={onRefresh} style={styles.retry}>
        <Text style={styles.retryText}>{isRefreshing ? 'Retrying…' : 'Try again'}</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{favouritesOnly ? 'No favourites here yet' : 'No matching kitchens'}</Text>
      <Text style={styles.emptySubtitle}>
        {favouritesOnly ? 'Tap the heart on a restaurant to save it.' : vegMode ? 'Veg mode is on. Turn it off to see every kitchen.' : 'Try another filter.'}
      </Text>
      {filterActive || openOnly ? (
        <TouchableOpacity accessibilityRole="button" onPress={() => { clearFilters(); setOpenOnly(false); }} style={styles.retry}>
          <Text style={styles.retryText}>Clear filters</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      {isLoading || loadedCoordinates !== coordinates ? (
        <View style={styles.loading}>
          <ActivityIndicator color={home.accent} size="large" />
          <Text style={styles.loadingText}>Finding kitchens near you…</Text>
        </View>
      ) : (
        <FlatList
          key={columns}
          ref={list}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? styles.restaurantGridRow : undefined}
          showsVerticalScrollIndicator={false}
          data={searching ? [] : listOutlets}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <RestaurantListItem outlet={item} width={columns > 1 ? gridCardWidth : undefined} facts={facts} onPress={() => onSelectOutlet(item)} />}
          ListHeaderComponent={renderHeader()}
          ListEmptyComponent={searching ? undefined : emptyList}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={6}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
        />
      )}

      {onViewCart && <CartSummaryBar onPress={onViewCart} bottomOffset={8} />}

      {filtersVisible && (
        <ExploreFiltersSheet
          openOnly={openOnly}
          onClose={() => setFiltersVisible(false)}
          onApply={next => { setOpenOnly(next); setFiltersVisible(false); }}
        />
      )}

      <AddressSelectionModal
        visible={isAddressModalVisible}
        addresses={addresses}
        selectedAddressId={selectedAddress?.id ?? null}
        onSelectAddress={addr => { clearFilters(); selectAddress(addr); setIsAddressModalVisible(false); }}
        onAddAddress={async (newAddr: Omit<Address, 'id'>) => { await addAddress(newAddr); clearFilters(); setIsAddressModalVisible(false); }}
        onUpdateAddress={async (id, changes) => { clearFilters(); return updateAddress(id, changes); }}
        onClose={() => setIsAddressModalVisible(false)}
      />
      <LaunchingSoonModal feature={launchingFeature} onClose={() => setLaunchingFeature(null)} onExploreFood={() => { setLaunchingFeature(null); handleShortcut(DEFAULT_SHORTCUTS[0], 0); }} />
    </View>
  );
};

const G = home.gutter;

const styles = appStyles({
  container: { flex: 1, backgroundColor: home.page },
  listContent: { paddingBottom: 96, backgroundColor: home.page },
  restaurantGridRow: { paddingHorizontal: home.gutter, gap: 16, marginTop: 18, marginBottom: 8 },
  navy: {
    backgroundColor: home.headerMid,
    backgroundImage: headerGradient,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingBottom: 10,
    overflow: 'hidden',
  },
  bannerGap: { marginTop: 6 },
  railNotice: { color: home.muted, fontSize: 10, marginHorizontal: G, marginTop: 8, marginBottom: -10 },
  railBlock: { marginTop: 24 },
  block: { marginTop: 22 },
  blockTitle: { color: home.ink, fontSize: 17, fontFamily: 'HomeBold', fontWeight: '800', letterSpacing: -0.3, marginHorizontal: G, marginBottom: 12 },
  inlineError: { color: '#9A2A16', fontSize: 13, marginHorizontal: G, marginTop: 8 },

  outOfArea: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: G, marginTop: 16, padding: 14, borderRadius: 16, backgroundColor: '#FDF3EC' },
  outOfAreaTitle: { fontSize: 15, fontFamily: 'HomeBold', fontWeight: '800', color: '#8C3A1C' },
  outOfAreaText: { fontSize: 13, color: '#5C4033', marginTop: 2 },
  outOfAreaBtn: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  outOfAreaBtnText: { fontSize: 14, fontFamily: 'HomeBold', fontWeight: '800', color: '#8C3A1C' },

  vegNote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: G, marginTop: 14, padding: 10, borderRadius: 12, backgroundColor: '#EAF7EF' },
  vegMark: { width: 14, height: 14, borderWidth: 1.5, borderColor: home.veg, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  vegDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: home.veg },
  vegNoteText: { flex: 1, color: '#16472A', fontSize: 13, fontFamily: 'HomeMedium', fontWeight: '600' },
  link: { color: home.accent, fontSize: 13, fontFamily: 'HomeBold', fontWeight: '800', padding: 4 },

  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: G, marginTop: 28 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#C9CAD0' },
  listTitle: { color: home.ink, fontSize: 23, lineHeight: 30, fontFamily: 'HomeBold', fontWeight: '800', letterSpacing: -0.6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: G, marginTop: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 34, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: home.hairline, backgroundColor: '#FFFFFF' },
  chipOn: { borderColor: home.accent, backgroundColor: home.accentSoft },
  chipText: { color: home.ink, fontSize: 13, fontFamily: 'HomeBold', fontWeight: '700' },
  chipTextOn: { color: home.accent },
  listCount: { color: '#7D8799', fontSize: 12, lineHeight: 18, fontFamily: 'HomeRegular', marginHorizontal: G, marginTop: 10, marginBottom: 12 },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: home.muted },
  empty: { paddingVertical: 32, alignItems: 'center', paddingHorizontal: G, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'HomeBold', fontWeight: '800', color: home.ink },
  emptySubtitle: { fontSize: 13, color: home.muted, textAlign: 'center' },
  retry: { backgroundColor: home.accent, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginTop: 4 },
  retryText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'HomeBold', fontWeight: '800' },
});
