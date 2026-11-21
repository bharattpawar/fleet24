import { appStyles } from '../theme/appStyles';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { colors, spacing } from '../theme/tokens';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../api/client';
import { MenuItemCard, MenuItemData } from '../components/MenuItemCard';
import { HomeImage } from '../components/home/HomeImage';
import { fallbackArt } from '../utils/imageRef';
import { OutletSummary } from '../components/RestaurantCard';
import { CartSummaryBar } from '../components/CartSummaryBar';
import { useCart } from '../context/CartContext';
import { USE_MOCK_DATA, MOCK_MENUS, DEFAULT_MOCK_MENU } from '../api/mockData';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatEta } from '../utils/deliveryEta';

interface RestaurantDetailScreenProps {
  outlet: OutletSummary;
  featuredDishId?: string;
  onBack: () => void;
  onViewCart: () => void;
  onRequireAuth: () => void;
  /** Veg mode from Home: hide non-veg dishes until the customer turns it off. */
  vegOnly?: boolean;
  onToggleVegOnly?: () => void;
}

export const RestaurantDetailScreen: React.FC<RestaurantDetailScreenProps> = ({
  outlet,
  featuredDishId,
  onBack,
  onViewCart,
  vegOnly = false,
  onToggleVegOnly,
}) => {
  const insets = useSafeAreaInsets();
  const { cart, addItem, updateQuantity, removeItem, clearCart } = useCart();
  const [items, setItems] = useState<MenuItemData[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    const fetchMenu = async () => {
      setIsLoading(true);
      setHasError(false);
      if (USE_MOCK_DATA) {
        const mockItems = MOCK_MENUS[outlet.id] || DEFAULT_MOCK_MENU;
        setItems(mockItems);
        const catSet = new Set<string>();
        mockItems.forEach((i) => {
          if (i.categoryName) catSet.add(i.categoryName);
        });
        setCategories(['All', ...Array.from(catSet)]);
        setIsLoading(false);
        return;
      }

      try {
        const data = await apiRequest<MenuItemData[]>(`/public/outlets/${outlet.id}/menu`);
        if (!active) return;
        setItems(data);

        // Extract unique categories
        const catSet = new Set<string>();
        data.forEach((i) => {
          if (i.categoryName) catSet.add(i.categoryName);
        });
        setCategories(['All', ...Array.from(catSet)]);
      } catch {
        if (!active) return;
        setHasError(true);
        setItems([]);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void fetchMenu();
    return () => { active = false; };
  }, [outlet.id, reload]);

  const handleAddItem = async (item: MenuItemData) => {
    const itemDetails = {
      name: item.name,
      unitPrice: parseFloat(item.finalPrice ?? item.effectivePrice),
      imageUrl: item.imageUrl,
      outletName: outlet.outletName,
      restaurantName: outlet.restaurantName,
    };

    try {
      await addItem(outlet.id, item.id, 1, itemDetails);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('another outlet')) {
        Alert.alert(
          'Replace Cart?',
          'Your cart has items from another outlet. Do you want to clear your cart and add this item?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Clear & Add',
              style: 'destructive',
              onPress: async () => {
                await clearCart();
                await addItem(outlet.id, item.id, 1, itemDetails);
              },
            },
          ],
        );
      } else {
        Alert.alert('Unable to add item', msg || 'Please try again.');
      }
    }
  };

  const getQuantityForMenu = (menuItemId: string): number => {
    if (!cart || cart.outletId !== outlet.id) return 0;
    const found = cart.items.find((i) => i.menuItemId === menuItemId);
    return found ? found.quantity : 0;
  };

  const handleIncrement = (menuItemId: string) => {
    if (!cart) return;
    const cartItem = cart.items.find((i) => i.menuItemId === menuItemId);
    if (cartItem) {
      updateQuantity(cartItem.id, cartItem.quantity + 1);
    }
  };

  const handleDecrement = (menuItemId: string) => {
    if (!cart) return;
    const cartItem = cart.items.find((i) => i.menuItemId === menuItemId);
    if (cartItem) {
      if (cartItem.quantity <= 1) {
        removeItem(cartItem.id);
      } else {
        updateQuantity(cartItem.id, cartItem.quantity - 1);
      }
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesCat =
      selectedCategory === 'All' || item.categoryName === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description &&
        item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch && (!vegOnly || item.isVeg);
  });
  const hiddenNonVeg = vegOnly ? items.filter(item => !item.isVeg).length : 0;

  const renderHeader = () => (
    <View style={styles.headerWrapper}>
      {/* Restaurant Hero Card */}
      <View style={styles.heroCard}>
        <View style={styles.imageBox}>
          <HomeImage source={outlet.coverImageUrl || outlet.logoUrl} fallback={fallbackArt(outlet.restaurantName)} alt={`${outlet.restaurantName} food`} />
          <View style={styles.imageGradientOverlay} />

          {/* Floating Status Pill */}
          <View
            style={[
              styles.floatingStatusPill,
              outlet.isAcceptingOrders ? styles.statusOpen : styles.statusClosed,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                outlet.isAcceptingOrders ? styles.dotOpen : styles.dotClosed,
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: outlet.isAcceptingOrders ? colors.primaryDark : colors.error },
              ]}
            >
              {outlet.isAcceptingOrders ? 'Open Now' : 'Closed'}
            </Text>
          </View>


        </View>

        {/* Info Area */}
        <View style={styles.heroInfoContent}>
          <Text style={styles.restaurantName}>{outlet.restaurantName}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.outletAddress} numberOfLines={2}>
              {outlet.outletName} • {outlet.address}
            </Text>
          </View>

          {/* Delivery Details Pills */}
          <View style={styles.metaPillsRow}>
            <View style={styles.metaPill}>
              <Ionicons name="bicycle-outline" size={12} color={colors.primary} />
              <Text style={styles.metaPillText}>Up to {outlet.deliveryRadiusKm} km</Text>
            </View>
            {formatEta(outlet.deliveryEta) && (
              <View style={styles.metaPill}>
                <Ionicons name="time-outline" size={12} color={colors.primary} />
                <Text style={styles.metaPillText}>{formatEta(outlet.deliveryEta)}</Text>
              </View>
            )}
            {typeof outlet.distanceKm === 'number' && <View style={styles.metaPill}><Ionicons name="location-outline" size={12} color={colors.primary} /><Text style={styles.metaPillText}>{outlet.distanceKm.toFixed(1)} km away</Text></View>}
          </View>
        </View>
      </View>

      {/* Menu Search Box */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          placeholder="Search items in this menu..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Category Pills Slider */}
      {categories.length > 1 && (
        <View style={styles.categoryContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categories}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.categoryList}
            renderItem={({ item }) => {
              const isSelected = selectedCategory === item;
              return (
                <TouchableOpacity
                  style={[styles.catChip, isSelected && styles.catChipActive]}
                  onPress={() => setSelectedCategory(item)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.catChipText, isSelected && styles.catChipTextActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {vegOnly && (
        <View style={styles.vegNotice}>
          <Text style={styles.vegNoticeText}>
            Veg mode is on{hiddenNonVeg ? ` · ${hiddenNonVeg} non-veg ${hiddenNonVeg === 1 ? 'dish' : 'dishes'} hidden` : ''}
          </Text>
          {onToggleVegOnly && (
            <TouchableOpacity onPress={onToggleVegOnly} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.vegNoticeAction}>Show all</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Section Headline */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>
          {selectedCategory === 'All' ? 'Explore the menu' : selectedCategory}
        </Text>
        <Text style={styles.sectionCount}>
          {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Top Floating App Bar */}
      <View style={[styles.navBar, { paddingTop: Math.max(insets.top, 14) }]}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.navIconButton}
          accessibilityRole="button"
          accessibilityLabel="Back to restaurants"
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.navBarTitle} numberOfLines={1}>
          {outlet.restaurantName}
        </Text>

        <TouchableOpacity
          onPress={onViewCart}
          style={styles.navIconButton}
          accessibilityRole="button"
          accessibilityLabel="View cart"
          activeOpacity={0.7}
        >
          <Ionicons name="cart-outline" size={20} color={colors.textPrimary} />
          {cart && cart.itemCount > 0 ? (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cart.itemCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      {/* Content List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading delicious menu...</Text>
        </View>
      ) : (
        <FlatList
          data={featuredDishId ? [...filteredItems].sort((a, b) => Number(b.id === featuredDishId) - Number(a.id === featuredDishId)) : filteredItems}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <MenuItemCard
              outletId={outlet.id}
              restaurantName={outlet.restaurantName}
              item={item}
              isOutletOpen={outlet.isAcceptingOrders}
              quantityInCart={getQuantityForMenu(item.id)}
              onAdd={() => handleAddItem(item)}
              onIncrement={() => handleIncrement(item.id)}
              onDecrement={() => handleDecrement(item.id)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="fast-food-outline" size={44} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{hasError ? 'Couldn’t load the menu' : 'No matching dishes'}</Text>
              <Text style={styles.emptySub}>
                {hasError ? 'Please try again in a moment.' : 'Try another dish name or category.'}
              </Text>
              {hasError && <TouchableOpacity accessibilityRole="button" onPress={() => setReload(value => value + 1)} style={styles.catChipActive}><Text style={{ color: '#FFFFFF', padding: 14, fontWeight: '700' }}>Try again</Text></TouchableOpacity>}
            </View>
          }
        />
      )}

      {/* Floating Bottom Cart Bar */}
      <CartSummaryBar onPress={onViewCart} />
    </View>
  );
};

const styles = appStyles({
  vegNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#EAF7EF' },
  vegNoticeText: { flex: 1, color: '#16472A', fontSize: 13, fontWeight: '600' },
  vegNoticeAction: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm + 4,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    zIndex: 10,
  },
  navIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  navBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.accent,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 110,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  headerWrapper: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.charcoal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 16,
  },
  imageBox: {
    width: '100%',
    aspectRatio: 2.1,
    position: 'relative',
    backgroundColor: '#EAE7DD',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  imageGradientOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  floatingStatusPill: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusOpen: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.borderLight,
  },
  statusClosed: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.borderLight,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotOpen: {
    backgroundColor: colors.primary,
  },
  dotClosed: {
    backgroundColor: colors.error,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  floatingRatingPill: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.charcoal,
  },
  ratingCount: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  heroInfoContent: {
    padding: 20,
    backgroundColor: colors.primary,
  },
  restaurantName: {
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  outletAddress: {
    fontSize: 12,
    lineHeight: 18,
    color: '#D9E8DF',
    flex: 1,
  },
  metaPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceGreen,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  metaPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.primary,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: colors.charcoal,
  },
  categoryContainer: {
    marginBottom: 14,
  },
  categoryList: {
    gap: 8,
    paddingVertical: 2,
  },
  catChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  catChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  catChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.charcoal,
  },
  catChipTextActive: {
    color: '#FFFFFF',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: -0.3,
  },
  sectionCount: {
    fontSize: 12.5,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 13.5,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 240,
  },
});
