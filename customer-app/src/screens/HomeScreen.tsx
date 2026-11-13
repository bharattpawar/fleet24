import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { colors, spacing, typography, borderRadius } from '../theme/tokens';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../api/client';
import { RestaurantCard, OutletSummary } from '../components/RestaurantCard';
import { USE_MOCK_DATA, MOCK_OUTLETS } from '../api/mockData';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { CartSummaryBar } from '../components/CartSummaryBar';
import { AddressSelectionModal, Address } from '../components/AddressSelectionModal';

interface HomeScreenProps {
  onSelectOutlet: (outlet: OutletSummary) => void;
  onViewCart?: () => void;
  onRequireAuth?: () => void;
  onOpenProfile?: () => void;
  bottomOffset?: number;
}

interface CuisineCategory {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  filterKey: string;
}

interface FeaturedDishItem {
  id: string;
  name: string;
  description: string;
  price: string;
  basePrice?: string;
  imageUrl: string | null;
  isVeg: boolean;
  outlet: OutletSummary;
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

const buildDefaultDishes = (outletList: OutletSummary[]): FeaturedDishItem[] => {
  if (!outletList || outletList.length === 0) return [];

  const biryaniOutlet =
    outletList.find(
      (o) =>
        o.slug.includes('biryani') ||
        o.restaurantName.toLowerCase().includes('biryani'),
    ) || outletList[0];

  const punjabiOutlet =
    outletList.find(
      (o) =>
        o.slug.includes('kulcha') ||
        o.restaurantName.toLowerCase().includes('kulcha') ||
        o.restaurantName.toLowerCase().includes('chaap'),
    ) || outletList[1] || outletList[0];

  const rollOutlet =
    outletList.find(
      (o) =>
        o.slug.includes('kathi') ||
        o.restaurantName.toLowerCase().includes('kathi') ||
        o.restaurantName.toLowerCase().includes('rolls'),
    ) || outletList[2] || outletList[0];

  return [
    {
      id: 'featured-1-biryani',
      name: 'Awadhi Chicken Biryani',
      description:
        'Fragrant long-grain basmati layered with tender spiced chicken and saffron aromatics.',
      price: '220',
      basePrice: '260',
      imageUrl:
        'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80',
      isVeg: false,
      outlet: biryaniOutlet,
    },
    {
      id: 'featured-2-thali',
      name: 'Amritsari Chur Chur Naan Thali',
      description:
        'Layered butter naan with paneer filling, served hot with dal makhani and pindi chole.',
      price: '190',
      basePrice: '210',
      imageUrl:
        'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=600&auto=format&fit=crop&q=80',
      isVeg: true,
      outlet: punjabiOutlet,
    },
    {
      id: 'featured-3-roll',
      name: 'Double Egg Chicken Kathi Roll',
      description:
        'Flaky golden paratha wrap loaded with spiced grilled chicken, crisp onions and mint chutney.',
      price: '140',
      basePrice: '160',
      imageUrl:
        'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop&q=80',
      isVeg: false,
      outlet: rollOutlet,
    },
  ];
};

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectOutlet,
  onViewCart,
  onRequireAuth,
  onOpenProfile,
  bottomOffset = 68,
}) => {
  const { cart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const [outlets, setOutlets] = useState<OutletSummary[]>([]);
  const [filteredOutlets, setFilteredOutlets] = useState<OutletSummary[]>([]);
  const [featuredDishes, setFeaturedDishes] = useState<FeaturedDishItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'open'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Address Selector Modal State
  const [addresses, setAddresses] = useState<Address[]>(DEFAULT_ADDRESSES);
  const [selectedAddress, setSelectedAddress] = useState<Address>(DEFAULT_ADDRESSES[0]);
  const [isAddressModalVisible, setIsAddressModalVisible] = useState(false);

  const fetchOutlets = async () => {
    if (USE_MOCK_DATA) {
      setOutlets(MOCK_OUTLETS);
      applyFilters(MOCK_OUTLETS, searchQuery, selectedFilter, selectedCategory);
      setFeaturedDishes(buildDefaultDishes(MOCK_OUTLETS));
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const data = await apiRequest<OutletSummary[]>('/public/outlets');
      setOutlets(data);
      applyFilters(data, searchQuery, selectedFilter, selectedCategory);
      const dishes = buildDefaultDishes(data);
      setFeaturedDishes(dishes);

      // Asynchronously enhance featured dishes with live menu data from active outlets
      fetchLiveDishes(data);
    } catch {
      setOutlets([]);
      setFilteredOutlets([]);
      setFeaturedDishes([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchLiveDishes = async (outletList: OutletSummary[]) => {
    try {
      const activeOutlets = outletList.filter((o) => o.isAcceptingOrders).slice(0, 3);
      if (activeOutlets.length === 0) return;

      const results = await Promise.allSettled(
        activeOutlets.map((outlet) =>
          apiRequest<Array<{
            id: string;
            name: string;
            description: string | null;
            basePrice: string;
            effectivePrice: string | number;
            imageUrl: string | null;
            isVeg: boolean;
            isAvailable: boolean;
          }>>(`/public/outlets/${outlet.id}/menu`).then((menuItems) => ({
            outlet,
            items: menuItems.filter((i) => i.isAvailable).slice(0, 2),
          })),
        ),
      );

      const liveDishes: FeaturedDishItem[] = [];
      results.forEach((res) => {
        if (res.status === 'fulfilled' && res.value.items.length > 0) {
          res.value.items.forEach((item) => {
            liveDishes.push({
              id: item.id,
              name: item.name,
              description: item.description || 'Artisanal dish prepared fresh to order.',
              price: String(typeof item.effectivePrice === 'number' ? item.effectivePrice : parseFloat(item.effectivePrice).toFixed(0)),
              basePrice: item.basePrice ? String(parseFloat(item.basePrice).toFixed(0)) : undefined,
              imageUrl: item.imageUrl,
              isVeg: item.isVeg,
              outlet: res.value.outlet,
            });
          });
        }
      });

      if (liveDishes.length > 0) {
        setFeaturedDishes(liveDishes.slice(0, 4));
      }
    } catch {
      // Keep existing default dishes gracefully
    }
  };

  useEffect(() => {
    fetchOutlets();
  }, []);

  const applyFilters = (
    list: OutletSummary[],
    query: string,
    filter: 'all' | 'open',
    categoryKey: string,
  ) => {
    let result = list;

    if (filter === 'open') {
      result = result.filter((o) => o.isAcceptingOrders);
    }

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

    setFilteredOutlets(result);
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    applyFilters(outlets, text, selectedFilter, selectedCategory);
  };

  const handleFilterChange = (filter: 'all' | 'open') => {
    setSelectedFilter(filter);
    applyFilters(outlets, searchQuery, filter, selectedCategory);
  };

  const handleCategorySelect = (filterKey: string) => {
    setSelectedCategory(filterKey);
    applyFilters(outlets, searchQuery, selectedFilter, filterKey);
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
    setSelectedAddress(created);
    setIsAddressModalVisible(false);
  };

  // Header rendered cleanly above the FlatList
  const renderListHeader = () => (
    <View style={styles.headerContainer}>
      {/* 1. First Row: Brand Wordmark (Left) and Notification + Account Actions (Right) */}
      <View style={styles.brandRow}>
        <View style={styles.brandLeftGroup}>
          <Text style={styles.brandTitle}>Fleet24</Text>
          <View style={styles.brandDot} />
        </View>

        <View style={styles.headerActionsRight}>
          {/* Notification Button */}
          <TouchableOpacity
            style={styles.iconButton}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={20} color={colors.charcoal} />
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
              <Ionicons name="person-outline" size={14} color={colors.primary} />
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
              accessibilityLabel="Cart"
            >
              <Ionicons name="cart-outline" size={20} color={colors.charcoal} />
              {cart && cart.itemCount > 0 ? (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cart.itemCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. Second Row: Delivery Location Selector (Distinct Clickable Row) */}
      <TouchableOpacity
        style={styles.locationSelectorRow}
        onPress={() => setIsAddressModalVisible(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Delivering to ${selectedAddress.addressLine1}`}
      >
        <View style={styles.locationIconContainer}>
          <Ionicons name="location-sharp" size={15} color={colors.primary} />
        </View>
        <View style={styles.locationContentContainer}>
          <Text style={styles.locationSubLabel}>Delivering to</Text>
          <View style={styles.locationAddressRow}>
            <Text style={styles.locationMainText} numberOfLines={1}>
              {selectedAddress.label ? `${selectedAddress.label} • ` : ''}
              {selectedAddress.addressLine1}
            </Text>
            <Ionicons name="chevron-down" size={13} color={colors.charcoal} style={styles.locationChevron} />
          </View>
        </View>
      </TouchableOpacity>

      {/* 3. Main Heading: Clean Typographic Hierarchy, No Random Italics */}
      <View style={styles.mainHeadingContainer}>
        <Text style={styles.mainHeadingTitle}>What's your craving today?</Text>
        <Text style={styles.mainHeadingSubtitle}>
          Order fresh meals prepared hot by neighbourhood kitchens
        </Text>
      </View>

      {/* 4. Search Bar & Dedicated Vertically Aligned Filter Button */}
      <View style={styles.searchRow}>
        <View style={styles.searchBarContainer}>
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.textSecondary}
            style={styles.searchLeftIcon}
          />
          <TextInput
            placeholder="Search dishes, restaurants or cuisines..."
            placeholderTextColor={colors.textMuted}
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
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={[
            styles.filterIconButton,
            selectedFilter === 'open' && styles.filterIconButtonActive,
          ]}
          onPress={() => handleFilterChange(selectedFilter === 'open' ? 'all' : 'open')}
          activeOpacity={0.8}
          accessibilityLabel="Toggle open restaurants filter"
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={selectedFilter === 'open' ? '#FFFFFF' : colors.charcoal}
          />
        </TouchableOpacity>
      </View>

      {/* 5. Horizontal Category Selector: Consistent Chips, Adequate Padding */}
      <View style={styles.categorySection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>Categories</Text>
          <TouchableOpacity onPress={() => handleCategorySelect('all')} activeOpacity={0.7}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

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
                onPress={() => handleCategorySelect(cat.filterKey)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={cat.icon}
                  size={15}
                  color={isSelected ? '#FFFFFF' : colors.primary}
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

      {/* 6. Curated Food Product Cards: Predictable Horizontal Card Composition */}
      {featuredDishes.length > 0 && (
        <View style={styles.featuredDishesSection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionHeaderTitle}>Curated Specials</Text>
              <Text style={styles.sectionHeaderSubtitle}>Chef's top picks from neighbourhood kitchens</Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.foodCardsScroll}
          >
            {featuredDishes.map((dish) => (
              <View key={dish.id} style={styles.foodCard}>
                {/* Left section: Price, kitchen metadata, title, description, predictable CTA */}
                <View style={styles.foodCardLeft}>
                  <View style={styles.cardHeaderMetadata}>
                    <View style={styles.priceContainer}>
                      <Text style={styles.foodPriceText}>₹{dish.price}</Text>
                      {dish.basePrice && parseFloat(dish.basePrice) > parseFloat(dish.price) && (
                        <Text style={styles.foodBasePriceText}>₹{dish.basePrice}</Text>
                      )}
                    </View>
                    <View style={styles.kitchenBadge}>
                      <Text style={styles.kitchenBadgeText} numberOfLines={1}>
                        {dish.outlet.restaurantName}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.foodTitle} numberOfLines={1}>
                    {dish.name}
                  </Text>

                  <Text style={styles.foodDescription} numberOfLines={2}>
                    {dish.description}
                  </Text>

                  <View style={styles.foodCardCtaRow}>
                    <TouchableOpacity
                      style={styles.orderNowBtn}
                      onPress={() => onSelectOutlet(dish.outlet)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.orderNowBtnText}>Order Now</Text>
                      <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Right section: Dedicated fixed-size image container */}
                <View style={styles.foodImageContainer}>
                  {dish.imageUrl ? (
                    <Image
                      source={{ uri: dish.imageUrl }}
                      style={styles.foodImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.foodImagePlaceholder}>
                      <Ionicons name="restaurant-outline" size={28} color={colors.primary} />
                    </View>
                  )}
                  <View style={styles.vegIndicatorPill}>
                    <View
                      style={[
                        styles.vegIndicatorDot,
                        { backgroundColor: dish.isVeg ? colors.veg : colors.nonVeg },
                      ]}
                    />
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 7. Popular Near You Section Header */}
      <View style={styles.popularSectionHeader}>
        <View style={styles.popularTitleCol}>
          <Text style={styles.popularSectionTitle}>Popular Near You</Text>
          <Text style={styles.popularSectionSubtitle}>
            {filteredOutlets.length} {filteredOutlets.length === 1 ? 'kitchen' : 'kitchens'} ready to deliver
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.filterTogglePill,
            selectedFilter === 'open' && styles.filterTogglePillActive,
          ]}
          onPress={() => handleFilterChange(selectedFilter === 'open' ? 'all' : 'open')}
          activeOpacity={0.75}
        >
          <View
            style={[
              styles.filterToggleDot,
              selectedFilter === 'open' && styles.filterToggleDotActive,
            ]}
          />
          <Text
            style={[
              styles.filterToggleText,
              selectedFilter === 'open' && styles.filterToggleTextActive,
            ]}
          >
            {selectedFilter === 'open' ? 'Open Only' : 'All Kitchens'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
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
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomOffset + 24 }]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="restaurant-outline" size={32} color={colors.textSecondary} />
              </View>
              <Text style={styles.emptyTitle}>No matching restaurants</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? `No kitchens found for "${searchQuery}"`
                  : 'Try selecting a different cuisine filter above.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Cart Summary Bar */}
      {onViewCart && <CartSummaryBar onPress={onViewCart} bottomOffset={bottomOffset} />}

      {/* Address Selection Modal */}
      <AddressSelectionModal
        visible={isAddressModalVisible}
        addresses={addresses}
        selectedAddressId={selectedAddress.id}
        onSelectAddress={(addr) => {
          setSelectedAddress(addr);
          setIsAddressModalVisible(false);
        }}
        onAddAddress={handleAddAddress}
        onClose={() => setIsAddressModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingBottom: 90,
  },
  headerContainer: {
    paddingTop: 8,
  },
  cardWrapper: {
    paddingHorizontal: 20,
  },

  // 1. First Row: Brand Wordmark & Account Actions
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  brandLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: -0.5,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  headerActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    position: 'relative',
    shadowColor: colors.charcoal,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  notificationDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.citrusLime,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 5,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  signInButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: colors.accent,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },

  // 2. Second Row: Delivery Location Selector
  locationSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    gap: 10,
  },
  locationIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationContentContainer: {
    flex: 1,
  },
  locationSubLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  locationMainText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.charcoal,
    flexShrink: 1,
    letterSpacing: -0.2,
  },
  locationChevron: {
    marginTop: 1,
  },

  // 3. Main Heading: Clean Typographic Hierarchy
  mainHeadingContainer: {
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 16,
  },
  mainHeadingTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  mainHeadingSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },

  // 4. Search Bar & Dedicated Vertically Aligned Filter Button
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  searchBarContainer: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 14,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  searchLeftIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '500',
    color: colors.charcoal,
    paddingVertical: 0,
  },
  filterIconButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.charcoal,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  filterIconButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  // 5. Category Horizontal Selector
  categorySection: {
    marginBottom: 22,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: -0.3,
  },
  sectionHeaderSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  categoryPillsScroll: {
    paddingHorizontal: 20,
    gap: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  categoryChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipIcon: {
    marginRight: 6,
  },
  categoryChipLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.charcoal,
  },
  categoryChipLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // 6. Curated Food Product Cards
  featuredDishesSection: {
    marginBottom: 24,
  },
  foodCardsScroll: {
    paddingHorizontal: 20,
    gap: 14,
  },
  foodCard: {
    flexDirection: 'row',
    width: 310,
    height: 162,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  foodCardLeft: {
    flex: 1,
    height: '100%',
    justifyContent: 'space-between',
    paddingRight: 12,
  },
  cardHeaderMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  foodPriceText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.charcoal,
  },
  foodBasePriceText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  kitchenBadge: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
    maxWidth: 110,
  },
  kitchenBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  foodTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.charcoal,
    letterSpacing: -0.2,
    marginTop: 2,
  },
  foodDescription: {
    fontSize: 11.5,
    color: colors.textSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
  foodCardCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  orderNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  orderNowBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  foodImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  foodImage: {
    width: '100%',
    height: '100%',
  },
  foodImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  vegIndicatorPill: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  vegIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // 7. Popular Near You Section Header
  popularSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  popularTitleCol: {
    flex: 1,
    paddingRight: 12,
  },
  popularSectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: -0.3,
  },
  popularSectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  filterTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  filterTogglePillActive: {
    backgroundColor: colors.surfaceGreen,
    borderColor: colors.primary,
  },
  filterToggleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
  },
  filterToggleDotActive: {
    backgroundColor: colors.primary,
  },
  filterToggleText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  filterToggleTextActive: {
    color: colors.primary,
  },

  // States
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 80,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.charcoal,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});
