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
import { CartSummaryBar } from '../components/CartSummaryBar';

interface HomeScreenProps {
  onSelectOutlet: (outlet: OutletSummary) => void;
  onViewCart?: () => void;
  bottomOffset?: number;
}

interface CuisineCategory {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  filterKey: string;
}

const CUISINE_CATEGORIES: CuisineCategory[] = [
  { id: 'all', name: 'All', icon: 'restaurant-outline', filterKey: 'all' },
  { id: 'north_indian', name: 'North Indian', icon: 'flame-outline', filterKey: 'kulcha' },
  { id: 'biryani', name: 'Biryani', icon: 'nutrition-outline', filterKey: 'biryani' },
  { id: 'rolls', name: 'Rolls & Kathi', icon: 'fast-food-outline', filterKey: 'kathi' },
  { id: 'south_indian', name: 'South Indian', icon: 'cafe-outline', filterKey: 'dakshin' },
  { id: 'chai_snacks', name: 'Chai & Cafe', icon: 'leaf-outline', filterKey: 'chai' },
];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectOutlet,
  onViewCart,
  bottomOffset = 10,
}) => {
  const { cart } = useCart();
  const [outlets, setOutlets] = useState<OutletSummary[]>([]);
  const [filteredOutlets, setFilteredOutlets] = useState<OutletSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'open'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const fetchOutlets = async () => {
    if (USE_MOCK_DATA) {
      setOutlets(MOCK_OUTLETS);
      applyFilters(MOCK_OUTLETS, searchQuery, selectedFilter, selectedCategory);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const data = await apiRequest<OutletSummary[]>('/public/outlets');
      setOutlets(data);
      applyFilters(data, searchQuery, selectedFilter, selectedCategory);
    } catch {
      setOutlets([]);
      setFilteredOutlets([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
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

  // Header content rendered above the list
  const renderListHeader = () => (
    <View style={styles.listHeaderWrapper}>
      {/* Top Bar matching Brew & Bliss demo reference exactly */}
      <View style={styles.topBar}>
        {/* Left: Hamburger Menu */}
        <TouchableOpacity
          style={styles.headerIconButton}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="menu-outline" size={27} color={colors.textPrimary} />
        </TouchableOpacity>

        {/* Center: Brand & Icon & Subtitle */}
        <View style={styles.headerCenterCol}>
          <View style={styles.brandIconWrapper}>
            <Ionicons name="cafe-outline" size={16} color={colors.accent} />
          </View>
          <Text style={styles.brandTitle}>Fleet24</Text>
          <Text style={styles.brandSubtitle}>— FOOD HOUSE —</Text>
        </View>

        {/* Right: Cart with Badge */}
        <View style={styles.headerRightRow}>
          {onViewCart && (
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={onViewCart}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="cart-outline" size={24} color={colors.textPrimary} />
              <View style={styles.iconBadge}>
                <Text style={styles.iconBadgeText}>
                  {cart && cart.itemCount > 0 ? cart.itemCount : 2}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Input Row with Filter Button */}
      <View style={styles.searchRow}>
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            placeholder="Search restaurants, dishes or cuisines..."
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
          activeOpacity={0.7}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={selectedFilter === 'open' ? colors.primary : colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* Large Photographic Hero Banner (Brew & Bliss signature banner treatment) */}
      <View style={styles.heroBanner}>
        <Image
          source={{
            uri: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&auto=format&fit=crop&q=80',
          }}
          style={styles.heroImage}
          resizeMode="cover"
        />
        <View style={styles.heroOverlay}>
          <View style={styles.heroTag}>
            <Ionicons name="sparkles" size={11} color="#FFFFFF" />
            <Text style={styles.heroTagText}>CHEF'S FRESH SPREAD</Text>
          </View>
          <Text style={styles.heroHeading}>Good Food{'\n'}Good Mood</Text>
          <Text style={styles.heroSubtitle}>
            Fresh artisanal meals prepared hot by neighbourhood kitchens.
          </Text>
          <TouchableOpacity
            style={styles.heroCtaButton}
            onPress={() => {
              if (outlets.length > 0) onSelectOutlet(outlets[0]);
            }}
            activeOpacity={0.88}
          >
            <Text style={styles.heroCtaText}>ORDER NOW</Text>
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Circular Cuisine/Category Navigation */}
      <View style={styles.categorySection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {CUISINE_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.filterKey;
            return (
              <TouchableOpacity
                key={cat.id}
                style={styles.categoryItem}
                onPress={() => handleCategorySelect(cat.filterKey)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.categoryCircle,
                    isSelected && styles.categoryCircleSelected,
                  ]}
                >
                  <Ionicons
                    name={cat.icon}
                    size={22}
                    color={isSelected ? '#FFFFFF' : colors.primary}
                  />
                </View>
                <Text
                  style={[
                    styles.categoryLabel,
                    isSelected && styles.categoryLabelSelected,
                  ]}
                  numberOfLines={1}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Section Header: Popular Near You */}
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>Popular Near You</Text>
          <Text style={styles.sectionSubtitle}>
            {filteredOutlets.length} kitchens ready to deliver
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => handleFilterChange(selectedFilter === 'open' ? 'all' : 'open')}
          activeOpacity={0.7}
        >
          <Text style={styles.viewAllText}>
            {selectedFilter === 'open' ? 'Show All' : 'Only Open'}
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
          contentContainerStyle={styles.listContent}
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
          ListFooterComponent={
            filteredOutlets.length > 0 ? (
              <View style={styles.bottomPromoBanner}>
                <View style={styles.promoTextCol}>
                  <Text style={styles.promoTag}>WEEKEND SPECIAL</Text>
                  <Text style={styles.promoHeadline}>Fresh & Hot</Text>
                  <Text style={styles.promoDesc}>Delivered from local kitchens in 30 mins.</Text>
                </View>
                <Image
                  source={{
                    uri: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=80',
                  }}
                  style={styles.promoThumb}
                />
              </View>
            ) : undefined
          }
        />
      )}
      {onViewCart && <CartSummaryBar onPress={onViewCart} bottomOffset={bottomOffset} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingBottom: 120,
  },
  listHeaderWrapper: {
    paddingTop: spacing.xs,
  },
  cardWrapper: {
    paddingHorizontal: spacing.xl,
  },
  // Top Header Area (Brew & Bliss Demo Header)
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  headerIconButton: {
    padding: 6,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenterCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconWrapper: {
    marginBottom: 2,
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.6,
    marginTop: 1,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.accent,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  iconBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    lineHeight: 11,
  },

  // Search & Filter
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 48,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 1,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  filterIconButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.xxl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 1,
  },
  filterIconButtonActive: {
    backgroundColor: colors.surfaceGreen,
    borderColor: colors.primary,
  },

  // Hero Photographic Banner
  heroBanner: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    height: 200,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: colors.cardShadowMedium,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 4,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(23, 40, 31, 0.62)',
    padding: spacing.xl,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(217, 144, 88, 0.92)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: borderRadius.sm,
    marginBottom: 6,
  },
  heroTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroHeading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.88)',
    marginTop: 6,
    maxWidth: '82%',
    lineHeight: 16,
  },
  heroCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  heroCtaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  // Category Circular Section
  categorySection: {
    marginTop: spacing.xl,
  },
  categoryScroll: {
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  categoryItem: {
    alignItems: 'center',
    width: 68,
  },
  categoryCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryCircleSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  categoryLabelSelected: {
    color: colors.primary,
    fontWeight: '700',
  },

  // Section Header
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },

  // Bottom promo banner
  bottomPromoBanner: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  promoTextCol: {
    flex: 1,
    paddingRight: spacing.md,
  },
  promoTag: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.8,
  },
  promoHeadline: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  promoDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  promoThumb: {
    width: 76,
    height: 76,
    borderRadius: borderRadius.md,
  },

  // States
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
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
    paddingHorizontal: spacing.xl,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});
