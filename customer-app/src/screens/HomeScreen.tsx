import { cuisineCategories, normalizeCategory } from '../utils/homeCategories';
import { useServiceAreas } from '../context/DeliveryLocationContext';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { exploreColors as c } from '../theme/tokens';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../api/client';
import { RestaurantCard, OutletSummary } from '../components/RestaurantCard';
import { USE_MOCK_DATA, MOCK_OUTLETS, MOCK_MENUS, DEFAULT_MOCK_MENU } from '../api/mockData';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { ExploreFiltersSheet } from '../components/ExploreFiltersSheet';
import { CuisineCircles, HeroBanner, OfferTiles, RestaurantRail, RotatingHint } from '../components/home/HomeSections';
import { FeedAction, FeedSection, searchHints } from '../utils/homeFeed';
import { home } from '../theme/homeTheme';
import { ExplorePhoto } from '../components/ExplorePhoto';
import { CartSummaryBar } from '../components/CartSummaryBar';
import { AddressSelectionModal, Address } from '../components/AddressSelectionModal';
import { useDeliveryLocation } from '../context/DeliveryLocationContext';

interface HomeScreenProps {
  onSelectOutlet: (outlet: OutletSummary, dishId?: string) => void;
  onViewCart?: () => void;
  onRequireAuth?: () => void;
  onOpenProfile?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectOutlet,
  onViewCart,
  onRequireAuth,
  onOpenProfile,
}) => {
  const serviceAreas = useServiceAreas();
  const { cart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const [outlets, setOutlets] = useState<OutletSummary[]>([]);
  const [categoriesByOutlet, setCategoriesByOutlet] = useState<Record<string, string[]>>({});
  const [sections, setSections] = useState<FeedSection[]>([]);
  const [categoryOutlets, setCategoryOutlets] = useState<string[] | null>(null);
  const [categoryLabel, setCategoryLabel] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Address Selector Modal State
  const {
    addresses,
    location,
    selectedAddress,
    selectAddress,
    addAddress,
    updateAddress,
  } = useDeliveryLocation();
  const [isAddressModalVisible, setIsAddressModalVisible] = useState(false);
  const notServiceable = location?.kind === 'address' && location.address.isServiceable === false;

  const coordinates = location?.latitude && location?.longitude
    ? '?latitude=' + encodeURIComponent(location.latitude) + '&longitude=' + encodeURIComponent(location.longitude)
    : '';
  const requestVersion = React.useRef(0);
  const [loadedCoordinates, setLoadedCoordinates] = useState<string>();
  const fetchOutlets = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const feed = USE_MOCK_DATA ? { outlets: MOCK_OUTLETS, sections: [], categoriesByOutlet: Object.fromEntries(MOCK_OUTLETS.map(outlet => [outlet.id, (MOCK_MENUS[outlet.id] ?? DEFAULT_MOCK_MENU).map(item => item.categoryName)])) } :
        await apiRequest<{ outlets: OutletSummary[]; sections: FeedSection[]; categoriesByOutlet?: Record<string, string[]> }>('/public/customer-home' + coordinates)
          .catch(async () => ({ outlets: await apiRequest<OutletSummary[]>('/public/outlets' + coordinates), sections: [], categoriesByOutlet: {} }));
      if (version !== requestVersion.current) return;
      setOutlets(feed.outlets);
      setSections(feed.sections);
      setCategoriesByOutlet(feed.categoriesByOutlet ?? {});
      setHasError(false);
    } catch {
      if (version !== requestVersion.current) return;
      setHasError(true);
      setOutlets([]);
      setSections([]);
      setCategoriesByOutlet({});
    } finally {
      if (version === requestVersion.current) {
        setLoadedCoordinates(coordinates);
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [coordinates]);

  useEffect(() => {
    void Promise.resolve().then(() => fetchOutlets());
    return () => { requestVersion.current++; };
  }, [fetchOutlets]);

  const applyFilters = (
    list: OutletSummary[],
    query: string,
    categoryKey: string,
  ) => {
    let result = list;

    if (categoryKey !== 'all') {
      result = result.filter(outlet => categoriesByOutlet[outlet.id]?.some(
        name => `category:${normalizeCategory(name)}` === categoryKey,
      ));
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (o) =>
          o.restaurantName.toLowerCase().includes(q) ||
          o.outletName.toLowerCase().includes(q) ||
          o.address.toLowerCase().includes(q),
      );
    }

    return result;
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  const handleCategorySelect = (filterKey: string, label = '') => {
    setCategoryOutlets(null);
    setSelectedCategory(filterKey);
    setCategoryLabel(label);
  };

  const clearCategory = () => {
    setCategoryOutlets(null);
    setSelectedCategory('all');
    setCategoryLabel('');
  };

  // Banners, tiles and cuisine circles all route through here.
  const handleAction = (action: FeedAction) => {
    if (action.type === 'outlet') onSelectOutlet(action.outlet, action.dishId);
    else if (action.type === 'outlets') {
      setSelectedCategory('all');
      setCategoryOutlets(action.outletIds);
      setCategoryLabel(action.label);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchOutlets();
  };

  const handleAddAddress = async (newAddr: Omit<Address, 'id'>) => {
    await addAddress(newAddr);
    setCategoryOutlets(null);
    setIsAddressModalVisible(false);
  };

  const openAddressPicker = () => {
    // Saving and searching addresses needs an account; signed-out users browse a service area.
    if (!isAuthenticated) {
      onRequireAuth?.();
      return;
    }
    setIsAddressModalVisible(true);
  };

  const categories = [{ id: 'all', name: 'All' }, ...cuisineCategories(categoriesByOutlet)];
  const activeCategory = categories.some(category => category.id === selectedCategory) ? selectedCategory : 'all';

  // Header rendered cleanly above the FlatList
  const matchingOutlets = applyFilters(categoryOutlets ? outlets.filter(outlet => categoryOutlets.includes(outlet.id)) : outlets, searchQuery, activeCategory);
  // Open kitchens first; closed ones stay visible but sink to the bottom.
  const filteredOutlets = (openOnly
    ? matchingOutlets.filter((outlet) => outlet.isAcceptingOrders)
    : matchingOutlets
  ).slice().sort((a, b) => Number(b.isAcceptingOrders) - Number(a.isAcceptingOrders));
  const openCount = filteredOutlets.filter((outlet) => outlet.isAcceptingOrders).length;


  const hints = searchHints(sections);
  const heroIndex = sections.findIndex(section => section.kind === 'banner');
  const firstCategoryIndex = sections.findIndex(section => section.kind === 'category');
  const categorySections = sections.filter(section => section.kind === 'category');
  const hasCuratedContent = sections.some(section => section.kind === 'row' || section.kind === 'rail');
  const filterActive = Boolean(categoryOutlets) || activeCategory !== 'all';
  const filterName = categoryLabel || categories.find(category => category.id === activeCategory)?.name || 'Selected';

  const renderSection = (section: FeedSection, index: number) => {
    switch (section.kind) {
      case 'banner':
        return index === heroIndex ? null : <HeroBanner key={index} onSheet section={section} onAction={handleAction} />;
      case 'tiles':
        return <OfferTiles key={index} section={section} onAction={handleAction} />;
      case 'rail':
        return <RestaurantRail key={index} section={section} outlets={outlets} onSelectOutlet={outlet => onSelectOutlet(outlet)} />;
      case 'category':
        return index === firstCategoryIndex ? <CuisineCircles key={index} sections={categorySections} onAction={handleAction} /> : null;
      case 'row':
        return (
          <View key={index} style={styles.featuredDishesSection}>
            <Text style={[styles.sectionHeaderTitle, { marginHorizontal: gutter }]}>{section.title}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.feedStrip}>
              {section.cards.map(({ outlet, dish }, cardIndex) => (
                <View key={cardIndex} style={styles.curatedCard}>
                  {dish ? (
                    <TouchableOpacity accessibilityRole="button" onPress={() => onSelectOutlet(outlet, dish.id)}>
                      <View style={styles.curatedPhoto}><ExplorePhoto uri={dish.imageUrl} /></View>
                      <Text style={styles.foodTitle} numberOfLines={2}>{dish.name}</Text>
                      <Text style={styles.kitchenName} numberOfLines={1}>{outlet.restaurantName}</Text>
                      <Text style={styles.foodPriceText}>₹{dish.finalPrice ?? dish.effectivePrice}</Text>
                    </TouchableOpacity>
                  ) : <RestaurantCard compact outlet={outlet} onPress={() => onSelectOutlet(outlet)} />}
                </View>
              ))}
            </ScrollView>
          </View>
        );
      default:
        return null;
    }
  };

  const renderListHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.heroHeader}>
        <View style={styles.brandRow}>
          <TouchableOpacity style={styles.addressHeader} onPress={openAddressPicker} accessibilityRole="button" accessibilityLabel={location ? `Delivering to ${location.title}. Change delivery address` : 'Set delivery address'}>
            <View style={styles.addressTitleRow}>
              <Ionicons name="navigate" size={18} color={home.cta} />
              <Text style={styles.addressLabel} numberOfLines={1}>{location ? location.title : 'Set location'}</Text>
              <Ionicons name="chevron-down" size={18} color={home.onHeader} />
            </View>
            <Text style={styles.addressLine} numberOfLines={1}>
              {location ? location.subtitle : 'Sign in to add your delivery address'}
            </Text>
          </TouchableOpacity>

          <View style={styles.headerActionsRight}>
            {onViewCart && (
              <TouchableOpacity style={styles.iconButton} onPress={onViewCart} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Cart">
                <Ionicons name="bag-handle-outline" size={20} color={home.onHeader} />
                {cart && cart.itemCount > 0 ? (
                  <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cart.itemCount}</Text></View>
                ) : null}
              </TouchableOpacity>
            )}
            {isAuthenticated ? (
              <TouchableOpacity style={styles.avatarButton} onPress={onOpenProfile} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Profile">
                <Text style={styles.avatarText}>{(user?.fullName || 'U').charAt(0).toUpperCase()}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.avatarButton} onPress={onRequireAuth} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Sign in">
                <Ionicons name="person" size={18} color={home.onCta} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBarContainer}>
            <View style={styles.searchField}>
              {!searchQuery && <RotatingHint hints={hints} />}
              <TextInput
                accessibilityLabel={`Search for ${hints[0]}`}
                value={searchQuery}
                onChangeText={handleSearchChange}
                style={[styles.searchInput, !searchQuery && StyleSheet.absoluteFill]}
                returnKeyType="search"
              />
            </View>
            {searchQuery ? (
              <TouchableOpacity onPress={() => handleSearchChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={home.muted} />
              </TouchableOpacity>
            ) : (
              <Ionicons name="search" size={20} color={home.accent} />
            )}
          </View>

          <TouchableOpacity
            style={[styles.filterIconButton, openOnly && styles.filterIconButtonActive]}
            onPress={() => setFiltersVisible(true)}
            activeOpacity={0.8}
            accessibilityLabel={openOnly ? 'Filters, 1 active' : 'Filters'}
            accessibilityRole="button"
            accessibilityState={{ expanded: filtersVisible }}
          >
            <Text style={[styles.filterCaption, openOnly && styles.filterCaptionActive]}>{openOnly ? 'OPEN' : 'FILTER'}</Text>
            <Ionicons name={openOnly ? 'toggle' : 'toggle-outline'} size={22} color={openOnly ? home.onCta : home.accent} />
          </TouchableOpacity>
        </View>

        {heroIndex >= 0 && <HeroBanner section={sections[heroIndex]} onAction={handleAction} />}
      </View>

      <View style={styles.sheet}>
        {notServiceable && (
          <View style={styles.outOfAreaCard} accessibilityRole="alert">
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

        {sections.map(renderSection)}

        {/* Until admin publishes cuisine circles, build them from live menus. */}
        {categorySections.length === 0 && categories.length > 1 && (
          <View style={styles.block}>
            <Text style={styles.discoveryHeading}>What’s on your mind?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.feedStrip}>
              {categories.filter(category => category.id !== 'all').map(category => {
                const photo = applyFilters(outlets, '', category.id).find(outlet => outlet.coverImageUrl || outlet.logoUrl);
                const uri = photo?.coverImageUrl || photo?.logoUrl || null;
                return (
                  <TouchableOpacity key={category.id} style={styles.feedTile} accessibilityRole="button" onPress={() => handleCategorySelect(category.id, category.name)}>
                    <View style={styles.tilePhoto}><ExplorePhoto key={uri} uri={uri} /></View>
                    <Text style={styles.tileLabel} numberOfLines={2}>{category.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {!hasCuratedContent && filteredOutlets.length > 0 && (
          <RestaurantRail
            section={{ kind: 'rail', title: 'In the spotlight', tabs: [{ label: 'Nearby', filter: 'all' }, { label: 'Fastest', filter: 'fast' }], targets: [], cards: [] }}
            outlets={outlets}
            onSelectOutlet={outlet => onSelectOutlet(outlet)}
          />
        )}

        <View style={styles.popularSectionHeader}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionRule} />
            <Text style={styles.allTitle}>ALL RESTAURANTS</Text>
            <View style={styles.sectionRule} />
          </View>
          {!hasError && (
            <Text style={styles.sectionHeaderSubtitle}>
              {openCount} {openCount === 1 ? 'kitchen' : 'kitchens'} ready to deliver
            </Text>
          )}
          {filterActive && (
            <TouchableOpacity style={styles.activeFilter} onPress={clearCategory} accessibilityRole="button" accessibilityLabel={`Showing ${filterName}. Clear`}>
              <Text style={styles.activeFilterText}>{filterName}</Text>
              <Ionicons name="close" size={14} color={home.accent} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {isLoading || loadedCoordinates !== coordinates ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={c.green} size="large" />
          <Text style={styles.loadingText}>Curating neighbourhood kitchens...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOutlets}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <RestaurantCard outlet={item} onPress={() => onSelectOutlet(item)} />
            </View>
          )}
          ListHeaderComponent={renderListHeader}
          contentContainerStyle={[styles.listContent, cart?.itemCount ? styles.listWithCart : undefined]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={c.green}
            />
          }
          ListEmptyComponent={
            hasError ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>Couldn’t load kitchens</Text>
                <TouchableOpacity accessibilityRole="button" onPress={onRefresh} style={styles.retry}>
                  <Text style={styles.orderNowBtnText}>{isRefreshing ? 'Retrying…' : 'Try again'}</Text>
                </TouchableOpacity>
              </View>
            ) : openOnly && matchingOutlets.length > 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No kitchens match your filters</Text>
                <TouchableOpacity accessibilityRole="button" onPress={() => setOpenOnly(false)} style={styles.retry}>
                  <Text style={styles.orderNowBtnText}>Clear filters</Text>
                </TouchableOpacity>
              </View>
            ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="restaurant-outline" size={32} color={c.secondary} />
              </View>
              <Text style={styles.emptyTitle}>No matching restaurants</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? `No kitchens found for "${searchQuery}"`
                  : 'Try selecting a different cuisine filter above.'}
              </Text>
            </View>
            )
          }
        />
      )}

      {/* Floating Cart Summary Bar */}
      {onViewCart && <CartSummaryBar onPress={onViewCart} bottomOffset={8} />}

      {filtersVisible && (
        <ExploreFiltersSheet
          openOnly={openOnly}
          onClose={() => setFiltersVisible(false)}
          onApply={(nextOpenOnly) => {
            setOpenOnly(nextOpenOnly);
            setFiltersVisible(false);
          }}
        />
      )}

      {/* Address Selection Modal */}
      <AddressSelectionModal
        visible={isAddressModalVisible}
        addresses={addresses}
        selectedAddressId={selectedAddress?.id ?? null}
        onSelectAddress={(addr) => {
          setCategoryOutlets(null);
          selectAddress(addr);
          setIsAddressModalVisible(false);
        }}
        onAddAddress={handleAddAddress}
        onUpdateAddress={async (id, changes) => {
          setCategoryOutlets(null);
          return updateAddress(id, changes);
        }}
        onClose={() => setIsAddressModalVisible(false)}
      />
    </View>
  );
};

const gutter = home.gutter;
const row = { flexDirection: 'row', alignItems: 'center' } as const;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: home.sheet },
  listContent: { paddingBottom: 12, backgroundColor: home.sheet },
  listWithCart: { paddingBottom: 80 },
  headerContainer: { paddingTop: 0 },
  cardWrapper: { paddingHorizontal: gutter },

  // Brand header: location, search, hero banner
  heroHeader: {
    paddingBottom: 30,
    backgroundColor: home.headerTop,
    backgroundImage: `linear-gradient(180deg, ${home.headerTop} 0%, ${home.headerBottom} 100%)`,
  },
  brandRow: { ...row, justifyContent: 'space-between', paddingHorizontal: gutter, paddingTop: 14, paddingBottom: 6 },
  addressHeader: { flex: 1, minWidth: 0, paddingRight: 12 },
  addressTitleRow: { ...row, gap: 4 },
  addressLabel: { color: home.onHeader, fontSize: 20, fontWeight: '900', letterSpacing: -0.4, flexShrink: 1 },
  addressLine: { color: home.onHeaderMuted, fontSize: 12, marginTop: 2, marginLeft: 22 },
  headerActionsRight: { ...row, gap: 10 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  avatarButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: home.cta, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: home.onCta, fontWeight: '900', fontSize: 16 },
  cartBadge: { position: 'absolute', right: 0, top: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: home.cta, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' },
  cartBadgeText: { color: home.onCta, fontSize: 10, fontWeight: '800' },

  searchRow: { ...row, marginHorizontal: gutter, gap: 10, marginTop: 12 },
  searchBarContainer: { ...row, flex: 1, minWidth: 0, height: 50, paddingHorizontal: 14, gap: 8, borderRadius: 14, backgroundColor: home.sheet },
  searchField: { flex: 1, minWidth: 0, height: '100%', justifyContent: 'center' },
  searchInput: { flex: 1, minWidth: 0, color: home.ink, fontSize: 15, paddingVertical: 0 },
  filterIconButton: { width: 58, height: 50, borderRadius: 14, backgroundColor: home.sheet, alignItems: 'center', justifyContent: 'center' },
  filterIconButtonActive: { backgroundColor: home.cta },
  filterCaption: { color: home.accent, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  filterCaptionActive: { color: home.onCta },

  // White content sheet overlapping the header
  sheet: { backgroundColor: home.sheet, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -18, paddingTop: 2 },
  block: { marginTop: 22 },
  outOfAreaCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: gutter, marginTop: 18, padding: 14, borderRadius: 16, backgroundColor: '#FDF3EC' },
  outOfAreaTitle: { fontSize: 15, fontWeight: '800', color: '#8C3A1C' },
  outOfAreaText: { fontSize: 13, color: '#5C4033', marginTop: 2 },
  outOfAreaBtn: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  outOfAreaBtnText: { fontSize: 14, fontWeight: '800', color: '#8C3A1C' },

  discoveryHeading: { fontSize: 18, fontWeight: '800', color: home.ink, marginHorizontal: gutter, marginBottom: 12 },
  feedStrip: { paddingHorizontal: gutter, gap: 12, paddingBottom: 4 },
  feedTile: { width: 80, alignItems: 'center', gap: 6 },
  tilePhoto: { width: 76, height: 76, borderRadius: 38, overflow: 'hidden' },
  tileLabel: { color: '#3D4152', fontSize: 13, fontWeight: '600', textAlign: 'center' },

  featuredDishesSection: { marginTop: 24, gap: 12 },
  sectionHeaderTitle: { color: home.ink, fontSize: 18, lineHeight: 24, fontWeight: '800' },
  curatedCard: { width: 140, backgroundColor: home.sheet, paddingBottom: 8 },
  curatedPhoto: { aspectRatio: 0.9, borderRadius: home.radius, overflow: 'hidden' },
  foodTitle: { color: home.ink, fontSize: 15, lineHeight: 20, minHeight: 40, fontWeight: '700', letterSpacing: -0.4, marginTop: 8 },
  kitchenName: { color: home.muted, fontSize: 12, lineHeight: 17, marginTop: 3, marginBottom: 5 },
  foodPriceText: { color: home.ink, fontSize: 14, lineHeight: 19, fontWeight: '700' },

  popularSectionHeader: { marginHorizontal: gutter, marginTop: 28, marginBottom: 14, alignItems: 'center', gap: 4 },
  sectionHeading: { ...row, gap: 12, alignSelf: 'stretch' },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#C9CAD0' },
  allTitle: { color: home.muted, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  sectionHeaderSubtitle: { color: home.muted, fontSize: 12, lineHeight: 16 },
  activeFilter: { ...row, gap: 4, marginTop: 6, paddingHorizontal: 12, minHeight: 32, borderRadius: 999, borderWidth: 1, borderColor: home.accent, backgroundColor: home.tileBg },
  activeFilterText: { color: home.accent, fontSize: 13, fontWeight: '700' },

  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: home.muted },
  emptyContainer: { paddingVertical: 32, alignItems: 'center', paddingHorizontal: gutter, gap: 6 },
  emptyIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: home.tileBg, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: home.ink },
  emptySubtitle: { fontSize: 13, color: home.muted, textAlign: 'center' },
  retry: { backgroundColor: home.accent, borderRadius: 12, padding: 12 },
  orderNowBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
