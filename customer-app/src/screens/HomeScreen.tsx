import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Image,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { exploreColors as c } from '../theme/tokens';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../api/client';
import { RestaurantCard, OutletSummary } from '../components/RestaurantCard';
import { USE_MOCK_DATA, MOCK_OUTLETS } from '../api/mockData';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { ExploreFiltersSheet } from '../components/ExploreFiltersSheet';
import { ExplorePhoto } from '../components/ExplorePhoto';
import { CartSummaryBar } from '../components/CartSummaryBar';
import { AddressSelectionModal, Address } from '../components/AddressSelectionModal';

interface HomeScreenProps {
  onSelectOutlet: (outlet: OutletSummary, dishId?: string) => void;
  onViewCart?: () => void;
  onRequireAuth?: () => void;
  onOpenProfile?: () => void;
}

interface CuisineCategory {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  filterKey: string;
}

interface FeedSection {
  kind: 'banner' | 'category' | 'row';
  title: string;
  image?: string;
  cta?: string;
  targets: { type: string; id: string }[];
  cards: { outlet: OutletSummary; dish?: { id: string; name: string; imageUrl: string | null; effectivePrice: string } }[];
}

const CUISINE_CATEGORIES: CuisineCategory[] = [
  { id: 'all', name: 'All', icon: 'restaurant-outline', filterKey: 'all' },
  { id: 'north_indian', name: 'North Indian', icon: 'flame-outline', filterKey: 'kulcha' },
  { id: 'biryani', name: 'Biryani', icon: 'nutrition-outline', filterKey: 'biryani' },
  { id: 'rolls', name: 'Rolls & Kathi', icon: 'fast-food-outline', filterKey: 'kathi' },
  { id: 'south_indian', name: 'South Indian', icon: 'cafe-outline', filterKey: 'dakshin' },
  { id: 'chai_snacks', name: 'Chai & Cafe', icon: 'leaf-outline', filterKey: 'chai' },
];

const DEFAULT_ADDRESSES: Address[] = [
  {
    id: 'addr-default-1',
    label: 'Home',
    addressLine1: 'Sector Alpha 1, Commercial Belt',
    addressLine2: 'Greater Noida',
    city: 'Greater Noida',
    postalCode: '201310',
    latitude: '28.4855',
    longitude: '77.5135',
    isDefault: true,
  },
  {
    id: 'addr-office-2',
    label: 'Office',
    addressLine1: 'Knowledge Park III, Institutional Area',
    addressLine2: 'Near Sharda University',
    city: 'Greater Noida',
    postalCode: '201306',
    latitude: '28.4744',
    longitude: '77.5040',
  },
];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectOutlet,
  onViewCart,
  onRequireAuth,
  onOpenProfile,
}) => {
  const { cart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const [outlets, setOutlets] = useState<OutletSummary[]>([]);
  const [sections, setSections] = useState<FeedSection[]>([]);
  const [categoryOutlets, setCategoryOutlets] = useState<string[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Address Selector Modal State
  const [addresses, setAddresses] = useState<Address[]>(DEFAULT_ADDRESSES);
  const [selectedAddress, setSelectedAddress] = useState<Address>(DEFAULT_ADDRESSES[0]);
  const [isAddressModalVisible, setIsAddressModalVisible] = useState(false);

  const coordinates = selectedAddress.latitude && selectedAddress.longitude
    ? '?latitude=' + encodeURIComponent(selectedAddress.latitude) + '&longitude=' + encodeURIComponent(selectedAddress.longitude)
    : '';
  const requestVersion = React.useRef(0);
  const [loadedCoordinates, setLoadedCoordinates] = useState<string>();
  const fetchOutlets = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const feed = USE_MOCK_DATA ? { outlets: MOCK_OUTLETS, sections: [] } :
        await apiRequest<{ outlets: OutletSummary[]; sections: FeedSection[] }>('/public/customer-home' + coordinates)
          .catch(async () => ({ outlets: await apiRequest<OutletSummary[]>('/public/outlets' + coordinates), sections: [] }));
      if (version !== requestVersion.current) return;
      setOutlets(feed.outlets);
      setSections(feed.sections);
      setHasError(false);
    } catch {
      if (version !== requestVersion.current) return;
      setHasError(true);
      setOutlets([]);
      setSections([]);
    } finally {
      if (version === requestVersion.current) {
        setLoadedCoordinates(coordinates);
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [coordinates]);

  useEffect(() => {
    void fetchOutlets();
    return () => { requestVersion.current++; };
  }, [fetchOutlets]);

  const applyFilters = (
    list: OutletSummary[],
    query: string,
    categoryKey: string,
  ) => {
    let result = list;

    if (categoryKey !== 'all') {
      result = result.filter((o) => {
        const text = (o.restaurantName + ' ' + o.outletName + ' ' + o.slug).toLowerCase();
        return text.includes(categoryKey.toLowerCase());
      });
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

  const handleCategorySelect = (filterKey: string) => {
    setCategoryOutlets(null);
    setSelectedCategory(filterKey);
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchOutlets();
  };

  const handleAddAddress = async (newAddr: Omit<Address, 'id'>) => {
    const created: Address = {
      ...newAddr,
      id: `addr-${Date.now()}`,
    };
    setAddresses((prev) => [created, ...prev]);
    setCategoryOutlets(null);
    setSelectedAddress(created);
    setIsAddressModalVisible(false);
  };

  // Header rendered cleanly above the FlatList
  const matchingOutlets = applyFilters(categoryOutlets ? outlets.filter(outlet => categoryOutlets.includes(outlet.id)) : outlets, searchQuery, selectedCategory);
  const filteredOutlets = openOnly
    ? matchingOutlets.filter((outlet) => outlet.isAcceptingOrders)
    : matchingOutlets;
  const openCount = filteredOutlets.filter((outlet) => outlet.isAcceptingOrders).length;

  const hasCampaign = sections.some(section => section.kind === 'banner');

  const renderListHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.heroHeader}>
      {/* 1. First Row: Brand Wordmark (Left) and Notification + Account Actions (Right) */}
      <View style={styles.brandRow}>
        <TouchableOpacity style={styles.addressHeader} onPress={() => setIsAddressModalVisible(true)} accessibilityRole="button" accessibilityLabel="Choose delivery address">
          <Text style={styles.addressLabel}>{selectedAddress.label} <Ionicons name="chevron-forward" size={16} /></Text>
          <Text style={styles.addressLine} numberOfLines={1}>{selectedAddress.addressLine1}</Text>
        </TouchableOpacity>

        <View style={styles.headerActionsRight}>
          {/* Notification Button */}
          <TouchableOpacity
            style={styles.iconButton}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={20} color={c.green} />
            <View style={styles.notificationDot} />
          </TouchableOpacity>

          {/* Profile / Sign In Button */}
          {isAuthenticated ? (
            <TouchableOpacity
              style={styles.avatarButton}
              onPress={onOpenProfile}
              activeOpacity={0.8}
              accessibilityLabel="Profile"
            >
              <Text style={styles.avatarText}>
                {(user?.fullName || 'U').charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.signInButton}
              onPress={onRequireAuth}
              activeOpacity={0.8}
              accessibilityLabel="Sign In"
            >
              <Ionicons name="person-outline" size={14} color={c.green} />
              <Text style={styles.signInButtonText}>Sign In</Text>
            </TouchableOpacity>
          )}

          {/* Cart Button */}
          {onViewCart && (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onViewCart}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Cart"
            >
              <Ionicons name="cart-outline" size={20} color={c.green} />
              {cart && cart.itemCount > 0 ? (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cart.itemCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.foodIdentity}>
        <View style={styles.foodIdentityIcon}><Ionicons name="fast-food" size={30} color="#FFFFFF" /></View>
        <View><Text style={styles.brandTitle}>Fleet24 Food</Text><Text style={styles.foodIdentityCaption}>Your neighbourhood. Delivered.</Text></View>
      </View>

      {/* 3. Main Heading: Clean Typographic Hierarchy, No Random Italics */}
      <View style={styles.searchRow}>
        <View style={styles.searchBarContainer}>
          <Ionicons
            name="search-outline"
            size={18}
            color={c.secondary}
            style={styles.searchLeftIcon}
          />
          <TextInput
            placeholder="Search for dishes & kitchens"
            placeholderTextColor={c.secondary}
            value={searchQuery}
            onChangeText={handleSearchChange}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => handleSearchChange('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={c.secondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={[
            styles.filterIconButton,
            openOnly && styles.filterIconButtonActive,
          ]}
          onPress={() => setFiltersVisible(true)}
          activeOpacity={0.8}
          accessibilityLabel={openOnly ? 'Filters, 1 active' : 'Filters'}
          accessibilityRole="button"
          accessibilityState={{ expanded: filtersVisible }}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={openOnly ? '#FFFFFF' : c.green}
          />
          {openOnly && (
            <View style={styles.filterCount}>
              <Text style={styles.cartBadgeText}>1</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* 5. Horizontal Category Selector: Consistent Chips, Adequate Padding */}
      <View style={styles.categorySection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryPillsScroll}
        >
          {CUISINE_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.filterKey;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  isSelected && styles.categoryChipSelected,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => handleCategorySelect(cat.filterKey)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={cat.icon}
                  size={15}
                  color={isSelected ? c.green : c.secondary}
                  style={styles.categoryChipIcon}
                />
                <Text
                  style={[
                    styles.categoryChipLabel,
                    isSelected && styles.categoryChipLabelSelected,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {!hasCampaign && (
        <View style={styles.foodBanner}>
          <Image source={require('../../assets/images/biryani-campaign.png')} style={styles.bannerImage} resizeMode="cover" accessibilityLabel="Bowl of chicken biryani" />
          <View style={styles.bannerText}>
            <Text style={styles.bannerEyebrow}>FLEET24 PICKS</Text>
            <Text style={styles.bannerTitle}>Big flavour.{'\n'}Every bite.</Text>
            <Text style={styles.bannerSubtitle}>Find your next favourite.</Text>
          </View>

        </View>
      )}
      </View>

      <Text style={styles.discoveryHeading}>What’s on your mind?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.feedStrip}>
        {sections.some(section => section.kind === 'category')
          ? sections.filter(section => section.kind === 'category').map((section, index) => (
            <TouchableOpacity key={section.targets[0].id + index} style={styles.feedTile} accessibilityRole="button" onPress={() => {
              setSelectedCategory('all');
              setCategoryOutlets(section.cards.map(card => card.outlet.id));
            }}>
              <View style={styles.tilePhoto}><ExplorePhoto key={section.image} uri={section.image ?? null} /></View>
              <Text style={styles.tileLabel} numberOfLines={2}>{section.title}</Text>
            </TouchableOpacity>
          ))
          : CUISINE_CATEGORIES.filter(category => category.id !== 'all').map(category => {
            const photo = applyFilters(outlets, '', category.filterKey).find(outlet => outlet.logoUrl)?.logoUrl;
            return (
              <TouchableOpacity key={category.id} style={styles.feedTile} accessibilityRole="button"
                onPress={() => handleCategorySelect(category.filterKey)}>
                <View style={styles.tilePhoto}><ExplorePhoto key={photo} uri={photo ?? null} /></View>
                <Text style={styles.tileLabel} numberOfLines={2}>{category.name}</Text>
              </TouchableOpacity>
            );
          })}
      </ScrollView>
      {sections.some(section => section.kind === 'banner') && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.feedStrip}>
          {sections.filter(section => section.kind === 'banner').map((section, index) => (
            <TouchableOpacity key={index} style={styles.campaign} accessibilityRole="button" onPress={() => {
              if (section.targets[0].type === 'category') {
                setSelectedCategory('all');
                setCategoryOutlets(section.cards.map(card => card.outlet.id));
              } else {
                const { outlet, dish } = section.cards[0];
                onSelectOutlet(outlet, dish?.id);
              }
            }}>
              <ExplorePhoto key={section.image} uri={section.image ?? null} />
              <View style={styles.campaignCopy}>
                <Text style={styles.campaignTitle} numberOfLines={2}>{section.title}</Text>
                <Text style={styles.campaignCta}>{section.cta}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {!sections.some(section => section.kind === 'row') && filteredOutlets.length > 0 && (
        <View style={styles.spotlightSection}>
          <View style={styles.spotlightHeading}><Ionicons name="restaurant-outline" size={22} color={c.green} /><Text style={styles.spotlightTitle}>In the spotlight</Text></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.feedStrip}>
            {filteredOutlets.slice(0, 8).map(outlet => <View key={outlet.id} style={styles.curatedCard}><RestaurantCard compact outlet={outlet} onPress={() => onSelectOutlet(outlet)} /></View>)}
          </ScrollView>
        </View>
      )}
      {sections.filter(section => section.kind === 'row').map((section, index) => (
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
                    <Text style={styles.foodPriceText}>₹{dish.effectivePrice}</Text>
                  </TouchableOpacity>
                ) : <RestaurantCard compact outlet={outlet} onPress={() => onSelectOutlet(outlet)} />}
              </View>
            ))}
          </ScrollView>
        </View>
      ))}

      <View style={styles.popularSectionHeader}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionHeaderTitle}>Nearby kitchens</Text>
        </View>
        {!hasError && (
          <Text style={styles.sectionHeaderSubtitle}>
            {openCount} {openCount === 1 ? 'kitchen' : 'kitchens'} ready to deliver
          </Text>
        )}
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
        selectedAddressId={selectedAddress.id}
        onSelectAddress={(addr) => {
          setCategoryOutlets(null);
          setSelectedAddress(addr);
          setIsAddressModalVisible(false);
        }}
        onAddAddress={handleAddAddress}
        onClose={() => setIsAddressModalVisible(false)}
      />
    </View>
  );
};

const gutter = 15;
const panel = {
  backgroundColor: c.surface,
  borderWidth: 1,
  borderColor: c.border,
  borderRadius: 12,
};
const shadow = { boxShadow: '0px 2px 4px rgba(17, 30, 23, 0.06)' };
const row = { flexDirection: 'row', alignItems: 'center' } as const;

const styles = StyleSheet.create({
  foodBanner: { marginHorizontal: 15, height: 190, backgroundColor: '#330D0C', borderRadius: 20, overflow: 'hidden', justifyContent: 'center' },
  bannerText: { paddingHorizontal: 16, paddingVertical: 18, width: '54%' },
  bannerEyebrow: { fontSize: 9, letterSpacing: 1.4, fontWeight: '800', color: '#FFE4BD', marginBottom: 7 },
  bannerTitle: { fontSize: 26, lineHeight: 29, fontWeight: '800', letterSpacing: -0.8, color: '#FFFFFF' },
  bannerSubtitle: { fontSize: 13, color: '#FFE4BD', marginTop: 8 },
  bannerImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  addressHeader: { flex: 1, minWidth: 0, paddingRight: 12 },
  addressLabel: { color: c.green, fontSize: 20, fontWeight: '800', marginBottom: 4 },
  addressLine: { color: c.secondary, fontSize: 12 },
  foodIdentity: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF' },
  foodIdentityIcon: { width: 54, height: 54, borderRadius: 17, backgroundColor: '#187547', alignItems: 'center', justifyContent: 'center' },
  foodIdentityCaption: { color: c.secondary, fontSize: 12, marginTop: 3 },
  spotlightSection: { marginTop: 8, marginBottom: 20 },
  spotlightHeading: { marginHorizontal: 15, marginBottom: 16, backgroundColor: '#F0F2F1', borderRadius: 28, padding: 16, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  spotlightTitle: { color: '#174D32', fontSize: 17, fontWeight: '800' },
  heroHeader: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden', paddingBottom: 14, marginBottom: 22 },
  heroFeature: { height: 184, marginHorizontal: 15, borderRadius: 18, overflow: 'hidden', backgroundColor: '#073C2A' },
  heroFeatureCopy: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 13, backgroundColor: 'rgba(3, 44, 26, 0.78)' },
  heroFeatureLabel: { color: '#D9F5E6', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  discoveryHeading: { fontSize: 19, fontWeight: '800', color: '#191919', marginHorizontal: 15, marginBottom: 14 },
  tileLabel: { color: '#474747', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  feedStrip: { paddingHorizontal: 14, gap: 12, paddingBottom: 14 },
  feedTile: { width: 76, alignItems: 'center', gap: 5 },
  tilePhoto: { width: 70, height: 70, borderRadius: 35, overflow: 'hidden' },
  campaign: { width: 316, height: 142, backgroundColor: c.green, overflow: 'hidden', borderRadius: 16, justifyContent: 'flex-end' },
  campaignCopy: { position: 'absolute', left: 0, bottom: 0, right: 0, padding: 12, backgroundColor: 'rgba(0, 28, 18, 0.8)' },
  campaignTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  campaignCta: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginTop: 4 },
  curatedCard: { width: 132, backgroundColor: '#FFFFFF', paddingBottom: 8 },
  curatedPhoto: { aspectRatio: 0.88, borderRadius: 18, overflow: 'hidden' },

  container: { flex: 1, backgroundColor: '#FFFFFF' },
  listContent: { paddingBottom: 12 },
  listWithCart: { paddingBottom: 80 },
  headerContainer: { paddingTop: 0 },
  cardWrapper: { paddingHorizontal: gutter },
  brandRow: { ...row, justifyContent: 'space-between', paddingHorizontal: gutter, paddingVertical: 18, backgroundColor: '#FAF7F0' },
  brandLeftGroup: { ...row, gap: 6 },
  brandTitle: { color: c.green, fontSize: 27, fontWeight: '900', letterSpacing: -1 },
  brandDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFAA65' },
  headerActionsRight: { ...row, gap: 5 },
  iconButton: { ...panel, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  signInButton: { ...row, height: 40, paddingHorizontal: 6, gap: 3 },
  signInButtonText: { color: c.green, fontSize: 12, fontWeight: '700' },
  avatarButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: c.tint,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: c.green, fontWeight: '800' },
  notificationDot: { position: 'absolute', right: 8, top: 8, width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFAA65' },
  cartBadge: {
    position: 'absolute', right: 2, top: 2, minWidth: 14, borderRadius: 8,
    backgroundColor: c.green, paddingHorizontal: 3, alignItems: 'center',
  },
  cartBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  locationSelectorRow: {
    ...panel, ...row, minHeight: 42, marginHorizontal: gutter, marginTop: 8, paddingHorizontal: 12, gap: 10,
  },
  locationMainText: { flex: 1, fontSize: 14, fontWeight: '800', color: c.ink },
  searchRow: { ...row, marginHorizontal: gutter, gap: 8, marginTop: 16, marginBottom: 6 },
  searchBarContainer: { ...panel, ...shadow, ...row, flex: 1, minWidth: 0, height: 50, paddingHorizontal: 12 },
  searchLeftIcon: { marginRight: 8 },
  searchInput: { flex: 1, minWidth: 0, color: c.ink, fontSize: 14, paddingVertical: 0 },
  filterIconButton: { ...panel, ...shadow, width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  filterCount: {
    position: 'absolute', top: -5, right: -4, minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center', borderRadius: 8,
    backgroundColor: c.green, borderColor: c.surface, borderWidth: 1,
  },
  filterIconButtonActive: { backgroundColor: c.green, borderColor: c.green },
  categorySection: { marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#ECEEEB' },
  categoryPillsScroll: { paddingHorizontal: gutter, paddingBottom: 3, gap: 8 },
  categoryChip: { ...row, minHeight: 42, paddingHorizontal: 10, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  categoryChipSelected: { borderBottomColor: c.green },
  categoryChipIcon: { marginRight: 6 },
  categoryChipLabel: { color: c.secondary, fontSize: 12, fontWeight: '600' },
  categoryChipLabelSelected: { color: c.green },
  sectionHeading: { ...row, gap: 12 },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.secondary },
  sectionHeaderTitle: { color: '#191919', fontSize: 21, lineHeight: 28, fontWeight: '800' },
  editorialHeading: { fontFamily: 'InstrumentSerifItalic' },
  editorialName: { fontFamily: 'BaskervvilleRegular', fontWeight: '400' },
  sectionHeaderSubtitle: { color: c.secondary, fontSize: 12, lineHeight: 16, marginTop: 2 },
  featuredDishesSection: { marginBottom: 24, gap: 12 },
  foodGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 9, marginTop: 11 },
  foodCard: { ...panel, backgroundColor: c.background, width: '49%', overflow: 'hidden' },
  foodImageContainer: { width: '100%', aspectRatio: 1.04, overflow: 'hidden' },
  foodBody: { flex: 1, padding: 8 },
  foodTitle: { color: '#202326', fontSize: 15, lineHeight: 20, minHeight: 40, fontWeight: '700', letterSpacing: -0.4, marginTop: 8 },
  kitchenName: { color: '#777B80', fontSize: 12, lineHeight: 17, marginTop: 3, marginBottom: 5 },
  foodFooter: {
    ...row, flexWrap: 'wrap', justifyContent: 'space-between', gap: 4, marginTop: 'auto',
    paddingTop: 7, borderTopWidth: 1, borderTopColor: c.border,
  },
  foodPriceText: { color: '#202326', fontSize: 14, lineHeight: 19, fontWeight: '700' },
  orderNowBtn: { ...row, gap: 3, backgroundColor: c.green, borderRadius: 16, paddingHorizontal: 7, paddingVertical: 5 },
  orderNowBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  vegIndicatorPill: {
    position: 'absolute', top: 7, right: 7, width: 15, height: 15,
    borderRadius: 3, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center',
  },
  vegIndicatorDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.green },
  popularSectionHeader: { marginHorizontal: gutter, marginBottom: 11 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: c.secondary },
  emptyContainer: { paddingVertical: 32, alignItems: 'center', paddingHorizontal: gutter, gap: 6 },
  emptyIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: c.ink },
  emptySubtitle: { fontSize: 13, color: c.secondary, textAlign: 'center' },
  retry: { backgroundColor: c.green, borderRadius: 12, padding: 12 },
});
